import { NextRequest, NextResponse } from "next/server";
import { getAnthropicClient, MODEL } from "@/lib/claude/client";
import type { Syllabus } from "@/lib/types";

// Formats that use numbered questions
const QUESTION_FORMATS = new Set(["problem-set", "multiple-choice", "short-response", "essay", "case-study"]);

function buildPrompt(format: string, numItems: number, weekNumber: number, weekTopic: string): string {
  switch (format) {
    case "multiple-choice":
      return `Return JSON with a "questions" array of exactly ${numItems} items.
Each: { "number": N, "type": "multiple-choice", "text": "...", "points": N, "choices": ["A. ...", "B. ...", "C. ...", "D. ..."], "answer": "A. correct answer" }
Cover different subtopics and cognitive levels (recall, application, analysis).`;

    case "short-response":
      return `Return JSON with a "questions" array of exactly ${numItems} items.
Each: { "number": N, "type": "short-answer", "text": "...", "points": N, "answer": "expected 1-2 sentence answer" }
Each question should be answerable in 1-2 sentences (not a full essay or paragraph).
Questions should test understanding and recall — concise, focused, and specific.
Cover different subtopics and cognitive levels.`;

    case "essay":
      return `Return JSON with a "questions" array of exactly ${numItems} items.
Each: { "number": N, "type": "essay", "text": "essay prompt requiring 250-500 word response", "points": N, "answer": "key points a strong essay would cover" }
Include analytical, argumentative, and reflective prompts.`;

    case "case-study":
      return `Return JSON with a "questions" array of exactly ${numItems} items.
Question 1: type "essay" — a detailed realistic case study scenario (150-300 words describing a real situation).
Remaining questions: mix of "short-answer", "problem", "essay" that analyze the case.
For any "multiple-choice" include "choices": ["A. ...", "B. ...", "C. ...", "D. ..."].
Omit "choices" for all other types.`;

    case "project":
      return `Return JSON with a "project" object (NOT questions). Structure:
{
  "project": {
    "description": "2-3 sentence overview of what students will build/create/research",
    "objectives": ["what students will learn or demonstrate", "..."],
    "steps": [
      { "step": 1, "title": "Phase name", "description": "What to do in this phase (2-3 sentences)", "deliverable": "What to hand in for this step" },
      ...
    ],
    "finalDeliverable": "Description of the complete final submission",
    "gradingCriteria": [
      { "criterion": "Criteria name", "weight": "XX%" },
      ...
    ]
  }
}
Generate exactly ${numItems} steps that build progressively toward a complete project.
Steps should be concrete and actionable — not vague. Each step should produce a tangible deliverable.
Grading criteria weights must sum to 100%.`;

    case "lab-report":
      return `Return JSON with a "lab" object (NOT questions). Structure:
{
  "lab": {
    "background": "Scientific/theoretical background for the experiment (2-3 sentences)",
    "materials": ["tool or material 1", "tool or material 2", "..."],
    "procedure": [
      { "step": 1, "instruction": "Clear, specific instruction for this step" },
      ...
    ],
    "dataCollection": "Describe what data to record, what tables/charts to create",
    "analysisQuestions": ["Question about interpreting the data", "..."]
  }
}
Generate exactly ${numItems} procedure steps. Be specific — include concrete values, parameters, or settings.
Analysis questions should require students to think critically about their results.`;

    case "coding":
      return `Return JSON with a "coding" object (NOT questions). Structure:
{
  "coding": {
    "description": "Overview of the programming challenge (2-3 sentences)",
    "requirements": ["Language/framework constraint", "Must use X data structure", "..."],
    "tasks": [
      { "number": 1, "title": "Task name", "description": "What to implement", "examples": "Input: [1,2,3] → Output: 6" },
      ...
    ],
    "bonusChallenges": ["Optional harder extension 1", "..."]
  }
}
Generate exactly ${numItems} tasks that progress from simpler to more complex.
Each task should include concrete input/output examples.
Bonus challenges are optional (2-3 items).`;

    case "research":
      return `Return JSON with a "research" object (NOT questions). Structure:
{
  "research": {
    "topic": "Specific research question or topic to investigate",
    "background": "Context for why this topic matters (2-3 sentences)",
    "requirements": ["Minimum 5 peer-reviewed sources", "APA format", "2000-3000 words", "..."],
    "guidingQuestions": ["Specific question to explore", "..."],
    "deliverables": ["Annotated bibliography by Week X", "Outline draft", "Final paper", "..."],
    "evaluationCriteria": [
      { "criterion": "Criteria name", "weight": "XX%" },
      ...
    ]
  }
}
Generate exactly ${numItems} guiding questions.
Evaluation criteria weights must sum to 100%.`;

    default: // problem-set
      return `Return JSON with a "questions" array of exactly ${numItems} items.
Each: { "number": N, "type": "multiple-choice"|"short-answer"|"problem"|"essay", "text": "...", "points": N, "answer": "..." }
For "multiple-choice" include "choices": ["A. ...", "B. ...", "C. ...", "D. ..."].
Omit "choices" for all other types.
Use a good mix of question types.`;
  }
}

export async function POST(req: NextRequest) {
  const { syllabus, weekNumber, numQuestions, difficulty, format, customInstructions } = (await req.json()) as {
    syllabus: Syllabus;
    weekNumber: number;
    numQuestions: number;
    difficulty: string;
    format: string;
    customInstructions?: string;
  };

  const week = syllabus.weeklySchedule.find((w) => w.week === weekNumber);
  if (!week) {
    return NextResponse.json({ error: "Week not found in syllabus" }, { status: 400 });
  }

  const formatInstructions = buildPrompt(format, numQuestions, weekNumber, week.topic);

  const systemPrompt = `You are an expert academic instructor creating assignments. Generate well-structured, pedagogically sound assignments appropriate for the course level. Always respond with valid JSON only — no markdown fences, no text outside the JSON object.`;

  const userPrompt = `Generate a ${format} assignment for the following course and week:

Course: ${syllabus.courseTitle}
${syllabus.courseCode ? `Course Code: ${syllabus.courseCode}` : ""}
Course Description: ${syllabus.courseDescription}

Week ${week.week}: ${week.topic}
Subtopics covered: ${week.subtopics.join(", ")}
${week.assignments ? `Related assignments/readings: ${week.assignments}` : ""}

Learning Objectives for the course:
${syllabus.learningObjectives.map((o) => `- ${o}`).join("\n")}

Difficulty level: ${difficulty}

${formatInstructions}

Wrap everything in this outer structure:
{
  "title": "descriptive title",
  "weekNumber": ${weekNumber},
  "topic": "${week.topic}",
  "format": "${format}",
  "instructions": "Clear instructions for students (2-4 sentences: what to do, how to submit, time/effort estimate)",
  "totalPoints": 100,
  ... the format-specific content from above ...
}

- totalPoints should be a clean number (50, 75, 100)
- All content must be specific to "${week.topic}"
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
    const homework = JSON.parse(cleaned);

    return NextResponse.json(homework);
  } catch (err) {
    console.error("Homework generation error:", err);
    return NextResponse.json({ error: "Failed to generate assignment" }, { status: 500 });
  }
}
