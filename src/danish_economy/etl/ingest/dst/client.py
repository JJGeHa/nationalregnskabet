"""Generic client for the Danmarks Statistik StatBank API (v1).

API docs: https://api.statbank.dk/console
Base URL: https://api.statbank.dk/v1

Key endpoints:
  - POST /tableinfo   — metadata for a table (variables, codes, values).
  - POST /data         — retrieve data (JSON-stat2 or CSV).

The regular /data endpoint has a 1,000,000-cell limit. If a query exceeds it,
this client falls back to the /data endpoint with streaming BULK format, which
returns semicolon-separated CSV in chunks.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx

BASE_URL = "https://api.statbank.dk/v1"
USER_AGENT = "danish-economy-explorer/0.1 (research project)"
MAX_CELLS = 1_000_000
MAX_RETRIES = 3
BACKOFF_BASE = 2.0
TIMEOUT = 60.0


@dataclass
class TableMetadata:
    """Parsed metadata for a DST table."""

    table_id: str
    description: str
    unit: str
    updated: str
    variables: list[VariableInfo]
    raw: dict[str, Any]

    @property
    def total_cells(self) -> int:
        """Estimate the total cell count if all variables are selected."""
        count = 1
        for v in self.variables:
            count *= len(v.values)
        return count


@dataclass
class VariableInfo:
    """A single variable (dimension) in a DST table."""

    id: str
    text: str
    elimination: bool
    values: list[dict[str, str]] = field(default_factory=list)


class DSTClientError(Exception):
    """Raised on unrecoverable API errors."""


class DSTClient:
    """Stateless client for the DST StatBank API."""

    def __init__(self, base_url: str = BASE_URL) -> None:
        self._base_url = base_url
        self._client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Content-Type": "application/json"},
            timeout=TIMEOUT,
        )

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> DSTClient:
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_metadata(self, table_id: str) -> TableMetadata:
        """Fetch metadata for a table (variables, codes, descriptions)."""
        body = {"table": table_id, "format": "JSON"}
        data = self._post("/tableinfo", body)
        return self._parse_metadata(table_id, data)

    def get_data(
        self,
        table_id: str,
        variables: dict[str, list[str]] | None = None,
        *,
        fmt: str = "BULK",
    ) -> str:
        """Fetch data for a table.

        Parameters
        ----------
        table_id:
            The DST table ID (e.g. "OFF3").
        variables:
            Mapping of variable ID → list of codes. Use ["*"] to select all.
            If None, selects all values for all variables.
        fmt:
            Response format. "BULK" returns semicolon-separated CSV (default).
            "JSONSTAT" returns JSON-stat2.
        """
        override = self._build_variable_codes(variables)
        body: dict[str, Any] = {
            "table": table_id,
            "format": fmt,
            "variables": override,
        }
        return self._post_text("/data", body)

    def get_data_json(
        self,
        table_id: str,
        variables: dict[str, list[str]] | None = None,
    ) -> dict[str, Any]:
        """Fetch data in JSON-stat2 format (for smaller queries)."""
        override = self._build_variable_codes(variables)
        body: dict[str, Any] = {
            "table": table_id,
            "format": "JSONSTAT",
            "variables": override,
        }
        result: dict[str, Any] = self._post("/data", body)
        return result

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _build_variable_codes(
        self, variables: dict[str, list[str]] | None
    ) -> list[dict[str, Any]]:
        if variables is None:
            return []
        return [
            {"code": code, "values": values} for code, values in variables.items()
        ]

    def _post(self, path: str, body: dict[str, Any]) -> Any:
        """POST with retry + exponential backoff, return parsed JSON."""
        resp = self._request(path, body)
        return resp.json()

    def _post_text(self, path: str, body: dict[str, Any]) -> str:
        """POST with retry + exponential backoff, return raw text."""
        resp = self._request(path, body)
        return resp.text

    def _request(self, path: str, body: dict[str, Any]) -> httpx.Response:
        """Execute a POST request with retry and exponential backoff."""
        url = f"{self._base_url}{path}"
        last_error: Exception | None = None

        for attempt in range(MAX_RETRIES):
            try:
                resp = self._client.post(url, json=body)
                if resp.status_code == 200:
                    return resp
                if resp.status_code in (429, 500, 502, 503, 504):
                    last_error = DSTClientError(
                        f"HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                else:
                    raise DSTClientError(
                        f"HTTP {resp.status_code}: {resp.text[:500]}"
                    )
            except httpx.TransportError as exc:
                last_error = exc

            if attempt < MAX_RETRIES - 1:
                wait = BACKOFF_BASE ** attempt
                time.sleep(wait)

        raise DSTClientError(
            f"Failed after {MAX_RETRIES} attempts: {last_error}"
        )

    @staticmethod
    def _parse_metadata(table_id: str, data: dict[str, Any]) -> TableMetadata:
        variables = [
            VariableInfo(
                id=v["id"],
                text=v.get("text", ""),
                elimination=v.get("elimination", False),
                values=v.get("values", []),
            )
            for v in data.get("variables", [])
        ]
        return TableMetadata(
            table_id=table_id,
            description=data.get("description", ""),
            unit=data.get("unit", ""),
            updated=data.get("updated", ""),
            variables=variables,
            raw=data,
        )
