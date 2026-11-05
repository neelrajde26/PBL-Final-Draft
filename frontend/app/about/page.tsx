import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About MDIS & Scientific Standards",
  description: "About the Maharashtra Drought Intelligence System (MDIS), institutional standards, and engineering architecture.",
};

export default function AboutPage() {
  return (
    <main className="route-main method-page">
      <header className="route-header">
        <div>
          <Link href="/overview" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 15 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>About MDIS</h1>
          <p>
            An operational, scientifically defensible drought monitoring and predictive intelligence system
            engineered specifically for Maharashtra’s 36 administrative districts.
          </p>
        </div>
      </header>

      <section>
        <h2>Institutional Mission</h2>
        <p>
          Maharashtra experiences recurrent, severe drought cycles—most intensely across the Marathwada and Vidarbha
          divisions. MDIS provides state administrators, agronomists, and farmers with verified, multi-sensor satellite
          evidence and transparent machine-learning forecasts. We replace disconnected prototypes and fabricated numbers
          with truthful, reproducible scientific indicators.
        </p>
      </section>

      <section>
        <h2>Drought Manual Compliance</h2>
        <p>
          MDIS strictly implements the standardized multi-tier triggers stipulated by the{" "}
          <strong>Manual for Drought Management (2016 / 2020 update)</strong>, Ministry of Agriculture and Farmers Welfare,
          Government of India. Triggers combine Matrix 1 (Rainfall Deficiency and Standardized Precipitation Index) with
          Matrix 2 (Vegetation Condition Index VCI, Soil Moisture Depletion, and Hydrological Streamflow Deficits).
        </p>
      </section>

      <section>
        <h2>Scientific Integrity Rules</h2>
        <p>
          <strong>1. Zero Data Fabrication:</strong> Observations reflect genuine sensor acquisitions. Districts lacking
          ingested records for a given period truthfully display an unavailable state rather than synthetic data.
          <br /><br />
          <strong>2. Boundary-Exact MultiPolygons:</strong> Reductions are computed over official Survey of India / PostGIS
          district geometries, not bounding boxes or artificial circular buffers.
          <br /><br />
          <strong>3. Temporal Leakage Elimination:</strong> All forecasting models use chronological walk-forward
          cross-validation. Random shuffling is strictly prohibited.
          <br /><br />
          <strong>4. NWP Forecasting Safeguards:</strong> 7-day and 15-day weather forecasts remain disabled until
          live numerical weather prediction (NWP) model feeds are certified and connected.
        </p>
      </section>

      <section>
        <h2>Sensor Catalog</h2>
        <p>
          Integrated satellite missions include CHIRPS (0.05° daily precipitation), MODIS MOD13Q1 (250m NDVI/EVI),
          MODIS MOD11A2 (1km LST), MODIS MOD16A2 (500m Evapotranspiration), NASA-USDA SMAP (root-zone soil moisture),
          and ECMWF ERA5-Land (climatological reanalysis and runoff).
        </p>
      </section>
    </main>
  );
}
