"use client";

import dynamic from "next/dynamic";

import type { MapLayer } from "@/lib/api";

const GisMap = dynamic(
  () => import("@/components/gis-map").then((mod) => mod.GisMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="map-loading"
        style={{
          height: "calc(100vh - 64px)",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070a0e",
          color: "#22d3ee",
          fontSize: "13px",
        }}
      >
        Initializing WebGL GIS engine & Maharashtra boundaries…
      </div>
    ),
  },
);

export function MapClient({ layers }: { layers: MapLayer[] }) {
  return (
    <div
      style={{
        height: "calc(100vh - 64px)",
        width: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <GisMap layers={layers} initialLayer="rainfall" />
    </div>
  );
}
