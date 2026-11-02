import type { Metadata } from "next";
import Link from "next/link";

import { getGeeHealth, getReadiness } from "@/lib/api";
import { AdminClient } from "./admin-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "System Administration & Telemetry",
  description: "Administrative console for managing database connections, Earth Engine workers, user access, and pipeline ingestion runs.",
};

export default async function AdminPage() {
  const [readiness, geeHealth] = await Promise.all([
    getReadiness().catch(() => null),
    getGeeHealth().catch(() => null),
  ]);

  return (
    <main className="route-main">
      <header className="route-header">
        <div>
          <Link href="/" style={{ color: "var(--aqua)", textDecoration: "none", fontSize: 13 }}>
            ← Home
          </Link>
          <h1 style={{ marginTop: 12 }}>System Administration & Ingestion Telemetry</h1>
          <p>
            Monitor real-time infrastructure health, PostGIS geospatial indexes, Celery worker task queues,
            and manage administrative role access.
          </p>
        </div>
      </header>

      <AdminClient
        readiness={readiness}
        geeHealth={geeHealth}
      />
    </main>
  );
}
