from __future__ import annotations

from dataclasses import asdict, dataclass
from enum import StrEnum


class TemporalResolution(StrEnum):
    THREE_HOURLY = "3-hourly"
    DAILY = "daily"
    FIVE_DAY_REVISIT = "5-day revisit"
    SIX_DAY_REVISIT = "6-day revisit"
    EIGHT_DAY = "8-day composite"
    SIXTEEN_DAY = "16-day composite"
    MONTHLY = "monthly"


@dataclass(frozen=True, slots=True)
class BandSpec:
    source_band: str
    output_band: str
    unit: str
    scale: float = 1.0
    offset: float = 0.0
    aggregation: str = "mean"


@dataclass(frozen=True, slots=True)
class CollectionSpec:
    key: str
    collection_id: str
    title: str
    temporal_resolution: TemporalResolution
    native_scale_m: int
    start_date: str
    bands: tuple[BandSpec, ...]
    quality_band: str | None = None
    notes: str = ""

    def public_metadata(self) -> dict[str, object]:
        value = asdict(self)
        value["temporal_resolution"] = self.temporal_resolution.value
        return value


# Metadata was checked against the official Earth Engine catalog on 2026-11-01.
# End dates are intentionally not hard-coded because operational collections
# advance. The application reads last acquisition time from the collection.
COLLECTIONS: dict[str, CollectionSpec] = {
    "chirps_daily": CollectionSpec(
        key="chirps_daily",
        collection_id="UCSB-CHG/CHIRPS/DAILY",
        title="CHIRPS Daily v2 Final",
        temporal_resolution=TemporalResolution.DAILY,
        native_scale_m=5566,
        start_date="1981-01-01",
        bands=(BandSpec("precipitation", "rainfall", "mm/day", aggregation="sum"),),
        notes="The catalog asset is CHIRPS v2 Final, not CHIRPS v3.",
    ),
    "modis_vi": CollectionSpec(
        key="modis_vi",
        collection_id="MODIS/061/MOD13Q1",
        title="MOD13Q1.061 Terra Vegetation Indices",
        temporal_resolution=TemporalResolution.SIXTEEN_DAY,
        native_scale_m=250,
        start_date="2000-02-18",
        bands=(
            BandSpec("NDVI", "ndvi", "index", scale=0.0001),
            BandSpec("EVI", "evi", "index", scale=0.0001),
        ),
        quality_band="SummaryQA",
    ),
    "modis_lst": CollectionSpec(
        key="modis_lst",
        collection_id="MODIS/061/MOD11A2",
        title="MOD11A2.061 Terra LST",
        temporal_resolution=TemporalResolution.EIGHT_DAY,
        native_scale_m=1000,
        start_date="2000-02-18",
        bands=(
            BandSpec("LST_Day_1km", "lst_day", "degC", scale=0.02, offset=-273.15),
            BandSpec("LST_Night_1km", "lst_night", "degC", scale=0.02, offset=-273.15),
        ),
        quality_band="QC_Day/QC_Night",
    ),
    "modis_et": CollectionSpec(
        key="modis_et",
        collection_id="MODIS/061/MOD16A2",
        title="MOD16A2.061 Terra ET",
        temporal_resolution=TemporalResolution.EIGHT_DAY,
        native_scale_m=500,
        start_date="2021-01-01",
        bands=(BandSpec("ET", "et", "kg/m2/composite", scale=0.1, aggregation="sum"),),
        quality_band="ET_QC",
        notes="Use MOD16A2GF for historical gap-filled ET; use this near real time.",
    ),
    "modis_et_gap_filled": CollectionSpec(
        key="modis_et_gap_filled",
        collection_id="MODIS/061/MOD16A2GF",
        title="MOD16A2GF.061 Terra ET Gap-Filled",
        temporal_resolution=TemporalResolution.EIGHT_DAY,
        native_scale_m=500,
        start_date="2000-01-01",
        bands=(BandSpec("ET", "et", "kg/m2/composite", scale=0.1, aggregation="sum"),),
        quality_band="ET_QC",
        notes="Year-end product; not appropriate as a current-year live feed.",
    ),
    "gldas_noah": CollectionSpec(
        key="gldas_noah",
        collection_id="NASA/GLDAS/V021/NOAH/G025/T3H",
        title="GLDAS-2.1 Noah 0.25 degree",
        temporal_resolution=TemporalResolution.THREE_HOURLY,
        native_scale_m=27830,
        start_date="2000-01-01",
        bands=(
            BandSpec("SoilMoi0_10cm_inst", "soil_moisture_0_10cm", "kg/m2"),
            BandSpec("SoilMoi10_40cm_inst", "soil_moisture_10_40cm", "kg/m2"),
            BandSpec("SoilMoi40_100cm_inst", "soil_moisture_40_100cm", "kg/m2"),
            BandSpec("SoilMoi100_200cm_inst", "soil_moisture_100_200cm", "kg/m2"),
            BandSpec("RootMoist_inst", "root_zone_moisture", "kg/m2"),
            BandSpec("Qs_acc", "surface_runoff", "kg/m2/3h", aggregation="sum"),
            BandSpec("Evap_tavg", "evapotranspiration_rate", "kg/m2/s"),
        ),
    ),
    "era5_land_daily": CollectionSpec(
        key="era5_land_daily",
        collection_id="ECMWF/ERA5_LAND/DAILY_AGGR",
        title="ERA5-Land Daily Aggregated",
        temporal_resolution=TemporalResolution.DAILY,
        native_scale_m=11132,
        start_date="1950-01-02",
        bands=(
            BandSpec("total_precipitation_sum", "precipitation", "m/day", aggregation="sum"),
            BandSpec("temperature_2m", "temperature_2m", "K"),
            BandSpec("total_evaporation_sum", "evaporation", "m/day", aggregation="sum"),
            BandSpec("volumetric_soil_water_layer_1", "soil_water_layer_1", "m3/m3"),
            BandSpec("volumetric_soil_water_layer_2", "soil_water_layer_2", "m3/m3"),
        ),
        notes="Flow bands may contain small negative packing artifacts; QC must flag them.",
    ),
    "smap_l3": CollectionSpec(
        key="smap_l3",
        collection_id="NASA/SMAP/SPL3SMP_E/006",
        title="SMAP L3 Enhanced Radiometer Soil Moisture v006",
        temporal_resolution=TemporalResolution.DAILY,
        native_scale_m=9000,
        start_date="2023-12-04",
        bands=(
            BandSpec("soil_moisture_am", "soil_moisture_am", "m3/m3"),
            BandSpec("soil_moisture_pm", "soil_moisture_pm", "m3/m3"),
        ),
        quality_band="retrieval_qual_flag_am/retrieval_qual_flag_pm",
        notes="Mission sampling is typically every 2-3 days despite daily composite assets.",
    ),
    "sentinel2_sr": CollectionSpec(
        key="sentinel2_sr",
        collection_id="COPERNICUS/S2_SR_HARMONIZED",
        title="Sentinel-2 Level-2A Surface Reflectance Harmonized",
        temporal_resolution=TemporalResolution.FIVE_DAY_REVISIT,
        native_scale_m=10,
        start_date="2017-03-28",
        bands=(
            BandSpec("B2", "blue", "reflectance", scale=0.0001),
            BandSpec("B3", "green", "reflectance", scale=0.0001),
            BandSpec("B4", "red", "reflectance", scale=0.0001),
            BandSpec("B8", "nir", "reflectance", scale=0.0001),
        ),
        quality_band="SCL",
        notes="SCL masking is used because QA60 availability changed over time.",
    ),
    "sentinel1_grd": CollectionSpec(
        key="sentinel1_grd",
        collection_id="COPERNICUS/S1_GRD",
        title="Sentinel-1 C-band SAR GRD",
        temporal_resolution=TemporalResolution.SIX_DAY_REVISIT,
        native_scale_m=10,
        start_date="2014-10-03",
        bands=(
            BandSpec("VV", "vv", "dB"),
            BandSpec("VH", "vh", "dB"),
            BandSpec("angle", "incidence_angle", "degrees"),
        ),
        notes="Backscatter is a moisture/land-condition proxy, not direct soil moisture.",
    ),
    "grace_mascon_cri": CollectionSpec(
        key="grace_mascon_cri",
        collection_id="NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI",
        title="JPL GRACE/GRACE-FO Mascon CRI RL06.3Mv04",
        temporal_resolution=TemporalResolution.MONTHLY,
        native_scale_m=55660,
        start_date="2002-03-31",
        bands=(
            BandSpec("lwe_thickness", "terrestrial_water_storage_anomaly", "cm"),
            BandSpec("uncertainty", "uncertainty", "cm"),
        ),
        notes=(
            "Underlying mascons are about 3 degrees; the 0.5-degree grid does not provide "
            "independent district-scale groundwater measurements."
        ),
    ),
}


def get_collection_spec(key: str) -> CollectionSpec:
    try:
        return COLLECTIONS[key]
    except KeyError as exc:
        raise KeyError(f"Unsupported Earth Engine collection key: {key}") from exc

