"use client";

import type { FeatureCollection, MultiPolygon } from "geojson";
import { Map, NavigationControl, type MapLayerMouseEvent } from "maplibre-gl";
import { useEffect, useRef } from "react";

import type { DistrictBoundaryCollection } from "@/lib/api";

type Props = {
  boundaries: DistrictBoundaryCollection;
  selectedDistrictId: string;
  observedDistrictIds: string[];
  onSelect: (districtId: string) => void;
};

const sourceId = "maharashtra-districts";

export function MaharashtraMap({
  boundaries,
  selectedDistrictId,
  observedDistrictIds,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialSelectionRef = useRef(selectedDistrictId);
  const initialObservedRef = useRef(observedDistrictIds);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: "background", type: "background", paint: { "background-color": "#071D2C" } }],
      },
      center: [76.2, 18.9],
      zoom: 5.4,
      minZoom: 4.8,
      maxZoom: 9,
      attributionControl: false,
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      map.addSource(sourceId, {
        type: "geojson",
        data: boundaries as unknown as FeatureCollection<MultiPolygon>,
      });
      map.addLayer({
        id: "district-fill",
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "district_id"], initialSelectionRef.current], "#F4BBD0",
            ["in", ["get", "district_id"], ["literal", initialObservedRef.current]], "#54D6BD",
            "#193B4A",
          ],
          "fill-opacity": ["case", ["==", ["get", "district_id"], initialSelectionRef.current], 0.72, 0.5],
        },
      });
      map.addLayer({
        id: "district-outline",
        type: "line",
        source: sourceId,
        paint: { "line-color": "#78959D", "line-width": 0.8, "line-opacity": 0.72 },
      });
      map.on("click", "district-fill", (event: MapLayerMouseEvent) => {
        const id = event.features?.[0]?.properties?.district_id;
        if (typeof id === "string") onSelectRef.current(id);
      });
      map.on("mouseenter", "district-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "district-fill", () => { map.getCanvas().style.cursor = ""; });
      map.fitBounds([[72.55, 15.55], [80.95, 22.15]], { padding: 36, duration: 0 });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [boundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("district-fill")) return;
    map.setPaintProperty("district-fill", "fill-color", [
      "case",
      ["==", ["get", "district_id"], selectedDistrictId], "#F4BBD0",
      ["in", ["get", "district_id"], ["literal", observedDistrictIds]], "#54D6BD",
      "#193B4A",
    ]);
  }, [observedDistrictIds, selectedDistrictId]);

  return <div className="district-map" ref={containerRef} aria-label="Interactive Maharashtra district boundary map" />;
}
