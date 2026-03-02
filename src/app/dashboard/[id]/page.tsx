"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, ClipboardCheck, PenLine, CalendarDays, BookOpen, Pencil, MessageCircle, Send, Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSyllabusById, getCourseContent } from "@/lib/storage";
import type { SavedSyllabus, CourseContent } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

const FEATURES = [
  { title: "Quiz / Test Generator", description: "Generate quizzes and tests aligned to your syllabus objectives.", href: "quiz", icon: ClipboardCheck },
  { title: "Assignment Generator", description: "Create homework assignments for any week of your course.", href: "homework", icon: PenLine },
  { title: "Week Planner", description: "Plan each week's class meetings with activities, timing, and optional slide outlines.", href: "slides", icon: CalendarDays },
  { title: "Study Guide", description: "Create student-facing study guides for exams.", href: "study-guide", icon: BookOpen },
];

export default function SyllabusDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [saved, setSaved] = useState<SavedSyllabus | null>(null);
  const [content, setContent] = useState<CourseContent>({ homework: {}, weekPlans: {}, quizzes: {} });
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSaved(getSyllabusById(id));
    setContent(getCourseContent(id));
    setMounted(true);
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  async function downloadPDF() {
    if (!saved || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ pdf }, { SyllabusPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/SyllabusPDF"),
      ]);
      const blob = await pdf(<SyllabusPDF data={saved.syllabus} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${saved.syllabus.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      setIsDownloading(false);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading || !saved) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabus: {
            courseTitle: saved.syllabus.courseTitle,
            courseCode: saved.syllabus.courseCode,
            weeklySchedule: saved.syllabus.weeklySchedule.map((w) => ({ week: w.week, topic: w.topic, subtopics: w.subtopics })),
            learningObjectives: saved.syllabus.learningObjectives,
          },
          content: {
            homeworkWeeks: Object.keys(content.homework).map(Number),
            weekPlanWeeks: Object.keys(content.weekPlans).map(Number),
          },
          message: userMsg,
          history: chatMessages.slice(-8),
        }),
      });
      const json = await res.json();
      if (json.error) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
        if (json.navigate) {
          setTimeout(() => router.push(`/dashboard/${id}/${json.navigate}`), 1500);
        }
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (!mounted) return null;

  if (!saved) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Syllabus not found.</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  const { syllabus } = saved;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Button>
        <Button size="sm" variant="outline" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
          {isDownloading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
          ) : (
            <><Download className="h-4 w-4" /> Download PDF</>
          )}
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Course info */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{syllabus.courseTitle}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {syllabus.courseCode && <Badge variant="outline">{syllabus.courseCode}</Badge>}
            <span>{syllabus.weeklySchedule.length} weeks</span>
            {saved.wizardParams?.audience && (
              <span className="capitalize">· {saved.wizardParams.audience}</span>
            )}
            {saved.wizardParams?.frequency && (
              <span>· {saved.wizardParams.frequency}/week</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mt-2">
            {syllabus.courseDescription}
          </p>
        </div>

        {/* Feature cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Course Materials</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <Link key={f.href} href={`/dashboard/${id}/${f.href}`}>
                <Card className="h-full hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
                  <CardHeader>
                    <div className="inline-flex items-center justify-center rounded-xl bg-muted p-3 mb-2 w-fit">
                      <f.icon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-base">{f.title}</CardTitle>
                    <CardDescription>{f.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Syllabus preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Syllabus Preview</h2>
            <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/${id}/edit`)} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit Syllabus
            </Button>
          </div>
          <div className="border border-border rounded-xl p-6 space-y-6 text-sm">

            {/* Objectives */}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Learning Objectives</h3>
              <p className="text-muted-foreground text-xs mb-1.5">By the end of this course, students will be able to:</p>
              <ul className="space-y-1">
                {syllabus.learningObjectives.map((obj, i) => (
                  <li key={i} className="flex gap-2 text-muted-foreground">
                    <span className="shrink-0">•</span>
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Grading */}
            <div>
              <h3 className="font-semibold text-foreground mb-2">Grading Breakdown</h3>
              <div className="space-y-1">
                {syllabus.gradingBreakdown.map((row, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{row.component}</span>
                    <span className="font-medium text-foreground">{row.weight}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Course Overview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Course Overview</h2>
          <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
            {syllabus.weeklySchedule.map((week) => {
              const hw = content.homework[week.week];
              const wp = content.weekPlans[week.week];
              const weekQuizzes = Object.values(content.quizzes).filter((q) => q.weekEnd === week.week);
              const hasContent = !!hw || !!wp || weekQuizzes.length > 0;
              const slideCount = wp?.meetings.filter((m) => m.slides).length ?? 0;

              return (
                <div key={week.week} className={`px-5 py-3.5 ${hasContent ? "" : "opacity-50"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground shrink-0">Week {week.week}</span>
                        <span className="text-sm text-foreground truncate">{week.topic}</span>
                      </div>
                      {hasContent && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {hw && (
                            <Link href={`/dashboard/${id}/homework?week=${week.week}`}>
                              <Badge variant="outline" className="text-[10px] hover:bg-muted cursor-pointer gap-1">
                                <PenLine className="h-2.5 w-2.5" />
                                {hw.format === "problem-set" ? "Problem Set" : hw.format === "multiple-choice" ? "Multiple Choice" : hw.format === "short-response" ? "Short Response" : hw.format === "essay" ? "Essay" : hw.format === "case-study" ? "Case Study" : hw.format === "project" ? "Project" : hw.format === "lab-report" ? "Lab Report" : hw.format === "coding" ? "Coding" : hw.format === "research" ? "Research" : hw.format}
                              </Badge>
                            </Link>
                          )}
                          {wp && (
                            <Link href={`/dashboard/${id}/slides?week=${week.week}`}>
                              <Badge variant="outline" className="text-[10px] hover:bg-muted cursor-pointer gap-1">
                                <CalendarDays className="h-2.5 w-2.5" />
                                {wp.meetings.length} meeting{wp.meetings.length > 1 ? "s" : ""}
                                {slideCount > 0 && ` + ${slideCount} slide${slideCount > 1 ? "s" : ""}`}
                              </Badge>
                            </Link>
                          )}
                          {weekQuizzes.map((q) => (
                            <Link key={q.id} href={`/dashboard/${id}/quiz`}>
                              <Badge variant="outline" className="text-[10px] hover:bg-muted cursor-pointer gap-1">
                                <ClipboardCheck className="h-2.5 w-2.5" />
                                {q.title}
                                <span className="text-muted-foreground font-normal">
                                  · {q.questions.length}q
                                </span>
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <div className="print:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="w-80 flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden" style={{ height: "480px" }}>
            <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-semibold">Course Assistant</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="hover:opacity-70 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {chatMessages.length === 0 && (
                <div className="text-center text-muted-foreground mt-8 space-y-2">
                  <Bot className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-xs font-medium">How can I help you?</p>
                  <p className="text-xs opacity-60 leading-relaxed">
                    e.g. &quot;Generate slides for week 1&quot; or &quot;What topics do I cover?&quot;
                  </p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-border p-3 flex gap-2 shrink-0">
              <textarea
                value={chatInput}
                rows={1}
                onChange={(e) => { setChatInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px"; }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                placeholder="Ask anything... (Enter to send)"
                className="flex-1 resize-none bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring leading-normal overflow-hidden"
                style={{ maxHeight: "80px" }}
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="shrink-0 w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-80 disabled:opacity-30 transition-opacity self-end"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setChatOpen((o) => !o)}
          className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity"
        >
          {chatOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        </button>
      </div>
    </main>
  );
}
