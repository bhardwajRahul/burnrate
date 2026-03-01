"""Bank detector for credit card statement PDFs."""

import os
import re
from typing import Optional

import pdfplumber


def detect_bank(pdf_path: str) -> Optional[str]:
    """
    Detect which bank a statement PDF belongs to.
    Returns one of: 'hdfc', 'icici', 'axis', 'sbi', 'amex', 'idfc_first',
    'indusind', 'kotak', 'sc', 'yes', 'au', 'rbl', or None.
    """
    # Check filename for bank name patterns (case-insensitive)
    filename = os.path.basename(pdf_path).lower()
    if "hdfc" in filename:
        return "hdfc"
    if "icici" in filename:
        return "icici"
    if "axis" in filename:
        return "axis"
    if "sbi" in filename or "sbi card" in filename or "state bank" in filename:
        return "sbi"
    if "american express" in filename or "amex" in filename:
        return "amex"
    if "idfc first" in filename or "idfc" in filename:
        return "idfc_first"
    if "indusind" in filename:
        return "indusind"
    if "kotak" in filename:
        return "kotak"
    if "standard chartered" in filename:
        return "sc"
    if "yes bank" in filename:
        return "yes"
    if "au small finance" in filename or "au bank" in filename:
        return "au"
    if "rbl bank" in filename or "rbl" in filename:
        return "rbl"

    # Try card BIN prefixes from masked card numbers in filename (e.g. 5522XXXXXXXXXX87)
    bin_match = re.search(r"(\d{4})[xX*]+\d{2,4}", filename)
    if bin_match:
        first4 = bin_match.group(1)
        hdfc_bins = {"5522", "4386", "4567", "5241", "4543", "5254", "4213"}
        icici_bins = {"4568", "5243", "4998", "5236", "4389", "4315", "4998", "5270", "4329"}
        axis_bins = {"4108", "4178", "5269", "4021", "4717"}
        if first4 in hdfc_bins:
            return "hdfc"
        if first4 in icici_bins:
            return "icici"
        if first4 in axis_bins:
            return "axis"

    # Open PDF and extract first page text
    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return None
            text = pdf.pages[0].extract_text() or ""
    except Exception:
        return None

    text_lower = text.lower()

    # Search for bank identifiers
    if re.search(r"\bhdfc\b", text_lower) or "hdfc bank" in text_lower:
        return "hdfc"
    if re.search(r"\bicici\b", text_lower) or "icici bank" in text_lower:
        return "icici"
    if re.search(r"\baxis\s*bank\b", text_lower) or "axis bank" in text_lower:
        return "axis"
    if re.search(r"\bsbi\b", text_lower) or "sbi card" in text_lower or "state bank" in text_lower:
        return "sbi"
    if "american express" in text_lower or re.search(r"\bamex\b", text_lower):
        return "amex"
    if "idfc first" in text_lower or re.search(r"\bidfc\b", text_lower):
        return "idfc_first"
    if re.search(r"\bindusind\b", text_lower):
        return "indusind"
    if re.search(r"\bkotak\b", text_lower):
        return "kotak"
    if "standard chartered" in text_lower:
        return "sc"
    if "yes bank" in text_lower:
        return "yes"
    if "au small finance" in text_lower or "au bank" in text_lower:
        return "au"
    if "rbl bank" in text_lower or re.search(r"\brbl\b", text_lower):
        return "rbl"

    return None
