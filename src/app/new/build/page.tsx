"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import ChatPanel from "@/components/ChatPanel";
import { syllabusToMarkdown, markdownToSyllabus } from "@/lib/syllabus-markdown";
import type { Syllabus } from "@/lib/syllabus-markdown";
import { ArrowLeft, Download, Loader2, BookOpen, MessageSquare } from "lucide-react";
import type { MDXEditorMethods } from "@mdxeditor/editor";

// Dynamic import — MDXEditor uses browser APIs, can't SSR
const MarkdownEditor = dynamic(() => import("@/components/MarkdownEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ),
});

type LessonPlan = {
  objectives: string[];
  materialsNeeded: string[];
  lessonOutline: { activity: string; duration: string; description: string }[];
  assessmentHomework: string;
};

function BuildContent() {
  const params = useSearchParams();
  const router = useRouter();
  const editorRef = useRef<MDXEditorMethods>(null);

  // Markdown is the source of truth
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Lesson plan state (kept separate from markdown)
  const [lessonPlans, setLessonPlans] = useState<Record<number, LessonPlan>>({});
  const [generatingWeek, setGeneratingWeek] = useState<number | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  // Keep a ref to the original syllabus JSON for lesson plan generation context
  const syllabusJsonRef = useRef<Syllabus | null>(null);

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
          syllabusJsonRef.current = json;
          setMarkdown(syllabusToMarkdown(json));
        }
      })
      .catch(() => setError("Something went wrong. Please try again."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When the AI chatbot updates markdown, push it into the editor
  function handleChatMarkdownUpdate(newMd: string) {
    setMarkdown(newMd);
    editorRef.current?.setMarkdown(newMd);
  }

  // ── Lesson plan generation ─────────────────────────────────────────────────
  // Uses markdownToSyllabus to get current schedule for context

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
    if (!markdown) return;
    const plan = lessonPlans[weekNum];
    if (!plan) return;
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

  // Parse current markdown for lesson plan toolbar buttons
  const currentSyllabus = markdownToSyllabus(markdown);
  const hasLessonPlans = Object.keys(lessonPlans).length > 0;

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="print:hidden shrink-0 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {/* Lesson plan generation dropdown */}
          {currentSyllabus.weeklySchedule.length > 0 && (
            <LessonPlanMenu
              weeks={currentSyllabus.weeklySchedule}
              lessonPlans={lessonPlans}
              generatingWeek={generatingWeek}
              onGenerate={generateLessonPlan}
              onDownload={downloadLessonPlanPDF}
            />
          )}
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

      {/* Main content: editor + chat panel */}
      <div className="flex flex-1 min-h-0">
        {/* Editor panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto py-6">
            <MarkdownEditor
              ref={editorRef}
              markdown={markdown}
              onChange={setMarkdown}
            />
          </div>
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

// ── Lesson Plan Dropdown ───────────────────────────────────────────────────────

function LessonPlanMenu({
  weeks,
  lessonPlans,
  generatingWeek,
  onGenerate,
  onDownload,
}: {
  weeks: { week: number; topic: string }[];
  lessonPlans: Record<number, LessonPlan>;
  generatingWeek: number | null;
  onGenerate: (weekNum: number) => void;
  onDownload: (weekNum: number) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)} className="gap-1.5">
        <BookOpen className="h-4 w-4" />
        Lesson Plans
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {weeks.map((w) => {
              const hasPlan = !!lessonPlans[w.week];
              const isGenerating = generatingWeek === w.week;
              return (
                <div
                  key={w.week}
                  className="flex items-center justify-between px-3 py-2 text-sm border-b border-border last:border-0 hover:bg-muted/50"
                >
                  <span className="truncate mr-2">
                    <span className="text-muted-foreground">W{w.week}:</span> {w.topic || "—"}
                  </span>
                  {hasPlan ? (
                    <button
                      onClick={() => { onDownload(w.week); setOpen(false); }}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  ) : (
                    <button
                      onClick={() => onGenerate(w.week)}
                      disabled={generatingWeek !== null}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0 flex items-center gap-1 disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                      ) : (
                        "Generate"
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
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
