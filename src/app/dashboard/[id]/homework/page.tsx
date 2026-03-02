"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Loader2, RefreshCw, PenLine, Eye, EyeOff, MessageCircle, Send, Bot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSyllabusById, saveHomework, loadHomework } from "@/lib/storage";
import type { Syllabus, HomeworkAssignment, HomeworkQuestion } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

const inputCls =
  "w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-foreground focus:outline-none resize-none py-0.5 text-sm transition-colors";

const TYPE_COLORS: Record<string, string> = {
  "multiple-choice": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "short-answer": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "problem": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "essay": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const FORMAT_OPTIONS = [
  { value: "problem-set", label: "Problem Set (Mixed)" },
  { value: "multiple-choice", label: "Multiple Choice" },
  { value: "short-response", label: "Short Response" },
  { value: "essay", label: "Essay" },
  { value: "case-study", label: "Case Study" },
  { value: "project", label: "Project" },
  { value: "lab-report", label: "Lab Report" },
  { value: "coding", label: "Coding Assignment" },
  { value: "research", label: "Research Paper" },
];

const QUESTION_FORMATS = new Set(["problem-set", "multiple-choice", "short-response", "essay", "case-study"]);

export default function HomeworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWeek = searchParams.get("week");

  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [mounted, setMounted] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek ? parseInt(initialWeek, 10) || 1 : 1);
  const [numItems, setNumItems] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [format, setFormat] = useState<string>("problem-set");
  const [customInstructions, setCustomInstructions] = useState<string>("");

  const [homework, setHomework] = useState<HomeworkAssignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [savedExists, setSavedExists] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = getSyllabusById(id);
    if (saved) setSyllabus(saved.syllabus);

    // If ?week=N was in the URL, auto-load saved content for that week
    if (initialWeek) {
      const w = parseInt(initialWeek, 10);
      if (!isNaN(w) && w >= 1) {
        const savedHw = loadHomework(id, w);
        if (savedHw) {
          setHomework(savedHw);
        }
      }
    }

    setMounted(true);
  }, [id, initialWeek]);

  // Check for saved homework when week changes
  useEffect(() => {
    if (!mounted) return;
    const saved = loadHomework(id, selectedWeek);
    setSavedExists(!!saved);
  }, [id, selectedWeek, mounted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auto-resize all textareas when content loads or changes
  useEffect(() => {
    if (!homework || !resultRef.current) return;
    const timer = setTimeout(() => {
      resultRef.current?.querySelectorAll("textarea").forEach((el) => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [homework, showAnswers]);

  async function generate() {
    if (!syllabus) return;
    setLoading(true);
    setError(null);
    setHomework(null);
    setChatMessages([]);
    try {
      const res = await fetch("/api/generate-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, weekNumber: selectedWeek, numQuestions: numItems, difficulty, format, customInstructions: customInstructions.trim() || undefined }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        setHomework(json);
        saveHomework(id, selectedWeek, json);
        setSavedExists(true);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function loadSaved() {
    const saved = loadHomework(id, selectedWeek);
    if (saved) {
      setHomework(saved);
      setSavedExists(false);
      setChatMessages([]);
    }
  }

  function updateQuestion(index: number, updates: Partial<HomeworkQuestion>) {
    if (!homework?.questions) return;
    setHomework({ ...homework, questions: homework.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)) });
  }

  function updateChoice(qIndex: number, cIndex: number, value: string) {
    if (!homework?.questions) return;
    const q = homework.questions[qIndex];
    if (!q.choices) return;
    const c = [...q.choices];
    c[cIndex] = value;
    updateQuestion(qIndex, { choices: c });
  }

  async function downloadPDF() {
    if (!homework || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ pdf }, { HomeworkPDF }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/HomeworkPDF")]);
      const blob = await pdf(<HomeworkPDF data={homework} courseTitle={syllabus?.courseTitle ?? ""} showAnswers={showAnswers} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${homework.title.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
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
    if (!chatInput.trim() || chatLoading || !homework) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homework, message: userMsg, history: chatMessages.slice(-8) }),
      });
      const json = await res.json();
      if (json.error) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
        if (json.homework) {
          setHomework(json.homework);
          saveHomework(id, json.homework.weekNumber, json.homework);
        }
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setChatLoading(false);
    }
  }

  if (!mounted) return null;

  if (!syllabus) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Syllabus not found.</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}><ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard</Button>
        </div>
      </main>
    );
  }

  const isQuestionBased = homework ? !!homework.questions?.length : QUESTION_FORMATS.has(format);
  const itemLabel = QUESTION_FORMATS.has(format) ? "Questions" : (format === "project" ? "Steps" : format === "lab-report" ? "Procedure Steps" : format === "coding" ? "Tasks" : "Guiding Questions");

  return (
    <main className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/${id}`)} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {homework && (
            <>
              {isQuestionBased && (
                <Button size="sm" variant="ghost" onClick={() => setShowAnswers(!showAnswers)} className="gap-1.5 text-muted-foreground">
                  {showAnswers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAnswers ? "Hide Answers" : "Show Answers"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
                {isDownloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF</>}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Config */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center rounded-xl bg-muted p-3"><PenLine className="h-5 w-5 text-foreground" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Assignment Generator</h1>
              <p className="text-sm text-muted-foreground">{syllabus.courseTitle}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Week</label>
              <select value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {syllabus.weeklySchedule.map((w) => <option key={w.week} value={w.week}>Week {w.week}: {w.topic}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Type</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {FORMAT_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{itemLabel}</label>
              <select value={numItems} onChange={(e) => setNumItems(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {[3, 4, 5, 6, 7, 8, 10, 12, 15].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          {/* Custom instructions */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Custom Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. &quot;Focus on thermodynamics problems&quot;, &quot;Make it a group project for 3-4 students&quot;, &quot;Include real-world scenarios from the healthcare industry&quot;..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={loading} className="gap-1.5">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : homework ? <><RefreshCw className="h-4 w-4" /> Regenerate</> : <><PenLine className="h-4 w-4" /> Generate Assignment</>}
            </Button>
            {savedExists && !homework && (
              <Button variant="outline" size="sm" onClick={loadSaved} className="gap-1.5 text-muted-foreground">
                Load Saved
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Generating assignment...</p>
            <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ── Result ─────────────────────────────────────────────── */}
        {homework && !loading && (
          <div ref={resultRef} className="border border-border rounded-xl overflow-hidden">
            {/* Header bar */}
            <div className="bg-muted/40 px-6 py-5 space-y-2 border-b border-border">
              <textarea rows={1} value={homework.title}
                onChange={(e) => { setHomework({ ...homework, title: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-2xl font-bold text-foreground py-0 transition-colors"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] capitalize">{homework.format ?? format}</Badge>
                <span>Week {homework.weekNumber}: {homework.topic}</span>
                <span>·</span>
                <span>{homework.totalPoints} points</span>
              </div>
              <textarea rows={2} value={homework.instructions}
                onChange={(e) => { setHomework({ ...homework, instructions: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm text-muted-foreground py-0.5 transition-colors"
              />
            </div>

            <div className="px-6 py-6 space-y-0">
              {/* Questions */}
              {homework.questions && homework.questions.length > 0 && (
                <QuestionsView questions={homework.questions} showAnswers={showAnswers} updateQuestion={updateQuestion} updateChoice={updateChoice} />
              )}

              {/* Project */}
              {homework.project && (
                <ProjectView hw={homework} setHomework={setHomework} />
              )}

              {/* Lab */}
              {homework.lab && (
                <LabView hw={homework} setHomework={setHomework} />
              )}

              {/* Coding */}
              {homework.coding && (
                <CodingView hw={homework} setHomework={setHomework} />
              )}

              {/* Research */}
              {homework.research && (
                <ResearchView hw={homework} setHomework={setHomework} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      {homework && <ChatWidget chatOpen={chatOpen} setChatOpen={setChatOpen} chatMessages={chatMessages} chatLoading={chatLoading} chatInput={chatInput} setChatInput={setChatInput} sendChatMessage={sendChatMessage} chatEndRef={chatEndRef} />}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTION-BASED VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function QuestionsView({ questions, showAnswers, updateQuestion, updateChoice }: {
  questions: HomeworkQuestion[];
  showAnswers: boolean;
  updateQuestion: (i: number, u: Partial<HomeworkQuestion>) => void;
  updateChoice: (qi: number, ci: number, v: string) => void;
}) {
  return (
    <div className="space-y-5">
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-2 border-b border-border pb-5 last:border-b-0 last:pb-0">
          <div className="flex items-start gap-3">
            <span className="text-sm font-bold text-foreground shrink-0 mt-0.5">{q.number}.</span>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`text-[10px] px-1.5 py-0 font-medium ${TYPE_COLORS[q.type] ?? ""}`}>{q.type}</Badge>
                <span className="text-xs text-muted-foreground">{q.points} pts</span>
              </div>
              <textarea rows={1} value={q.text}
                onChange={(e) => { updateQuestion(qi, { text: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
              {q.type === "multiple-choice" && q.choices && (
                <div className="space-y-1 pl-1">
                  {q.choices.map((c, ci) => (
                    <textarea key={ci} rows={1} value={c}
                      onChange={(e) => { updateChoice(qi, ci, e.target.value); autoResize(e.target); }}
                      onFocus={(e) => autoResize(e.target)}
                      className={`${inputCls} text-muted-foreground`}
                    />
                  ))}
                </div>
              )}
              {showAnswers && q.answer && (
                <div className="mt-2 rounded-md bg-muted/50 p-3">
                  <p className="text-xs font-semibold text-foreground mb-1">Answer:</p>
                  <textarea rows={1} value={q.answer}
                    onChange={(e) => { updateQuestion(qi, { answer: e.target.value }); autoResize(e.target); }}
                    onFocus={(e) => autoResize(e.target)}
                    className={`${inputCls} text-muted-foreground`}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROJECT VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function ProjectView({ hw, setHomework }: { hw: HomeworkAssignment; setHomework: (h: HomeworkAssignment) => void }) {
  const p = hw.project!;
  const update = (patch: Partial<typeof p>) => setHomework({ ...hw, project: { ...p, ...patch } });

  return (
    <div className="space-y-6">
      {/* Description */}
      <textarea rows={2} value={p.description}
        onChange={(e) => { update({ description: e.target.value }); autoResize(e.target); }}
        onFocus={(e) => autoResize(e.target)}
        className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm text-foreground leading-relaxed"
      />

      {/* Objectives */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Objectives</h3>
        <div className="space-y-1.5">
          {p.objectives.map((obj, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
              <textarea rows={1} value={obj}
                onChange={(e) => { const a = [...p.objectives]; a[i] = e.target.value; update({ objectives: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Steps</h3>
        <div className="space-y-0">
          {p.steps.map((step, i) => (
            <div key={i} className="relative pl-8 pb-6 last:pb-0">
              {/* Timeline line */}
              {i < p.steps.length - 1 && <div className="absolute left-3.25 top-7 bottom-0 w-0.5 bg-border" />}
              {/* Step number circle */}
              <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold">
                {step.step}
              </div>
              <div className="space-y-1">
                <textarea rows={1} value={step.title}
                  onChange={(e) => { const a = [...p.steps]; a[i] = { ...a[i], title: e.target.value }; update({ steps: a }); autoResize(e.target); }}
                  onFocus={(e) => autoResize(e.target)}
                  className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm font-semibold text-foreground py-0.5"
                />
                <textarea rows={1} value={step.description}
                  onChange={(e) => { const a = [...p.steps]; a[i] = { ...a[i], description: e.target.value }; update({ steps: a }); autoResize(e.target); }}
                  onFocus={(e) => autoResize(e.target)}
                  className={`${inputCls} text-muted-foreground`}
                />
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">Deliverable</Badge>
                  <textarea rows={1} value={step.deliverable}
                    onChange={(e) => { const a = [...p.steps]; a[i] = { ...a[i], deliverable: e.target.value }; update({ steps: a }); autoResize(e.target); }}
                    onFocus={(e) => autoResize(e.target)}
                    className={`${inputCls} text-muted-foreground text-xs flex-1`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final deliverable */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Final Deliverable</h3>
        <textarea rows={1} value={p.finalDeliverable}
          onChange={(e) => { update({ finalDeliverable: e.target.value }); autoResize(e.target); }}
          onFocus={(e) => autoResize(e.target)}
          className={`${inputCls} text-muted-foreground`}
        />
      </div>

      {/* Grading criteria */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Grading Criteria</h3>
        <div className="space-y-1">
          {p.gradingCriteria.map((gc, i) => (
            <div key={i} className="flex items-center gap-3">
              <textarea rows={1} value={gc.criterion}
                onChange={(e) => { const a = [...p.gradingCriteria]; a[i] = { ...a[i], criterion: e.target.value }; update({ gradingCriteria: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground flex-1`}
              />
              <textarea rows={1} value={gc.weight}
                onChange={(e) => { const a = [...p.gradingCriteria]; a[i] = { ...a[i], weight: e.target.value }; update({ gradingCriteria: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-16 bg-transparent border-0 border-b border-transparent hover:border-border focus:border-foreground focus:outline-none resize-none py-0.5 text-sm text-right font-medium text-foreground transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   LAB VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function LabView({ hw, setHomework }: { hw: HomeworkAssignment; setHomework: (h: HomeworkAssignment) => void }) {
  const lab = hw.lab!;
  const update = (patch: Partial<typeof lab>) => setHomework({ ...hw, lab: { ...lab, ...patch } });

  return (
    <div className="space-y-6">
      {/* Background */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Background</h3>
        <textarea rows={2} value={lab.background}
          onChange={(e) => { update({ background: e.target.value }); autoResize(e.target); }}
          onFocus={(e) => autoResize(e.target)}
          className={`${inputCls} text-foreground leading-relaxed`}
        />
      </div>

      {/* Materials */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Materials</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {lab.materials.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
              <textarea rows={1} value={m}
                onChange={(e) => { const a = [...lab.materials]; a[i] = e.target.value; update({ materials: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Procedure */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Procedure</h3>
        <div className="space-y-3">
          {lab.procedure.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground shrink-0 mt-0.5">
                {step.step}
              </div>
              <textarea rows={1} value={step.instruction}
                onChange={(e) => { const a = [...lab.procedure]; a[i] = { ...a[i], instruction: e.target.value }; update({ procedure: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Data collection */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Data Collection</h3>
        <textarea rows={2} value={lab.dataCollection}
          onChange={(e) => { update({ dataCollection: e.target.value }); autoResize(e.target); }}
          onFocus={(e) => autoResize(e.target)}
          className={`${inputCls} text-muted-foreground leading-relaxed`}
        />
      </div>

      {/* Analysis questions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Analysis Questions</h3>
        <div className="space-y-2">
          {lab.analysisQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm font-bold text-foreground shrink-0">{i + 1}.</span>
              <textarea rows={1} value={q}
                onChange={(e) => { const a = [...lab.analysisQuestions]; a[i] = e.target.value; update({ analysisQuestions: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CODING VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function CodingView({ hw, setHomework }: { hw: HomeworkAssignment; setHomework: (h: HomeworkAssignment) => void }) {
  const code = hw.coding!;
  const update = (patch: Partial<typeof code>) => setHomework({ ...hw, coding: { ...code, ...patch } });

  return (
    <div className="space-y-6">
      {/* Description */}
      <textarea rows={2} value={code.description}
        onChange={(e) => { update({ description: e.target.value }); autoResize(e.target); }}
        onFocus={(e) => autoResize(e.target)}
        className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm text-foreground leading-relaxed"
      />

      {/* Requirements */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Requirements</h3>
        <div className="space-y-1.5">
          {code.requirements.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground shrink-0 text-sm">→</span>
              <textarea rows={1} value={r}
                onChange={(e) => { const a = [...code.requirements]; a[i] = e.target.value; update({ requirements: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tasks */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tasks</h3>
        <div className="space-y-4">
          {code.tasks.map((task, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono">Task {task.number}</Badge>
                <textarea rows={1} value={task.title}
                  onChange={(e) => { const a = [...code.tasks]; a[i] = { ...a[i], title: e.target.value }; update({ tasks: a }); autoResize(e.target); }}
                  onFocus={(e) => autoResize(e.target)}
                  className="flex-1 bg-transparent border-0 focus:outline-none resize-none text-sm font-semibold text-foreground py-0"
                />
              </div>
              <textarea rows={1} value={task.description}
                onChange={(e) => { const a = [...code.tasks]; a[i] = { ...a[i], description: e.target.value }; update({ tasks: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-muted-foreground`}
              />
              {task.examples && (
                <div className="rounded bg-muted px-3 py-2 font-mono text-xs">
                  <textarea rows={1} value={task.examples}
                    onChange={(e) => { const a = [...code.tasks]; a[i] = { ...a[i], examples: e.target.value }; update({ tasks: a }); autoResize(e.target); }}
                    onFocus={(e) => autoResize(e.target)}
                    className="w-full bg-transparent border-0 focus:outline-none resize-none font-mono text-xs text-foreground"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bonus */}
      {code.bonusChallenges && code.bonusChallenges.length > 0 && (
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Bonus Challenges</h3>
          {code.bonusChallenges.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-muted-foreground shrink-0 text-sm">⭐</span>
              <textarea rows={1} value={b}
                onChange={(e) => { const a = [...(code.bonusChallenges ?? [])]; a[i] = e.target.value; update({ bonusChallenges: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-muted-foreground`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESEARCH VIEW
   ═══════════════════════════════════════════════════════════════════════════ */
function ResearchView({ hw, setHomework }: { hw: HomeworkAssignment; setHomework: (h: HomeworkAssignment) => void }) {
  const r = hw.research!;
  const update = (patch: Partial<typeof r>) => setHomework({ ...hw, research: { ...r, ...patch } });

  return (
    <div className="space-y-6">
      {/* Topic */}
      <div className="rounded-lg bg-muted/50 p-4 space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Research Topic</h3>
        <textarea rows={1} value={r.topic}
          onChange={(e) => { update({ topic: e.target.value }); autoResize(e.target); }}
          onFocus={(e) => autoResize(e.target)}
          className={`${inputCls} text-foreground font-medium`}
        />
      </div>

      {/* Background */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Background</h3>
        <textarea rows={2} value={r.background}
          onChange={(e) => { update({ background: e.target.value }); autoResize(e.target); }}
          onFocus={(e) => autoResize(e.target)}
          className={`${inputCls} text-foreground leading-relaxed`}
        />
      </div>

      {/* Requirements */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Requirements</h3>
        <div className="space-y-1.5">
          {r.requirements.map((req, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0 mt-2" />
              <textarea rows={1} value={req}
                onChange={(e) => { const a = [...r.requirements]; a[i] = e.target.value; update({ requirements: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Guiding questions */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Guiding Questions</h3>
        <div className="space-y-2">
          {r.guidingQuestions.map((q, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm font-bold text-foreground shrink-0">{i + 1}.</span>
              <textarea rows={1} value={q}
                onChange={(e) => { const a = [...r.guidingQuestions]; a[i] = e.target.value; update({ guidingQuestions: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Deliverables</h3>
        <div className="space-y-1.5">
          {r.deliverables.map((d, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
              <textarea rows={1} value={d}
                onChange={(e) => { const a = [...r.deliverables]; a[i] = e.target.value; update({ deliverables: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Evaluation */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Evaluation Criteria</h3>
        <div className="space-y-1">
          {r.evaluationCriteria.map((ec, i) => (
            <div key={i} className="flex items-center gap-3">
              <textarea rows={1} value={ec.criterion}
                onChange={(e) => { const a = [...r.evaluationCriteria]; a[i] = { ...a[i], criterion: e.target.value }; update({ evaluationCriteria: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-foreground flex-1`}
              />
              <textarea rows={1} value={ec.weight}
                onChange={(e) => { const a = [...r.evaluationCriteria]; a[i] = { ...a[i], weight: e.target.value }; update({ evaluationCriteria: a }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-16 bg-transparent border-0 border-b border-transparent hover:border-border focus:border-foreground focus:outline-none resize-none py-0.5 text-sm text-right font-medium text-foreground transition-colors"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT WIDGET
   ═══════════════════════════════════════════════════════════════════════════ */
function ChatWidget({ chatOpen, setChatOpen, chatMessages, chatLoading, chatInput, setChatInput, sendChatMessage, chatEndRef }: {
  chatOpen: boolean;
  setChatOpen: (fn: boolean | ((o: boolean) => boolean)) => void;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatInput: string;
  setChatInput: (v: string) => void;
  sendChatMessage: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="print:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {chatOpen && (
        <div className="w-80 flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden" style={{ height: "480px" }}>
          <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background shrink-0">
            <div className="flex items-center gap-2"><Bot className="h-4 w-4" /><span className="text-sm font-semibold">Assignment Assistant</span></div>
            <button onClick={() => setChatOpen(false)} className="hover:opacity-70 transition-opacity"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-muted-foreground mt-8 space-y-2">
                <Bot className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-xs font-medium">Ask me to modify your assignment</p>
                <p className="text-xs opacity-60 leading-relaxed">e.g. &quot;Make step 3 more detailed&quot; or &quot;Add a bonus task&quot;</p>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${msg.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>{msg.content}</div>
              </div>
            ))}
            {chatLoading && <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2.5"><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /></div></div>}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-border p-3 flex gap-2 shrink-0">
            <textarea value={chatInput} rows={1}
              onChange={(e) => { setChatInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px"; }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
              placeholder="Ask anything... (Enter to send)"
              className="flex-1 resize-none bg-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring leading-normal overflow-hidden"
              style={{ maxHeight: "80px" }}
            />
            <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading}
              className="shrink-0 w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-80 disabled:opacity-30 transition-opacity self-end">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
      <button onClick={() => setChatOpen((o) => !o)} className="w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:opacity-90 transition-opacity">
        {chatOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
