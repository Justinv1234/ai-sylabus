"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StudyGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/${id}`)} className="gap-1.5 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Syllabus
        </Button>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center rounded-xl bg-muted p-4">
          <BookOpen className="h-8 w-8 text-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Study Guide</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Create student-facing study guides for midterms and final exams.
        </p>
        <p className="text-sm text-muted-foreground/60">Coming soon</p>
      </div>
    </main>
  );
}
