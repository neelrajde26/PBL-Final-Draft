"use client";

import { Bell, CheckCircle2, Globe, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function SettingsPage() {
  const [language, setLanguage] = useState("mr");
  const [district, setDistrict] = useState("beed");
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [severeOnly, setSevereOnly] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>User Preferences & Alert Settings</h1>
          <p>
            Configure your primary district watch preferences, advisory language, and automated notification triggers.
          </p>
        </div>
      </header>

      <form onSubmit={handleSave} style={{ maxWidth: 640, display: "grid", gap: 24 }}>
        {/* Localization Preferences */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Globe size={18} style={{ color: "var(--aqua)" }} />
            <h2 style={{ fontSize: 16, margin: 0 }}>Language & Regional Display</h2>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 6 }}>
                Primary Advisory Language
              </label>
              <select
                className="ui-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="mr">मराठी (Marathi) - शिफारसी व पूर्वसूचना</option>
                <option value="en">English - Operational Bulletins</option>
                <option value="hi">हिन्दी (Hindi) - कृषि परामर्श</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--secondary)", marginBottom: 6 }}>
                Default Administrative District
              </label>
              <select
                className="ui-select"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              >
                <option value="beed">Beed (बीड)</option>
                <option value="dharashiv">Dharashiv (धाराशिव)</option>
                <option value="latur">Latur (लातूर)</option>
                <option value="solapur">Solapur (सोलापूर)</option>
                <option value="pune">Pune (पुणे)</option>
                <option value="ahmednagar">Ahmednagar (अहिल्यानगर)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Early Warning Notifications */}
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Bell size={18} style={{ color: "var(--aqua)" }} />
            <h2 style={{ fontSize: 16, margin: 0 }}>Early Warning Notifications</h2>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--aqua)" }}
              />
              <span>Receive automated weekly drought status digest</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={severeOnly}
                onChange={(e) => setSevereOnly(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "var(--aqua)" }}
              />
              <span>Trigger immediate SMS / email notice only for High Risk and Severe Emergency warnings</span>
            </label>
          </div>
        </section>

        {saved && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 4,
              fontSize: 12,
              background: "rgba(16, 185, 129, 0.15)",
              color: "#10B981",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle2 size={16} />
            <span>Preferences saved successfully!</span>
          </div>
        )}

        <div>
          <button type="submit" className="ui-button primary" style={{ padding: "10px 20px" }}>
            <Save size={15} /> Save Preferences
          </button>
        </div>
      </form>
    </main>
  );
}
