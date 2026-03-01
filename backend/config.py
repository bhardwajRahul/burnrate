"""Bank configurations: password formats, email patterns, merchant categories."""

from typing import Dict, List

# Bank password format hints (for documentation)
# HDFC: UPPERCASE first 4 letters of name + DDMM (DOB) OR UPPERCASE first 4 + last 4 digits of card
# ICICI: lowercase first 4 letters of name + DDMM (DOB)
# Axis: UPPERCASE first 4 letters of name + DDMM (DOB)

# Merchant category keyword mappings (~50 Indian merchants across 8+ categories)
MERCHANT_CATEGORIES: Dict[str, List[str]] = {
    "food": [
        "swiggy", "zomato", "mcdonald", "starbucks", "restaurant", "cafe",
        "dominos", "kfc", "subway", "pizza hut", "burger king", "haldiram",
        "barbeque nation",
    ],
    "shopping": [
        "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "tatacliq",
        "croma", "reliance digital", "infiniti retail", "aptronix", "indivinity",
    ],
    "travel": [
        "uber", "ola", "makemytrip", "irctc", "cleartrip", "goibibo",
        "airline", "railway", "indigo", "air india", "vistara",
        "yatra", "agoda", "ibibo", "lounge",
    ],
    "bills": [
        "jio", "airtel", "vi", "bsnl", "electricity", "gas", "insurance",
        "broadband", "tata power", "adani", "bharti",
        "life insurance", "lic",
    ],
    "entertainment": [
        "netflix", "spotify", "hotstar", "prime video", "inox", "pvr",
        "youtube", "apple", "google play", "bundl",
    ],
    "fuel": [
        "hp", "bharat petroleum", "iocl", "shell", "indian oil", "bpcl",
        "hindustan petroleum",
    ],
    "health": [
        "apollo", "pharmeasy", "1mg", "hospital", "medplus", "netmeds",
        "practo", "lenskart",
    ],
    "groceries": [
        "bigbasket", "blinkit", "zepto", "dmart", "jiomart",
        "swiggy instamart", "instamart", "nature basket", "more",
    ],
    "cc_payment": [
        "cc payment", "cc pymt", "bppy cc payment",
        "bbps payment", "neft payment", "imps payment",
    ],
}
