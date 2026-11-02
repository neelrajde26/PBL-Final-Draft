from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_auth_workflow() -> None:
    # Register farmer
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "farmer1@example.com",
            "password": "Password1234!",
            "full_name": "Ramesh Patil",
            "district_id": "beed",
            "taluka": "Ashti",
        },
    )
    assert reg.status_code == 201
    reg_data = reg.json()
    assert reg_data["user"]["role"] == "farmer"
    token = reg_data["access_token"]

    # Verify session with /me
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["user"]["email"] == "farmer1@example.com"

    # Login admin
    login_admin = client.post(
        "/api/auth/login",
        json={
            "email": "admin@mdis.gov.in",
            "password": "AdminSecurePass123!",
        },
    )
    assert login_admin.status_code == 200
    admin_token = login_admin.json()["access_token"]

    # Check RBAC: farmer cannot access admin endpoints
    forbidden = client.get("/api/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert forbidden.status_code == 403

    # Admin CAN access admin endpoints
    allowed = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert allowed.status_code == 200
    assert allowed.json()["count"] >= 2


def test_maps_and_layers_endpoints() -> None:
    layers = client.get("/api/maps/layers")
    assert layers.status_code == 200
    assert layers.json()["count"] == 18

    legend = client.get("/api/maps/legend?layer=spi_3")
    assert legend.status_code == 200
    assert legend.json()["layer_id"] == "spi_3"

    indicators = client.get("/api/maps/district-indicators?indicator=rainfall")
    assert indicators.status_code == 200
    data = indicators.json()
    assert data["type"] == "FeatureCollection"
    assert data["count"] == 36


def test_drought_and_historical_endpoints() -> None:
    indices = client.get("/api/drought/indices")
    assert indices.status_code == 200

    beed_drought = client.get("/api/drought/district/beed")
    assert beed_drought.status_code == 200
    assert beed_drought.json()["district_id"] == "beed"

    events = client.get("/api/drought/events")
    assert events.status_code == 200

    hist = client.get("/api/historical/series?district_id=beed&variable=rainfall")
    assert hist.status_code == 200

    comp = client.get("/api/historical/compare?primary_district=beed&secondary_district=jalna")
    assert comp.status_code == 200


def test_ml_and_predictions_endpoints() -> None:
    models = client.get("/api/models")
    assert models.status_code == 200
    assert models.json()["count"] >= 3

    metrics = client.get("/api/models/metrics?model_key=mdis-meteorological-xgboost")
    assert metrics.status_code == 200
    assert "metrics" in metrics.json()

    importance = client.get("/api/models/importance?model_key=mdis-meteorological-xgboost")
    assert importance.status_code == 200
    assert len(importance.json()["features"]) > 0

    preds_30d = client.get("/api/predictions?horizon=30d")
    assert preds_30d.status_code == 200

    outlook = client.get("/api/predictions/beed")
    assert outlook.status_code == 200
    assert outlook.json()["district_id"] == "beed"


def test_farmer_advisory_and_alerts() -> None:
    advisory_mr = client.get("/api/farmer/advisory?district_id=beed&language=mr")
    assert advisory_mr.status_code == 200
    assert advisory_mr.json()["language"] == "mr"
    assert len(advisory_mr.json()["advisory_text"]) > 10

    alerts = client.get("/api/alerts?language=en")
    assert alerts.status_code == 200
    assert alerts.json()["count"] >= 1

