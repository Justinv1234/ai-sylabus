import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  const { courseTitle, weekNumber, topic, subtopics, assignments, audience, teaching } =
    await req.json();

  const systemPrompt = `You are an expert educator who creates detailed, actionable lesson plans. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Create a detailed lesson plan for Week ${weekNumber} of a course titled "${courseTitle}".

Topic: ${topic}
Subtopics: ${Array.isArray(subtopics) ? subtopics.join(", ") : subtopics}
Assignments due: ${assignments || "None"}
Target Audience: ${audience || "College students"}
Teaching Approach: ${teaching || "Mixed"}

Return this exact JSON structure:
{
  "objectives": [
    "specific learning objective for this week (action-verb phrase)"
  ],
  "materialsNeeded": [
    "material or resource needed for this lesson"
  ],
  "lessonOutline": [
    {
      "activity": "activity name",
      "duration": "XX minutes",
      "description": "what happens during this activity"
    }
  ],
  "assessmentHomework": "description of assessment or homework for this week"
}

Requirements:
- objectives: 3-5 specific, measurable objectives for this week only
- materialsNeeded: realistic materials/resources needed (slides, software, handouts, etc.)
- lessonOutline: 4-8 activities that fill a typical class session (50-75 minutes total), each with a clear duration
- assessmentHomework: tie back to the assignments listed above if any; otherwise suggest appropriate practice
- Be specific and practical — a real instructor should be able to follow this plan`;

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
    const lessonPlan = JSON.parse(cleaned);

    return NextResponse.json(lessonPlan);
  } catch (err) {
    console.error("Lesson plan generation error:", err);
    return NextResponse.json({ error: "Failed to generate lesson plan" }, { status: 500 });
  }
}
