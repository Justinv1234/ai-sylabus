import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

const AUDIENCE_LABELS: Record<string, string> = {
  "high-school": "High School students",
  "undergraduate": "Undergraduate students",
  "graduate": "Graduate students",
  "professional": "Working Professionals",
};

const FREQUENCY_LABELS: Record<string, string> = {
  "1x": "once a week",
  "2x": "twice a week",
  "3x": "three times a week",
  "async": "asynchronously (online, self-paced)",
};

const TEACHING_LABELS: Record<string, string> = {
  "lecture": "Lecture-based",
  "project": "Project-based",
  "lab": "Lab / Hands-on",
  "seminar": "Discussion / Seminar",
  "mixed": "Mixed approach",
};

const ASSESSMENT_LABELS: Record<string, string> = {
  "exams": "Exams-focused",
  "projects": "Projects-focused",
  "balanced": "Balanced (mix of exams and projects)",
  "assignments": "Continuous assignments",
};

export async function POST(req: NextRequest) {
  const { topic, audience, duration, frequency, goal, teaching, assessment, courseCode, prerequisites } =
    await req.json();

  const sessionsPerWeek = frequency === "async" ? null : parseInt(frequency);
  const totalSessions = sessionsPerWeek
    ? `${sessionsPerWeek * parseInt(duration)} sessions total`
    : "self-paced";

  const audienceLabel = AUDIENCE_LABELS[audience] ?? audience;
  const frequencyLabel = FREQUENCY_LABELS[frequency] ?? frequency;
  const teachingLabel = TEACHING_LABELS[teaching] ?? teaching;
  const assessmentLabel = ASSESSMENT_LABELS[assessment] ?? assessment;

  const systemPrompt = `You are an expert academic syllabus designer. Generate comprehensive, realistic, ready-to-use course syllabi. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Generate a complete course syllabus:

Course: ${topic}
Target Audience: ${audienceLabel}
Duration: ${duration} weeks, meeting ${frequencyLabel} (${totalSessions})
Learning Objectives: ${goal}
Teaching Approach: ${teachingLabel}
Assessment Style: ${assessmentLabel}${prerequisites ? `\nPrerequisites (provided by professor): ${prerequisites}` : ""}

Return this exact JSON structure — do NOT invent a course code, credits, or prerequisites; those are omitted from the schema intentionally:
{
  "courseTitle": "full descriptive course title",
  "courseDescription": "1 concise paragraph (3-5 sentences) describing the course and what students will experience",
  "learningObjectives": [
    "action-verb phrase only, e.g. 'Design and deploy scalable cloud applications'",
    "..."
  ],
  "requiredMaterials": [
    "Software: ...",
    "Platform: ...",
    "..."
  ],
  "gradingBreakdown": [
    { "component": "component name", "weight": "XX%", "description": "brief description" }
  ],
  "weeklySchedule": [
    { "week": 1, "topic": "week topic title", "subtopics": ["subtopic 1", "subtopic 2"], "assignments": "readings or assignment due" }
  ],
  "policies": {
    "attendance": "clear, specific attendance policy",
    "lateWork": "clear late work and extension policy",
    "academicIntegrity": "academic integrity and AI usage policy"
  }
}

Requirements:
- weeklySchedule must have exactly ${duration} entries
- gradingBreakdown weights must sum to 100%
- learningObjectives: 3-5 items max, each is a short action-verb phrase only (no "By the end..." prefix — that will be added by the UI)
- requiredMaterials: list only software, tools, and platforms genuinely needed — do NOT invent textbook titles; omit textbooks entirely unless the course truly requires specific reading
- Content depth must be appropriate for ${audienceLabel}
- Weekly topics must show progressive complexity
- Be specific and realistic — use real field terminology`;

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
    const syllabus = JSON.parse(cleaned);

    // Merge professor-provided fields (not AI-invented)
    if (courseCode) syllabus.courseCode = courseCode;
    if (prerequisites) syllabus.prerequisites = prerequisites;

    return NextResponse.json(syllabus);
  } catch (err) {
    console.error("Syllabus generation error:", err);
    return NextResponse.json({ error: "Failed to generate syllabus" }, { status: 500 });
  }
}
