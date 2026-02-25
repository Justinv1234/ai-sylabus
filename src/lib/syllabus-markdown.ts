// Conversion between Syllabus JSON ↔ Markdown
// Markdown is the source of truth for the editor; JSON is used for PDF export.

export type GradingItem = { component: string; weight: string; description: string };
export type WeekItem = { week: number; topic: string; subtopics: string[]; assignments: string };
export type Policies = { attendance: string; lateWork: string; academicIntegrity: string };
export type Syllabus = {
  courseTitle: string;
  courseCode?: string;
  courseDescription: string;
  learningObjectives: string[];
  prerequisites?: string;
  requiredMaterials: string[];
  gradingBreakdown: GradingItem[];
  weeklySchedule: WeekItem[];
  policies: Policies;
};

// ── JSON → Markdown ──────────────────────────────────────────────────────────

export function syllabusToMarkdown(s: Syllabus): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${s.courseTitle}`);
  if (s.courseCode) lines.push(`*${s.courseCode}*`);
  lines.push("");

  // Course Description
  lines.push("## Course Description");
  lines.push(s.courseDescription);
  lines.push("");

  // Prerequisites
  if (s.prerequisites) {
    lines.push("## Prerequisites");
    lines.push(s.prerequisites);
    lines.push("");
  }

  // Learning Objectives
  lines.push("## Learning Objectives");
  lines.push("*By the end of this course, students will be able to:*");
  for (const obj of s.learningObjectives) {
    lines.push(`- ${obj}`);
  }
  lines.push("");

  // Required Materials
  if (s.requiredMaterials.length > 0) {
    lines.push("## Required Materials");
    for (const m of s.requiredMaterials) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }

  // Grading Breakdown
  lines.push("## Grading Breakdown");
  lines.push("| Component | Weight | Description |");
  lines.push("| --- | --- | --- |");
  for (const g of s.gradingBreakdown) {
    lines.push(`| ${esc(g.component)} | ${esc(g.weight)} | ${esc(g.description)} |`);
  }
  lines.push("");

  // Course Schedule
  lines.push("## Course Schedule");
  lines.push("| Week | Topic | Subtopics & Assignments |");
  lines.push("| --- | --- | --- |");
  for (const w of s.weeklySchedule) {
    const sub = w.subtopics.join(", ");
    const assign = w.assignments ? ` — *${esc(w.assignments)}*` : "";
    lines.push(`| ${w.week} | ${esc(w.topic)} | ${esc(sub)}${assign} |`);
  }
  lines.push("");

  // Course Policies
  lines.push("## Course Policies");
  lines.push("### Attendance");
  lines.push(s.policies.attendance);
  lines.push("");
  lines.push("### Late Work");
  lines.push(s.policies.lateWork);
  lines.push("");
  lines.push("### Academic Integrity");
  lines.push(s.policies.academicIntegrity);
  lines.push("");

  return lines.join("\n");
}

function esc(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// ── Markdown → JSON ──────────────────────────────────────────────────────────
// Best-effort parser for PDF export. Handles markdown produced by syllabusToMarkdown
// and also markdown edited by the user or AI (with reasonable structure).

export function markdownToSyllabus(md: string): Syllabus {
  const sections = splitSections(md);

  // Title from first H1
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const courseTitle = titleMatch ? titleMatch[1].trim() : "Untitled Course";

  // Course code: italic line right after H1
  const codeMatch = md.match(/^#\s+.+\n\*([^*]+)\*/m);
  const courseCode = codeMatch ? codeMatch[1].trim() : undefined;

  // Course Description
  const courseDescription = getBodyText(sections["course description"] || "");

  // Prerequisites
  const prerequisites = sections["prerequisites"]
    ? getBodyText(sections["prerequisites"])
    : undefined;

  // Learning Objectives
  const learningObjectives = extractBullets(sections["learning objectives"] || "");

  // Required Materials
  const requiredMaterials = extractBullets(sections["required materials"] || "");

  // Grading Breakdown
  const gradingBreakdown = parseGradingTable(sections["grading breakdown"] || "");

  // Course Schedule
  const weeklySchedule = parseScheduleTable(sections["course schedule"] || "");

  // Course Policies
  const policies = parsePolicies(sections["course policies"] || "");

  return {
    courseTitle,
    courseCode,
    courseDescription,
    learningObjectives,
    prerequisites,
    requiredMaterials,
    gradingBreakdown,
    weeklySchedule,
    policies,
  };
}

// Split markdown into sections by ## headings. Keys are lowercase heading text.
function splitSections(md: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = md.split(/^##\s+/m);
  for (let i = 1; i < parts.length; i++) {
    const newline = parts[i].indexOf("\n");
    if (newline === -1) continue;
    const key = parts[i].slice(0, newline).trim().toLowerCase();
    result[key] = parts[i].slice(newline + 1).trim();
  }
  return result;
}

// Get non-heading body text from a section (skip italic preambles)
function getBodyText(section: string): string {
  return section
    .split("\n")
    .filter((l) => !l.startsWith("#") && !l.startsWith("|"))
    .join("\n")
    .trim();
}

// Extract bullet points from a section
function extractBullets(section: string): string[] {
  return section
    .split("\n")
    .filter((l) => /^[-*]\s/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, "").trim());
}

// Parse a 3-column table (Component | Weight | Description)
function parseGradingTable(section: string): GradingItem[] {
  const rows = extractTableRows(section);
  return rows.map((cols) => ({
    component: cols[0] || "",
    weight: cols[1] || "",
    description: cols[2] || "",
  }));
}

// Parse course schedule table
function parseScheduleTable(section: string): WeekItem[] {
  const rows = extractTableRows(section);
  return rows.map((cols, i) => {
    const weekNum = parseInt(cols[0]) || i + 1;
    const topic = cols[1] || "";
    const raw = cols[2] || "";
    // Split on " — *...*" pattern for assignments
    const assignMatch = raw.match(/^(.*?)\s*—\s*\*([^*]*)\*\s*$/);
    let subtopics: string[];
    let assignments: string;
    if (assignMatch) {
      subtopics = assignMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      assignments = assignMatch[2].trim();
    } else {
      subtopics = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      assignments = "";
    }
    return { week: weekNum, topic, subtopics, assignments };
  });
}

// Extract data rows from a markdown table (skip header + separator)
function extractTableRows(section: string): string[][] {
  const lines = section.split("\n").filter((l) => l.trim().startsWith("|"));
  // Skip header row and separator row
  const dataLines = lines.slice(2);
  return dataLines.map((line) =>
    line
      .split("|")
      .slice(1, -1) // remove empty first/last from leading/trailing |
      .map((cell) => cell.replace(/\\\|/g, "|").trim())
  );
}

// Parse policies from ### sub-headings
function parsePolicies(section: string): Policies {
  const sub = splitSubSections(section);
  return {
    attendance: sub["attendance"] || "",
    lateWork: sub["late work"] || "",
    academicIntegrity: sub["academic integrity"] || "",
  };
}

function splitSubSections(section: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = section.split(/^###\s+/m);
  for (let i = 1; i < parts.length; i++) {
    const newline = parts[i].indexOf("\n");
    if (newline === -1) continue;
    const key = parts[i].slice(0, newline).trim().toLowerCase();
    result[key] = parts[i].slice(newline + 1).trim();
  }
  return result;
}
