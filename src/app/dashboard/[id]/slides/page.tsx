"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Download, Loader2, RefreshCw, CalendarDays,
  MessageCircle, Send, Bot, X, Presentation, Clock, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSyllabusById, saveWeekPlan, loadWeekPlan } from "@/lib/storage";
import type { Syllabus, SavedSyllabus, WeekPlan, MeetingPlan, MeetingBlock, Slide } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

const inputCls =
  "w-full bg-transparent border-0 border-b border-transparent hover:border-border focus:border-foreground focus:outline-none resize-none py-0.5 text-sm transition-colors";

export default function WeekPlannerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWeek = searchParams.get("week");

  const [savedSyllabus, setSavedSyllabus] = useState<SavedSyllabus | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [mounted, setMounted] = useState(false);

  const [selectedWeek, setSelectedWeek] = useState<number>(initialWeek ? parseInt(initialWeek, 10) || 1 : 1);
  const [customInstructions, setCustomInstructions] = useState<string>("");

  const [weekPlan, setWeekPlan] = useState<WeekPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [slidesLoading, setSlidesLoading] = useState<Record<number, boolean>>({});

  const [savedExists, setSavedExists] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const frequency = savedSyllabus?.wizardParams?.frequency ?? "2x";
  const teaching = savedSyllabus?.wizardParams?.teaching;
  const meetingCount = frequency === "async" ? 1 : parseInt(frequency);

  useEffect(() => {
    const saved = getSyllabusById(id);
    if (saved) {
      setSavedSyllabus(saved);
      setSyllabus(saved.syllabus);
    }

    // If ?week=N was in the URL, auto-load saved content for that week
    if (initialWeek) {
      const w = parseInt(initialWeek, 10);
      if (!isNaN(w) && w >= 1) {
        const savedWp = loadWeekPlan(id, w);
        if (savedWp) {
          setWeekPlan(savedWp);
        }
      }
    }

    setMounted(true);
  }, [id, initialWeek]);

  useEffect(() => {
    if (!mounted) return;
    const saved = loadWeekPlan(id, selectedWeek);
    setSavedExists(!!saved);
  }, [id, selectedWeek, mounted]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auto-resize all textareas when content loads or changes
  useEffect(() => {
    if (!weekPlan || !resultRef.current) return;
    const timer = setTimeout(() => {
      resultRef.current?.querySelectorAll("textarea").forEach((el) => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [weekPlan]);

  async function generate() {
    if (!syllabus) return;
    setLoading(true);
    setError(null);
    setWeekPlan(null);
    setChatMessages([]);
    try {
      const res = await fetch("/api/generate-week-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus, weekNumber: selectedWeek, frequency, teaching, customInstructions: customInstructions.trim() || undefined }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else {
        setWeekPlan(json);
        saveWeekPlan(id, selectedWeek, json);
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
    const saved = loadWeekPlan(id, selectedWeek);
    if (saved) {
      setWeekPlan(saved);
      setSavedExists(false);
      setChatMessages([]);
    }
  }

  async function generateSlides(meetingIndex: number) {
    if (!weekPlan) return;
    const meeting = weekPlan.meetings[meetingIndex];
    setSlidesLoading((prev) => ({ ...prev, [meetingIndex]: true }));
    try {
      const res = await fetch("/api/generate-slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meeting, weekTopic: weekPlan.topic, courseTitle: weekPlan.courseTitle, meetingIndex }),
      });
      const json = await res.json();
      if (!json.error) {
        const updated = {
          ...weekPlan,
          meetings: weekPlan.meetings.map((m, i) => (i === meetingIndex ? { ...m, slides: json } : m)),
        };
        setWeekPlan(updated);
        saveWeekPlan(id, weekPlan.weekNumber, updated);
      }
    } catch {
      // silently handle
    } finally {
      setSlidesLoading((prev) => ({ ...prev, [meetingIndex]: false }));
    }
  }

  function updateMeeting(meetingIndex: number, updates: Partial<MeetingPlan>) {
    if (!weekPlan) return;
    setWeekPlan({ ...weekPlan, meetings: weekPlan.meetings.map((m, i) => (i === meetingIndex ? { ...m, ...updates } : m)) });
  }

  function updateBlock(meetingIndex: number, blockIndex: number, updates: Partial<MeetingBlock>) {
    if (!weekPlan) return;
    const meeting = weekPlan.meetings[meetingIndex];
    const blocks = meeting.blocks.map((b, i) => (i === blockIndex ? { ...b, ...updates } : b));
    updateMeeting(meetingIndex, { blocks });
  }

  function updateSlide(meetingIndex: number, slideIndex: number, updates: Partial<Slide>) {
    if (!weekPlan) return;
    const meeting = weekPlan.meetings[meetingIndex];
    if (!meeting.slides) return;
    const slides = meeting.slides.slides.map((s, i) => (i === slideIndex ? { ...s, ...updates } : s));
    updateMeeting(meetingIndex, { slides: { ...meeting.slides, slides } });
  }

  function updateSlideBullet(meetingIndex: number, slideIndex: number, bulletIndex: number, value: string) {
    if (!weekPlan) return;
    const meeting = weekPlan.meetings[meetingIndex];
    if (!meeting.slides) return;
    const slide = meeting.slides.slides[slideIndex];
    const bullets = [...slide.bullets];
    bullets[bulletIndex] = value;
    updateSlide(meetingIndex, slideIndex, { bullets });
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading || !weekPlan) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-week-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekPlan, message: userMsg, history: chatMessages.slice(-8) }),
      });
      const json = await res.json();
      if (json.error) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
        if (json.weekPlan) {
          setWeekPlan(json.weekPlan);
          saveWeekPlan(id, json.weekPlan.weekNumber, json.weekPlan);
        }
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong." }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function downloadPDF() {
    if (!weekPlan || isDownloading) return;
    setIsDownloading(true);
    try {
      const [{ pdf }, { WeekPlanPDF }] = await Promise.all([import("@react-pdf/renderer"), import("@/components/WeekPlanPDF")]);
      const blob = await pdf(<WeekPlanPDF data={weekPlan} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Week${weekPlan.weekNumber}-${weekPlan.topic.replace(/[^a-z0-9\s]/gi, "").trim()}.pdf`;
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
          {weekPlan && (
            <Button size="sm" variant="outline" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
              {isDownloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><Download className="h-4 w-4" /> Download PDF</>}
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {/* Config */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center rounded-xl bg-muted p-3"><CalendarDays className="h-5 w-5 text-foreground" /></div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Week Planner</h1>
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
              <label className="text-sm font-medium text-foreground">Class Format</label>
              <div className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {frequency === "async" ? "Asynchronous (1 module)" : `${meetingCount}x/week (${meetingCount} meeting${meetingCount > 1 ? "s" : ""})`}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Custom Instructions <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={2}
              placeholder='e.g. "Include a group discussion activity", "Focus on hands-on coding exercises", "Add a quiz review segment"...'
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground/50"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={loading} className="gap-1.5">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : weekPlan ? <><RefreshCw className="h-4 w-4" /> Regenerate</> : <><CalendarDays className="h-4 w-4" /> Generate Week Plan</>}
            </Button>
            {savedExists && !weekPlan && (
              <Button variant="outline" size="sm" onClick={loadSaved} className="gap-1.5 text-muted-foreground">
                Load Saved
              </Button>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Generating week plan...</p>
            <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Result */}
        {weekPlan && !loading && (
          <div ref={resultRef} className="space-y-6">
            {/* Week header */}
            <div className="border border-border rounded-xl overflow-hidden bg-muted/40 px-6 py-5 space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-[10px] capitalize">{weekPlan.mode === "async" ? "Async" : `${weekPlan.meetings.length}x/week`}</Badge>
                <span>Week {weekPlan.weekNumber}: {weekPlan.topic}</span>
              </div>
            </div>

            {weekPlan.meetings.map((meeting, mi) => (
              <MeetingCard
                key={mi}
                meeting={meeting}
                meetingIndex={mi}
                updateMeeting={updateMeeting}
                updateBlock={updateBlock}
                generateSlides={generateSlides}
                slidesLoading={slidesLoading[mi] ?? false}
                updateSlide={updateSlide}
                updateSlideBullet={updateSlideBullet}
              />
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      {weekPlan && <ChatWidget chatOpen={chatOpen} setChatOpen={setChatOpen} chatMessages={chatMessages} chatLoading={chatLoading} chatInput={chatInput} setChatInput={setChatInput} sendChatMessage={sendChatMessage} chatEndRef={chatEndRef} />}
    </main>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MEETING CARD
   ═══════════════════════════════════════════════════════════════════════════ */
function MeetingCard({ meeting, meetingIndex, updateMeeting, updateBlock, generateSlides, slidesLoading, updateSlide, updateSlideBullet }: {
  meeting: MeetingPlan;
  meetingIndex: number;
  updateMeeting: (mi: number, u: Partial<MeetingPlan>) => void;
  updateBlock: (mi: number, bi: number, u: Partial<MeetingBlock>) => void;
  generateSlides: (mi: number) => void;
  slidesLoading: boolean;
  updateSlide: (mi: number, si: number, u: Partial<Slide>) => void;
  updateSlideBullet: (mi: number, si: number, bi: number, v: string) => void;
}) {
  const [slidesExpanded, setSlidesExpanded] = useState(true);
  const totalDuration = meeting.blocks.reduce((sum, b) => sum + b.duration, 0);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Meeting header */}
      <div className="bg-muted/40 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Badge variant="outline" className="text-[10px] font-mono shrink-0">{meeting.label}</Badge>
            <textarea rows={1} value={meeting.focus}
              onChange={(e) => { updateMeeting(meetingIndex, { focus: e.target.value }); autoResize(e.target); }}
              onFocus={(e) => autoResize(e.target)}
              className={`${inputCls} text-foreground font-medium`}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-3">
            <Clock className="h-3 w-3" />
            <span>{totalDuration} min</span>
          </div>
        </div>
      </div>

      {/* Blocks timeline */}
      <div className="px-6 py-5 space-y-0">
        {meeting.blocks.map((block, bi) => (
          <div key={bi} className="relative pl-8 pb-5 last:pb-0">
            {bi < meeting.blocks.length - 1 && <div className="absolute left-3.25 top-7 bottom-0 w-0.5 bg-border" />}
            <div className="absolute left-0 top-0 w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center text-[10px] font-bold">
              {block.duration}m
            </div>
            <div className="space-y-1">
              <textarea rows={1} value={block.title}
                onChange={(e) => { updateBlock(meetingIndex, bi, { title: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className="w-full bg-transparent border-0 focus:outline-none resize-none text-sm font-semibold text-foreground py-0.5"
              />
              <textarea rows={1} value={block.description}
                onChange={(e) => { updateBlock(meetingIndex, bi, { description: e.target.value }); autoResize(e.target); }}
                onFocus={(e) => autoResize(e.target)}
                className={`${inputCls} text-muted-foreground`}
              />
              {block.materials && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge variant="outline" className="text-[10px]">Materials</Badge>
                  <textarea rows={1} value={block.materials}
                    onChange={(e) => { updateBlock(meetingIndex, bi, { materials: e.target.value }); autoResize(e.target); }}
                    onFocus={(e) => autoResize(e.target)}
                    className={`${inputCls} text-muted-foreground text-xs flex-1`}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Slides section */}
      <div className="border-t border-border px-6 py-3">
        {!meeting.slides ? (
          <Button size="sm" variant="ghost" onClick={() => generateSlides(meetingIndex)} disabled={slidesLoading} className="gap-1.5 text-muted-foreground">
            {slidesLoading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating slides...</>
              : <><Presentation className="h-3.5 w-3.5" /> Generate Slides</>}
          </Button>
        ) : (
          <>
            <button onClick={() => setSlidesExpanded(!slidesExpanded)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
              <Presentation className="h-3.5 w-3.5" />
              <span className="font-medium">Slides ({meeting.slides.slides.length})</span>
              {slidesExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
            </button>
            {slidesExpanded && (
              <div className="mt-3 space-y-3">
                {meeting.slides.slides.map((slide, si) => (
                  <div key={si} className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{si + 1}/{meeting.slides!.slides.length}</span>
                      <textarea rows={1} value={slide.title}
                        onChange={(e) => { updateSlide(meetingIndex, si, { title: e.target.value }); autoResize(e.target); }}
                        onFocus={(e) => autoResize(e.target)}
                        className="flex-1 bg-transparent border-0 focus:outline-none resize-none text-sm font-semibold text-foreground py-0"
                      />
                    </div>
                    <div className="space-y-1 pl-4">
                      {slide.bullets.map((bullet, bi) => (
                        <div key={bi} className="flex items-start gap-2">
                          <span className="text-muted-foreground shrink-0 text-xs mt-0.5">–</span>
                          <textarea rows={1} value={bullet}
                            onChange={(e) => { updateSlideBullet(meetingIndex, si, bi, e.target.value); autoResize(e.target); }}
                            onFocus={(e) => autoResize(e.target)}
                            className={`${inputCls} text-muted-foreground text-xs`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
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
            <div className="flex items-center gap-2"><Bot className="h-4 w-4" /><span className="text-sm font-semibold">Week Planner Assistant</span></div>
            <button onClick={() => setChatOpen(false)} className="hover:opacity-70 transition-opacity"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center text-muted-foreground mt-8 space-y-2">
                <Bot className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-xs font-medium">Ask me to modify your week plan</p>
                <p className="text-xs opacity-60 leading-relaxed">e.g. &quot;Add a group activity to Meeting 2&quot; or &quot;Make the warm-up longer&quot;</p>
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
