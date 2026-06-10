// src/server/pdf/resume-document.tsx
// ATS-safe single-column resume PDF from tailoredJson + master fallbacks.
// Deliberately boring: Helvetica, no tables, no graphics, no columns —
// ATS parsers reward simplicity. Same content structure feeds 2H auto-fill.
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Disable react-pdf's auto-hyphenation: it breaks words at wrap points
// with inserted hyphens ("langgraph-"), corrupting skills/keywords for
// ATS parsing. Whole words wrap intact instead.
Font.registerHyphenationCallback((word) => [word]);
import type { TailoredJson } from "@/server/services/ai/tailor";

// Helvetica via react-pdf silently DROPS several typographic characters
// (verified: U+2011 non-breaking hyphen vanished from rendered output).
// Normalize to ASCII equivalents at render time only — stored content
// stays untouched.
const CHAR_MAP: Array<[RegExp, string]> = [
  [/[‐‑‒–−]/g, "-"], // hyphens/en-dash/minus -> hyphen
  [/—/g, " - "], // em-dash
  [/[‘’‚]/g, "'"],
  [/[“”„]/g, '"'],
  [/…/g, "..."],
  [/ /g, " "], // nbsp
];
export function pdfSafe(text: string): string {
  let out = text;
  for (const [re, repl] of CHAR_MAP) out = out.replace(re, repl);
  return out;
}

export type ResumePdfData = {
  name: string;
  email: string | null;
  phone: string | null;
  summary: string;
  skills: string[];
  workHistory: TailoredJson["workHistory"];
  location: string | null;
  education: Array<{
    school: string | null;
    degree: string | null;
    field: string | null;
    startYear: number | null;
    endYear: number | null;
  }>;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 48,
    color: "#111111",
    lineHeight: 1.4,
  },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  contact: { fontSize: 9, color: "#444444", marginBottom: 14 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: "#999999",
    paddingBottom: 2,
  },
  roleHeader: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginTop: 7 },
  roleMeta: { fontSize: 9, color: "#444444", marginBottom: 3 },
  bullet: { flexDirection: "row", marginBottom: 2.5 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
  skills: { marginBottom: 2 },
});

export function ResumeDocument({ data }: { data: ResumePdfData }) {
  const contactLine = [data.email, data.phone, data.location].filter(Boolean).join("  ·  ");
  return (
    <Document title={`${data.name} — Resume`} author={data.name}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{data.name}</Text>
        {contactLine.length > 0 && <Text style={styles.contact}>{contactLine}</Text>}

        {data.summary.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text>{data.summary}</Text>
          </View>
        )}

        {data.skills.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text style={styles.skills}>{data.skills.join("  ·  ")}</Text>
          </View>
        )}

        {data.workHistory.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Experience</Text>
            {data.workHistory.map((role, i) => (
              <View key={i} wrap={false}>
                <Text style={styles.roleHeader}>
                  {role.title ?? ""}
                  {role.company ? ` — ${role.company}` : ""}
                </Text>
                {(role.startDate || role.endDate) && (
                  <Text style={styles.roleMeta}>
                    {role.startDate ?? ""} – {role.endDate ?? "Present"}
                  </Text>
                )}
                {role.bullets.map((b) => (
                  <View key={b.id} style={styles.bullet}>
                    <Text style={styles.bulletMark}>•</Text>
                    <Text style={styles.bulletText}>{b.text}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {data.education.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Education</Text>
            {data.education.map((e, i) => (
              <View key={i} wrap={false}>
                <Text style={styles.roleHeader}>{e.school ?? ""}</Text>
                <Text style={styles.roleMeta}>
                  {[e.degree, e.field].filter(Boolean).join(", ")}
                  {e.startYear || e.endYear ? `  ·  ${e.startYear ?? ""}–${e.endYear ?? ""}` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
