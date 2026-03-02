import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { weekPlan, message, history } = await req.json();

  const systemPrompt = `You are an AI assistant embedded in a week planner editor. Professors use you to modify their generated week plans.

You always receive the CURRENT week plan and must respond with valid JSON only — no markdown, no text outside the JSON:
{
  "reply": "Brief, friendly 1-2 sentence response",
  "weekPlan": { ...the complete updated week plan object... }
}

The week plan structure:
- "meetings" array, each with "label", "focus", "blocks" array, and optional "slides"
- Each block has "title", "duration" (minutes), "description", and optional "materials"
- If slides exist on a meeting, they have "meetingIndex" and "slides" array with "title" and "bullets"

Rules:
- Always return the COMPLETE week plan — never partial or truncated
- Preserve any existing slides data unless the user asks to modify slides
- Keep the same "mode" field (sync/async)
- For pure questions (no changes needed): answer in reply and return weekPlan unchanged
- Keep replies concise and conversational

Current week plan:
${JSON.stringify(weekPlan, null, 2)}`;

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
    console.error("Chat week plan error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
