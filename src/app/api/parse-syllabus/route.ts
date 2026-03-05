import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const duration = formData.get("duration") as string | null;
    const frequency = formData.get("frequency") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    const numWeeks = duration ? parseInt(duration) : null;
    const frequencyLabel =
      frequency === "1x" ? "once a week" :
      frequency === "2x" ? "twice a week" :
      frequency === "3x" ? "three times a week" :
      frequency === "async" ? "asynchronously (online, self-paced)" :
      null;

    // Convert PDF to base64 for Claude's native PDF support
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const client = getAnthropicClient();

    const systemPrompt = `You are a precise syllabus parser. Your ONLY job is to EXTRACT information directly from the uploaded PDF and structure it into JSON. Do NOT generate, rewrite, or infer content — copy the original text as closely as possible. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

    const weekScheduleRule = numWeeks
      ? `- For weeklySchedule: the course runs for ${numWeeks} weeks (meeting ${frequencyLabel}). You MUST produce exactly ${numWeeks} entries (week 1 through ${numWeeks}). The PDF may list topics as broad units, chapters, or date ranges rather than week-by-week — distribute the original topics across all ${numWeeks} weeks logically. Use the EXACT topic names and descriptions from the document, but split or group them so every week has content. If the PDF only lists 4 broad units for a ${numWeeks}-week course, spread each unit across multiple weeks with appropriate subtopics from the document.`
      : `- For weeklySchedule: use the exact number of weeks in the document. If it uses dates instead of week numbers, convert dates to sequential week numbers but keep the original topic text.`;

    const userPrompt = `Extract the contents of this syllabus PDF into the JSON structure below. Use the EXACT text from the document — do not rephrase, summarize, or generate new content.
${numWeeks ? `\nContext from the instructor: This course is ${numWeeks} weeks long, meeting ${frequencyLabel}.\n` : ""}
{
  "courseTitle": "exact course title from the document",
  "courseCode": "exact course code if present, otherwise omit this field",
  "courseDescription": "copy the course description verbatim from the document, or if none exists use the first introductory paragraph",
  "learningObjectives": ["copy each learning objective exactly as written, just remove any leading numbering/bullets"],
  "prerequisites": "copy prerequisites text exactly, or omit if not present",
  "requiredMaterials": ["ONLY items the document explicitly labels as required — copy each exactly as listed"],
  "gradingBreakdown": [
    { "component": "exact component name", "weight": "exact weight as written (e.g. '25%')", "description": "copy the description if provided, otherwise leave as a short label" }
  ],
  "weeklySchedule": [
    { "week": 1, "topic": "exact topic title from the schedule", "subtopics": ["exact subtopics/readings listed"], "assignments": "exact assignments/due items listed for this week" }
  ],
  "policies": {
    "attendance": "copy the attendance policy verbatim from the document",
    "lateWork": "copy the late work policy verbatim",
    "academicIntegrity": "copy the academic integrity policy verbatim"
  },
  "additionalSections": [
    {
      "title": "exact section heading from the document",
      "type": "list | text | table",
      "items": ["for list type: each item verbatim"],
      "content": "for text type: the full section text verbatim",
      "columns": ["for table type: column headers"],
      "rows": [{"col1": "value", "col2": "value"}]
    }
  ]
}

Rules:
- PRESERVE the original wording — do not paraphrase or "improve" the text
${weekScheduleRule}
- For gradingBreakdown: use the exact components and weights from the document. Weights should sum to 100%
- For learningObjectives: copy them exactly as written, just strip leading numbers/bullets. Use short action-verb form only if that is how they appear in the document
- If a field genuinely does not exist in the document, use a brief placeholder like "Not specified in syllabus" for policy fields, or an empty array [] for lists
- Preserve the original course code and title character-for-character
- For requiredMaterials: ONLY include items the document explicitly marks as "required." Do NOT put supplemental, recommended, or optional materials here
- For additionalSections: capture EVERY other section from the document that does not fit the core fields above. This includes but is not limited to: supplemental/recommended materials, office hours, instructor information, technology requirements, disability accommodations, extra policies beyond attendance/late work/academic integrity, important dates, tutoring resources, etc.
  - Use type "list" for bulleted/numbered lists (provide "items" array)
  - Use type "text" for paragraph content (provide "content" string)
  - Use type "table" for tabular data (provide "columns" array and "rows" array of objects keyed by column name)
  - Use the EXACT section heading from the document as the "title"
  - If the document has no extra sections, use an empty array []`;

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: userPrompt },
        ],
      }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    const syllabus = JSON.parse(cleaned);

    return NextResponse.json(syllabus);
  } catch (err) {
    console.error("Syllabus parsing error:", err);
    return NextResponse.json({ error: "Failed to parse syllabus. Please try again." }, { status: 500 });
  }
}
