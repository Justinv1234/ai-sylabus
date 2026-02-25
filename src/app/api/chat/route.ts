import { NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: Request) {
  try {
    const { messages, currentMarkdown } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages are required" }, { status: 400 });
    }

    const client = getAnthropicClient();

    const systemPrompt = `You are an AI assistant helping a professor edit their course syllabus. The current syllabus is in markdown format below.

<current_syllabus>
${currentMarkdown}
</current_syllabus>

When the user asks you to make changes to the syllabus, respond with a JSON object containing:
- "explanation": A brief, friendly description of what you did (or your answer if no edits needed)
- "updatedMarkdown": The full updated markdown if you made changes, or null if no changes were needed

IMPORTANT:
- Always return valid JSON with exactly these two keys.
- When editing, return the COMPLETE updated markdown, not just the changed parts.
- Preserve the overall structure: # title, ## sections, tables, bullet lists.
- For questions that don't require edits (e.g. "what topics are covered?"), set updatedMarkdown to null.
- Keep your explanations concise (1-2 sentences).
- Do not wrap the JSON in markdown code fences.`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response
    let parsed: { explanation: string; updatedMarkdown: string | null };
    try {
      // Strip markdown fences if present
      const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "");
      parsed = JSON.parse(cleaned);
    } catch {
      // If parsing fails, treat the whole response as explanation with no edits
      parsed = { explanation: text, updatedMarkdown: null };
    }

    return NextResponse.json(parsed);
  } catch (e) {
    console.error("Chat API error:", e);
    return NextResponse.json(
      { error: "Failed to process chat message" },
      { status: 500 }
    );
  }
}
