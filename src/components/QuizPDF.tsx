import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Quiz } from "@/lib/types";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 54, paddingLeft: 60, paddingRight: 60, fontSize: 10, color: "#1a1a1a", lineHeight: 1.4 },
  header: { borderBottomWidth: 2, borderBottomColor: "#1a1a1a", paddingBottom: 14, marginBottom: 22 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 2 },
  typeBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 },
  metaRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  metaItem: { fontSize: 9, color: "#666" },
  instructions: { fontSize: 10, color: "#333", lineHeight: 1.5, marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  questionBlock: { marginBottom: 14 },
  questionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 6 },
  questionNumber: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  questionTypeBadge: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#555", backgroundColor: "#f0f0f0", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3 },
  points: { fontSize: 8, color: "#888" },
  questionText: { fontSize: 10, color: "#222", lineHeight: 1.5, marginBottom: 4 },
  choice: { fontSize: 10, color: "#444", marginLeft: 16, marginBottom: 2, lineHeight: 1.4 },
  answerBlock: { marginTop: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: "#ccc" },
  answerLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#888", marginBottom: 2 },
  answerText: { fontSize: 9, color: "#555", lineHeight: 1.4 },
  footer: { marginTop: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#ddd", flexDirection: "row", justifyContent: "flex-end" },
  totalPoints: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1a1a1a" },
});

export function QuizPDF({ data, courseTitle, showAnswers }: { data: Quiz; courseTitle: string; showAnswers: boolean }) {
  const weekRange = data.weekStart === data.weekEnd
    ? `Week ${data.weekStart}`
    : `Weeks ${data.weekStart}–${data.weekEnd}`;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>{data.title}</Text>
          <Text style={s.subtitle}>{courseTitle}</Text>
          <Text style={s.typeBadge}>{data.type}</Text>
          <View style={s.metaRow}>
            <Text style={s.metaItem}>{weekRange}</Text>
            <Text style={s.metaItem}>{data.totalPoints} points</Text>
            {data.timeLimit && <Text style={s.metaItem}>{data.timeLimit}</Text>}
          </View>
        </View>

        <Text style={s.instructions}>{data.instructions}</Text>

        {data.questions.map((q) => (
          <View key={q.number} style={s.questionBlock}>
            <View style={s.questionHeader}>
              <Text style={s.questionNumber}>{q.number}.</Text>
              <Text style={s.questionTypeBadge}>{q.type}</Text>
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

        <View style={s.footer}>
          <Text style={s.totalPoints}>Total: {data.totalPoints} points</Text>
        </View>
      </Page>
    </Document>
  );
}
