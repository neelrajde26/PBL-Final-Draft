import type { Metadata } from "next";

import { getMapLayers, type MapLayer } from "@/lib/api";
import { MapClient } from "./map-client";

export const dynamicMode = "force-dynamic";
export const metadata: Metadata = {
  title: "Interactive GIS Map",
  description: "Statewide 18-layer multi-sensor geospatial drought intelligence viewer for Maharashtra.",
};

export default async function MapPage() {
  let layers: MapLayer[] = [];
  try {
    const res = await getMapLayers();
    layers = res.items;
  } catch {
    layers = [
      { id: "rainfall", name: "CHIRPS Precipitation", domain: "meteorological", unit: "mm/day", source: "UCSB-CHG/CHIRPS/DAILY", min: 0, max: 100, palette: ["#102C3C", "#54D6BD", "#F4BBD0"] },
      { id: "vci", name: "MODIS VCI (Vegetation Condition)", domain: "agricultural", unit: "%", source: "MODIS/061/MOD13Q1", min: 0, max: 100, palette: ["#7F1D1D", "#FBBF24", "#10B981"] },
      { id: "soil_moisture", name: "SMAP Soil Moisture", domain: "hydrological", unit: "m³/m³", source: "NASA-USDA/SMAP_SM2015", min: 0, max: 0.5, palette: ["#EF4444", "#FBBF24", "#54D6BD"] },
    ];
  }

  return <MapClient layers={layers} />;
}
