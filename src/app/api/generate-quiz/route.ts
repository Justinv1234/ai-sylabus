import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";
import type { Syllabus } from "@/lib/types";

function buildFormatInstructions(questionFormat: string, numQuestions: number): string {
  switch (questionFormat) {
    case "multiple-choice":
      return `Return a "questions" array of exactly ${numQuestions} items.
Each: { "number": N, "type": "multiple-choice", "text": "...", "points": N, "choices": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A. correct answer" }
Cover different topics and cognitive levels (recall, application, analysis).`;

    case "short-answer":
      return `Return a "questions" array of exactly ${numQuestions} items.
Each: { "number": N, "type": "short-answer", "text": "...", "points": N, "answer": "expected 1-2 sentence answer" }
Questions should test understanding and recall — concise, focused, and specific.`;

    default: // mixed
      return `Return a "questions" array of exactly ${numQuestions} items.
Each: { "number": N, "type": "multiple-choice"|"short-answer"|"problem"|"essay", "text": "...", "points": N, "answer": "..." }
For "multiple-choice" include "choices": ["A. ...", "B. ...", "C. ...", "D. ..."].
Omit "choices" for all other types.
Use a good mix of question types — approximately 40% multiple-choice, 30% short-answer, 20% problem, 10% essay.`;
  }
}

export async function POST(req: NextRequest) {
  const { syllabus, weekStart, weekEnd, numQuestions, difficulty, questionFormat, timeLimit, customInstructions } = (await req.json()) as {
    syllabus: Syllabus;
    weekStart: number;
    weekEnd: number;
    numQuestions: number;
    difficulty: string;
    questionFormat: string;
    timeLimit?: string;
    customInstructions?: string;
  };

  const weeks = syllabus.weeklySchedule.filter((w) => w.week >= weekStart && w.week <= weekEnd);
  if (weeks.length === 0) {
    return NextResponse.json({ error: "No weeks found in the specified range" }, { status: 400 });
  }

  const topicsList = weeks.map((w) => `Week ${w.week}: ${w.topic} — ${w.subtopics.join(", ")}`).join("\n");
  const topicsArray = weeks.map((w) => w.topic);

  const formatInstructions = buildFormatInstructions(questionFormat, numQuestions);

  const systemPrompt = `You are an expert academic instructor creating assessments. Generate well-structured, pedagogically sound quiz/test questions appropriate for the course level. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Generate a ${weekStart === weekEnd ? "quiz" : "comprehensive assessment"} for the following course:

Course: ${syllabus.courseTitle}
${syllabus.courseCode ? `Course Code: ${syllabus.courseCode}` : ""}
Course Description: ${syllabus.courseDescription}

Covering ${weekStart === weekEnd ? `Week ${weekStart}` : `Weeks ${weekStart}-${weekEnd}`}:
${topicsList}

Learning Objectives for the course:
${syllabus.learningObjectives.map((o) => `- ${o}`).join("\n")}

Difficulty level: ${difficulty}
${timeLimit ? `Time limit: ${timeLimit}` : ""}

${formatInstructions}

Distribute questions proportionally across all topics covered.

Wrap everything in this structure:
{
  "title": "descriptive title for this assessment",
  "type": "${weekEnd - weekStart >= syllabus.weeklySchedule.length - 1 ? "final" : weekEnd - weekStart >= Math.floor(syllabus.weeklySchedule.length / 2) ? "midterm" : weekStart === weekEnd ? "quiz" : "test"}",
  "weekStart": ${weekStart},
  "weekEnd": ${weekEnd},
  "topics": ${JSON.stringify(topicsArray)},
  "instructions": "Clear instructions for students (2-4 sentences: what to do, rules, time limit if applicable)",
  "totalPoints": 100,
  ${timeLimit ? `"timeLimit": "${timeLimit}",` : ""}
  "questions": [ ... ]
}

- totalPoints should be a clean number (50, 75, 100)
- Questions should cover ALL topics in the week range proportionally
- Be realistic, specific, and test genuine understanding${customInstructions ? `

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
    const quiz = JSON.parse(cleaned);

    return NextResponse.json(quiz);
  } catch (err) {
    console.error("Quiz generation error:", err);
    return NextResponse.json({ error: "Failed to generate quiz" }, { status: 500 });
  }
}
