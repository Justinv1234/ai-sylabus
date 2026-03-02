"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, RefreshCw, ClipboardCheck, Eye, EyeOff, MessageCircle, Send, Bot, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getSyllabusById, saveQuiz, loadQuiz } from "@/lib/storage";
import type { Syllabus, Quiz, HomeworkQuestion, GradingItem } from "@/lib/types";

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

const ASSESSMENT_KEYWORDS = ["quiz", "test", "exam", "midterm", "final"];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function detectType(component: string): Quiz["type"] {
  const lower = component.toLowerCase();
  if (lower.includes("midterm")) return "midterm";
  if (lower.includes("final")) return "final";
  if (lower.includes("test") || lower.includes("exam")) return "test";
  return "quiz";
}

function isAssessment(g: GradingItem): boolean {
  return ASSESSMENT_KEYWORDS.some((kw) => g.component.toLowerCase().includes(kw));
}

export default function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [mounted, setMounted] = useState(false);

  // Config
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<number>(1);
  const [weekEnd, setWeekEnd] = useState<number>(1);
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [questionFormat, setQuestionFormat] = useState<string>("mixed");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [customInstructions, setCustomInstructions] = useState<string>("");

  // Result
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const [savedExists, setSavedExists] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = getSyllabusById(id);
    if (saved) setSyllabus(saved.syllabus);
    setMounted(true);
  }, [id]);

  // Check for saved quiz when assessment changes
  useEffect(() => {
    if (!mounted || !selectedAssessment) return;
    const saved = loadQuiz(id, selectedAssessment);
    setSavedExists(!!saved);
  }, [id, selectedAssessment, mounted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auto-resize textareas
  useEffect(() => {
    if (!quiz || !resultRef.current) return;
    const timer = setTimeout(() => {
      resultRef.current?.querySelectorAll("textarea").forEach((el) => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [quiz, showAnswers]);

  const assessments = syllabus ? syllabus.gradingBreakdown.filter(isAssessment) : [];
  const totalWeeks = syllabus?.weeklySchedule.length ?? 1;

  function selectAssessment(slug: string, g: GradingItem | null) {
    setSelectedAssessment(slug);
    setQuiz(null);
    setChatMessages([]);

    if (g) {
      const type = detectType(g.component);
      if (type === "midterm") {
        setWeekStart(1);
        setWeekEnd(Math.ceil(totalWeeks / 2));
        setNumQuestions(25);
        setDifficulty("medium");
      } else if (type === "final") {
        setWeekStart(1);
        setWeekEnd(totalWeeks);
        setNumQuestions(30);
        setDifficulty("medium");
      } else {
        setWeekStart(1);
        setWeekEnd(1);
        setNumQuestions(10);
        setDifficulty("easy");
      }
    } else {
      // Custom
      setWeekStart(1);
      setWeekEnd(1);
      setNumQuestions(10);
      setDifficulty("easy");
    }

    setQuestionFormat("mixed");
    setTimeLimit("");
    setCustomInstructions("");
  }

  async function generate() {
    if (!syllabus || !selectedAssessment) return;
    setLoading(true);
    setError(null);
    setQuiz(null);
    setChatMessages([]);
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syllabus,
          weekStart,
          weekEnd,
          numQuestions,
          difficulty,
          questionFormat,
          timeLimit: timeLimit.trim() || undefined,
          customInstructions: customInstructions.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        const quizWithId = { ...json, id: selectedAssessment };
        setQuiz(quizWithId);
        saveQuiz(id, selectedAssessment, quizWithId);
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
    if (!selectedAssessment) return;
    const saved = loadQuiz(id, selectedAssessment);
    if (saved) {
      setQuiz(saved);
      setSavedExists(false);
      setChatMessages([]);
    }
  }

  function updateQuestion(index: number, updates: Partial<HomeworkQuestion>) {
    if (!quiz) return;
    setQuiz({ ...quiz, questions: quiz.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)) });
  }

  function updateChoice(qIndex: number, cIndex: number, value: string) {
    if (!quiz) return;
    const q = quiz.questions[qIndex];
    if (!q.choices) return;
    const c = [...q.choices];
    c[cIndex] = value;
    updateQuestion(qIndex, { choices: c });
  }

  async function downloadPDF() {
    if (!quiz || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ pdf }, { QuizPDF }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/QuizPDF")]);
      const blob = await pdf(<QuizPDF data={quiz} courseTitle={syllabus?.courseTitle ?? ""} showAnswers={showAnswers} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${quiz.title.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
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
    if (!chatInput.trim() || chatLoading || !quiz) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz, message: userMsg, history: chatMessages.slice(-8) }),
      });
      const json = await res.json();
      if (json.error) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
        if (json.quiz) {
          const updated = { ...json.quiz, id: quiz.id };
          setQuiz(updated);
          saveQuiz(id, quiz.id, updated);
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

  return (
    <main className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/${id}`)} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          {quiz && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setShowAnswers(!showAnswers)} className="gap-1.5 text-muted-foreground">
                {showAnswers ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showAnswers ? "Hide Answers" : "Show Answers"}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
                {isDownloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF</>}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center rounded-xl bg-muted p-3"><ClipboardCheck className="h-5 w-5 text-foreground" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Quiz / Test Generator</h1>
            <p className="text-sm text-muted-foreground">{syllabus.courseTitle}</p>
          </div>
        </div>

        {/* Assessment selector */}
        {!selectedAssessment && (
          <div className="space-y-4">
            {assessments.length > 0 && (
              <>
                <h2 className="text-sm font-semibold text-foreground">From Your Syllabus</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {assessments.map((g) => {
                    const slug = slugify(g.component);
                    const hasSaved = !!loadQuiz(id, slug);
                    return (
                      <Card
                        key={slug}
                        className="cursor-pointer hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                        onClick={() => selectAssessment(slug, g)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{g.component}</CardTitle>
                            <Badge variant="outline" className="text-[10px]">{g.weight}</Badge>
                          </div>
                          <CardDescription className="text-xs">{g.description}</CardDescription>
                          {hasSaved && (
                            <Badge variant="secondary" className="text-[10px] w-fit mt-1">Saved</Badge>
                          )}
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}

            <div className={assessments.length > 0 ? "pt-2" : ""}>
              <Card
                className="cursor-pointer hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-dashed"
                onClick={() => selectAssessment(`custom-${Date.now()}`, null)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Custom Assessment</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Create a quiz or test not in your grading breakdown</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}

        {/* Config (after selecting assessment) */}
        {selectedAssessment && !quiz && !loading && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedAssessment(null); setQuiz(null); }} className="gap-1 text-muted-foreground text-xs">
                <ArrowLeft className="h-3 w-3" /> Change Assessment
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">From Week</label>
                <select value={weekStart} onChange={(e) => { const v = Number(e.target.value); setWeekStart(v); if (v > weekEnd) setWeekEnd(v); }} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {syllabus.weeklySchedule.map((w) => <option key={w.week} value={w.week}>Week {w.week}: {w.topic}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">To Week</label>
                <select value={weekEnd} onChange={(e) => setWeekEnd(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {syllabus.weeklySchedule.filter((w) => w.week >= weekStart).map((w) => <option key={w.week} value={w.week}>Week {w.week}: {w.topic}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Questions</label>
                <select value={numQuestions} onChange={(e) => setNumQuestions(Number(e.target.value))} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {[5, 10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Question Format</label>
                <select value={questionFormat} onChange={(e) => setQuestionFormat(e.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="mixed">Mixed (Recommended)</option>
                  <option value="multiple-choice">Multiple Choice Only</option>
                  <option value="short-answer">Short Answer Only</option>
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
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Time Limit <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(e.target.value)}
                  placeholder="e.g. 60 minutes"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Custom Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                rows={2}
                placeholder='e.g. "Focus on chapters 3-5", "Include diagram-based questions", "No essay questions"...'
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={generate} disabled={loading} className="gap-1.5">
                <ClipboardCheck className="h-4 w-4" /> Generate Assessment
              </Button>
              {savedExists && (
                <Button variant="outline" size="sm" onClick={loadSaved} className="gap-1.5 text-muted-foreground">
                  Load Saved
                </Button>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Generating assessment...</p>
            <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ── Result ─────────────────────────────────────────────── */}
        {quiz && !loading && (
          <div ref={resultRef} className="border border-border rounded-xl overflow-hidden">
            {/* Header bar */}
            <div className="bg-muted/40 px-6 py-5 space-y-2 border-b border-border">
              <textarea rows={1} value={quiz.title}
                onChange={(e) => { setQuiz({ ...quiz, title: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-2xl font-bold text-foreground py-0 transition-colors"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                <Badge variant="outline" className="text-[10px] capitalize">{quiz.type}</Badge>
                <span>{quiz.weekStart === quiz.weekEnd ? `Week ${quiz.weekStart}` : `Weeks ${quiz.weekStart}–${quiz.weekEnd}`}</span>
                <span>·</span>
                <span>{quiz.questions.length} questions</span>
                <span>·</span>
                <span>{quiz.totalPoints} points</span>
                {quiz.timeLimit && <><span>·</span><span>{quiz.timeLimit}</span></>}
              </div>
              <textarea rows={2} value={quiz.instructions}
                onChange={(e) => { setQuiz({ ...quiz, instructions: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm text-muted-foreground py-0.5 transition-colors"
              />
            </div>

            <div className="px-6 py-6 space-y-0">
              <QuestionsView questions={quiz.questions} showAnswers={showAnswers} updateQuestion={updateQuestion} updateChoice={updateChoice} />
            </div>

            {/* Regenerate */}
            <div className="border-t border-border px-6 py-4">
              <Button variant="outline" size="sm" onClick={generate} disabled={loading} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      {quiz && (
        <div className="print:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {chatOpen && (
            <div className="w-80 flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden" style={{ height: "480px" }}>
              <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background shrink-0">
                <div className="flex items-center gap-2"><Bot className="h-4 w-4" /><span className="text-sm font-semibold">Quiz Assistant</span></div>
                <button onClick={() => setChatOpen(false)} className="hover:opacity-70 transition-opacity"><X className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {chatMessages.length === 0 && (
                  <div className="text-center text-muted-foreground mt-8 space-y-2">
                    <Bot className="h-8 w-8 mx-auto opacity-30" />
                    <p className="text-xs font-medium">Ask me to modify your quiz</p>
                    <p className="text-xs opacity-60 leading-relaxed">e.g. &quot;Make question 3 harder&quot; or &quot;Add 5 more multiple choice questions&quot;</p>
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
      )}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   QUESTIONS VIEW
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
