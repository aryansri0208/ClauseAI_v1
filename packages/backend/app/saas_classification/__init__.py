"""
SaaS Category Classification module.

Production-ready, deterministic classification using weighted keyword scoring.
No ML or external APIs. Modular: taxonomy, feature extraction, scoring, benchmark selection.

Public API:
    classify_saas(vendor_input) -> ClassifySaaSResult
"""

from app.saas_classification.types import (
    VendorInput,
    ClassifySaaSResult,
    ClassificationResult,
    ScoreBreakdown,
)
from app.saas_classification.feature_extractor import extract_signals, ExtractedSignals
from app.saas_classification.classification_engine import classify
from app.saas_classification.benchmark_selector import get_benchmark_key
from app.saas_classification.product_ranking import rank_products_for_category
from app.saas_classification.taxonomy import get_taxonomy, WEIGHT_WEBSITE_KEYWORD, WEIGHT_METADATA_MATCH, WEIGHT_EXACT_PRODUCT_TAG


def classify_saas(vendor_input: VendorInput) -> ClassifySaaSResult:
    """
    Classify a SaaS vendor into a category and return category, confidence, and benchmark key.

    Args:
        vendor_input: Dict with optional keys:
            - website_text: raw or extracted website/marketing text
            - description: short vendor description
            - name: vendor/product name
            - product_tags: list of tags (e.g. ["payments", "api"])
            - metadata: key-value pairs (e.g. {"industry": "fintech"})

    Returns:
        {
            "category": str,
            "confidence": float (0-1),
            "benchmark_key": str
        }

    Example:
        >>> result = classify_saas({
        ...     "name": "Stripe",
        ...     "description": "Payment processing for the internet.",
        ...     "product_tags": ["payments", "api", "fintech"],
        ... })
        >>> result["category"]
        'Payments'
        >>> result["benchmark_key"]
        'fintech_benchmark_v1'
    """
    # Normalize input to dict for feature extractor
    payload = dict(vendor_input) if vendor_input else {}
    signals = extract_signals(payload)
    category, confidence, _score_breakdown = classify(signals)
    benchmark_key = get_benchmark_key(category)
    vendor_name = str(payload.get("name") or "")
    top_products = rank_products_for_category(category, vendor_name=vendor_name, signals=signals, top_n=3)

    result = ClassifySaaSResult(
        category=category,
        confidence=round(confidence, 4),
        benchmark_key=benchmark_key,
    )
    # Backwards-compatible extension: extra structured output for downstream use.
    result["category_profile"] = {
        "category_name": category,
        "confidence": round(confidence, 4),
        "top_products": top_products,
    }
    return result


__all__ = [
    "classify_saas",
    "VendorInput",
    "ClassifySaaSResult",
    "ClassificationResult",
    "ScoreBreakdown",
    "ExtractedSignals",
    "extract_signals",
    "classify",
    "get_benchmark_key",
    "get_taxonomy",
    "rank_products_for_category",
]
