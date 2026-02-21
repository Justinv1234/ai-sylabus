"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, X, Plus, BookOpen, ChevronDown, ChevronRight } from "lucide-react";

type GradingItem = { component: string; weight: string; description: string };
type WeekItem = { week: number; topic: string; subtopics: string[]; assignments: string };
type Policies = { attendance: string; lateWork: string; academicIntegrity: string };
type Syllabus = {
  courseTitle: string;
  courseCode?: string;
  courseDescription: string;
  learningObjectives: string[];
  prerequisites?: string;
  requiredMaterials: string[];
  gradingBreakdown: GradingItem[];
  weeklySchedule: WeekItem[];
  policies: Policies;
};

type LessonPlan = {
  objectives: string[];
  materialsNeeded: string[];
  lessonOutline: { activity: string; duration: string; description: string }[];
  assessmentHomework: string;
};

// Shared class for inline editable inputs / textareas
const inputCls = "bg-transparent focus:outline-none focus:bg-muted rounded px-1 w-full";

// Auto-resize textarea handler — call from onChange and onFocus
function autoResize(e: React.ChangeEvent<HTMLTextAreaElement> | React.FocusEvent<HTMLTextAreaElement>) {
  e.target.style.height = "auto";
  e.target.style.height = e.target.scrollHeight + "px";
}

function BuildContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<Syllabus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Lesson plan state
  const [lessonPlans, setLessonPlans] = useState<Record<number, LessonPlan>>({});
  const [generatingWeek, setGeneratingWeek] = useState<number | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});
  const [downloadingLessonWeek, setDownloadingLessonWeek] = useState<number | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

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
        if (json.error) setError(json.error);
        else {
          document.title = json.courseTitle || "Course Syllabus";
          setData(json);
        }
      })
      .catch(() => setError("Something went wrong. Please try again."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── List helpers ──────────────────────────────────────────────────────────

  function setObjectives(fn: (prev: string[]) => string[]) {
    setData((d) => d ? { ...d, learningObjectives: fn(d.learningObjectives) } : d);
  }
  function setMaterials(fn: (prev: string[]) => string[]) {
    setData((d) => d ? { ...d, requiredMaterials: fn(d.requiredMaterials) } : d);
  }
  function setGrading(fn: (prev: GradingItem[]) => GradingItem[]) {
    setData((d) => d ? { ...d, gradingBreakdown: fn(d.gradingBreakdown) } : d);
  }
  function setSchedule(fn: (prev: WeekItem[]) => WeekItem[]) {
    setData((d) => d ? { ...d, weeklySchedule: fn(d.weeklySchedule) } : d);
  }

  // ── Lesson plan generation ─────────────────────────────────────────────

  async function generateLessonPlan(week: WeekItem) {
    if (!data || generatingWeek !== null) return;
    setGeneratingWeek(week.week);
    try {
      const res = await fetch("/api/generate-lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: data.courseTitle,
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
        setLessonPlans((prev) => ({ ...prev, [week.week]: json }));
        setExpandedWeeks((prev) => ({ ...prev, [week.week]: true }));
      }
    } catch (e) {
      console.error("Lesson plan generation failed:", e);
    } finally {
      setGeneratingWeek(null);
    }
  }

  // ── PDF downloads ──────────────────────────────────────────────────────

  async function downloadPDF() {
    if (!data || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ pdf }, { SyllabusPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/SyllabusPDF"),
      ]);
      const blob = await pdf(<SyllabusPDF data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
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
    if (!data || downloadingLessonWeek !== null) return;
    const plan = lessonPlans[weekNum];
    if (!plan) return;
    setDownloadingLessonWeek(weekNum);
    try {
      const weekItem = data.weeklySchedule.find((w) => w.week === weekNum);
      const [{ pdf }, { LessonPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/LessonPlanPDF"),
      ]);
      const blob = await pdf(
        <LessonPlanPDF
          data={{
            courseTitle: data.courseTitle,
            weekNumber: weekNum,
            topic: weekItem?.topic || "",
            ...plan,
          }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()} - Week ${weekNum} Lesson Plan.pdf`;
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
    if (!data || isDownloadingAll) return;
    setIsDownloadingAll(true);
    try {
      const [{ pdf }, { LessonPlanPDF }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/LessonPlanPDF"),
      ]);
      for (const weekNum of Object.keys(lessonPlans).map(Number).sort((a, b) => a - b)) {
        const plan = lessonPlans[weekNum];
        const weekItem = data.weeklySchedule.find((w) => w.week === weekNum);
        const blob = await pdf(
          <LessonPlanPDF
            data={{
              courseTitle: data.courseTitle,
              weekNumber: weekNum,
              topic: weekItem?.topic || "",
              ...plan,
            }}
          />
        ).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.courseTitle.replace(/[^a-z0-9\s]/gi, "").trim()} - Week ${weekNum} Lesson Plan.pdf`;
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

  // ── States ────────────────────────────────────────────────────────────────

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

  if (!data) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Generating your syllabus...</p>
        <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
      </main>
    );
  }

  const hasLessonPlans = Object.keys(lessonPlans).length > 0;

  return (
    <>
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="text-xs text-muted-foreground">Click any text to edit</p>
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
        </div>
      </div>

      {/* Syllabus document */}
      <div className="syllabus-doc max-w-3xl mx-auto px-8 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-1 pb-6 border-b-2 border-foreground">
          <h1
            contentEditable
            suppressContentEditableWarning
            className="text-3xl font-bold text-foreground focus:outline-none focus:bg-muted rounded px-1"
          >
            {data.courseTitle}
          </h1>
          {data.courseCode && (
            <p
              contentEditable
              suppressContentEditableWarning
              className="text-muted-foreground focus:outline-none focus:bg-muted rounded px-1"
            >
              {data.courseCode}
            </p>
          )}
        </div>

        {/* Course Description */}
        <Section title="Course Description">
          <p
            contentEditable
            suppressContentEditableWarning
            className="text-sm leading-relaxed whitespace-pre-wrap focus:outline-none focus:bg-muted rounded px-1"
          >
            {data.courseDescription}
          </p>
        </Section>

        {/* Prerequisites — only if professor provided */}
        {data.prerequisites && (
          <Section title="Prerequisites">
            <p
              contentEditable
              suppressContentEditableWarning
              className="text-sm focus:outline-none focus:bg-muted rounded px-1"
            >
              {data.prerequisites}
            </p>
          </Section>
        )}

        {/* Learning Objectives */}
        <Section title="Learning Objectives">
          <p className="text-sm text-muted-foreground mb-2">By the end of this course, students will be able to:</p>
          <ul className="space-y-1.5">
            {data.learningObjectives.map((obj, i) => (
              <li key={i} className="group flex gap-2 items-start">
                <span className="text-muted-foreground shrink-0 text-sm mt-0.5">•</span>
                <textarea
                  value={obj}
                  rows={1}
                  onChange={(e) => {
                    setObjectives((prev) => {
                      const a = [...prev]; a[i] = e.target.value; return a;
                    });
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  onFocus={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  className={`${inputCls} text-sm resize-none overflow-hidden leading-normal`}
                  placeholder="Add objective..."
                />
                <button
                  onClick={() => setObjectives((prev) => prev.filter((_, idx) => idx !== i))}
                  className="print:hidden opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setObjectives((prev) => [...prev, ""])}
            className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add objective
          </button>
        </Section>

        {/* Required Materials */}
        <Section title="Required Materials">
          <ul className="space-y-1.5">
            {data.requiredMaterials.map((m, i) => (
              <li key={i} className="group flex gap-2 items-start">
                <span className="text-muted-foreground shrink-0 text-sm mt-0.5">•</span>
                <textarea
                  value={m}
                  rows={1}
                  onChange={(e) => {
                    setMaterials((prev) => {
                      const a = [...prev]; a[i] = e.target.value; return a;
                    });
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  onFocus={(e) => {
                    e.target.style.height = "auto";
                    e.target.style.height = e.target.scrollHeight + "px";
                  }}
                  className={`${inputCls} text-sm resize-none overflow-hidden leading-normal`}
                  placeholder="Add material..."
                />
                <button
                  onClick={() => setMaterials((prev) => prev.filter((_, idx) => idx !== i))}
                  className="print:hidden opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setMaterials((prev) => [...prev, ""])}
            className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add material
          </button>
        </Section>

        {/* Grading Breakdown */}
        <Section title="Grading Breakdown">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 pr-4 font-medium text-muted-foreground w-1/4">Component</th>
                <th className="text-left pb-2 pr-4 font-medium text-muted-foreground w-16">Weight</th>
                <th className="text-left pb-2 font-medium text-muted-foreground">Description</th>
                <th className="print:hidden w-6" />
              </tr>
            </thead>
            <tbody>
              {data.gradingBreakdown.map((row, i) => (
                <tr key={i} className="group border-b border-border last:border-0">
                  <td className="py-1.5 pr-4 align-top">
                    <textarea
                      value={row.component}
                      rows={1}
                      onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], component: e.target.value }; return a; }); autoResize(e); }}
                      onFocus={autoResize}
                      className={`${inputCls} font-medium resize-none overflow-hidden leading-normal`}
                      placeholder="Component"
                    />
                  </td>
                  <td className="py-1.5 pr-4 align-top">
                    <textarea
                      value={row.weight}
                      rows={1}
                      onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], weight: e.target.value }; return a; }); autoResize(e); }}
                      onFocus={autoResize}
                      className={`${inputCls} resize-none overflow-hidden leading-normal`}
                      placeholder="0%"
                    />
                  </td>
                  <td className="py-1.5 align-top">
                    <textarea
                      value={row.description}
                      rows={1}
                      onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], description: e.target.value }; return a; }); autoResize(e); }}
                      onFocus={autoResize}
                      className={`${inputCls} text-muted-foreground resize-none overflow-hidden leading-normal`}
                      placeholder="Description"
                    />
                  </td>
                  <td className="print:hidden py-1.5 pl-2">
                    <button
                      onClick={() => setGrading((prev) => prev.filter((_, idx) => idx !== i))}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => setGrading((prev) => [...prev, { component: "", weight: "", description: "" }])}
            className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add row
          </button>
        </Section>

        {/* Weekly Schedule */}
        <Section title="Course Schedule">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left pb-2 pr-3 font-medium text-muted-foreground w-14">Week</th>
                <th className="text-left pb-2 pr-3 font-medium text-muted-foreground w-1/3">Topic</th>
                <th className="text-left pb-2 font-medium text-muted-foreground">Subtopics &amp; Assignments</th>
                <th className="print:hidden w-6" />
              </tr>
            </thead>
            <tbody>
              {data.weeklySchedule.map((row, i) => {
                const plan = lessonPlans[row.week];
                const isExpanded = expandedWeeks[row.week] ?? false;
                const isGenerating = generatingWeek === row.week;

                return (
                  <tr key={i} className="group border-b border-border last:border-0 align-top">
                    <td colSpan={4} className="p-0">
                      {/* Week row */}
                      <div className="flex items-start">
                        <div className="py-2 pr-3 text-muted-foreground w-14 shrink-0">{row.week}</div>
                        <div className="py-2 pr-3 w-1/3 shrink-0">
                          <textarea
                            value={row.topic}
                            rows={1}
                            onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], topic: e.target.value }; return a; }); autoResize(e); }}
                            onFocus={autoResize}
                            className={`${inputCls} font-medium resize-none overflow-hidden leading-normal`}
                            placeholder="Topic"
                          />
                        </div>
                        <div className="py-2 flex-1 min-w-0">
                          <textarea
                            value={row.subtopics.join(", ")}
                            rows={1}
                            onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], subtopics: e.target.value.split(", ").filter(Boolean) }; return a; }); autoResize(e); }}
                            onFocus={autoResize}
                            className={`${inputCls} resize-none overflow-hidden leading-normal`}
                            placeholder="Subtopics (comma-separated)..."
                          />
                          <textarea
                            value={row.assignments}
                            rows={1}
                            onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], assignments: e.target.value }; return a; }); autoResize(e); }}
                            onFocus={autoResize}
                            className={`${inputCls} text-muted-foreground text-xs italic mt-0.5 resize-none overflow-hidden leading-normal`}
                            placeholder="Assignments..."
                          />
                          {/* Lesson plan button */}
                          <div className="print:hidden mt-1.5 flex items-center gap-2">
                            {!plan && (
                              <button
                                onClick={() => generateLessonPlan(row)}
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
                                  onClick={() => setExpandedWeeks((prev) => ({ ...prev, [row.week]: !isExpanded }))}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  Lesson Plan
                                </button>
                                <button
                                  onClick={() => downloadLessonPlanPDF(row.week)}
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
                        <div className="print:hidden py-2 pl-2 pt-3 w-6 shrink-0">
                          <button
                            onClick={() =>
                              setSchedule((prev) =>
                                prev.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, week: idx + 1 }))
                              )
                            }
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
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
                                  <span className="shrink-0">•</span>
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
                                  <span className="shrink-0">•</span>
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
                            <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Assessment & Homework</p>
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
          <button
            onClick={() =>
              setSchedule((prev) => [
                ...prev,
                { week: prev.length + 1, topic: "", subtopics: [], assignments: "" },
              ])
            }
            className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" /> Add week
          </button>
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
                <p
                  contentEditable
                  suppressContentEditableWarning
                  className="text-sm text-muted-foreground leading-relaxed focus:outline-none focus:bg-muted rounded px-1"
                >
                  {data.policies[key]}
                </p>
              </div>
            ))}
          </div>
        </Section>

      </div>
    </>
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
