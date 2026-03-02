"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllSyllabi, deleteSyllabus } from "@/lib/storage";
import { formatRelativeTime } from "@/lib/utils";
import type { SavedSyllabus } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [syllabi, setSyllabi] = useState<SavedSyllabus[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setSyllabi(getAllSyllabi());
    setMounted(true);
  }, []);

  function handleDelete(id: string) {
    if (!window.confirm("Delete this syllabus?")) return;
    deleteSyllabus(id);
    setSyllabi(getAllSyllabi());
  }

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-foreground">Course Builder</Link>
        <Button onClick={() => router.push("/new")} className="gap-1.5">
          <Plus className="h-4 w-4" /> New Syllabus
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Your Syllabi</h1>
          <p className="text-muted-foreground">Select a syllabus to view it or generate course materials.</p>
        </div>

        {syllabi.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">No syllabi saved yet.</p>
            <Button onClick={() => router.push("/new")} variant="outline">
              Create your first syllabus
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {syllabi.map((item) => (
              <Card
                key={item.id}
                className="hover:border-foreground/30 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/${item.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-base truncate">{item.syllabus.courseTitle}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-1.5 mt-1">
                    {item.syllabus.courseCode && (
                      <Badge variant="outline" className="text-xs">{item.syllabus.courseCode}</Badge>
                    )}
                    <span>{item.syllabus.weeklySchedule.length} weeks</span>
                    {item.wizardParams?.audience && (
                      <span className="capitalize">· {item.wizardParams.audience}</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(new Date(item.updatedAt))}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                      className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/${item.id}`); }}
                      className="gap-1 h-7 px-2"
                    >
                      Open <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
