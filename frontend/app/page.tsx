import { ExecutiveDashboard } from "@/components/executive-dashboard";
import { getBeedRainfall, getDistrictBoundaries, getDistricts } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [districtResponse, boundaries, observations] = await Promise.all([
    getDistricts(),
    getDistrictBoundaries(),
    getBeedRainfall(),
  ]);
  return (
    <ExecutiveDashboard
      districts={districtResponse.items}
      boundaries={boundaries}
      initialObservations={observations}
    />
  );
}
