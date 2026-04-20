"""Tests for the DST StatBank client: retry, backoff, and error handling."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import httpx
import pytest

from danish_economy.etl.ingest.dst.client import (
    DSTClient,
    DSTClientError,
    TableMetadata,
)

FIXTURES = Path(__file__).parent / "fixtures" / "dst"


def _make_response(
    status_code: int = 200,
    json_data: dict | None = None,
    text: str = "",
) -> httpx.Response:
    """Create a mock httpx.Response."""
    if json_data is not None:
        content = json.dumps(json_data).encode()
        headers = {"content-type": "application/json"}
    else:
        content = text.encode()
        headers = {"content-type": "text/plain"}
    return httpx.Response(
        status_code=status_code,
        content=content,
        headers=headers,
        request=httpx.Request("POST", "https://example.com"),
    )


class TestGetMetadata:
    def test_parses_metadata_correctly(self) -> None:
        with open(FIXTURES / "OFF3_metadata.json") as f:
            fixture = json.load(f)

        mock_resp = _make_response(json_data=fixture)
        client = DSTClient()
        with patch.object(client._client, "post", return_value=mock_resp):
            meta = client.get_metadata("OFF3")

        assert isinstance(meta, TableMetadata)
        assert meta.table_id == "OFF3"
        assert len(meta.variables) == 3
        assert meta.variables[0].id == "UI"
        assert meta.variables[1].elimination is True

    def test_total_cells_calculated(self) -> None:
        with open(FIXTURES / "OFF3_metadata.json") as f:
            fixture = json.load(f)

        mock_resp = _make_response(json_data=fixture)
        client = DSTClient()
        with patch.object(client._client, "post", return_value=mock_resp):
            meta = client.get_metadata("OFF3")

        # 3 UI * 3 SEKTOR * 5 Tid = 45
        assert meta.total_cells == 45


class TestRetryBehavior:
    @patch("danish_economy.etl.ingest.dst.client.time.sleep")
    def test_retries_on_500(self, mock_sleep: object) -> None:
        """Client retries on 500 and succeeds on second attempt."""
        fail_resp = _make_response(status_code=500, text="Internal Server Error")
        ok_resp = _make_response(json_data={"variables": []})

        client = DSTClient()
        with patch.object(
            client._client, "post", side_effect=[fail_resp, ok_resp]
        ):
            result = client.get_metadata("OFF3")

        assert result.table_id == "OFF3"

    @patch("danish_economy.etl.ingest.dst.client.time.sleep")
    def test_retries_on_429(self, mock_sleep: object) -> None:
        """Client retries on 429 rate limit."""
        fail_resp = _make_response(status_code=429, text="Too Many Requests")
        ok_resp = _make_response(json_data={"variables": []})

        client = DSTClient()
        with patch.object(
            client._client, "post", side_effect=[fail_resp, ok_resp]
        ):
            result = client.get_metadata("OFF3")

        assert result.table_id == "OFF3"

    @patch("danish_economy.etl.ingest.dst.client.time.sleep")
    def test_raises_after_max_retries(self, mock_sleep: object) -> None:
        """Client raises after exhausting retries."""
        fail_resp = _make_response(status_code=500, text="Error")

        client = DSTClient()
        with patch.object(
            client._client, "post", return_value=fail_resp
        ):
            with pytest.raises(DSTClientError, match="Failed after 3 attempts"):
                client.get_metadata("OFF3")

    def test_raises_immediately_on_400(self) -> None:
        """Client does not retry on 4xx (except 429)."""
        fail_resp = _make_response(status_code=400, text="Bad Request")

        client = DSTClient()
        with patch.object(client._client, "post", return_value=fail_resp):
            with pytest.raises(DSTClientError, match="HTTP 400"):
                client.get_metadata("OFF3")

    @patch("danish_economy.etl.ingest.dst.client.time.sleep")
    def test_retries_on_transport_error(self, mock_sleep: object) -> None:
        """Client retries on network transport errors."""
        ok_resp = _make_response(json_data={"variables": []})

        client = DSTClient()
        with patch.object(
            client._client,
            "post",
            side_effect=[httpx.ConnectError("Connection refused"), ok_resp],
        ):
            result = client.get_metadata("OFF3")

        assert result.table_id == "OFF3"


class TestGetData:
    def test_get_data_returns_text(self) -> None:
        csv_text = "UI;SEKTOR;TID;INDHOLD\n1;TOTAL;2020;1184539\n"
        mock_resp = _make_response(text=csv_text)

        client = DSTClient()
        with patch.object(client._client, "post", return_value=mock_resp):
            result = client.get_data("OFF3")

        assert "UI;SEKTOR;TID;INDHOLD" in result

    def test_build_variable_codes(self) -> None:
        client = DSTClient()
        codes = client._build_variable_codes({"UI": ["*"], "Tid": ["2020", "2021"]})
        assert len(codes) == 2
        assert codes[0] == {"code": "UI", "values": ["*"]}
        assert codes[1] == {"code": "Tid", "values": ["2020", "2021"]}

    def test_build_variable_codes_none(self) -> None:
        client = DSTClient()
        codes = client._build_variable_codes(None)
        assert codes == []
