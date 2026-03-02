import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { quiz, message, history } = await req.json();

  const systemPrompt = `You are an AI assistant embedded in a quiz/test editor. Professors use you to modify their generated assessments.

You always receive the CURRENT quiz and must respond with valid JSON only — no markdown, no text outside the JSON:
{
  "reply": "Brief, friendly 1-2 sentence response",
  "quiz": { ...the complete updated quiz object... }
}

This assessment uses a "questions" array.
- Question types: "multiple-choice", "short-answer", "problem", "essay"
- For "multiple-choice": include exactly 4 "choices" labeled A, B, C, D
- Renumber questions if you add/remove them
- Update totalPoints accordingly

Rules:
- Always return the COMPLETE quiz — never partial or truncated
- Keep the same "type", "weekStart", "weekEnd", and "topics" fields
- For pure questions (no changes needed): answer in reply and return quiz unchanged
- Keep replies concise and conversational

Current quiz:
${JSON.stringify(quiz, null, 2)}`;

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
    console.error("Chat quiz error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
