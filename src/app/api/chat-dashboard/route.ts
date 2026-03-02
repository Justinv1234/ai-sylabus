import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { syllabus, content, message, history } = await req.json();

  const systemPrompt = `You are a helpful AI assistant on a course dashboard. Professors use you to navigate the app and ask questions about their course.

You must respond with valid JSON only — no markdown, no text outside the JSON:
{
  "reply": "A friendly, helpful response",
  "navigate": "optional/relative/path"
}

Available pages (use these exact paths for the "navigate" field):
- "quiz" — Quiz / Test Generator (create quizzes and tests)
- "homework?week=N" — Assignment Generator for week N (create homework, assignments)
- "slides?week=N" — Week Planner for week N (plan class meetings, generate slides)
- "study-guide" — Study Guide Generator
- "edit" — Edit Syllabus

Rules:
- If the user wants to go to a specific feature, set "navigate" to the appropriate path
- If the user mentions a week number, include it as ?week=N for homework and slides
- If no navigation is needed (pure Q&A), omit the "navigate" field entirely
- For questions about course content, answer using the syllabus data below
- Keep replies concise, friendly, and conversational (1-3 sentences)
- If the user's request is ambiguous, ask a clarifying question instead of guessing

Course: ${syllabus.courseTitle}${syllabus.courseCode ? ` (${syllabus.courseCode})` : ""}

Weekly Schedule:
${syllabus.weeklySchedule.map((w: { week: number; topic: string; subtopics: string[] }) => `Week ${w.week}: ${w.topic} — ${w.subtopics.join(", ")}`).join("\n")}

Learning Objectives:
${syllabus.learningObjectives.map((o: string) => `- ${o}`).join("\n")}

Content created so far:
- Homework assignments: ${content.homeworkWeeks.length > 0 ? `Weeks ${content.homeworkWeeks.join(", ")}` : "None yet"}
- Week plans: ${content.weekPlanWeeks.length > 0 ? `Weeks ${content.weekPlanWeeks.join(", ")}` : "None yet"}`;

  const messages = [
    ...history.map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];

  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Chat dashboard error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
