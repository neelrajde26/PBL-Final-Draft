import type { Metadata } from "next";
import Link from "next/link";

import { getGeeCollections, getGeeHealth } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Satellite sources" };

export default async function SatellitePage() {
  const [health, collections] = await Promise.all([getGeeHealth(), getGeeCollections()]);
  return (
    <main className="route-main">
      <header className="route-header"><div><Link href="/">MDIS</Link><h1>Satellite sources</h1><p>Backend-only Earth Engine configuration and native dataset cadence.</p></div><span className={health.available ? "source-state available" : "source-state"}>{health.status}</span></header>
      <section className="source-summary"><div><span>Project</span><strong>{health.project_id ?? "Not configured"}</strong></div><div><span>Authentication</span><strong>{health.auth_method ?? "Unavailable"}</strong></div><div><span>Registered collections</span><strong className="num">{collections.count}</strong></div></section>
      <div className="source-list">
        {collections.items.map((collection) => (
          <article key={collection.key}><div><h2>{collection.title}</h2><p>{collection.collection_id}</p></div><dl><div><dt>Cadence</dt><dd>{collection.temporal_resolution}</dd></div><div><dt>Scale</dt><dd className="num">{collection.native_scale_m ? `${collection.native_scale_m.toLocaleString("en-IN")} m` : "Varies"}</dd></div><div><dt>Available from</dt><dd>{collection.start_date ?? "Product dependent"}</dd></div></dl></article>
        ))}
      </div>
    </main>
  );
}
