"""Ingest Finanslov overview data from PDF when CSV files are unavailable.

For years where oes-cs.dk only publishes PDF files (FL25+), this module
downloads the Hovedoversigt PDF and extracts paragraph-level budget totals.

Output: same bronze directory structure, but as a parsed JSON file instead
of raw CSV.
"""

from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path

import httpx
import pypdf

DATA_DIR = Path(__file__).resolve().parents[5] / "data"
BASE_URL = "https://www.oes-cs.dk/bevillingslove"
TIMEOUT = 30.0

# Paragraf names from FL26 Hovedoversigt (these are stable across years)
PARAGRAF_NAMES: dict[str, str] = {
    "01": "Kongen",
    "02": "Medlemmer af det kongelige hus m.fl.",
    "03": "Folketinget",
    "05": "Statsministeriet",
    "06": "Udenrigsministeriet",
    "07": "Finansministeriet",
    "08": "Erhvervsministeriet",
    "09": "Skatteministeriet",
    "10": "Økonomiministeriet",
    "11": "Justitsministeriet",
    "12": "Forsvarsministeriet",
    "13": "Ministeriet for Samfundssikkerhed og Beredskab",
    "14": "Udlændinge- og Integrationsministeriet",
    "15": "Social- og Boligministeriet",
    "16": "Indenrigs- og Sundhedsministeriet",
    "17": "Beskæftigelsesministeriet",
    "18": "Ældreministeriet",
    "19": "Uddannelses- og Forskningsministeriet",
    "20": "Børne- og Undervisningsministeriet",
    "21": "Kulturministeriet",
    "22": "Kirkeministeriet",
    "23": "Miljøministeriet",
    "24": "Ministeriet for Fødevarer, Landbrug og Fiskeri",
    "25": "Digitaliseringsministeriet",
    "27": "Ministeriet for Grøn Trepart",
    "28": "Transportministeriet",
    "29": "Klima-, Energi- og Forsyningsministeriet",
    "35": "Generelle reserver",
    "36": "Pensionsvæsenet",
    "37": "Renter",
    "38": "Skatter og afgifter",
    "39": "Lovbundne overførsler mv.",
    "40": "Genudlån mv.",
    "41": "Beholdningsbevægelser mv.",
    "42": "Afdrag på statsgælden (netto)",
    "45": "Bevillingsparagraffen",
}


def _parse_danish_number(s: str) -> float:
    """Parse a Danish-formatted number: '1.234,5' → 1234.5."""
    s = s.strip()
    negative = s.startswith("-")
    if negative:
        s = s[1:]
    # Remove thousands separators (dots), convert decimal comma
    s = s.replace(".", "").replace(",", ".")
    val = float(s)
    return -val if negative else val


def _parse_overview_page(text: str) -> list[dict]:
    """Parse the Hovedoversigt page text into paragraph rows.

    The overview has 4 columns:
      1. Udgifter under delloft for driftsudgifter
      2. Udgifter under delloft for indkomstoverførsler
      3. Udgifter uden for udgiftslofter
      4. Indtægter

    Each §-line has the paragraf number and 1-4 numbers.
    """
    rows = []
    seen: set[str] = set()
    # Match lines like: § 6. 21.424,5 4,0
    # Use [ \t]+ instead of \s+ to avoid matching across newlines
    pattern = re.compile(
        r"§[ \t]*(\d+)\.[ \t]+"
        r"(-?[\d.,]+)"
        r"(?:[ \t]+(-?[\d.,]+))?"
        r"(?:[ \t]+(-?[\d.,]+))?"
        r"(?:[ \t]+(-?[\d.,]+))?"
    )

    for match in pattern.finditer(text):
        par_nr = match.group(1).zfill(2)

        # Only take the first occurrence (the Hovedoversigt row).
        # Later tables in the PDF repeat § numbers with different columns.
        if par_nr in seen:
            continue
        seen.add(par_nr)

        values = []
        for i in range(2, 6):
            g = match.group(i)
            values.append(_parse_danish_number(g) if g else 0.0)

        # Count how many values were captured
        num_values = sum(1 for v in values if v != 0.0)

        # Column assignment depends on the paragraf.
        # The Hovedoversigt has 4 columns:
        #   1. Drift  2. Indkomstoverførsler  3. Uden loft  4. Indtægter
        #
        # §38 (taxes) has 3 values: drift, indkomst_overf, indtaegt
        #   (column 3 is empty — the 3rd captured value is column 4)
        # §37 (interest) has 2 values: udgift, indtaegt (columns vary)
        # §40-42 (financing) have 1 value
        if par_nr == "38":
            drift = values[0]
            indkomst = values[1]
            uden_loft = 0.0
            indtaegt = values[2]  # 3rd value is income, not "uden loft"
        elif par_nr == "37":
            # Interest: first value is expense, second is income
            drift = 0.0
            indkomst = 0.0
            uden_loft = values[0]
            indtaegt = values[1]
        else:
            drift = values[0]
            indkomst = values[1]
            uden_loft = values[2]
            indtaegt = values[3]

        total_udgift = drift + indkomst + uden_loft

        # Finanslov value: the headline figure for this paragraph
        if par_nr == "38":
            # Tax paragraph: income is the dominant figure
            finanslov = indtaegt + drift + indkomst
        elif par_nr in ("37", "40", "41", "42"):
            # Financing items
            finanslov = total_udgift + indtaegt
        else:
            finanslov = total_udgift

        rows.append(
            {
                "paragraf_nr": par_nr,
                "finanslov": finanslov,
                "drift": drift,
                "indkomst_overfoersler": indkomst,
                "uden_loft": uden_loft,
                "indtaegt": indtaegt,
            }
        )

    return rows


def ingest_finanslov_pdf(
    fiscal_year: int,
    *,
    data_dir: Path | None = None,
    pdf_path: Path | None = None,
) -> Path:
    """Download and parse Finanslov overview PDF for a fiscal year.

    Writes parsed data as JSON to bronze directory.
    """
    base = data_dir or DATA_DIR
    yy = str(fiscal_year)[-2:]
    run_date = datetime.now(UTC).strftime("%Y-%m-%d")
    run_dir = base / "bronze" / "finanslov" / f"FL{yy}" / f"run_date={run_date}"
    run_dir.mkdir(parents=True, exist_ok=True)

    # Download or use provided PDF
    if pdf_path and pdf_path.exists():
        pdf_bytes = pdf_path.read_bytes()
    else:
        url = f"{BASE_URL}/fl{yy}a00.pdf"
        with httpx.Client(timeout=TIMEOUT) as client:
            resp = client.get(url)
            resp.raise_for_status()
            pdf_bytes = resp.content

    # Save raw PDF
    pdf_file = run_dir / "hovedoversigt.pdf"
    pdf_file.write_bytes(pdf_bytes)

    # Parse PDF text
    import io

    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"

    # Extract paragraph data
    rows = _parse_overview_page(full_text)

    # Save parsed data
    parsed = {
        "fiscal_year": fiscal_year,
        "source": "pdf_overview",
        "paragraphs": rows,
    }
    out_path = run_dir / "overview_parsed.json"
    out_path.write_text(json.dumps(parsed, indent=2, ensure_ascii=False))
    print(f"Parsed FL{yy} overview: {len(rows)} paragraphs → {out_path}")

    return run_dir


if __name__ == "__main__":
    for year in (2025, 2026):
        try:
            ingest_finanslov_pdf(year)
        except httpx.HTTPStatusError as e:
            print(f"Skipping FL{year}: {e}")
