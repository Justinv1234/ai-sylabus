import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { HomeworkAssignment } from "@/lib/types";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 54, paddingLeft: 60, paddingRight: 60, fontSize: 10, color: "#1a1a1a", lineHeight: 1.4 },
  header: { borderBottomWidth: 2, borderBottomColor: "#1a1a1a", paddingBottom: 14, marginBottom: 22 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 2 },
  formatLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 },
  instructions: { fontSize: 10, color: "#333", lineHeight: 1.5, marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  // Section headings
  sectionHeading: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 3, marginBottom: 8, marginTop: 16, color: "#333" },
  // Question styles
  questionBlock: { marginBottom: 14 },
  questionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 },
  questionNumber: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  typeBadge: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#555", backgroundColor: "#f0f0f0", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  points: { fontSize: 8, color: "#888" },
  questionText: { fontSize: 10, color: "#222", lineHeight: 1.5, marginBottom: 4 },
  choice: { fontSize: 10, color: "#444", marginLeft: 16, marginBottom: 2, lineHeight: 1.4 },
  answerBlock: { marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#ccc" },
  answerLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#888", marginBottom: 2 },
  answerText: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  // Body text
  body: { fontSize: 10, color: "#222", lineHeight: 1.5 },
  bodyBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#222", lineHeight: 1.5 },
  muted: { fontSize: 9, color: "#666", lineHeight: 1.4 },
  // Bullet & step
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 10, color: "#666" },
  stepRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  stepCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#1a1a1a", marginRight: 8, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#fff", textAlign: "center" },
  stepContent: { flex: 1 },
  // Table row
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e8e8e8", paddingVertical: 4 },
  // Highlighted box
  box: { backgroundColor: "#f5f5f5", borderRadius: 4, padding: 10, marginBottom: 10 },
  boxLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#555", marginBottom: 4 },
  // Coding
  codeBox: { backgroundColor: "#f0f0f0", borderRadius: 3, padding: 8, marginTop: 4 },
  codeText: { fontSize: 8, fontFamily: "Courier", color: "#333", lineHeight: 1.4 },
  // Footer
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ddd", flexDirection: "row", justifyContent: "flex-end" },
  totalPoints: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
});

export function HomeworkPDF({ data, courseTitle, showAnswers }: { data: HomeworkAssignment; courseTitle: string; showAnswers: boolean }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{data.title}</Text>
          <Text style={s.subtitle}>{courseTitle}</Text>
          <Text style={s.formatLabel}>{data.format}</Text>
          <Text style={s.subtitle}>Week {data.weekNumber}: {data.topic} — {data.totalPoints} points</Text>
        </View>

        <Text style={s.instructions}>{data.instructions}</Text>

        {/* Question-based */}
        {data.questions && data.questions.map((q) => (
          <View key={q.number} style={s.questionBlock}>
            <View style={s.questionHeader}>
              <Text style={s.questionNumber}>{q.number}.</Text>
              <Text style={s.typeBadge}>{q.type}</Text>
              <Text style={s.points}>({q.points} pts)</Text>
            </View>
            <Text style={s.questionText}>{q.text}</Text>
            {q.type === "multiple-choice" && q.choices && q.choices.map((c, ci) => (
              <Text key={ci} style={s.choice}>{c}</Text>
            ))}
            {showAnswers && q.answer && (
              <View style={s.answerBlock}>
                <Text style={s.answerLabel}>Answer</Text>
                <Text style={s.answerText}>{q.answer}</Text>
              </View>
            )}
          </View>
        ))}

        {/* Project */}
        {data.project && (
          <View>
            <Text style={s.body}>{data.project.description}</Text>

            <Text style={s.sectionHeading}>Objectives</Text>
            {data.project.objectives.map((obj, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>☐</Text>
                <Text style={s.body}>{obj}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Steps</Text>
            {data.project.steps.map((step) => (
              <View key={step.step} style={s.stepRow}>
                <View style={s.stepCircle}><Text style={s.stepNum}>{step.step}</Text></View>
                <View style={s.stepContent}>
                  <Text style={s.bodyBold}>{step.title}</Text>
                  <Text style={s.body}>{step.description}</Text>
                  <Text style={[s.muted, { marginTop: 2 }]}>Deliverable: {step.deliverable}</Text>
                </View>
              </View>
            ))}

            <View style={s.box}>
              <Text style={s.boxLabel}>Final Deliverable</Text>
              <Text style={s.body}>{data.project.finalDeliverable}</Text>
            </View>

            <Text style={s.sectionHeading}>Grading Criteria</Text>
            {data.project.gradingCriteria.map((gc, i) => (
              <View key={i} style={s.tableRow}>
                <View style={{ flex: 3 }}><Text style={s.body}>{gc.criterion}</Text></View>
                <View style={{ width: 50 }}><Text style={s.bodyBold}>{gc.weight}</Text></View>
              </View>
            ))}
          </View>
        )}

        {/* Lab */}
        {data.lab && (
          <View>
            <Text style={s.sectionHeading}>Background</Text>
            <Text style={s.body}>{data.lab.background}</Text>

            <Text style={s.sectionHeading}>Materials</Text>
            {data.lab.materials.map((m, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.body}>{m}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Procedure</Text>
            {data.lab.procedure.map((step) => (
              <View key={step.step} style={s.stepRow}>
                <View style={s.stepCircle}><Text style={s.stepNum}>{step.step}</Text></View>
                <View style={s.stepContent}><Text style={s.body}>{step.instruction}</Text></View>
              </View>
            ))}

            <View style={s.box}>
              <Text style={s.boxLabel}>Data Collection</Text>
              <Text style={s.body}>{data.lab.dataCollection}</Text>
            </View>

            <Text style={s.sectionHeading}>Analysis Questions</Text>
            {data.lab.analysisQuestions.map((q, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bulletDot, s.bodyBold]}>{i + 1}.</Text>
                <Text style={s.body}>{q}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Coding */}
        {data.coding && (
          <View>
            <Text style={s.body}>{data.coding.description}</Text>

            <Text style={s.sectionHeading}>Requirements</Text>
            {data.coding.requirements.map((r, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>→</Text>
                <Text style={s.body}>{r}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Tasks</Text>
            {data.coding.tasks.map((task) => (
              <View key={task.number} style={{ marginBottom: 12 }}>
                <Text style={s.bodyBold}>Task {task.number}: {task.title}</Text>
                <Text style={s.body}>{task.description}</Text>
                {task.examples && (
                  <View style={s.codeBox}><Text style={s.codeText}>{task.examples}</Text></View>
                )}
              </View>
            ))}

            {data.coding.bonusChallenges && data.coding.bonusChallenges.length > 0 && (
              <View style={s.box}>
                <Text style={s.boxLabel}>Bonus Challenges</Text>
                {data.coding.bonusChallenges.map((b, i) => (
                  <View key={i} style={s.bulletRow}>
                    <Text style={s.bulletDot}>⭐</Text>
                    <Text style={s.body}>{b}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Research */}
        {data.research && (
          <View>
            <View style={s.box}>
              <Text style={s.boxLabel}>Research Topic</Text>
              <Text style={s.bodyBold}>{data.research.topic}</Text>
            </View>

            <Text style={s.sectionHeading}>Background</Text>
            <Text style={s.body}>{data.research.background}</Text>

            <Text style={s.sectionHeading}>Requirements</Text>
            {data.research.requirements.map((r, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.body}>{r}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Guiding Questions</Text>
            {data.research.guidingQuestions.map((q, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={[s.bulletDot, s.bodyBold]}>{i + 1}.</Text>
                <Text style={s.body}>{q}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Deliverables</Text>
            {data.research.deliverables.map((d, i) => (
              <View key={i} style={s.bulletRow}>
                <Text style={s.bulletDot}>☐</Text>
                <Text style={s.body}>{d}</Text>
              </View>
            ))}

            <Text style={s.sectionHeading}>Evaluation Criteria</Text>
            {data.research.evaluationCriteria.map((ec, i) => (
              <View key={i} style={s.tableRow}>
                <View style={{ flex: 3 }}><Text style={s.body}>{ec.criterion}</Text></View>
                <View style={{ width: 50 }}><Text style={s.bodyBold}>{ec.weight}</Text></View>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer}>
          <Text style={s.totalPoints}>Total: {data.totalPoints} points</Text>
        </View>
      </Page>
    </Document>
  );
}
