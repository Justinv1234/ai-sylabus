import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";
import type { Syllabus } from "@/lib/types";

const TEACHING_HINTS: Record<string, string> = {
  lecture: "Focus on structured knowledge delivery with clear explanations and examples.",
  project: "Emphasize hands-on building, iterative work, and practical application.",
  lab: "Include experimental procedures, demonstrations, and guided practice.",
  seminar: "Center on discussion, student presentations, and collaborative analysis.",
  mixed: "Balance direct instruction with interactive activities and discussion.",
};

export async function POST(req: NextRequest) {
  const { syllabus, weekNumber, frequency, teaching, customInstructions } = (await req.json()) as {
    syllabus: Syllabus;
    weekNumber: number;
    frequency: string;
    teaching?: string;
    customInstructions?: string;
  };

  const week = syllabus.weeklySchedule.find((w) => w.week === weekNumber);
  if (!week) {
    return NextResponse.json({ error: "Week not found in syllabus" }, { status: 400 });
  }

  const isAsync = frequency === "async";
  const meetingCount = isAsync ? 1 : parseInt(frequency);
  const mode = isAsync ? "async" : "sync";

  const blockInstructions = isAsync
    ? `Generate exactly 1 module with 4 blocks in this order:
1. "Watch" (estimated minutes) — video lectures or recorded content to watch
2. "Read" (estimated minutes) — readings, articles, or textbook sections
3. "Activity" (estimated minutes) — interactive exercise, discussion post, or practice
4. "Submit" (estimated minutes) — assignment or deliverable to turn in`
    : `Each meeting MUST have exactly 4 blocks in this order:
1. "Opening / Warm-up" (5-10 min) — hook, review, or context-setting activity
2. "Main Content" (20-35 min) — core instruction, lecture, or exploration
3. "Activity" (15-25 min) — practice, discussion, group work, or hands-on exercise
4. "Wrap-up" (5-10 min) — summary, preview next session, Q&A`;

  const systemPrompt = `You are an expert academic instructor designing class session plans. Generate well-structured, pedagogically sound lesson plans appropriate for the course level. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Generate a week plan for the following course:

Course: ${syllabus.courseTitle}
${syllabus.courseCode ? `Course Code: ${syllabus.courseCode}` : ""}
Course Description: ${syllabus.courseDescription}

Week ${week.week}: ${week.topic}
Subtopics: ${week.subtopics.join(", ")}
${week.assignments ? `Assignments/readings: ${week.assignments}` : ""}

Learning Objectives:
${syllabus.learningObjectives.map((o) => `- ${o}`).join("\n")}

${teaching ? `Teaching approach: ${TEACHING_HINTS[teaching] || teaching}` : ""}

This course meets ${isAsync ? "asynchronously (online, self-paced)" : `${meetingCount}x per week (in-person/synchronous)`}.

Generate exactly ${meetingCount} ${isAsync ? "module" : meetingCount === 1 ? "meeting" : "meetings"} for this week.

${blockInstructions}

Return this exact JSON structure:
{
  "weekNumber": ${weekNumber},
  "topic": "${week.topic}",
  "courseTitle": "${syllabus.courseTitle}",
  "mode": "${mode}",
  "meetings": [
    {
      "label": "${isAsync ? "Module" : "Meeting 1"}",
      "focus": "One-sentence focus statement for this session",
      "blocks": [
        {
          "title": "Block name",
          "duration": 10,
          "description": "2-3 sentences: what happens, what the instructor does, what students do",
          "materials": "Optional: specific slides, handouts, tools, or resources needed"
        }
      ]
    }
  ]
}

Requirements:
- Block durations within a meeting should sum to a realistic class session length (50-75 min)
- Descriptions should be specific and actionable, not generic
- The "materials" field is optional — include only when there are specific resources to mention
- All content must be specific to "${week.topic}" and its subtopics
- ${meetingCount > 1 ? "Each meeting should cover different subtopics to avoid repetition" : "Cover all subtopics within the module"}${customInstructions ? `

IMPORTANT — Professor's custom instructions (follow these closely):
${customInstructions}` : ""}`;

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const weekPlan = JSON.parse(cleaned);

    return NextResponse.json(weekPlan);
  } catch (err) {
    console.error("Week plan generation error:", err);
    return NextResponse.json({ error: "Failed to generate week plan" }, { status: 500 });
  }
}
