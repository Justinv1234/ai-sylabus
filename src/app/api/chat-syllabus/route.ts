import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { syllabus, message, history } = await req.json();

  const systemPrompt = `You are an AI assistant embedded in a course syllabus editor. Professors use you to modify their syllabus or ask questions about it.

You always receive the CURRENT syllabus and must respond with valid JSON only — no markdown, no text outside the JSON:
{
  "reply": "Brief, friendly 1-2 sentence response",
  "syllabus": { ...the complete updated syllabus object... }
}

Rules:
- Always return the COMPLETE syllabus — never partial or truncated
- To remove a policy or section: set its value to an empty string ""
- To regenerate or rewrite content: replace it with new, specific content
- For pure questions (no changes needed): answer in reply and return syllabus unchanged
- Keep replies concise and conversational
- Maintain the exact same JSON structure as the input syllabus

Current syllabus:
${JSON.stringify(syllabus, null, 2)}`;

  // Build conversation history (just text, not the JSON blobs)
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
    console.error("Chat syllabus error:", err);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
