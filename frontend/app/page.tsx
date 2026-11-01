import { DistrictRainfallScreen } from "@/components/district-rainfall-screen";
import { getBeedRainfall } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialData = null;
  let initialError: string | null = null;
  try {
    initialData = await getBeedRainfall();
  } catch (reason: unknown) {
    initialError = reason instanceof Error ? reason.message : "Unknown API error";
  }
  return <DistrictRainfallScreen initialData={initialData} initialError={initialError} />;
}
