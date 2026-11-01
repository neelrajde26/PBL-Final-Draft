export type DistrictObservation = {
  variable_key: string;
  observation_time: string;
  period_start: string;
  period_end: string;
  mean_value: number | null;
  median_value: number | null;
  minimum_value: number | null;
  maximum_value: number | null;
  valid_pixel_count: number | null;
  total_pixel_count: number | null;
  coverage_percentage: number | null;
  unit: string;
  quality_status: string;
  processing_metadata: Record<string, unknown> | null;
  ingested_at: string;
  is_demo: boolean;
  source_key: string;
  source_name: string;
  product_id: string;
  native_temporal_resolution: string;
  native_spatial_resolution_m: number | null;
  boundary_version: string;
};

export type DistrictObservationResponse = {
  district_id: string;
  count: number;
  items: DistrictObservation[];
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export async function getBeedRainfall(signal?: AbortSignal): Promise<DistrictObservationResponse> {
  const query = new URLSearchParams({
    variable: "rainfall",
    start: "2024-06-01T00:00:00Z",
    end: "2024-06-04T00:00:00Z",
  });
  const response = await fetch(`${apiBase}/satellite/district/beed?${query.toString()}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Observation API returned ${response.status}`);
  }
  return (await response.json()) as DistrictObservationResponse;
}
