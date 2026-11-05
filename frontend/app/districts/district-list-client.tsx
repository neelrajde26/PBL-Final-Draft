"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { District } from "@/lib/api";

const REGIONS = [
  "All",
  "Marathwada",
  "Vidarbha",
  "Western Maharashtra",
  "North Maharashtra",
  "Konkan",
];

export function DistrictListClient({ initialDistricts }: { initialDistricts: District[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All");

  const filtered = useMemo(() => {
    return initialDistricts.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(query.toLowerCase()) ||
        d.code.toLowerCase().includes(query.toLowerCase()) ||
        d.region.toLowerCase().includes(query.toLowerCase());
      const matchesRegion = region === "All" || d.region === region;
      return matchesSearch && matchesRegion;
    });
  }, [initialDistricts, query, region]);

  return (
    <div>
      {/* Search and Filter Controls */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--subtle)" }}
          />
          <input
            type="text"
            className="ui-input"
            style={{ paddingLeft: 36 }}
            placeholder="Search districts by name, code, or division…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {REGIONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRegion(r)}
              style={{
                padding: "6px 12px",
                fontSize: 14,
                borderRadius: 4,
                cursor: "pointer",
                background: region === r ? "var(--aqua)" : "var(--surface)",
                color: region === r ? "var(--ground)" : "var(--secondary)",
                border: "1px solid",
                borderColor: region === r ? "var(--aqua)" : "var(--border)",
                fontWeight: region === r ? 600 : 400,
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Registry Table */}
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
            gridTemplateColumns: "1.4fr 1.2fr 1.2fr 1fr 100px",
            padding: "12px 20px",
            background: "var(--raised)",
            color: "var(--secondary)",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          <span>District Name</span>
          <span>Region</span>
          <span>Boundary Status</span>
          <span>Drought Priority</span>
          <span style={{ textAlign: "right" }}>Action</span>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--secondary)" }}>
            No districts match the specified filters.
          </div>
        ) : (
          filtered.map((district) => (
            <div
              key={district.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1.2fr 1.2fr 1fr 100px",
                padding: "14px 20px",
                borderTop: "1px solid var(--border)",
                alignItems: "center",
                fontSize: 15,
              }}
            >
              <div>
                <Link
                  href={`/districts/${district.id}`}
                  style={{
                    color: "var(--text)",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {district.name}
                </Link>
                <small className="num" style={{ display: "block", color: "var(--subtle)", marginTop: 2 }}>
                  {district.code}
                </small>
              </div>

              <span style={{ color: "var(--secondary)" }}>{district.region}</span>

              <span>
                {district.boundary_available ? (
                  <span style={{ color: "var(--aqua)", fontSize: 14 }}>
                    ✓ {district.boundary_version}
                  </span>
                ) : (
                  <span style={{ color: "var(--subtle)", fontSize: 14 }}>Unavailable</span>
                )}
              </span>

              <div>
                {district.is_priority ? (
                  <span className="badge severe">Priority</span>
                ) : (
                  <span className="badge normal">Standard</span>
                )}
              </div>

              <div style={{ textAlign: "right" }}>
                <Link
                  href={`/districts/${district.id}`}
                  className="ui-button"
                  style={{ padding: "4px 8px", fontSize: 14 }}
                  title={`View ${district.name} details`}
                >
                  Profile <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
