import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts } from "@/lib/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "District registry" };

export default async function DistrictsPage() {
  const response = await getDistricts();
  return (
    <main className="route-main">
      <header className="route-header"><div><Link href="/">MDIS</Link><h1>District registry</h1><p>All 36 administrative districts with stable identifiers and active boundary status.</p></div><span className="num">{response.count} districts</span></header>
      <div className="registry-table">
        <div className="registry-head"><span>District</span><span>Region</span><span>Boundary</span></div>
        {response.items.map((district) => (
          <div className="registry-row" key={district.id}>
            <div><strong>{district.name}</strong><small className="num">{district.code}</small></div>
            <span>{district.region}</span>
            <span>{district.boundary_available ? district.boundary_version : "Unavailable"}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
