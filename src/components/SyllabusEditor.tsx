"use client";

import { useState, useRef, useEffect } from "react";
import { Loader2, X, Plus, MessageCircle, Send, Bot } from "lucide-react";
import type { Syllabus, GradingItem, WeekItem, Policies, SyllabusSection } from "@/lib/types";

type ChatMessage = { role: "user" | "assistant"; content: string };

const inputCls = "bg-transparent focus:outline-none focus:bg-muted rounded px-1 w-full";

function autoResize(e: React.ChangeEvent<HTMLTextAreaElement> | React.FocusEvent<HTMLTextAreaElement>) {
  e.target.style.height = "auto";
  e.target.style.height = e.target.scrollHeight + "px";
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

export function SyllabusEditor({
  data,
  onChange,
}: {
  data: Syllabus;
  onChange: (fn: (prev: Syllabus) => Syllabus) => void;
}) {
  // ── Chat state ──────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auto-resize all textareas when data changes (e.g. after AI chat or initial load)
  useEffect(() => {
    if (!docRef.current) return;
    const timer = setTimeout(() => {
      docRef.current?.querySelectorAll("textarea").forEach((el) => {
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      });
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  // ── List helpers ────────────────────────────────────────────────────────
  function setObjectives(fn: (prev: string[]) => string[]) {
    onChange((d) => ({ ...d, learningObjectives: fn(d.learningObjectives) }));
  }
  function setMaterials(fn: (prev: string[]) => string[]) {
    onChange((d) => ({ ...d, requiredMaterials: fn(d.requiredMaterials) }));
  }
  function setGrading(fn: (prev: GradingItem[]) => GradingItem[]) {
    onChange((d) => ({ ...d, gradingBreakdown: fn(d.gradingBreakdown) }));
  }
  function setSchedule(fn: (prev: WeekItem[]) => WeekItem[]) {
    onChange((d) => ({ ...d, weeklySchedule: fn(d.weeklySchedule) }));
  }
  function setAdditionalSections(fn: (prev: SyllabusSection[]) => SyllabusSection[]) {
    onChange((d) => ({ ...d, additionalSections: fn(d.additionalSections ?? []) }));
  }

  // ── AI chat ─────────────────────────────────────────────────────────────
  async function sendChatMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus: data, message: userMsg, history: chatMessages.slice(-8) }),
      });
      const json = await res.json();
      if (json.error) {
        setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
      } else {
        setChatMessages((prev) => [...prev, { role: "assistant", content: json.reply }]);
        if (json.syllabus) onChange(() => json.syllabus);
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <>
      {/* Syllabus document */}
      <div ref={docRef} className="syllabus-doc max-w-3xl mx-auto px-8 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-1 pb-6 border-b-2 border-foreground">
          <textarea
            value={data.courseTitle}
            rows={1}
            onChange={(e) => { onChange((d) => ({ ...d, courseTitle: e.target.value })); autoResize(e); }}
            onFocus={autoResize}
            className="text-3xl font-bold text-foreground focus:outline-none focus:bg-muted rounded px-1 w-full resize-none overflow-hidden leading-normal text-center"
          />
          {data.courseCode && (
            <textarea
              value={data.courseCode}
              rows={1}
              onChange={(e) => { onChange((d) => ({ ...d, courseCode: e.target.value })); autoResize(e); }}
              onFocus={autoResize}
              className="text-muted-foreground focus:outline-none focus:bg-muted rounded px-1 w-full resize-none overflow-hidden leading-normal text-center"
            />
          )}
        </div>

        {/* Course Description */}
        <Section title="Course Description">
          <textarea
            value={data.courseDescription}
            rows={3}
            onChange={(e) => { onChange((d) => ({ ...d, courseDescription: e.target.value })); autoResize(e); }}
            onFocus={autoResize}
            className={`${inputCls} text-sm leading-relaxed resize-none overflow-hidden`}
          />
        </Section>

        {/* Prerequisites */}
        {data.prerequisites && (
          <Section title="Prerequisites">
            <textarea
              value={data.prerequisites}
              rows={1}
              onChange={(e) => { onChange((d) => ({ ...d, prerequisites: e.target.value })); autoResize(e); }}
              onFocus={autoResize}
              className={`${inputCls} text-sm resize-none overflow-hidden leading-normal`}
            />
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
                  onChange={(e) => { setObjectives((prev) => { const a = [...prev]; a[i] = e.target.value; return a; }); autoResize(e); }}
                  onFocus={autoResize}
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
                  onChange={(e) => { setMaterials((prev) => { const a = [...prev]; a[i] = e.target.value; return a; }); autoResize(e); }}
                  onFocus={autoResize}
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
                    <textarea value={row.component} rows={1} onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], component: e.target.value }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} font-medium resize-none overflow-hidden leading-normal`} placeholder="Component" />
                  </td>
                  <td className="py-1.5 pr-4 align-top">
                    <textarea value={row.weight} rows={1} onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], weight: e.target.value }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} resize-none overflow-hidden leading-normal`} placeholder="0%" />
                  </td>
                  <td className="py-1.5 align-top">
                    <textarea value={row.description} rows={1} onChange={(e) => { setGrading((prev) => { const a = [...prev]; a[i] = { ...a[i], description: e.target.value }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} text-muted-foreground resize-none overflow-hidden leading-normal`} placeholder="Description" />
                  </td>
                  <td className="print:hidden py-1.5 pl-2">
                    <button onClick={() => setGrading((prev) => prev.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setGrading((prev) => [...prev, { component: "", weight: "", description: "" }])} className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
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
              {data.weeklySchedule.map((row, i) => (
                <tr key={i} className="group border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 text-muted-foreground">{row.week}</td>
                  <td className="py-2 pr-3">
                    <textarea value={row.topic} rows={1} onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], topic: e.target.value }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} font-medium resize-none overflow-hidden leading-normal`} placeholder="Topic" />
                  </td>
                  <td className="py-2">
                    <textarea value={row.subtopics.join(", ")} rows={1} onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], subtopics: e.target.value.split(", ").filter(Boolean) }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} resize-none overflow-hidden leading-normal`} placeholder="Subtopics (comma-separated)..." />
                    <textarea value={row.assignments} rows={1} onChange={(e) => { setSchedule((prev) => { const a = [...prev]; a[i] = { ...a[i], assignments: e.target.value }; return a; }); autoResize(e); }} onFocus={autoResize} className={`${inputCls} text-muted-foreground text-xs italic mt-0.5 resize-none overflow-hidden leading-normal`} placeholder="Assignments..." />
                  </td>
                  <td className="print:hidden py-2 pl-2 pt-3">
                    <button onClick={() => setSchedule((prev) => prev.filter((_, idx) => idx !== i).map((w, idx) => ({ ...w, week: idx + 1 })))} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setSchedule((prev) => [...prev, { week: prev.length + 1, topic: "", subtopics: [], assignments: "" }])} className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="h-3 w-3" /> Add week
          </button>
        </Section>

        {/* Additional Sections (from parsed PDF) */}
        {data.additionalSections?.map((section, si) => (
          <Section key={si} title={section.title}>
            {section.type === "text" && (
              <textarea
                value={section.content ?? ""}
                rows={2}
                onChange={(e) => {
                  setAdditionalSections((prev) => {
                    const a = [...prev]; a[si] = { ...a[si], content: e.target.value }; return a;
                  });
                  autoResize(e);
                }}
                onFocus={autoResize}
                className={`${inputCls} text-sm leading-relaxed resize-none overflow-hidden`}
              />
            )}
            {section.type === "list" && (
              <>
                <ul className="space-y-1.5">
                  {(section.items ?? []).map((item, ii) => (
                    <li key={ii} className="group flex gap-2 items-start">
                      <span className="text-muted-foreground shrink-0 text-sm mt-0.5">•</span>
                      <textarea
                        value={item}
                        rows={1}
                        onChange={(e) => {
                          setAdditionalSections((prev) => {
                            const a = [...prev];
                            const items = [...(a[si].items ?? [])];
                            items[ii] = e.target.value;
                            a[si] = { ...a[si], items };
                            return a;
                          });
                          autoResize(e);
                        }}
                        onFocus={autoResize}
                        className={`${inputCls} text-sm resize-none overflow-hidden leading-normal`}
                      />
                      <button
                        onClick={() => setAdditionalSections((prev) => {
                          const a = [...prev];
                          a[si] = { ...a[si], items: (a[si].items ?? []).filter((_, idx) => idx !== ii) };
                          return a;
                        })}
                        className="print:hidden opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setAdditionalSections((prev) => {
                    const a = [...prev];
                    a[si] = { ...a[si], items: [...(a[si].items ?? []), ""] };
                    return a;
                  })}
                  className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add item
                </button>
              </>
            )}
            {section.type === "table" && (
              <>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      {(section.columns ?? []).map((col, ci) => (
                        <th key={ci} className="text-left pb-2 pr-4 font-medium text-muted-foreground">{col}</th>
                      ))}
                      <th className="print:hidden w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {(section.rows ?? []).map((row, ri) => (
                      <tr key={ri} className="group border-b border-border last:border-0">
                        {(section.columns ?? []).map((col, ci) => (
                          <td key={ci} className="py-1.5 pr-4 align-top">
                            <textarea
                              value={row[col] ?? ""}
                              rows={1}
                              onChange={(e) => {
                                setAdditionalSections((prev) => {
                                  const a = [...prev];
                                  const rows = [...(a[si].rows ?? [])];
                                  rows[ri] = { ...rows[ri], [col]: e.target.value };
                                  a[si] = { ...a[si], rows };
                                  return a;
                                });
                                autoResize(e);
                              }}
                              onFocus={autoResize}
                              className={`${inputCls} resize-none overflow-hidden leading-normal`}
                            />
                          </td>
                        ))}
                        <td className="print:hidden py-1.5 pl-2">
                          <button
                            onClick={() => setAdditionalSections((prev) => {
                              const a = [...prev];
                              a[si] = { ...a[si], rows: (a[si].rows ?? []).filter((_, idx) => idx !== ri) };
                              return a;
                            })}
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
                  onClick={() => setAdditionalSections((prev) => {
                    const a = [...prev];
                    const emptyRow: Record<string, string> = {};
                    (a[si].columns ?? []).forEach((col) => { emptyRow[col] = ""; });
                    a[si] = { ...a[si], rows: [...(a[si].rows ?? []), emptyRow] };
                    return a;
                  })}
                  className="print:hidden mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add row
                </button>
              </>
            )}
          </Section>
        ))}

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
                <textarea
                  value={data.policies[key]}
                  rows={2}
                  onChange={(e) => { onChange((d) => ({ ...d, policies: { ...d.policies, [key]: e.target.value } })); autoResize(e); }}
                  onFocus={autoResize}
                  className={`${inputCls} text-sm text-muted-foreground leading-relaxed resize-none overflow-hidden`}
                />
              </div>
            ))}
          </div>
        </Section>

      </div>

      {/* ── AI Chat ─────────────────────────────────────────────────────────── */}
      <div className="print:hidden fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="w-80 flex flex-col bg-background border border-border rounded-xl shadow-2xl overflow-hidden" style={{ height: "480px" }}>
            <div className="flex items-center justify-between px-4 py-3 bg-foreground text-background shrink-0">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-semibold">Syllabus Assistant</span>
              </div>
              <button onClick={() => setChatOpen(false)} className="hover:opacity-70 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {chatMessages.length === 0 && (
                <div className="text-center text-muted-foreground mt-8 space-y-2">
                  <Bot className="h-8 w-8 mx-auto opacity-30" />
                  <p className="text-xs font-medium">Ask me to modify your syllabus</p>
                  <p className="text-xs opacity-60 leading-relaxed">
                    e.g. &quot;Remove the late work policy&quot; or &quot;Rewrite the academic integrity section to allow AI tools&quot;
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
    </>
  );
}
