"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, Download, Loader2, Check, FileText, X } from "lucide-react";
import { saveSyllabus } from "@/lib/storage";
import { SyllabusEditor } from "@/components/SyllabusEditor";
import type { Syllabus } from "@/lib/types";

const DURATION_OPTIONS = [
  { value: "4", label: "4 Weeks" },
  { value: "8", label: "8 Weeks" },
  { value: "14", label: "14 Weeks" },
];

const FREQUENCY_OPTIONS = [
  { value: "1x", label: "1x / week" },
  { value: "2x", label: "2x / week" },
  { value: "3x", label: "3x / week" },
  { value: "async", label: "Async" },
];

type PageState = "idle" | "parsing" | "review";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<PageState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Syllabus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Context questions
  const [duration, setDuration] = useState("");
  const [customWeeks, setCustomWeeks] = useState("");
  const [frequency, setFrequency] = useState("");

  const weeks = duration === "custom" ? customWeeks : duration;

  /* ── File selection & validation ─────────────────────────────── */

  function handleFileSelect(selected: File) {
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("File is too large. Maximum size is 10 MB.");
      return;
    }
    setError(null);
    setFile(selected);
  }

  /* ── Drag-and-drop ───────────────────────────────────────────── */

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Upload & parse ──────────────────────────────────────────── */

  async function handleUpload() {
    if (!file || !weeks || !frequency) return;
    setState("parsing");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("duration", weeks);
      formData.append("frequency", frequency);

      const res = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        setState("idle");
      } else {
        document.title = json.courseTitle || "Course Syllabus";
        setData(json);
        setState("review");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  /* ── Download PDF ────────────────────────────────────────────── */

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

  /* ── Done: save & redirect ───────────────────────────────────── */

  function handleDone() {
    if (!data) return;
    const saved = saveSyllabus(data, {
      topic: data.courseTitle,
      audience: "",
      duration: String(data.weeklySchedule.length),
      frequency,
      goal: data.learningObjectives.join("; "),
      teaching: "",
      assessment: "",
      courseCode: data.courseCode || undefined,
      prerequisites: data.prerequisites || undefined,
    });
    router.push(`/dashboard/${saved.id}`);
  }

  /* ── Parsing state ───────────────────────────────────────────── */

  if (state === "parsing") {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Parsing your syllabus...</p>
        <p className="text-muted-foreground/60 text-xs">This usually takes 10–20 seconds</p>
      </main>
    );
  }

  /* ── Review state ────────────────────────────────────────────── */

  if (state === "review" && data) {
    return (
      <>
        <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setState("idle"); setData(null); }} className="gap-1.5 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Upload another
          </Button>
          <p className="text-xs text-muted-foreground">Click any text to edit</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadPDF} disabled={isDownloading} className="gap-1.5">
              {isDownloading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Download className="h-4 w-4" /> Download PDF</>
              )}
            </Button>
            <Button size="sm" onClick={handleDone} className="gap-1.5">
              <Check className="h-4 w-4" /> Done
            </Button>
          </div>
        </div>

        <SyllabusEditor
          data={data}
          onChange={(fn) => setData((d) => d ? fn(d) : d)}
        />
      </>
    );
  }

  /* ── Idle state (upload UI) ──────────────────────────────────── */

  const canSubmit = !!file && !!weeks && !!frequency;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold text-foreground">Upload a Syllabus</h1>
          <p className="text-muted-foreground">Upload an existing PDF syllabus and we&apos;ll parse it into an editable format.</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed px-6 py-14 flex flex-col items-center gap-3 transition-all duration-200 cursor-pointer ${
            isDragging
              ? "border-foreground bg-muted"
              : file
                ? "border-foreground/30 bg-card"
                : "border-border bg-card hover:border-foreground/30 hover:bg-muted"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />

          {file ? (
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors ml-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Drag and drop your PDF here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse (PDF only, max 10 MB)</p>
              </div>
            </>
          )}
        </div>

        {/* Context questions — shown after file is selected */}
        {file && (
          <div className="space-y-5 rounded-xl border border-border bg-card p-5">
            <p className="text-sm font-medium text-foreground">A couple quick questions to help us parse accurately:</p>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How long is the course?</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setDuration(opt.value); setCustomWeeks(""); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      duration === opt.value
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => setDuration("custom")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    duration === "custom"
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground hover:bg-muted/80"
                  }`}
                >
                  Custom
                </button>
              </div>
              {duration === "custom" && (
                <input
                  type="number"
                  min={1}
                  max={19}
                  placeholder="Number of weeks"
                  value={customWeeks}
                  onChange={(e) => {
                    const val = e.target.value;
                    const num = parseInt(val);
                    if (val === "" || (num > 0 && num < 20)) setCustomWeeks(val);
                  }}
                  className="w-40 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
            </div>

            {/* Frequency */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">How often does class meet?</label>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFrequency(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      frequency === opt.value
                        ? "bg-foreground text-background"
                        : "bg-muted text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/")} className="rounded-xl h-11 px-6">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <Button onClick={handleUpload} disabled={!canSubmit} className="rounded-xl h-11 px-6">
            <Upload className="h-4 w-4 mr-1" /> Parse Syllabus
          </Button>
        </div>
      </div>
    </main>
  );
}
