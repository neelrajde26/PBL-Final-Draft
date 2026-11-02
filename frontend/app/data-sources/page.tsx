import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Satellite Sensor & Data Source Catalog",
  description: "Comprehensive scientific specification of the 11 integrated Earth observation datasets in MDIS.",
};

const DATASETS = [
  {
    id: "chirps",
    title: "CHIRPS Daily Precipitation",
    collection_id: "UCSB-CHG/CHIRPS/DAILY",
    mission: "Climate Hazards Center / UCSB",
    native_spatial: "0.05° (~5.5 km)",
    native_temporal: "Daily",
    bands: [{ name: "precipitation", unit: "mm/day", scale: 1.0, description: "Daily rainfall estimate combining satellite cold cloud duration and rain gauge measurements." }],
    qa_mask: "Gauge calibration flags and valid coverage ratio",
    cadence_rule: "Native daily observations are stored without collapsing into synthetic multi-month composites.",
  },
  {
    id: "mod13q1",
    title: "MODIS Vegetation Indices (NDVI / EVI)",
    collection_id: "MODIS/061/MOD13Q1",
    mission: "Terra MODIS (NASA LP DAAC)",
    native_spatial: "250 m",
    native_temporal: "16-day composite",
    bands: [
      { name: "NDVI", unit: "Normalized ratio [-1 to 1]", scale: 0.0001, description: "Normalized Difference Vegetation Index" },
      { name: "EVI", unit: "Enhanced ratio", scale: 0.0001, description: "Enhanced Vegetation Index with atmospheric aerosol resistance" },
    ],
    qa_mask: "Pixel reliability band (0 = Good data, 1 = Marginal, 2 = Snow/Ice, 3 = Cloudy)",
    cadence_rule: "16-day native composites; never interpolated into synthetic daily greenness.",
  },
  {
    id: "mod11a2",
    title: "MODIS Land Surface Temperature (LST)",
    collection_id: "MODIS/061/MOD11A2",
    mission: "Terra MODIS (NASA LP DAAC)",
    native_spatial: "1000 m (1 km)",
    native_temporal: "8-day composite",
    bands: [
      { name: "LST_Day_1km", unit: "Kelvin", scale: 0.02, description: "Daytime surface skin temperature" },
      { name: "LST_Night_1km", unit: "Kelvin", scale: 0.02, description: "Nighttime surface skin temperature" },
    ],
    qa_mask: "QC_Day bitmask (Mandatory QA flags, average emissivity error, LST error < 1K)",
    cadence_rule: "8-day clear-sky average composite.",
  },
  {
    id: "mod16a2",
    title: "MODIS Evapotranspiration (ET & PET)",
    collection_id: "MODIS/061/MOD16A2",
    mission: "Terra MODIS (NASA LP DAAC)",
    native_spatial: "500 m",
    native_temporal: "8-day composite",
    bands: [
      { name: "ET", unit: "kg/m²/8day (mm)", scale: 0.1, description: "Actual Evapotranspiration" },
      { name: "PET", unit: "kg/m²/8day (mm)", scale: 0.1, description: "Potential Evapotranspiration" },
    ],
    qa_mask: "ET_QC bitmask excluding cloudy or snow-covered pixels",
    cadence_rule: "8-day cumulative water vapor flux.",
  },
  {
    id: "gldas",
    title: "GLDAS Noah Land Surface Model",
    collection_id: "NASA/GLDAS/V021/NOAH/G025/T3H",
    mission: "NASA GSFC",
    native_spatial: "0.25° (~27 km)",
    native_temporal: "3-hourly",
    bands: [
      { name: "SoilMoi0_10cm_inst", unit: "kg/m²", scale: 1.0, description: "Topsoil moisture (0–10 cm)" },
      { name: "SoilMoi10_40cm_inst", unit: "kg/m²", scale: 1.0, description: "Root-zone upper layer (10–40 cm)" },
      { name: "SoilMoi40_100cm_inst", unit: "kg/m²", scale: 1.0, description: "Root-zone lower layer (40–100 cm)" },
    ],
    qa_mask: "Model land-sea mask and convergence flags",
    cadence_rule: "Aggregated from native 3-hourly time steps to daily mean root-zone volume.",
  },
  {
    id: "era5_land",
    title: "ERA5-Land Daily Meteorological Aggregations",
    collection_id: "ECMWF/ERA5_LAND/DAILY_AGGR",
    mission: "ECMWF Copernicus Climate Change Service",
    native_spatial: "0.1° (~11 km)",
    native_temporal: "Daily aggregation",
    bands: [
      { name: "temperature_2m", unit: "Kelvin", scale: 1.0, description: "2-meter air temperature" },
      { name: "surface_runoff_sum", unit: "m/day", scale: 1.0, description: "Surface runoff depth" },
      { name: "sub_surface_runoff_sum", unit: "m/day", scale: 1.0, description: "Sub-surface drainage runoff" },
    ],
    qa_mask: "Quality-controlled European reanalysis assimilation",
    cadence_rule: "Daily aggregate product calculated from hourly model integration.",
  },
  {
    id: "sentinel1",
    title: "Sentinel-1 Synthetic Aperture Radar (SAR)",
    collection_id: "COPERNICUS/S1_GRD",
    mission: "ESA Copernicus",
    native_spatial: "10 m",
    native_temporal: "6–12 days",
    bands: [
      { name: "VV", unit: "dB backscatter", scale: 1.0, description: "Vertical transmit / Vertical receive" },
      { name: "VH", unit: "dB backscatter", scale: 1.0, description: "Vertical transmit / Horizontal receive" },
    ],
    qa_mask: "Border noise removal, thermal noise removal, and radiometric terrain flattening",
    cadence_rule: "All-weather cloud-penetrating radar acquisitions.",
  },
  {
    id: "sentinel2",
    title: "Sentinel-2 Multispectral Surface Reflectance",
    collection_id: "COPERNICUS/S2_SR_HARMONIZED",
    mission: "ESA Copernicus",
    native_spatial: "10 m / 20 m",
    native_temporal: "5 days",
    bands: [
      { name: "B4", unit: "Red reflectance", scale: 0.0001, description: "Band 4 (665 nm)" },
      { name: "B8", unit: "NIR reflectance", scale: 0.0001, description: "Band 8 (842 nm)" },
      { name: "B11", unit: "SWIR reflectance", scale: 0.0001, description: "Band 11 (1610 nm) - Canopy water content" },
    ],
    qa_mask: "SCL (Scene Classification Layer) masking clouds, cirrus, and cloud shadows",
    cadence_rule: "High-resolution cloud-screened optical pass.",
  },
  {
    id: "smap",
    title: "NASA-USDA SMAP Soil Moisture",
    collection_id: "NASA_USDA/HSL/SMAP10KM_soil_moisture",
    mission: "NASA / USDA",
    native_spatial: "10 km",
    native_temporal: "3-day composite",
    bands: [
      { name: "ssm", unit: "m³/m³", scale: 1.0, description: "Surface soil moisture (0–5 cm)" },
      { name: "susm", unit: "m³/m³", scale: 1.0, description: "Root-zone subsurface soil moisture (0–100 cm)" },
    ],
    qa_mask: "Retrieval quality flag (0 = Recommended, 1 = Retrieval attempt successful)",
    cadence_rule: "L-band microwave radiometric retrieval.",
  },
  {
    id: "grace",
    title: "GRACE Terrestrial Water Storage Anomaly",
    collection_id: "NASA/GRACE/MASS_GRIDS/LAND",
    mission: "NASA / JPL",
    native_spatial: "1.0° (~110 km)",
    native_temporal: "Monthly",
    bands: [
      { name: "lwe_thickness", unit: "cm equivalent water height", scale: 1.0, description: "Liquid water equivalent groundwater & deep aquifer storage anomaly" },
    ],
    qa_mask: "Degree-60 spherical harmonic destriping filter applied",
    cadence_rule: "Regional groundwater basin depletion tracking.",
  },
  {
    id: "gpm",
    title: "GPM IMERG Final Precipitation",
    collection_id: "NASA/GPM_L3/IMERG_V06",
    mission: "NASA / JAXA",
    native_spatial: "0.1° (~11 km)",
    native_temporal: "Daily",
    bands: [
      { name: "precipitationCal", unit: "mm/hr", scale: 1.0, description: "Multi-satellite precipitation with gauge calibration" },
    ],
    qa_mask: "Quality index weighting gauge density vs microwave sensor type",
    cadence_rule: "Used for high-intensity precipitation benchmarking.",
  },
];

export default function DataSourcesPage() {
  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Earth Observation Satellite Catalog</h1>
          <p>
            Detailed specifications of the 11 operational satellite missions integrated into MDIS,
            including native spatial resolutions, temporal observation cadences, QA bitmask rules, and band scalings.
          </p>
        </div>
        <span className="num" style={{ fontSize: 18, color: "var(--aqua)" }}>
          11 Sensors
        </span>
      </header>

      <div style={{ display: "grid", gap: 20 }}>
        {DATASETS.map((ds) => (
          <article
            key={ds.id}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-card)",
              padding: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: "var(--text)" }}>{ds.title}</h2>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono",
                      fontSize: 11,
                      background: "var(--ground)",
                      border: "1px solid var(--border)",
                      padding: "2px 6px",
                      borderRadius: 3,
                      color: "var(--aqua)",
                    }}
                  >
                    {ds.mission}
                  </span>
                </div>
                <p style={{ margin: "4px 0 0", fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--secondary)" }}>
                  GEE Collection: <strong>{ds.collection_id}</strong>
                </p>
              </div>

              <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                <div>
                  <span style={{ color: "var(--secondary)" }}>Resolution:</span>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{ds.native_spatial}</div>
                </div>
                <div>
                  <span style={{ color: "var(--secondary)" }}>Cadence:</span>
                  <div style={{ fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{ds.native_temporal}</div>
                </div>
              </div>
            </div>

            {/* Bands Table */}
            <div
              style={{
                background: "var(--ground)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                overflow: "hidden",
                margin: "14px 0",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr 2fr",
                  padding: "8px 14px",
                  background: "var(--raised)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--secondary)",
                }}
              >
                <span>Band Name</span>
                <span>Unit</span>
                <span>Scale Factor</span>
                <span>Scientific Description</span>
              </div>
              {ds.bands.map((b) => (
                <div
                  key={b.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr 1fr 2fr",
                    padding: "10px 14px",
                    borderTop: "1px solid var(--border)",
                    fontSize: 12,
                    alignItems: "center",
                  }}
                >
                  <code style={{ color: "var(--aqua)" }}>{b.name}</code>
                  <span style={{ color: "var(--secondary)" }}>{b.unit}</span>
                  <span className="num" style={{ color: "var(--text)" }}>{b.scale}</span>
                  <span style={{ color: "var(--secondary)" }}>{b.description}</span>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12, marginTop: 12 }}>
              <div>
                <strong style={{ color: "var(--secondary)" }}>QA & Pixel Masking Protocol:</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{ds.qa_mask}</p>
              </div>
              <div>
                <strong style={{ color: "var(--secondary)" }}>Temporal Aggregation Rule:</strong>
                <p style={{ margin: "4px 0 0", color: "var(--text)" }}>{ds.cadence_rule}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
