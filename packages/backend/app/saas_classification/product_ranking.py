"""
Deterministic product ranking for a classified category.

This is intentionally lightweight: a predefined list of example products per category
is scored using simple string/token/phrase matching against the vendor text signals.
No ML, no external APIs.
"""

from __future__ import annotations

from typing import TypedDict

from app.saas_classification.feature_extractor import ExtractedSignals


class RankedProduct(TypedDict):
    name: str
    score: float
    reason: str


# Predefined example products per category (extensible).
CATEGORY_TO_PRODUCTS: dict[str, list[str]] = {
    "Infrastructure": ["AWS", "GCP", "Azure"],
    "Payments": ["Stripe", "Square", "PayPal"],
    "DevTools": ["GitHub", "GitLab", "Vercel"],
    "CRM": ["Salesforce", "HubSpot", "Pipedrive"],
    "Analytics": ["Mixpanel", "Amplitude", "Looker"],
    "Marketing Automation": ["Marketo", "Mailchimp", "HubSpot Marketing Hub"],
    "HRTech": ["Workday", "BambooHR", "Greenhouse"],
    "Cybersecurity": ["Okta", "CrowdStrike", "Palo Alto Networks"],
    "Collaboration": ["Slack", "Notion", "Asana"],
}

# Optional product aliases to improve matching against common website phrasing.
PRODUCT_ALIASES: dict[str, list[str]] = {
    "AWS": ["amazon web services", "aws"],
    "GCP": ["google cloud", "google cloud platform", "gcp"],
    "Azure": ["microsoft azure", "azure"],
}


def _normalize(s: str) -> str:
    return " ".join((s or "").lower().split())


def rank_products_for_category(
    category: str,
    vendor_name: str,
    signals: ExtractedSignals,
    top_n: int = 3,
) -> list[RankedProduct]:
    """
    Returns top-N example products for a category.

    Scoring signals:
    - Category alignment baseline (ensures stable ordering even with no matches)
    - Phrase match boost (product name appears in normalized website text)
    - Token match boost (product name tokens appear)
    - Vendor-name alignment boost (when vendor looks like the product)
    """
    products = CATEGORY_TO_PRODUCTS.get(category, [])
    if not products or top_n <= 0:
        return []

    website_text = signals.get("website_text_normalized", "")
    website_tokens = signals.get("website_tokens", set())

    vendor_norm = _normalize(vendor_name)

    ranked: list[RankedProduct] = []
    for product in products:
        product_norm = _normalize(product)
        score = 1.0  # category alignment baseline
        reasons: list[str] = ["category alignment"]

        aliases = PRODUCT_ALIASES.get(product, [])
        alias_norms = [_normalize(a) for a in aliases if a]
        phrase_candidates = [product_norm] + [a for a in alias_norms if a and a != product_norm]

        # Phrase match (strongest signal)
        matched_phrase = next((p for p in phrase_candidates if p and p in website_text), None)
        if matched_phrase:
            score += 3.0
            if matched_phrase == product_norm:
                reasons.append("name phrase match in website text")
            else:
                reasons.append(f"alias phrase match ({matched_phrase})")
        else:
            # Token overlap (weaker)
            token_source = " ".join(phrase_candidates)
            toks = [t for t in token_source.split(" ") if t]
            token_hits = sum(1 for t in toks if t in website_tokens)
            if token_hits:
                score += min(1.5, 0.5 * token_hits)
                reasons.append(f"token match ({token_hits})")

        # Vendor-name alignment (helps when classifying AWS/GCP themselves)
        if vendor_norm and product_norm:
            if vendor_norm == product_norm:
                score += 2.0
                reasons.append("vendor name equals product")
            elif vendor_norm in product_norm or product_norm in vendor_norm:
                score += 1.0
                reasons.append("vendor name similar to product")

        ranked.append(
            {
                "name": product,
                "score": round(score, 3),
                "reason": "; ".join(reasons),
            }
        )

    # Deterministic ordering: score desc, then name asc
    ranked.sort(key=lambda p: (-p["score"], p["name"].lower()))
    return ranked[:top_n]

