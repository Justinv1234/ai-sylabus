"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Paperclip, X, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";

const AUDIENCE_OPTIONS = [
  { value: "high-school", label: "High School" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "graduate", label: "Graduate" },
  { value: "professional", label: "Working Professionals" },
];

const DURATION_OPTIONS = [
  { value: "4", label: "4 Weeks" },
  { value: "8", label: "8 Weeks" },
  { value: "16", label: "16 Weeks" },
];

const FREQUENCY_OPTIONS = [
  { value: "1x", label: "Once a week" },
  { value: "2x", label: "Twice a week" },
  { value: "3x", label: "Three times a week" },
  { value: "async", label: "Async / Online" },
];

const TEACHING_OPTIONS = [
  { value: "lecture", label: "Lecture-based" },
  { value: "project", label: "Project-based" },
  { value: "lab", label: "Lab / Hands-on" },
  { value: "seminar", label: "Discussion / Seminar" },
  { value: "mixed", label: "Mixed approach" },
];

const ASSESSMENT_OPTIONS = [
  { value: "exams", label: "Exams focused" },
  { value: "projects", label: "Projects focused" },
  { value: "balanced", label: "Balanced" },
  { value: "assignments", label: "Continuous assignments" },
];

const DEFAULTS = {
  audience: "undergraduate",
  duration: "16",
  frequency: "2x",
  goal: "",
  teaching: "mixed",
  assessment: "balanced",
};

// Steps 0–6 are questions, step 7 is materials (optional), step 8 is summary
const TOTAL_STEPS = 7;

export default function NewCoursePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);

  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [duration, setDuration] = useState("");
  const [customWeeks, setCustomWeeks] = useState("");
  const [goal, setGoal] = useState("");
  const [frequency, setFrequency] = useState("");
  const [teaching, setTeaching] = useState("");
  const [assessment, setAssessment] = useState("");
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [courseCode, setCourseCode] = useState("");
  const [prerequisites, setPrerequisites] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  function advance() {
    setDirection("forward");
    setAnimKey((k) => k + 1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setDirection("back");
    setAnimKey((k) => k + 1);
    setStep((s) => s - 1);
  }

  function handleSelect(setter: (v: string) => void, value: string) {
    setter(value);
    setTimeout(advance, 150);
  }

  function handleFinish() {
    const finalDuration = customWeeks || duration || DEFAULTS.duration;
    const params = new URLSearchParams({
      topic,
      audience: audience || DEFAULTS.audience,
      duration: finalDuration,
      frequency: frequency || DEFAULTS.frequency,
      goal: goal || DEFAULTS.goal,
      teaching: teaching || DEFAULTS.teaching,
      assessment: assessment || DEFAULTS.assessment,
      ...(materialFile ? { material: materialFile.name } : {}),
      ...(courseCode ? { courseCode } : {}),
      ...(prerequisites ? { prerequisites } : {}),
    });
    router.push(`/new/build?${params.toString()}`);
  }

  const progress = (step / (TOTAL_STEPS + 1)) * 100;
  const animClass =
    direction === "forward" ? "animate-slide-in-right" : "animate-slide-in-left";

  const pillClass = (selected: boolean) =>
    `rounded-xl border px-4 py-4 text-base font-medium text-left transition-all duration-150 ${
      selected
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted"
    }`;

  function SkipButton() {
    return (
      <button
        onClick={advance}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
      >
        <SkipForward className="h-3.5 w-3.5" />
        Skip
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col px-4">
      {/* Progress bar */}
      <div className="w-full h-1 bg-muted">
        <div
          className="h-full bg-foreground transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-xl w-full">
          <div key={animKey} className={animClass}>

            {/* Step 0 — Course title (required, no skip) */}
            {step === 0 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 1 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">What do you want to teach?</h2>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && topic.trim().length > 0 && advance()}
                  placeholder="e.g. Introduction to Machine Learning..."
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                />
                <Button onClick={advance} disabled={topic.trim().length === 0} className="rounded-xl h-11 px-6">
                  Continue <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Step 1 — Audience */}
            {step === 1 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 2 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">Who are your students?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => handleSelect(setAudience, opt.value)} className={pillClass(audience === opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <SkipButton />
              </div>
            )}

            {/* Step 2 — Duration */}
            {step === 2 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 3 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">How long is the course?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {DURATION_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => { setCustomWeeks(""); handleSelect(setDuration, opt.value); }} className={pillClass(duration === opt.value && !customWeeks)}>
                      {opt.label}
                    </button>
                  ))}
                  <div className={`rounded-xl border px-4 py-3 transition-all duration-150 flex items-center gap-2 ${customWeeks ? "border-foreground" : "border-border bg-card hover:border-foreground/40"}`}>
                    <input
                      type="number" min={1} max={19} value={customWeeks}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = parseInt(val);
                        if (val === "" || (num > 0 && num < 20)) { setCustomWeeks(val); if (val) setDuration(val); }
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter" && customWeeks && parseInt(customWeeks) > 0) advance(); }}
                      placeholder="Custom"
                      className="w-full bg-transparent text-base font-medium text-foreground placeholder:text-muted-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">weeks</span>
                  </div>
                </div>
                {customWeeks && parseInt(customWeeks) > 0 && parseInt(customWeeks) < 20 && (
                  <Button onClick={advance} className="rounded-xl h-11 px-6">Continue <ArrowRight className="h-4 w-4 ml-1" /></Button>
                )}
                <SkipButton />
              </div>
            )}

            {/* Step 3 — Meeting frequency */}
            {step === 3 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 4 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">How often does the class meet?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => handleSelect(setFrequency, opt.value)} className={pillClass(frequency === opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <SkipButton />
              </div>
            )}

            {/* Step 4 — Learning objectives */}
            {step === 4 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 5 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">What are your learning objectives?</h2>
                  <p className="text-sm text-muted-foreground">In 1–3 sentences, what should students be able to do by the end?</p>
                </div>
                <textarea
                  autoFocus
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder={`"Design secure cloud applications and understand scalability principles."`}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                />
                <div className="flex items-center gap-4">
                  <Button onClick={advance} disabled={goal.trim().length === 0} className="rounded-xl h-11 px-6">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <SkipButton />
                </div>
              </div>
            )}

            {/* Step 5 — Teaching method */}
            {step === 5 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 6 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">How will this course mainly be taught?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {TEACHING_OPTIONS.map((opt, i) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleSelect(setTeaching, opt.value)}
                      className={`${pillClass(teaching === opt.value)} ${i === TEACHING_OPTIONS.length - 1 && TEACHING_OPTIONS.length % 2 !== 0 ? "col-span-2" : ""}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <SkipButton />
              </div>
            )}

            {/* Step 6 — Assessment preference */}
            {step === 6 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Question 7 of {TOTAL_STEPS}</p>
                  <h2 className="text-3xl font-bold text-foreground">How should students be evaluated?</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {ASSESSMENT_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => handleSelect(setAssessment, opt.value)} className={pillClass(assessment === opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <SkipButton />
              </div>
            )}

            {/* Step 7 — Course materials (optional) */}
            {step === 7 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Optional</p>
                  <h2 className="text-3xl font-bold text-foreground">Add course materials</h2>
                  <p className="text-sm text-muted-foreground">
                    Upload a textbook, previous syllabus, or notes to personalize your course outline.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => setMaterialFile(e.target.files?.[0] ?? null)}
                />

                {materialFile ? (
                  <div className="flex items-center justify-between rounded-xl border border-foreground bg-muted px-4 py-4">
                    <div className="flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-foreground shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{materialFile.name}</span>
                    </div>
                    <button onClick={() => setMaterialFile(null)} className="text-muted-foreground hover:text-foreground transition-colors ml-3 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-xl border-2 border-dashed border-border bg-card hover:border-foreground/30 hover:bg-muted transition-all duration-150 px-4 py-10 flex flex-col items-center gap-2 text-muted-foreground"
                  >
                    <Paperclip className="h-5 w-5" />
                    <span className="text-sm font-medium">Click to upload a file</span>
                    <span className="text-xs">PDF, DOCX, or TXT</span>
                  </button>
                )}

                {/* Optional course details */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-sm text-muted-foreground">Course details (optional)</p>
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="Course number — e.g. CS 301"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                  />
                  <input
                    type="text"
                    value={prerequisites}
                    onChange={(e) => setPrerequisites(e.target.value)}
                    placeholder="Prerequisites — e.g. Calculus I, basic Python"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 transition"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={advance} className="rounded-xl h-11 px-6">
                    Continue <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                  <Button variant="ghost" onClick={advance} className="rounded-xl h-11 px-6 text-muted-foreground">
                    Skip
                  </Button>
                </div>
              </div>
            )}

            {/* Step 8 — Summary */}
            {step === 8 && (
              <div className="space-y-7">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold text-foreground">Ready to generate your syllabus?</h2>
                  <p className="text-muted-foreground text-sm">Here&apos;s what we&apos;ll work with:</p>
                </div>
                <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                  {[
                    { label: "Course", value: topic },
                    { label: "Audience", value: AUDIENCE_OPTIONS.find((o) => o.value === audience)?.label || AUDIENCE_OPTIONS.find((o) => o.value === DEFAULTS.audience)?.label },
                    { label: "Duration", value: DURATION_OPTIONS.find((o) => o.value === (duration || DEFAULTS.duration))?.label ?? `${duration || DEFAULTS.duration} Weeks` },
                    { label: "Frequency", value: FREQUENCY_OPTIONS.find((o) => o.value === (frequency || DEFAULTS.frequency))?.label },
                    { label: "Objectives", value: goal || "AI will generate based on topic" },
                    { label: "Teaching style", value: TEACHING_OPTIONS.find((o) => o.value === (teaching || DEFAULTS.teaching))?.label },
                    { label: "Assessment", value: ASSESSMENT_OPTIONS.find((o) => o.value === (assessment || DEFAULTS.assessment))?.label },
                    ...(materialFile ? [{ label: "Materials", value: materialFile.name }] : []),
                    ...(courseCode ? [{ label: "Course code", value: courseCode }] : []),
                    ...(prerequisites ? [{ label: "Prerequisites", value: prerequisites }] : []),
                  ].map((row, i, arr) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm gap-4">
                        <span className="text-muted-foreground shrink-0">{row.label}</span>
                        <span className="font-medium text-foreground text-right">{row.value}</span>
                      </div>
                      {i < arr.length - 1 && <div className="h-px bg-border mt-3" />}
                    </div>
                  ))}
                </div>
                <Button onClick={handleFinish} className="rounded-xl h-11 px-6">
                  Generate syllabus <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Back button */}
      <div className="max-w-xl w-full mx-auto pb-8 h-16 flex items-end">
        {step > 0 && (
          <Button variant="outline" onClick={goBack} className="rounded-xl h-11 px-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
      </div>
    </main>
  );
}
