"""Build SVG path data for the Maharashtra outline and districts from the canonical GeoJSON."""
import json
from pathlib import Path

import geopandas as gpd

ROOT = Path(__file__).resolve().parents[1]
gdf = gpd.read_file(ROOT / "backend/data/boundaries/maharashtra_36_districts.geojson").to_crs(32643)
state = gdf.union_all().simplify(1500)
districts = gdf.copy(); districts["geometry"] = districts.simplify(900)
minx, miny, maxx, maxy = state.bounds
W = 1000; s = W / (maxx - minx); H = round((maxy - miny) * s)

def path(geom):
    polys = getattr(geom, "geoms", [geom])
    out = []
    for p in polys:
        if p.area < 2e7: continue
        pts = [f"{(x-minx)*s:.1f},{(maxy-y)*s:.1f}" for x, y in p.exterior.coords]
        out.append("M" + "L".join(pts) + "Z")
    return "".join(out)

idcol = next(c for c in ("district_id", "id", "slug") if c in gdf.columns)
data = {"viewBox": f"0 0 {W} {H}", "state": path(state),
        "districts": [{"id": r[idcol], "name": r["district_name"], "d": path(r.geometry)} for _, r in districts.iterrows()]}
out = ROOT / "frontend/lib/maharashtra-shape.json"
out.write_text(json.dumps(data))
print(W, H, len(data["state"]), len(data["districts"]), out.stat().st_size)
