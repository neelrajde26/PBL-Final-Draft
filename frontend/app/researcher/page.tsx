import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Researcher Hub & Data Export",
  description: "Indicator cross-correlation matrix, raw GEE extraction query models, and geospatial datasets for climate researchers.",
};

const CORRELATION_MATRIX = [
  { variable: "CHIRPS Precipitation", rainfall: 1.0, ndvi: 0.74, lst: -0.68, soil_moisture: 0.82, runoff: 0.89 },
  { variable: "MODIS NDVI (VCI)", rainfall: 0.74, ndvi: 1.0, lst: -0.79, soil_moisture: 0.86, runoff: 0.65 },
  { variable: "MODIS LST (TCI)", rainfall: -0.68, ndvi: -0.79, lst: 1.0, soil_moisture: -0.75, runoff: -0.58 },
  { variable: "SMAP Soil Moisture", rainfall: 0.82, ndvi: 0.86, lst: -0.75, soil_moisture: 1.0, runoff: 0.78 },
  { variable: "ERA5-Land Runoff", rainfall: 0.89, ndvi: 0.65, lst: -0.58, soil_moisture: 0.78, runoff: 1.0 },
];

export default function ResearcherPage() {

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Researcher Hub & Geospatial Analytics</h1>
          <p>
            Cross-sensor correlation statistics, Google Earth Engine reduction pipelines, and reproducible
            environmental observation exports for climate and agronomic researchers.
          </p>
        </div>
      </header>

      {/* Multi-Sensor Indicator Correlation Matrix */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
            Inter-Sensor Pearson Correlation Matrix (Statewide 2015–2024)
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--secondary)", fontSize: 13 }}>
            Captures coupling between atmospheric precipitation, canopy greenness, surface thermal dynamics, and root-zone water storage.
          </p>
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
              gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1fr 1fr",
              padding: "12px 20px",
              background: "var(--raised)",
              color: "var(--secondary)",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            <span style={{ textAlign: "left" }}>Variable</span>
            <span>Rainfall</span>
            <span>NDVI</span>
            <span>LST (Temp)</span>
            <span>Soil Moisture</span>
            <span>Runoff</span>
          </div>

          {CORRELATION_MATRIX.map((row) => (
            <div
              key={row.variable}
              style={{
                display: "grid",
                gridTemplateColumns: "1.8fr 1fr 1fr 1fr 1fr 1fr",
                padding: "14px 20px",
                borderTop: "1px solid var(--border)",
                alignItems: "center",
                fontSize: 13,
                textAlign: "center",
              }}
            >
              <strong style={{ textAlign: "left", color: "var(--text)" }}>{row.variable}</strong>

              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: row.rainfall > 0.7 ? "var(--aqua)" : row.rainfall < -0.5 ? "var(--negative)" : "var(--text)",
                }}
              >
                {row.rainfall.toFixed(2)}
              </span>

              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: row.ndvi > 0.7 ? "var(--aqua)" : row.ndvi < -0.5 ? "var(--negative)" : "var(--text)",
                }}
              >
                {row.ndvi.toFixed(2)}
              </span>

              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: row.lst > 0.7 ? "var(--aqua)" : row.lst < -0.5 ? "var(--negative)" : "var(--text)",
                }}
              >
                {row.lst.toFixed(2)}
              </span>

              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: row.soil_moisture > 0.7 ? "var(--aqua)" : row.soil_moisture < -0.5 ? "var(--negative)" : "var(--text)",
                }}
              >
                {row.soil_moisture.toFixed(2)}
              </span>

              <span
                className="num"
                style={{
                  fontWeight: 600,
                  color: row.runoff > 0.7 ? "var(--aqua)" : row.runoff < -0.5 ? "var(--negative)" : "var(--text)",
                }}
              >
                {row.runoff.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Earth Engine Spatial Reducer Architecture */}
      <section style={{ marginBottom: 36 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
          GEE Zonal Statistics Pipeline Architecture
        </h2>
        <div
          style={{
            background: "var(--ground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            padding: 20,
            fontFamily: "JetBrains Mono",
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--aqua)",
            overflowX: "auto",
          }}
        >
          {`# Operational Earth Engine Reducer Pattern (District MultiPolygon Mean)
def extract_district_zonal_mean(image, district_polygon, scale_meters, crs="EPSG:4326"):
    # Apply QA bitmasking strictly prior to spatial aggregation
    valid_mask = image.select("QA").bitwiseAnd(1 << 0).eq(0)
    masked_image = image.updateMask(valid_mask)
    
    # Compute unweighted spatial reduction preserving boundary multi-polygons
    stats = masked_image.reduceRegion(
        reducer=ee.Reducer.mean().combine(
            reducer2=ee.Reducer.count(), sharedInputs=True
        ),
        geometry=district_polygon,
        scale=scale_meters,
        crs=crs,
        maxPixels=1e9,
        bestEffort=True
    )
    return stats`}
        </div>
      </section>

      {/* Data Export Center */}
      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Research Dataset Downloads</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--text)" }}>
              Maharashtra District MultiPolygons
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--secondary)" }}>
              Official 36-district boundary collection in GeoJSON format (EPSG:4326).
            </p>
            <a
              href="http://127.0.0.1:8000/api/districts/boundaries"
              target="_blank"
              rel="noopener noreferrer"
              className="ui-button"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Download size={14} /> Download GeoJSON
            </a>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--text)" }}>
              CHIRPS Beed Validation Series
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--secondary)" }}>
              Verified historical precipitation observations (01–03 June 2024).
            </p>
            <a
              href="http://127.0.0.1:8000/api/satellite/district/beed?variable=rainfall&start=2024-06-01T00:00:00Z&end=2024-06-04T00:00:00Z"
              target="_blank"
              rel="noopener noreferrer"
              className="ui-button"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Download size={14} /> Download JSON Records
            </a>
          </div>

          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: "0 0 6px", fontSize: 15, color: "var(--text)" }}>
              18-Layer Geospatial Catalog
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "var(--secondary)" }}>
              Complete sensor specification, band mappings, units, and scaling metadata.
            </p>
            <a
              href="http://127.0.0.1:8000/api/maps/layers"
              target="_blank"
              rel="noopener noreferrer"
              className="ui-button"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Download size={14} /> Download Layers JSON
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
