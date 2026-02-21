import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";

export type SyllabusData = {
  courseTitle: string;
  courseCode?: string;
  courseDescription: string;
  learningObjectives: string[];
  prerequisites?: string;
  requiredMaterials: string[];
  gradingBreakdown: { component: string; weight: string; description: string }[];
  weeklySchedule: { week: number; topic: string; subtopics: string[]; assignments: string }[];
  policies: { attendance: string; lateWork: string; academicIntegrity: string };
};

const s = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 60,
    paddingRight: 60,
    fontSize: 10,
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  header: {
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 14,
    marginBottom: 22,
  },
  courseTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  courseCode: {
    fontSize: 11,
    color: "#666",
  },
  section: {
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 3,
    marginBottom: 8,
    color: "#333",
  },
  body: {
    fontSize: 10,
    color: "#222",
    lineHeight: 1.5,
  },
  bodyBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#222",
    lineHeight: 1.5,
  },
  muted: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.4,
  },
  mutedItalic: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique",
    color: "#666",
    lineHeight: 1.4,
  },
  prefixItalic: {
    fontSize: 10,
    fontFamily: "Helvetica-Oblique",
    color: "#555",
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: "#666",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 4,
    marginBottom: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
    paddingVertical: 5,
  },
  colHeader: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: "#555",
  },
  policyBlock: {
    marginBottom: 10,
  },
  policyLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

export function SyllabusPDF({ data }: { data: SyllabusData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.courseTitle}>{data.courseTitle}</Text>
          {data.courseCode && <Text style={s.courseCode}>{data.courseCode}</Text>}
        </View>

        {/* Course Description */}
        <Section title="Course Description">
          <Text style={s.body}>{data.courseDescription}</Text>
        </Section>

        {/* Prerequisites */}
        {data.prerequisites && (
          <Section title="Prerequisites">
            <Text style={s.body}>{data.prerequisites}</Text>
          </Section>
        )}

        {/* Learning Objectives */}
        <Section title="Learning Objectives">
          <Text style={s.prefixItalic}>By the end of this course, students will be able to:</Text>
          {data.learningObjectives.map((obj, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletDot, s.muted]}>•</Text>
              <Text style={s.body}>{obj}</Text>
            </View>
          ))}
        </Section>

        {/* Required Materials */}
        {data.requiredMaterials.length > 0 && (
          <Section title="Required Materials">
            {data.requiredMaterials.map((m, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bulletDot, s.muted]}>•</Text>
                <Text style={s.body}>{m}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Grading Breakdown */}
        <Section title="Grading Breakdown">
          <View style={s.tableHeaderRow}>
            <View style={{ flex: 2 }}><Text style={s.colHeader}>Component</Text></View>
            <View style={{ width: 45 }}><Text style={s.colHeader}>Weight</Text></View>
            <View style={{ flex: 3 }}><Text style={s.colHeader}>Description</Text></View>
          </View>
          {data.gradingBreakdown.map((row, i) => (
            <View key={i} style={s.tableRow}>
              <View style={{ flex: 2 }}><Text style={s.bodyBold}>{row.component}</Text></View>
              <View style={{ width: 45 }}><Text style={s.body}>{row.weight}</Text></View>
              <View style={{ flex: 3 }}><Text style={s.muted}>{row.description}</Text></View>
            </View>
          ))}
        </Section>

        {/* Weekly Schedule */}
        <Section title="Course Schedule">
          <View style={s.tableHeaderRow}>
            <View style={{ width: 36 }}><Text style={s.colHeader}>Week</Text></View>
            <View style={{ flex: 2 }}><Text style={s.colHeader}>Topic</Text></View>
            <View style={{ flex: 3 }}><Text style={s.colHeader}>Subtopics & Assignments</Text></View>
          </View>
          {data.weeklySchedule.map((row, i) => (
            <View key={i} style={[s.tableRow, { alignItems: "flex-start" }]}>
              <View style={{ width: 36 }}><Text style={s.muted}>{String(row.week)}</Text></View>
              <View style={{ flex: 2 }}><Text style={s.bodyBold}>{row.topic}</Text></View>
              <View style={{ flex: 3 }}>
                {row.subtopics.length > 0 && (
                  <Text style={s.body}>{row.subtopics.join(", ")}</Text>
                )}
                {row.assignments && (
                  <Text style={[s.mutedItalic, { marginTop: 2 }]}>{row.assignments}</Text>
                )}
              </View>
            </View>
          ))}
        </Section>

        {/* Policies */}
        <Section title="Course Policies">
          {[
            { label: "Attendance", value: data.policies.attendance },
            { label: "Late Work", value: data.policies.lateWork },
            { label: "Academic Integrity", value: data.policies.academicIntegrity },
          ].map(({ label, value }) => (
            <View key={label} style={s.policyBlock}>
              <Text style={s.policyLabel}>{label}</Text>
              <Text style={s.body}>{value}</Text>
            </View>
          ))}
        </Section>

      </Page>
    </Document>
  );
}
