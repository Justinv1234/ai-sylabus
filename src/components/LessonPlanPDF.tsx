import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";

export type LessonPlanData = {
  courseTitle: string;
  weekNumber: number;
  topic: string;
  objectives: string[];
  materialsNeeded: string[];
  lessonOutline: { activity: string; duration: string; description: string }[];
  assessmentHomework: string;
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
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#444",
    marginBottom: 2,
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
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

export function LessonPlanPDF({ data }: { data: LessonPlanData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>Lesson Plan</Text>
          <Text style={s.subtitle}>{data.courseTitle}</Text>
          <Text style={s.muted}>
            Week {data.weekNumber} — {data.topic}
          </Text>
        </View>

        {/* Objectives */}
        <Section title="Learning Objectives">
          {data.objectives.map((obj, i) => (
            <View key={i} style={s.bulletRow}>
              <Text style={[s.bulletDot, s.muted]}>•</Text>
              <Text style={s.body}>{obj}</Text>
            </View>
          ))}
        </Section>

        {/* Materials Needed */}
        {data.materialsNeeded.length > 0 && (
          <Section title="Materials Needed">
            {data.materialsNeeded.map((m, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bulletDot, s.muted]}>•</Text>
                <Text style={s.body}>{m}</Text>
              </View>
            ))}
          </Section>
        )}

        {/* Lesson Outline */}
        <Section title="Lesson Outline">
          <View style={s.tableHeaderRow}>
            <View style={{ flex: 2 }}>
              <Text style={s.colHeader}>Activity</Text>
            </View>
            <View style={{ width: 65 }}>
              <Text style={s.colHeader}>Duration</Text>
            </View>
            <View style={{ flex: 3 }}>
              <Text style={s.colHeader}>Description</Text>
            </View>
          </View>
          {data.lessonOutline.map((row, i) => (
            <View key={i} style={[s.tableRow, { alignItems: "flex-start" }]}>
              <View style={{ flex: 2 }}>
                <Text style={s.bodyBold}>{row.activity}</Text>
              </View>
              <View style={{ width: 65 }}>
                <Text style={s.muted}>{row.duration}</Text>
              </View>
              <View style={{ flex: 3 }}>
                <Text style={s.body}>{row.description}</Text>
              </View>
            </View>
          ))}
        </Section>

        {/* Assessment & Homework */}
        <Section title="Assessment & Homework">
          <Text style={s.body}>{data.assessmentHomework}</Text>
        </Section>
      </Page>
    </Document>
  );
}
