"use client";

import { AlertCircle, Sprout } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getApiBase, getDistricts, type District } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [districts, setDistricts] = useState<District[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [districtId, setDistrictId] = useState("beed");
  const [taluka, setTaluka] = useState("");
  const [village, setVillage] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState("mr");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDistricts()
      .then((res) => {
        setDistricts(res.items);
        if (res.items.length > 0) setDistrictId(res.items[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          password,
          district_id: districtId,
          taluka: taluka || undefined,
          village: village || undefined,
          preferred_language: preferredLanguage,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Registration failed. Please check the provided information.");
      }

      router.push("/farmer");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "calc(100vh - 60px)",
        display: "grid",
        placeItems: "center",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              display: "inline-grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "var(--ground)",
              border: "1px solid var(--aqua)",
              color: "var(--aqua)",
              marginBottom: 12,
            }}
          >
            <Sprout size={20} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Farmer Registration</h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--secondary)" }}>
            Register to receive localized advisories and submit ground-truth field observations.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
              Full Name (पूर्ण नाव)
            </label>
            <input
              type="text"
              required
              className="ui-input"
              placeholder="e.g. Ramesh Keshavrao Kadam"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
              Email Address (ईमेल)
            </label>
            <input
              type="email"
              required
              className="ui-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
              Password (पासवर्ड - किमान ८ अक्षरे)
            </label>
            <input
              type="password"
              required
              minLength={8}
              className="ui-input"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
                District (जिल्हा)
              </label>
              <select
                className="ui-select"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
                Preferred Language
              </label>
              <select
                className="ui-select"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
              >
                <option value="mr">मराठी (Marathi)</option>
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
                Taluka (तालुका)
              </label>
              <input
                type="text"
                className="ui-input"
                placeholder="Optional"
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 4 }}>
                Village (गाव)
              </label>
              <input
                type="text"
                className="ui-input"
                placeholder="Optional"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 4,
                fontSize: 14,
                background: "rgba(239, 68, 68, 0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="ui-button primary"
            disabled={loading}
            style={{ width: "100%", padding: "10px 16px", marginTop: 6 }}
          >
            {loading ? "Creating Account…" : "Complete Farmer Registration"}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
            textAlign: "center",
            fontSize: 15,
            color: "var(--secondary)",
          }}
        >
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--aqua)", textDecoration: "none", fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
