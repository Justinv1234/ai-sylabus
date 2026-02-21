import Link from "next/link";
import { Upload, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-2xl w-full space-y-10 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            Course Builder
          </h1>
          <p className="text-muted-foreground text-lg">
            How would you like to get started?
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* From scratch option */}
          <Link href="/new" className="group block">
            <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all duration-200 hover:border-foreground/30 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
              <div className="mb-5 inline-flex items-center justify-center rounded-xl bg-muted p-3 group-hover:bg-foreground/10 transition-colors">
                <Sparkles className="h-6 w-6 text-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Start from Scratch
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Starting fresh? Tell us about your course and we&apos;ll generate
                a complete syllabus for you.
              </p>
            </div>
          </Link>

          {/* Upload option */}
          <Link href="/upload" className="group block">
            <div className="h-full rounded-2xl border border-border bg-card p-8 text-left transition-all duration-200 hover:border-foreground/30 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer">
              <div className="mb-5 inline-flex items-center justify-center rounded-xl bg-muted p-3 group-hover:bg-foreground/10 transition-colors">
                <Upload className="h-6 w-6 text-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Upload a Syllabus
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Have an existing syllabus? Upload it and we&apos;ll use it as the
                starting point for a new one.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
