import type { Metadata } from "next";
import Link from "next/link";

import { getDistricts, type District } from "@/lib/api";
import { DistrictListClient } from "./district-list-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Maharashtra District Registry",
  description: "All 36 administrative districts of Maharashtra with boundary versions, centroids, and profile links.",
};

export default async function DistrictsPage() {
  let districts: District[] = [];
  try {
    const res = await getDistricts();
    districts = res.items;
  } catch {
    districts = [];
  }

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>Maharashtra District Registry</h1>
          <p>
            Complete catalog of all 36 administrative districts with versioned multi-polygon boundaries,
            priority drought risk classifications, and live indicator drilldowns.
          </p>
        </div>
        <span className="num" style={{ fontSize: 18, color: "var(--aqua)" }}>
          {districts.length} Districts
        </span>
      </header>

      <DistrictListClient initialDistricts={districts} />
    </main>
  );
}
