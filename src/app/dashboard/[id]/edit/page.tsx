"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSyllabusById, updateSyllabus } from "@/lib/storage";
import { SyllabusEditor } from "@/components/SyllabusEditor";
import type { Syllabus } from "@/lib/types";

export default function EditSyllabusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<Syllabus | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const saved = getSyllabusById(id);
    if (saved) setData(saved.syllabus);
    setMounted(true);
  }, [id]);

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

  function handleSave() {
    if (!data) return;
    updateSyllabus(id, data);
    router.push(`/dashboard/${id}`);
  }

  if (!mounted) return null;

  if (!data) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Syllabus not found.</p>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/${id}`)} className="gap-1.5 text-muted-foreground">
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
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save className="h-4 w-4" /> Save
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
