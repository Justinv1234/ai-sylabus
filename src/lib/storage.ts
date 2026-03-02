import type { SavedSyllabus, Syllabus, CourseContent, HomeworkAssignment, WeekPlan, Quiz } from "./types";

const STORAGE_KEY = "course-builder-syllabi";

export function getAllSyllabi(): SavedSyllabus[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getSyllabusById(id: string): SavedSyllabus | null {
  return getAllSyllabi().find((s) => s.id === id) ?? null;
}

export function saveSyllabus(
  syllabus: Syllabus,
  wizardParams?: SavedSyllabus["wizardParams"],
): SavedSyllabus {
  const all = getAllSyllabi();
  const now = new Date().toISOString();
  const entry: SavedSyllabus = {
    id: crypto.randomUUID(),
    syllabus,
    createdAt: now,
    updatedAt: now,
    wizardParams,
  };
  all.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return entry;
}

export function updateSyllabus(id: string, syllabus: Syllabus): void {
  const all = getAllSyllabi();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return;
  all[idx] = { ...all[idx], syllabus, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteSyllabus(id: string): void {
  const all = getAllSyllabi().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

// ── Course Content Storage ──────────────────────────────────────────

const CONTENT_PREFIX = "course-builder-content-";

function getContentKey(syllabusId: string) {
  return `${CONTENT_PREFIX}${syllabusId}`;
}

export function getCourseContent(syllabusId: string): CourseContent {
  if (typeof window === "undefined") return { homework: {}, weekPlans: {}, quizzes: {} };
  try {
    const raw = localStorage.getItem(getContentKey(syllabusId));
    if (!raw) return { homework: {}, weekPlans: {}, quizzes: {} };
    const parsed = JSON.parse(raw);
    return { homework: parsed.homework ?? {}, weekPlans: parsed.weekPlans ?? {}, quizzes: parsed.quizzes ?? {} };
  } catch {
    return { homework: {}, weekPlans: {}, quizzes: {} };
  }
}

export function saveHomework(syllabusId: string, weekNumber: number, homework: HomeworkAssignment): void {
  const content = getCourseContent(syllabusId);
  content.homework[weekNumber] = homework;
  localStorage.setItem(getContentKey(syllabusId), JSON.stringify(content));
}

export function saveWeekPlan(syllabusId: string, weekNumber: number, weekPlan: WeekPlan): void {
  const content = getCourseContent(syllabusId);
  content.weekPlans[weekNumber] = weekPlan;
  localStorage.setItem(getContentKey(syllabusId), JSON.stringify(content));
}

export function loadHomework(syllabusId: string, weekNumber: number): HomeworkAssignment | null {
  return getCourseContent(syllabusId).homework[weekNumber] ?? null;
}

export function loadWeekPlan(syllabusId: string, weekNumber: number): WeekPlan | null {
  return getCourseContent(syllabusId).weekPlans[weekNumber] ?? null;
}

export function saveQuiz(syllabusId: string, quizId: string, quiz: Quiz): void {
  const content = getCourseContent(syllabusId);
  content.quizzes[quizId] = quiz;
  localStorage.setItem(getContentKey(syllabusId), JSON.stringify(content));
}

export function loadQuiz(syllabusId: string, quizId: string): Quiz | null {
  return getCourseContent(syllabusId).quizzes[quizId] ?? null;
}
