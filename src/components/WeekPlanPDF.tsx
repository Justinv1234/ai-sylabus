import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { WeekPlan } from "@/lib/types";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 54, paddingLeft: 60, paddingRight: 60, fontSize: 10, color: "#1a1a1a", lineHeight: 1.4 },
  header: { borderBottomWidth: 2, borderBottomColor: "#1a1a1a", paddingBottom: 14, marginBottom: 22 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#666", marginBottom: 2 },
  modeBadge: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.5, color: "#888", marginBottom: 2 },
  // Meeting
  meetingHeader: { backgroundColor: "#f5f5f5", padding: 10, borderRadius: 4, marginBottom: 8, marginTop: 16 },
  meetingLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  meetingFocus: { fontSize: 9, color: "#555", fontStyle: "italic" },
  totalDuration: { fontSize: 8, color: "#888", marginTop: 2 },
  // Block
  blockRow: { flexDirection: "row", marginBottom: 8, alignItems: "flex-start" },
  durationPill: { width: 28, height: 18, borderRadius: 3, backgroundColor: "#1a1a1a", marginRight: 8, alignItems: "center", justifyContent: "center" },
  durationText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff", textAlign: "center" },
  blockContent: { flex: 1 },
  blockTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#222", marginBottom: 2 },
  blockDesc: { fontSize: 9, color: "#444", lineHeight: 1.4 },
  materialsRow: { flexDirection: "row", marginTop: 3, alignItems: "center" },
  materialsLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.3, color: "#888", marginRight: 4, backgroundColor: "#eee", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },
  materialsText: { fontSize: 8, color: "#666" },
  // Slides
  slidesHeading: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.8, borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 3, marginBottom: 6, marginTop: 12, color: "#333" },
  slideCard: { backgroundColor: "#fafafa", borderRadius: 3, padding: 8, marginBottom: 6, borderLeftWidth: 2, borderLeftColor: "#ccc" },
  slideNumber: { fontSize: 7, color: "#999", marginBottom: 2 },
  slideTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#222", marginBottom: 3 },
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 8, fontSize: 9, color: "#666" },
  bulletText: { fontSize: 8, color: "#444", lineHeight: 1.4, flex: 1 },
});

export function WeekPlanPDF({ data }: { data: WeekPlan }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Week {data.weekNumber}: {data.topic}</Text>
          <Text style={s.subtitle}>{data.courseTitle}</Text>
          <Text style={s.modeBadge}>{data.mode === "async" ? "Asynchronous Module" : `${data.meetings.length} Class Meeting${data.meetings.length > 1 ? "s" : ""}`}</Text>
        </View>

        {data.meetings.map((meeting, mi) => (
          <View key={mi}>
            <View style={s.meetingHeader}>
              <Text style={s.meetingLabel}>{meeting.label}</Text>
              <Text style={s.meetingFocus}>{meeting.focus}</Text>
              <Text style={s.totalDuration}>Total: {meeting.blocks.reduce((sum, b) => sum + b.duration, 0)} minutes</Text>
            </View>

            {meeting.blocks.map((block, bi) => (
              <View key={bi} style={s.blockRow}>
                <View style={s.durationPill}>
                  <Text style={s.durationText}>{block.duration}m</Text>
                </View>
                <View style={s.blockContent}>
                  <Text style={s.blockTitle}>{block.title}</Text>
                  <Text style={s.blockDesc}>{block.description}</Text>
                  {block.materials && (
                    <View style={s.materialsRow}>
                      <Text style={s.materialsLabel}>Materials</Text>
                      <Text style={s.materialsText}>{block.materials}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {meeting.slides && meeting.slides.slides.length > 0 && (
              <View>
                <Text style={s.slidesHeading}>Slide Outline</Text>
                {meeting.slides.slides.map((slide, si) => (
                  <View key={si} style={s.slideCard}>
                    <Text style={s.slideNumber}>Slide {si + 1}</Text>
                    <Text style={s.slideTitle}>{slide.title}</Text>
                    {slide.bullets.map((bullet, bi) => (
                      <View key={bi} style={s.bulletRow}>
                        <Text style={s.bulletDot}>–</Text>
                        <Text style={s.bulletText}>{bullet}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
}
