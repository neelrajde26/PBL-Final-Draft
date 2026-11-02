"use client";

import {
  MapPin,
  Send,
  Sprout,
} from "lucide-react";
import { useState } from "react";

import {
  submitFarmerReport,
  type District,
  type FarmerReport,
} from "@/lib/api";

type Props = {
  districts: District[];
  initialReports: FarmerReport[];
};

const CROPS = [
  "Cotton (कापूस)",
  "Soybean (सोयाबीन)",
  "Sugarcane (ऊस)",
  "Pigeon Pea / Tur (तूर)",
  "Onion (कांदा)",
  "Jowar / Bajra (ज्वारी/बाजरी)",
  "Wheat / Gram (गहू/हरभरा)",
];

const CONCERNS = [
  "Prolonged dry spell > 14 days (पावसाचा खंड)",
  "Visible leaf wilting & moisture stress (पिकांची सुकवण)",
  "Well / Borewell water table depletion (विहिरींची पाणीपातळी खालावणे)",
  "Pest / Fungal outbreak under heat stress (कीड व रोगांचा प्रादुर्भाव)",
  "Fodder shortage for livestock (चाऱ्याची टंचाई)",
];

export function FarmerClient({ districts, initialReports }: Props) {
  const [selectedDistrict, setSelectedDistrict] = useState("beed");
  const [lang, setLang] = useState<"mr" | "en">("mr");

  // Form State
  const [taluka, setTaluka] = useState("");
  const [village, setVillage] = useState("");
  const [crop, setCrop] = useState(CROPS[0]);
  const [concern, setConcern] = useState(CONCERNS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reports, setReports] = useState<FarmerReport[]>(initialReports);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    try {
      const res = await submitFarmerReport({
        district_id: selectedDistrict,
        taluka: taluka || undefined,
        village: village || undefined,
        crop,
        concern,
        description: description || "Ground-truthed field report submitted via Farmer Portal.",
      });

      setSubmitSuccess("Report submitted successfully! Thank you for ground-truthing satellite observations.");
      setReports((prev) => [res.report, ...prev]);
      setTaluka("");
      setVillage("");
      setDescription("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit field report. Please verify backend connection.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 36 }}>
        {/* Localized Advisory Panel */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Sprout size={20} style={{ color: "var(--aqua)" }} />
                <h2 style={{ fontSize: 18, margin: 0 }}>
                  {lang === "mr" ? "शेतकरी सल्ला (Crop Advisory)" : "Agricultural Advisory"}
                </h2>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
                District-specific guidance calibrated against satellite moisture and thermal stress.
              </p>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => setLang("mr")}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: lang === "mr" ? "var(--aqua)" : "var(--ground)",
                  color: lang === "mr" ? "var(--ground)" : "var(--secondary)",
                  border: "1px solid",
                  borderColor: lang === "mr" ? "var(--aqua)" : "var(--border)",
                  fontWeight: lang === "mr" ? 600 : 400,
                }}
              >
                मराठी
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: 4,
                  cursor: "pointer",
                  background: lang === "en" ? "var(--aqua)" : "var(--ground)",
                  color: lang === "en" ? "var(--ground)" : "var(--secondary)",
                  border: "1px solid",
                  borderColor: lang === "en" ? "var(--aqua)" : "var(--border)",
                  fontWeight: lang === "en" ? 600 : 400,
                }}
              >
                English
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 6 }}>
              Select District (जिल्हा निवडा)
            </label>
            <select
              className="ui-select"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.region})
                </option>
              ))}
            </select>
          </div>

          <div
            style={{
              background: "var(--ground)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: 20,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
                marginBottom: 10,
              }}
            >
              {lang === "mr" ? "सक्रिय पूर्वसूचना: उच्च जोखीम" : "Active Warning: High Risk"}
            </span>

            <p style={{ margin: "0 0 12px", color: "var(--text)", fontWeight: 500 }}>
              {lang === "mr"
                ? "उच्च दुष्काळ जोखीम: पावसाचा खंड २० दिवसांपेक्षा अधिक झाल्यामुळे जमिनीतील ओलावा ३०% च्या खाली आला आहे. ठिबक किंवा तुषार सिंचनाचा वापर करून पिकांना संरक्षित पाणी द्यावे. तीव्र ताण असताना रासायनिक खतांचा वापर टाळावा."
                : "High Drought Risk: Continuous dry spell exceeding 20 days has reduced root-zone soil moisture below 30%. Provide protective micro-irrigation via drip/sprinkler. Avoid chemical top-dressing under acute moisture stress."}
            </p>

            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "var(--secondary)" }}>
              <li>
                {lang === "mr"
                  ? "बाष्पीभवन रोखण्यासाठी पिकांमध्ये सेंद्रिय आच्छादन (Mulching) करावे."
                  : "Apply organic straw mulching to suppress soil evaporation."}
              </li>
              <li>
                {lang === "mr"
                  ? "कपाशी आणि सोयाबीनमध्ये रसशोषक किडींचे त्वरित नियंत्रण करावे."
                  : "Monitor and manage sucking pests on cotton and soybean crops promptly."}
              </li>
            </ul>
          </div>
        </section>

        {/* Ground Truth Submission Form */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <MapPin size={20} style={{ color: "var(--aqua)" }} />
            <h2 style={{ fontSize: 18, margin: 0 }}>Ground-Truth Field Report</h2>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--secondary)" }}>
            Share field-level conditions directly with agricultural scientists to improve model accuracy.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--secondary)", marginBottom: 4 }}>
                  Taluka (तालुका)
                </label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="e.g. Georai"
                  value={taluka}
                  onChange={(e) => setTaluka(e.target.value)}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--secondary)", marginBottom: 4 }}>
                  Village (गाव)
                </label>
                <input
                  type="text"
                  className="ui-input"
                  placeholder="e.g. Madalmohi"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--secondary)", marginBottom: 4 }}>
                Primary Crop (मुख्य पीक)
              </label>
              <select className="ui-select" value={crop} onChange={(e) => setCrop(e.target.value)}>
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--secondary)", marginBottom: 4 }}>
                Observed Field Concern (मुख्य अडचण)
              </label>
              <select className="ui-select" value={concern} onChange={(e) => setConcern(e.target.value)}>
                {CONCERNS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, color: "var(--secondary)", marginBottom: 4 }}>
                Field Notes & Description (तपशील)
              </label>
              <textarea
                className="ui-textarea"
                rows={3}
                placeholder="Describe current crop condition, days without rain, or well levels…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {submitSuccess && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#10B981",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 4,
                }}
              >
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div
                style={{
                  padding: 10,
                  fontSize: 12,
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#EF4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: 4,
                }}
              >
                {submitError}
              </div>
            )}

            <button
              type="submit"
              className="ui-button primary"
              disabled={submitting}
              style={{ marginTop: 6 }}
            >
              <Send size={14} /> {submitting ? "Submitting to MDIS…" : "Submit Ground-Truth Observation"}
            </button>
          </form>
        </section>
      </div>

      {/* Community Ground-Truth Reports Feed */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17 }}>Crowdsourced Field Observations</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              Submitted by registered farmers across Maharashtra to validate satellite indices.
            </p>
          </div>
          <span className="num" style={{ fontSize: 12, color: "var(--secondary)" }}>
            {reports.length} Reports
          </span>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {reports.map((r) => (
            <div
              key={r.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-card)",
                padding: "16px 20px",
                display: "grid",
                gridTemplateColumns: "1.2fr 1.5fr 1fr 100px",
                gap: 16,
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <div>
                <strong style={{ color: "var(--text)" }}>
                  {districts.find((d) => d.id === r.district_id)?.name ?? r.district_id}
                </strong>
                <small style={{ display: "block", color: "var(--subtle)", marginTop: 2 }}>
                  {r.taluka ? `${r.taluka}, ` : ""}
                  {r.village ?? "District rural"}
                </small>
              </div>

              <div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>{r.crop}</div>
                <div style={{ fontSize: 12, color: "var(--secondary)", marginTop: 2 }}>{r.concern}</div>
              </div>

              <div style={{ fontSize: 12, color: "var(--subtle)" }}>
                {new Date(r.observation_date).toLocaleDateString("en-IN")}
              </div>

              <div style={{ textAlign: "right" }}>
                <span
                  className={`badge ${
                    r.status === "verified" || r.status === "approved" ? "normal" : "watch"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
