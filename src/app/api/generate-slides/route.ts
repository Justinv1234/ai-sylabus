import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { meeting, weekTopic, courseTitle, meetingIndex } = (await req.json()) as {
    meeting: { label: string; focus: string; blocks: { title: string; duration: number; description: string }[] };
    weekTopic: string;
    courseTitle: string;
    meetingIndex: number;
  };

  const systemPrompt = `You are an expert instructor creating slide deck outlines. Generate clear, well-organized slide outlines that support effective teaching. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Create a slide deck outline for this class meeting:

Course: ${courseTitle}
Week topic: ${weekTopic}
Session: ${meeting.label} — ${meeting.focus}

Session blocks:
${meeting.blocks.map((b) => `- ${b.title} (${b.duration} min): ${b.description}`).join("\n")}

Generate a slide outline with 8-15 slides that support this session.

Return this exact JSON:
{
  "meetingIndex": ${meetingIndex},
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ]
}

Requirements:
- First slide should be a title/agenda slide
- Last slide should be a summary/next-steps slide
- Each slide should have 2-5 bullet points
- Bullets should be concise phrases, not full paragraphs
- Slides should follow the session flow (opening → content → activity → wrap-up)
- Include slides for key concepts, examples, discussion prompts, and activities`;

  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const slides = JSON.parse(cleaned);

    return NextResponse.json(slides);
  } catch (err) {
    console.error("Slide generation error:", err);
    return NextResponse.json({ error: "Failed to generate slides" }, { status: 500 });
  }
}
