import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { homework, message, history } = await req.json();

  const fmt = homework.format || "problem-set";
  const contentKey = homework.questions ? "questions" : homework.project ? "project" : homework.lab ? "lab" : homework.coding ? "coding" : homework.research ? "research" : "questions";

  const structureHints: Record<string, string> = {
    questions: `This assignment uses a "questions" array.
- Question types: "multiple-choice", "short-answer", "problem", "essay"
- For "multiple-choice": include exactly 4 "choices" labeled A, B, C, D
- Renumber questions if you add/remove them
- Update totalPoints accordingly`,

    project: `This assignment uses a "project" object with:
- "description": string, "objectives": string[], "steps": [{ step, title, description, deliverable }], "finalDeliverable": string, "gradingCriteria": [{ criterion, weight }]
- Renumber steps if you add/remove them
- Grading criteria weights must sum to 100%`,

    lab: `This assignment uses a "lab" object with:
- "background": string, "materials": string[], "procedure": [{ step, instruction }], "dataCollection": string, "analysisQuestions": string[]
- Renumber procedure steps if you add/remove them`,

    coding: `This assignment uses a "coding" object with:
- "description": string, "requirements": string[], "tasks": [{ number, title, description, examples? }], "bonusChallenges": string[]
- Renumber tasks if you add/remove them`,

    research: `This assignment uses a "research" object with:
- "topic": string, "background": string, "requirements": string[], "guidingQuestions": string[], "deliverables": string[], "evaluationCriteria": [{ criterion, weight }]
- Evaluation criteria weights must sum to 100%`,
  };

  const systemPrompt = `You are an AI assistant embedded in an assignment editor. Professors use you to modify their generated ${fmt} assignments.

You always receive the CURRENT assignment and must respond with valid JSON only — no markdown, no text outside the JSON:
{
  "reply": "Brief, friendly 1-2 sentence response",
  "homework": { ...the complete updated assignment object... }
}

${structureHints[contentKey] || structureHints.questions}

Rules:
- Always return the COMPLETE assignment — never partial or truncated
- Keep the same "format" field and content structure
- For pure questions (no changes needed): answer in reply and return homework unchanged
- Keep replies concise and conversational

Current assignment:
${JSON.stringify(homework, null, 2)}`;

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
      max_tokens: 8000,
      system: systemPrompt,
      messages,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const result = JSON.parse(cleaned);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Chat homework error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
