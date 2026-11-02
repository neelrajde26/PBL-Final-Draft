import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Methodology" };

export default function MethodologyPage() {
  return (
    <main className="route-main method-page">
      <header className="route-header"><div><Link href="/">MDIS</Link><h1>Methodology</h1><p>How MDIS separates observed evidence from unavailable, historical, and modeled information.</p></div></header>
      <section><h2>Administrative geometry</h2><p>District statistics use versioned Maharashtra MultiPolygon boundaries stored in PostGIS. A district mean is not presented as a farm-level pixel measurement.</p></section>
      <section><h2>Satellite observations</h2><p>Earth Engine credentials remain in the backend. Native acquisition dates, product cadence, units, valid pixels, coverage, and processing metadata accompany stored observations.</p></section>
      <section><h2>Current limitations</h2><p>The verified frontend slice contains historical CHIRPS observations for Beed from 01–03 June 2024. Other districts show an unavailable state for that interval instead of synthetic values. Drought indices and forecasts remain disabled until their validated pipelines are implemented.</p></section>
    </main>
  );
}
