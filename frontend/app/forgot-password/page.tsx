"use client";

import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { getApiBase } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${getApiBase()}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        throw new Error("Unable to process password reset request.");
      }

      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to request password reset.";
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
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
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
            <KeyRound size={20} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Reset Password</h1>
          <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--secondary)" }}>
            Enter your registered email to receive secure recovery instructions.
          </p>
        </div>

        {success ? (
          <div
            style={{
              padding: 20,
              textAlign: "center",
              background: "var(--ground)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 6,
            }}
          >
            <CheckCircle2 size={32} style={{ color: "#10B981", margin: "0 auto 10px" }} />
            <strong style={{ display: "block", color: "var(--text)", fontSize: 15 }}>
              Instructions Dispatched
            </strong>
            <p style={{ margin: "6px 0 16px", fontSize: 14, color: "var(--secondary)", lineHeight: 1.5 }}>
              If an account is associated with <strong>{email}</strong>, a recovery token has been generated.
            </p>
            <Link href="/login" className="ui-button primary" style={{ width: "100%", justifyContent: "center" }}>
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 14, color: "var(--secondary)", marginBottom: 6 }}>
                Registered Email Address
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }}
                />
                <input
                  type="email"
                  required
                  className="ui-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              style={{ width: "100%", padding: "10px 16px" }}
            >
              {loading ? "Sending Request…" : "Send Reset Link"}
            </button>

            <div style={{ textAlign: "center", marginTop: 8 }}>
              <Link
                href="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "var(--secondary)",
                  fontSize: 15,
                  textDecoration: "none",
                }}
              >
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
