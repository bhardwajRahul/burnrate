"""Merchant categorizer based on keyword matching."""

from backend.config import MERCHANT_CATEGORIES


def categorize(merchant_name: str) -> str:
    """
    Categorize a merchant by name using keyword lists from config.
    Returns category string, default 'other' if no match.
    """
    if not merchant_name:
        return "other"

    lower = merchant_name.lower()

    for category, keywords in MERCHANT_CATEGORIES.items():
        for keyword in keywords:
            if keyword in lower:
                return category

    return "other"
