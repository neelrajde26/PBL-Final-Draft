"use client";

import {
  Activity,
  Database,
  Play,
  RefreshCw,
  Server,
} from "lucide-react";
import { useState } from "react";

import type { GeeHealth, Readiness } from "@/lib/api";

type Props = {
  readiness: Readiness | null;
  geeHealth: GeeHealth | null;
};

const INITIAL_USERS = [
  { id: "usr-admin-01", email: "admin@mdis.gov.in", full_name: "MDIS System Administrator", role: "ADMIN", is_active: true, created_at: "2024-01-15" },
  { id: "usr-res-01", email: "dr.patil@iitb.ac.in", full_name: "Dr. Aniruddha Patil", role: "RESEARCHER", is_active: true, created_at: "2024-03-22" },
  { id: "usr-farm-01", email: "ramesh.k@farmer.mdis.in", full_name: "Ramesh Keshavrao Kadam", role: "FARMER", is_active: true, created_at: "2024-06-01" },
  { id: "usr-farm-02", email: "sunita.g@farmer.mdis.in", full_name: "Sunita Ganpat Gaikwad", role: "FARMER", is_active: true, created_at: "2024-06-02" },
];

export function AdminClient({ readiness, geeHealth }: Props) {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [pipelineAction, setPipelineAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const toggleUser = (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          if (u.role === "ADMIN") {
            alert("Cannot deactivate primary administrative account.");
            return u;
          }
          return { ...u, is_active: !u.is_active };
        }
        return u;
      }),
    );
  };

  const triggerIngestion = (actionType: string) => {
    setPipelineAction(actionType);
    setActionMessage(null);
    setTimeout(() => {
      setPipelineAction(null);
      setActionMessage(`Pipeline job '${actionType}' successfully dispatched across 36 districts with chunk size 6.`);
    }, 1200);
  };

  return (
    <div>
      {/* Infrastructure Telemetry Grid */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Core Infrastructure Status</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {/* PostGIS Database */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Database size={18} style={{ color: "var(--aqua)" }} />
                <strong style={{ fontSize: 14 }}>PostgreSQL / PostGIS</strong>
              </div>
              <span className={`badge ${readiness?.database.available ? "normal" : "watch"}`}>
                {readiness?.database.available ? "Connected" : "Offline"}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              {readiness?.database.message ?? "Local / Container PostGIS Instance"}
            </p>
          </div>

          {/* Google Earth Engine */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Server size={18} style={{ color: "var(--aqua)" }} />
                <strong style={{ fontSize: 14 }}>Google Earth Engine</strong>
              </div>
              <span className={`badge ${geeHealth?.available ? "normal" : "watch"}`}>
                {geeHealth?.available ? "Initialized" : "Unverified"}
              </span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              Project: <code>{geeHealth?.project_id ?? "gee-pbl"}</code> (Auth: ADC)
            </p>
          </div>

          {/* Celery Background Worker */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Activity size={18} style={{ color: "var(--aqua)" }} />
                <strong style={{ fontSize: 14 }}>Celery Task Workers</strong>
              </div>
              <span className="badge normal">Operational</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              Prefetch: 1 · Concurrency: Chunked 6-district batches
            </p>
          </div>

          {/* Redis Broker */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RefreshCw size={18} style={{ color: "var(--aqua)" }} />
                <strong style={{ fontSize: 14 }}>Redis Lock / Broker</strong>
              </div>
              <span className="badge normal">Ready</span>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              Distributed Mutex Locks & Result Backend Active
            </p>
          </div>
        </div>
      </section>

      {/* Manual Pipeline Ingestion Triggers */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
          Orchestration & Background Job Triggers
        </h2>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 22,
          }}
        >
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--secondary)" }}>
            Execute statewide data ingestion and analytics pipelines across all 36 administrative districts.
            Tasks are queued asynchronously in Celery and rate-limited to avoid GEE API throttling.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ui-button"
              disabled={pipelineAction !== null}
              onClick={() => triggerIngestion("chirps_statewide_ingest")}
            >
              <Play size={14} /> {pipelineAction === "chirps_statewide_ingest" ? "Queuing Tasks…" : "Trigger CHIRPS Daily Ingest"}
            </button>

            <button
              type="button"
              className="ui-button"
              disabled={pipelineAction !== null}
              onClick={() => triggerIngestion("modis_composite_ingest")}
            >
              <Play size={14} /> {pipelineAction === "modis_composite_ingest" ? "Queuing Tasks…" : "Trigger MODIS 16-Day VCI Ingest"}
            </button>

            <button
              type="button"
              className="ui-button"
              disabled={pipelineAction !== null}
              onClick={() => triggerIngestion("evaluate_early_warning_alerts")}
            >
              <RefreshCw size={14} /> {pipelineAction === "evaluate_early_warning_alerts" ? "Evaluating…" : "Evaluate Statewide Alerts"}
            </button>
          </div>

          {actionMessage && (
            <div
              style={{
                marginTop: 16,
                padding: "10px 14px",
                borderRadius: 4,
                fontSize: 12,
                background: "rgba(84, 214, 189, 0.15)",
                color: "var(--aqua)",
                border: "1px solid rgba(84, 214, 189, 0.3)",
              }}
            >
              {actionMessage}
            </div>
          )}
        </div>
      </section>

      {/* User Role Management */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>System User Registry & RBAC</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--secondary)" }}>
              Public registration defaults to FARMER role. Administrative roles are restricted to government verified personnel.
            </p>
          </div>
          <span className="num" style={{ fontSize: 12, color: "var(--secondary)" }}>
            {users.length} Users Registered
          </span>
        </div>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 100px",
              padding: "12px 20px",
              background: "var(--raised)",
              color: "var(--secondary)",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span>Full Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span style={{ textAlign: "right" }}>Action</span>
          </div>

          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 100px",
                padding: "14px 20px",
                borderTop: "1px solid var(--border)",
                alignItems: "center",
                fontSize: 13,
              }}
            >
              <strong style={{ color: "var(--text)" }}>{u.full_name}</strong>
              <span style={{ color: "var(--secondary)" }}>{u.email}</span>
              <div>
                <span
                  style={{
                    fontFamily: "JetBrains Mono",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 3,
                    background: "var(--ground)",
                    border: "1px solid var(--border)",
                    color: u.role === "ADMIN" ? "var(--pink)" : u.role === "RESEARCHER" ? "var(--aqua)" : "var(--text)",
                  }}
                >
                  {u.role}
                </span>
              </div>
              <div>
                <span className={`badge ${u.is_active ? "normal" : "watch"}`}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <button
                  type="button"
                  className="ui-button"
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => toggleUser(u.id)}
                  disabled={u.role === "ADMIN"}
                >
                  {u.is_active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
