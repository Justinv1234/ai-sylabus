"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, Check } from "lucide-react";
import { saveSyllabus } from "@/lib/storage";
import { SyllabusEditor } from "@/components/SyllabusEditor";
import type { Syllabus } from "@/lib/types";

function BuildContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<Syllabus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

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

  function handleDone() {
    if (!data) return;
    const wizardParams = {
      topic: params.get("topic") ?? "",
      audience: params.get("audience") ?? "",
      duration: params.get("duration") ?? "",
      frequency: params.get("frequency") ?? "",
      goal: params.get("goal") ?? "",
      teaching: params.get("teaching") ?? "",
      assessment: params.get("assessment") ?? "",
      courseCode: params.get("courseCode") || undefined,
      prerequisites: params.get("prerequisites") || undefined,
    };
    const saved = saveSyllabus(data, wizardParams);
    router.push(`/dashboard/${saved.id}`);
  }

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

  return (
    <>
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
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
