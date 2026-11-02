# Data Sources and Collection Registry

Registry metadata was checked against the official Google Earth Engine catalog on 2026-11-01. Operational end dates are read from collections at runtime rather than frozen in code.

| Key | Earth Engine product | Native cadence | Nominal scale | Important handling |
|---|---|---|---:|---|
| `chirps_daily` | `UCSB-CHG/CHIRPS/DAILY` | Daily | 5,566 m | The catalog product is CHIRPS v2 Final. Accumulate rainfall by summing native daily values. |
| `modis_vi` | `MODIS/061/MOD13Q1` | 16-day composite | 250 m | Scale NDVI/EVI by 0.0001 and mask poor `SummaryQA`. Never create interpolated daily vegetation observations. |
| `modis_lst` | `MODIS/061/MOD11A2` | 8-day composite | 1,000 m | Scale by 0.02 K and convert to Celsius; apply day/night QC. |
| `modis_et` | `MODIS/061/MOD16A2` | 8-day composite | 500 m | ET is an 8-day sum scaled by 0.1. Current product starts in 2021. |
| `modis_et_gap_filled` | `MODIS/061/MOD16A2GF` | 8-day composite | 500 m | Historical year-end gap-filled product; not a current-year live substitute. |
| `gldas_noah` | `NASA/GLDAS/V021/NOAH/G025/T3H` | 3-hourly | 27,830 m | Preserve layer-specific soil moisture units and distinguish instantaneous, averaged and accumulated bands. |
| `era5_land_daily` | `ECMWF/ERA5_LAND/DAILY_AGGR` | Daily aggregate | 11,132 m | Treat flow and non-flow bands differently; flag negative/implausible packed flow values. |
| `smap_l3` | `NASA/SMAP/SPL3SMP_E/006` | Daily composite | 9,000 m | Apply AM/PM retrieval-quality flags and report valid-observation coverage. Mission sampling is generally every 2-3 days. |
| `sentinel2_sr` | `COPERNICUS/S2_SR_HARMONIZED` | 5-day revisit | 10-20 m | Scale reflectance by 0.0001. Use SCL/cloud-probability masking; QA60 behavior changed over time. |
| `sentinel1_grd` | `COPERNICUS/S1_GRD` | About 6-day revisit | 10 m after filtering | Filter to homogeneous IW, 10 m, VV+VH scenes. Backscatter is a proxy affected by vegetation, roughness and incidence angle. |
| `grace_mascon_cri` | `NASA/GRACE/MASS_GRIDS_V04/MASCON_CRI` | Monthly | Published grid 55,660 m | Underlying estimates are roughly 3-degree mascons. Treat as terrestrial water storage anomaly, not district groundwater. |

Official catalog references:

- https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY
- https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1
- https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A2
- https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2
- https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD16A2GF
- https://developers.google.com/earth-engine/datasets/catalog/NASA_GLDAS_V021_NOAH_G025_T3H
- https://developers.google.com/earth-engine/datasets/catalog/ECMWF_ERA5_LAND_DAILY_AGGR
- https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL3SMP_E_006
- https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED
- https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD
- https://developers.google.com/earth-engine/datasets/catalog/NASA_GRACE_MASS_GRIDS_V04_MASCON_CRI

## Source priority versus availability

IMD rainfall, Maharashtra groundwater/reservoir information, official crop statistics and India Drought Monitor products require separate access/licensing and provenance review. They are priorities, but they are not represented as available until an adapter and source agreement are verified.

The supplied repository spreadsheets are staging candidates only. Canonical ingestion must attach a raw-file checksum, origin URL or custodian, retrieval date, column mapping, units, geographic boundary/version and quality report. Files lacking those facts remain `provenance_unverified` and cannot be presented as official live observations.

