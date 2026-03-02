export type GradingItem = { component: string; weight: string; description: string };
export type WeekItem = { week: number; topic: string; subtopics: string[]; assignments: string };
export type Policies = { attendance: string; lateWork: string; academicIntegrity: string };

export type Syllabus = {
  courseTitle: string;
  courseCode?: string;
  courseDescription: string;
  learningObjectives: string[];
  prerequisites?: string;
  requiredMaterials: string[];
  gradingBreakdown: GradingItem[];
  weeklySchedule: WeekItem[];
  policies: Policies;
};

export type HomeworkQuestion = {
  number: number;
  type: "multiple-choice" | "short-answer" | "problem" | "essay";
  text: string;
  points: number;
  choices?: string[];
  answer?: string;
};

export type ProjectStep = {
  step: number;
  title: string;
  description: string;
  deliverable: string;
};

export type ProjectContent = {
  description: string;
  objectives: string[];
  steps: ProjectStep[];
  finalDeliverable: string;
  gradingCriteria: { criterion: string; weight: string }[];
};

export type LabContent = {
  background: string;
  materials: string[];
  procedure: { step: number; instruction: string }[];
  dataCollection: string;
  analysisQuestions: string[];
};

export type CodingTask = {
  number: number;
  title: string;
  description: string;
  examples?: string;
};

export type CodingContent = {
  description: string;
  requirements: string[];
  tasks: CodingTask[];
  bonusChallenges?: string[];
};

export type ResearchContent = {
  topic: string;
  background: string;
  requirements: string[];
  guidingQuestions: string[];
  deliverables: string[];
  evaluationCriteria: { criterion: string; weight: string }[];
};

export type HomeworkAssignment = {
  title: string;
  weekNumber: number;
  topic: string;
  instructions: string;
  format: "problem-set" | "multiple-choice" | "short-response" | "project" | "essay" | "lab-report" | "case-study" | "coding" | "research";
  questions?: HomeworkQuestion[];
  project?: ProjectContent;
  lab?: LabContent;
  coding?: CodingContent;
  research?: ResearchContent;
  totalPoints: number;
};

// ── Week Planner Types ──────────────────────────────────────────────

export type MeetingBlock = {
  title: string;
  duration: number;
  description: string;
  materials?: string;
};

export type Slide = {
  title: string;
  bullets: string[];
};

export type SlideOutline = {
  meetingIndex: number;
  slides: Slide[];
};

export type MeetingPlan = {
  label: string;
  focus: string;
  blocks: MeetingBlock[];
  slides?: SlideOutline;
};

export type WeekPlan = {
  weekNumber: number;
  topic: string;
  courseTitle: string;
  mode: "sync" | "async";
  meetings: MeetingPlan[];
};

// ── Quiz / Test Types ─────────────────────────────────────────────

export type Quiz = {
  id: string;
  title: string;
  type: "quiz" | "midterm" | "final" | "test";
  weekStart: number;
  weekEnd: number;
  topics: string[];
  instructions: string;
  questions: HomeworkQuestion[];
  totalPoints: number;
  timeLimit?: string;
};

// ── Course Content Storage ──────────────────────────────────────────

export type CourseContent = {
  homework: Record<number, HomeworkAssignment>;
  weekPlans: Record<number, WeekPlan>;
  quizzes: Record<string, Quiz>;
};

export type SavedSyllabus = {
  id: string;
  syllabus: Syllabus;
  createdAt: string;
  updatedAt: string;
  wizardParams?: {
    topic: string;
    audience: string;
    duration: string;
    frequency: string;
    goal: string;
    teaching: string;
    assessment: string;
    courseCode?: string;
    prerequisites?: string;
  };
};
