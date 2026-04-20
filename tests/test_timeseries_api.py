"""Tests for the /timeseries API endpoint.

These tests run against the real gold Parquet files, so they require
a built warehouse (data/gold/*.parquet).
"""

from fastapi.testclient import TestClient

from danish_economy.api.main import app

client = TestClient(app)


class TestTimeseriesHappyPath:
    def test_returns_200(self) -> None:
        resp = client.get(
            "/timeseries",
            params={"metric": "public_balance", "entity": "STAT"},
        )
        assert resp.status_code == 200

    def test_response_shape(self) -> None:
        resp = client.get(
            "/timeseries",
            params={"metric": "public_balance", "entity": "STAT"},
        )
        data = resp.json()
        assert data["metric"] == "public_balance"
        assert data["entity"] == "STAT"
        assert isinstance(data["points"], list)
        assert len(data["points"]) > 0

    def test_points_have_expected_fields(self) -> None:
        resp = client.get(
            "/timeseries",
            params={"metric": "public_balance", "entity": "STAT"},
        )
        point = resp.json()["points"][0]
        assert "date" in point
        assert "value" in point
        assert "unit" in point

    def test_date_range_filter(self) -> None:
        resp = client.get(
            "/timeseries",
            params={
                "metric": "public_balance",
                "entity": "STAT",
                "from": "2020-01-01",
                "to": "2022-01-01",
            },
        )
        data = resp.json()
        dates = [p["date"] for p in data["points"]]
        assert all("2020-01-01" <= d <= "2022-01-01" for d in dates)

    def test_all_12_metrics_queryable(self) -> None:
        metrics = [
            "public_total_expenditure",
            "public_operating_expenditure",
            "public_employee_compensation",
            "public_consumption",
            "public_social_benefits",
            "public_subsidies",
            "public_total_revenue",
            "public_operating_revenue",
            "public_tax_production",
            "public_tax_income",
            "public_balance",
            "public_interest",
        ]
        for m in metrics:
            resp = client.get(
                "/timeseries", params={"metric": m, "entity": "STAT"}
            )
            assert resp.status_code == 200, f"Failed for metric {m}"
            assert len(resp.json()["points"]) > 0, f"No data for metric {m}"


class TestTimeseriesErrors:
    def test_unknown_metric_returns_404(self) -> None:
        resp = client.get(
            "/timeseries",
            params={"metric": "nonexistent_metric", "entity": "STAT"},
        )
        assert resp.status_code == 404

    def test_unknown_entity_returns_404(self) -> None:
        resp = client.get(
            "/timeseries",
            params={"metric": "public_balance", "entity": "NOPE"},
        )
        assert resp.status_code == 404

    def test_missing_metric_returns_422(self) -> None:
        resp = client.get("/timeseries", params={"entity": "STAT"})
        assert resp.status_code == 422
