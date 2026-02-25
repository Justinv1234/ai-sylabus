"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/ChatPanel";
import { syllabusToMarkdown, markdownToSyllabus } from "@/lib/syllabus-markdown";
import type { Syllabus, Policies } from "@/lib/syllabus-markdown";
import {
  ArrowLeft, Download, Loader2, BookOpen, MessageSquare,
  Eye, Pencil, ChevronDown, ChevronRight,
} from "lucide-react";

type LessonPlan = {
  objectives: string[];
  materialsNeeded: string[];
  lessonOutline: { activity: string; duration: string; description: string }[];
  assessmentHomework: string;
};

function BuildContent() {
  const params = useSearchParams();
  const router = useRouter();

  // Markdown is the source of truth
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [mode, setMode] = useState<"preview" | "edit">("preview");

  // Lesson plan state
  const [lessonPlans, setLessonPlans] = useState<Record<number, LessonPlan>>({});
  const [generatingWeek, setGeneratingWeek] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadingLessonWeek, setDownloadingLessonWeek] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/generate-syllabus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: params.get("topic"),
        audience: params.get("audience"),
        duration: params.get("duration"),
        frequency: params.get("frequency"),
        goal: params.get("goal"),
        teaching: params.get("teaching"),
        assessment: params.get("assessment"),
        courseCode: params.get("courseCode") || undefined,
        prerequisites: params.get("prerequisites") || undefined,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          document.title = json.courseTitle || "Course Syllabus";
          setMarkdown(syllabusToMarkdown(json));
        }
      })
      .catch(() => setError("Something went wrong. Please try again."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleChatMarkdownUpdate(newMd: string) {
    setMarkdown(newMd);
  }

  // ── Lesson plan generation ─────────────────────────────────────────────────

  async function generateLessonPlan(weekNum: number) {
    if (!markdown || generatingWeek !== null) return;
    setGeneratingWeek(weekNum);
    try {
      const syllabus = markdownToSyllabus(markdown);
      const week = syllabus.weeklySchedule.find((w) => w.week === weekNum);
      if (!week) return;

      const res = await fetch("/api/generate-lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: syllabus.courseTitle,
          weekNumber: week.week,
          topic: week.topic,
          subtopics: week.subtopics,
          assignments: week.assignments,
          audience: params.get("audience") || "undergraduate",
          teaching: params.get("teaching") || "mixed",
        }),
      });
      const json = await res.json();
      if (!json.error) {
        setLessonPlans((prev) => ({ ...prev, [weekNum]: json }));
        setExpandedWeeks((prev) => ({ ...prev, [weekNum]: true }));
      }
    } catch (e) {
      console.error("Lesson plan generation failed:", e);
    } finally {
      setGeneratingWeek(null);
    }
  }

  // ── PDF downloads ──────────────────────────────────────────────────────────

  async function downloadPDF() {
    if (!markdown || isDownloading) return;
    setIsDownloading(true);
    try {
      const syllabus = markdownToSyllabus(markdown);
      const [{ pdf }, { SyllabusPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/SyllabusPDF"),
      ]);
      const blob = await pdf(<SyllabusPDF data={syllabus} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${syllabus.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
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

  async function downloadLessonPlanPDF(weekNum: number) {
    if (!markdown || downloadingLessonWeek !== null) return;
    const plan = lessonPlans[weekNum];
    if (!plan) return;
    setDownloadingLessonWeek(weekNum);
    try {
      const syllabus = markdownToSyllabus(markdown);
      const weekItem = syllabus.weeklySchedule.find((w) => w.week === weekNum);
      const [{ pdf }, { LessonPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/LessonPlanPDF"),
      ]);
      const blob = await pdf(
        <LessonPlanPDF
          data={{
            courseTitle: syllabus.courseTitle,
            weekNumber: weekNum,
            topic: weekItem?.topic || "",
            ...plan,
          }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${syllabus.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()} - Week ${weekNum} Lesson Plan.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lesson plan PDF failed:", e);
    } finally {
      setDownloadingLessonWeek(null);
    }
  }

  async function downloadAllLessonPlans() {
    if (!markdown || isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      const syllabus = markdownToSyllabus(markdown);
      const [{ pdf }, { LessonPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/LessonPlanPDF"),
      ]);
      for (const weekNum of Object.keys(lessonPlans).map(Number).sort((a, b) => a - b)) {
        const plan = lessonPlans[weekNum];
        const weekItem = syllabus.weeklySchedule.find((w) => w.week === weekNum);
        const blob = await pdf(
          <LessonPlanPDF
            data={{
              courseTitle: syllabus.courseTitle,
              weekNumber: weekNum,
              topic: weekItem?.topic || "",
              ...plan,
            }}
          />
        ).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${syllabus.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()} - Week ${weekNum} Lesson Plan.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error("Download all lesson plans failed:", e);
    } finally {
      setIsDownloadingAll(false);
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive font-medium">{error}</p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Go back
          </Button>
        </div>
      </main>
    );
  }

  if (!markdown) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Generating your syllabus...</p>
        <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
      </main>
    );
  }

  const currentSyllabus = markdownToSyllabus(markdown);
  const hasLessonPlans = Object.keys(lessonPlans).length > 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="print:hidden shrink-0 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Mode toggle */}
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === "edit"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>

        <div className="flex items-center gap-2">
          {hasLessonPlans && (
            <Button size="sm" variant="outline" onClick={downloadAllLessonPlans} disabled={isDownloadingAll} className="gap-1.5">
              {isDownloadingAll ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Downloading...</>
              ) : (
                <><BookOpen className="h-4 w-4" /> All Lesson Plans</>
              )}
            </Button>
          )}
          <Button size="sm" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
            {isDownloading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="h-4 w-4" /> Download PDF</>
            )}
          </Button>
          <Button
            size="sm"
            variant={chatOpen ? "default" : "outline"}
            onClick={() => setChatOpen((o) => !o)}
            className="gap-1.5"
          >
            <MessageSquare className="h-4 w-4" />
            AI Assistant
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Editor / Preview panel */}
        <div className="flex-1 overflow-y-auto">
          {mode === "edit" ? (
            <div className="max-w-4xl mx-auto py-6 px-6">
              <textarea
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                spellCheck={false}
                className="w-full h-[calc(100vh-8rem)] font-mono text-sm leading-relaxed bg-background text-foreground border border-border rounded-lg p-4 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ) : (
            <SyllabusPreview
              data={currentSyllabus}
              lessonPlans={lessonPlans}
              expandedWeeks={expandedWeeks}
              generatingWeek={generatingWeek}
              downloadingLessonWeek={downloadingLessonWeek}
              onToggleWeek={(weekNum) =>
                setExpandedWeeks((prev) => ({ ...prev, [weekNum]: !prev[weekNum] }))
              }
              onGenerateLessonPlan={generateLessonPlan}
              onDownloadLessonPlan={downloadLessonPlanPDF}
            />
          )}
        </div>

        {/* Chat panel */}
        <ChatPanel
          markdown={markdown}
          onMarkdownUpdate={handleChatMarkdownUpdate}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  );
}

// ── Styled Preview with inline lesson plans ───────────────────────────────────

function SyllabusPreview({
  data,
  lessonPlans,
  expandedWeeks,
  generatingWeek,
  downloadingLessonWeek,
  onToggleWeek,
  onGenerateLessonPlan,
  onDownloadLessonPlan,
}: {
  data: Syllabus;
  lessonPlans: Record<number, LessonPlan>;
  expandedWeeks: Record<number, boolean>;
  generatingWeek: number | null;
  downloadingLessonWeek: number | null;
  onToggleWeek: (weekNum: number) => void;
  onGenerateLessonPlan: (weekNum: number) => void;
  onDownloadLessonPlan: (weekNum: number) => void;
}) {
  return (
    <div className="max-w-3xl mx-auto px-8 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-1 pb-6 border-b-2 border-foreground">
        <h1 className="text-3xl font-bold text-foreground">{data.courseTitle}</h1>
        {data.courseCode && (
          <p className="text-muted-foreground">{data.courseCode}</p>
        )}
      </div>

      {/* Course Description */}
      <Section title="Course Description">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{data.courseDescription}</p>
      </Section>

      {/* Prerequisites */}
      {data.prerequisites && (
        <Section title="Prerequisites">
          <p className="text-sm">{data.prerequisites}</p>
        </Section>
      )}

      {/* Learning Objectives */}
      <Section title="Learning Objectives">
        <p className="text-sm text-muted-foreground mb-2">By the end of this course, students will be able to:</p>
        <ul className="space-y-1.5">
          {data.learningObjectives.map((obj, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="text-muted-foreground shrink-0 text-sm mt-0.5">&bull;</span>
              <span className="text-sm">{obj}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Required Materials */}
      {data.requiredMaterials.length > 0 && (
        <Section title="Required Materials">
          <ul className="space-y-1.5">
            {data.requiredMaterials.map((m, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-muted-foreground shrink-0 text-sm mt-0.5">&bull;</span>
                <span className="text-sm">{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Grading Breakdown */}
      <Section title="Grading Breakdown">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 pr-4 font-medium text-muted-foreground w-1/4">Component</th>
              <th className="text-left pb-2 pr-4 font-medium text-muted-foreground w-16">Weight</th>
              <th className="text-left pb-2 font-medium text-muted-foreground">Description</th>
            </tr>
          </thead>
          <tbody>
            {data.gradingBreakdown.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-4 font-medium">{row.component}</td>
                <td className="py-1.5 pr-4">{row.weight}</td>
                <td className="py-1.5 text-muted-foreground">{row.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Weekly Schedule with inline lesson plans */}
      <Section title="Course Schedule">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left pb-2 pr-3 font-medium text-muted-foreground w-14">Week</th>
              <th className="text-left pb-2 pr-3 font-medium text-muted-foreground w-1/3">Topic</th>
              <th className="text-left pb-2 font-medium text-muted-foreground">Subtopics &amp; Assignments</th>
            </tr>
          </thead>
          <tbody>
            {data.weeklySchedule.map((row, i) => {
              const plan = lessonPlans[row.week];
              const isExpanded = expandedWeeks[row.week] ?? false;
              const isGenerating = generatingWeek === row.week;

              return (
                <tr key={i} className="border-b border-border last:border-0 align-top">
                  <td colSpan={3} className="p-0">
                    <div className="flex items-start">
                      <div className="py-2 pr-3 text-muted-foreground w-14 shrink-0">{row.week}</div>
                      <div className="py-2 pr-3 w-1/3 shrink-0 font-medium">{row.topic}</div>
                      <div className="py-2 flex-1 min-w-0">
                        {row.subtopics.length > 0 && (
                          <span>{row.subtopics.join(", ")}</span>
                        )}
                        {row.assignments && (
                          <p className="text-muted-foreground text-xs italic mt-0.5">{row.assignments}</p>
                        )}
                        {/* Lesson plan controls */}
                        <div className="print:hidden mt-1.5 flex items-center gap-2">
                          {!plan && (
                            <button
                              onClick={() => onGenerateLessonPlan(row.week)}
                              disabled={generatingWeek !== null}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                            >
                              {isGenerating ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Generating lesson plan...</>
                              ) : (
                                <><BookOpen className="h-3 w-3" /> Generate Lesson Plan</>
                              )}
                            </button>
                          )}
                          {plan && (
                            <>
                              <button
                                onClick={() => onToggleWeek(row.week)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                Lesson Plan
                              </button>
                              <button
                                onClick={() => onDownloadLessonPlan(row.week)}
                                disabled={downloadingLessonWeek !== null}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                              >
                                {downloadingLessonWeek === row.week ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                                PDF
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded lesson plan detail */}
                    {plan && isExpanded && (
                      <div className="ml-14 mr-6 mb-3 mt-1 p-4 rounded-lg bg-muted/50 border border-border space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Objectives</p>
                          <ul className="space-y-0.5">
                            {plan.objectives.map((obj, j) => (
                              <li key={j} className="flex gap-1.5 text-muted-foreground">
                                <span className="shrink-0">&bull;</span>
                                <span>{obj}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Materials Needed</p>
                          <ul className="space-y-0.5">
                            {plan.materialsNeeded.map((m, j) => (
                              <li key={j} className="flex gap-1.5 text-muted-foreground">
                                <span className="shrink-0">&bull;</span>
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Lesson Outline</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left pb-1 pr-2 font-medium text-muted-foreground">Activity</th>
                                <th className="text-left pb-1 pr-2 font-medium text-muted-foreground w-20">Duration</th>
                                <th className="text-left pb-1 font-medium text-muted-foreground">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {plan.lessonOutline.map((step, j) => (
                                <tr key={j} className="border-b border-border/50 last:border-0">
                                  <td className="py-1 pr-2 font-medium text-foreground">{step.activity}</td>
                                  <td className="py-1 pr-2 text-muted-foreground">{step.duration}</td>
                                  <td className="py-1 text-muted-foreground">{step.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Assessment &amp; Homework</p>
                          <p className="text-muted-foreground">{plan.assessmentHomework}</p>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>

      {/* Policies */}
      <Section title="Course Policies">
        <div className="space-y-4">
          {(
            [
              { label: "Attendance", key: "attendance" },
              { label: "Late Work", key: "lateWork" },
              { label: "Academic Integrity", key: "academicIntegrity" },
            ] as { label: string; key: keyof Policies }[]
          ).map(({ label, key }) => (
            <div key={key}>
              <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.policies[key]}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold text-foreground uppercase tracking-wide border-b border-border pb-1">
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </main>
      }
    >
      <BuildContent />
    </Suspense>
  );
}
