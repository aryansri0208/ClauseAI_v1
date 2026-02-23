"""
ClassificationEngine: weighted scoring over taxonomy categories.

Uses FeatureExtractor output and taxonomy to produce a single category,
confidence (0-1), and per-category score breakdown. Deterministic and explainable.
"""

from __future__ import annotations

import os

from app.saas_classification.types import ScoreBreakdown
from app.saas_classification.taxonomy import (
    get_taxonomy,
    WEIGHT_WEBSITE_KEYWORD,
    WEIGHT_METADATA_MATCH,
    WEIGHT_EXACT_PRODUCT_TAG,
)
from app.saas_classification.feature_extractor import ExtractedSignals

# Confidence scale: raw score >= this maps to confidence 1.0
MAX_SCORE_FOR_FULL_CONFIDENCE = 15.0
# Penalty per negative signal match (reduces category score)
NEGATIVE_SIGNAL_PENALTY = 2.0

# Phrase matches should be stronger than single-token matches.
WEIGHT_WEBSITE_PHRASE = 2.0

# Generic payments tokens commonly appear on non-payments sites (cloud billing pages, etc.).
# We downweight these for the Payments category unless a higher-signal phrase matches.
GENERIC_PAYMENTS_TOKENS: set[str] = {
    "payment",
    "payments",
    "billing",
    "checkout",
    "transaction",
    "transactions",
    "merchant",
    "card",
    "refund",
    "chargeback",
}
GENERIC_PAYMENTS_TOKEN_MULTIPLIER = 0.25

# Enable temporary debug logging with: SAAS_CLASSIFIER_DEBUG=1
DEBUG_SCORING = os.getenv("SAAS_CLASSIFIER_DEBUG") == "1"


def _normalize_keyword(key: str) -> str:
    """Lowercase for matching; caller passes taxonomy keywords already lowercased in logic."""
    return key.lower().strip()


def _category_keywords_normalized(keywords: list[str]) -> set[str]:
    """Set of lowercase keywords for a category."""
    return {_normalize_keyword(k) for k in keywords}


def _score_category(
    category_id: str,
    definition: dict,
    signals: ExtractedSignals,
) -> tuple[float, ScoreBreakdown]:
    """
    Score one category: website keywords (1.0), metadata (1.5), product tag (2.0),
    minus negative signal penalty. Returns (total_raw_score, breakdown).
    Website scoring: token-level (existing) + phrase-level for multi-word keywords.
    """
    keywords_set = _category_keywords_normalized(definition["keywords"])
    metadata_triggers_set = _category_keywords_normalized(definition["metadata_triggers"])
    negative_set = _category_keywords_normalized(definition["negative_signals"])

    # --- Token-level website scoring (unchanged) ---
    website_token_score = 0.0
    for token in signals["website_tokens"]:
        if token in keywords_set:
            increment = WEIGHT_WEBSITE_KEYWORD
            if category_id == "Payments" and token in GENERIC_PAYMENTS_TOKENS:
                increment *= GENERIC_PAYMENTS_TOKEN_MULTIPLIER
            website_token_score += increment

    # --- Phrase-level website scoring: multi-word keywords only ---
    # Build normalized combined website text (from feature extractor); fallback to empty if absent.
    website_text_normalized = signals.get("website_text_normalized", "")
    website_phrase_score = 0.0
    for keyword in definition["keywords"]:
        phrase = _normalize_keyword(keyword)
        if " " in phrase and phrase in website_text_normalized:
            website_phrase_score += WEIGHT_WEBSITE_PHRASE

    website_score = website_token_score + website_phrase_score

    metadata_score = 0.0
    for val in signals["metadata_values"]:
        matched = val in metadata_triggers_set
        if not matched:
            for kw in metadata_triggers_set:
                if kw in val:
                    matched = True
                    break
        if matched:
            metadata_score += WEIGHT_METADATA_MATCH

    product_tag_score = 0.0
    for tag in signals["product_tags"]:
        if tag in keywords_set or tag in metadata_triggers_set:
            product_tag_score += WEIGHT_EXACT_PRODUCT_TAG

    negative_penalty = 0.0
    for token in signals["website_tokens"]:
        if token in negative_set:
            negative_penalty += NEGATIVE_SIGNAL_PENALTY
    for val in signals["metadata_values"]:
        if val in negative_set:
            negative_penalty += NEGATIVE_SIGNAL_PENALTY
    for tag in signals["product_tags"]:
        if tag in negative_set:
            negative_penalty += NEGATIVE_SIGNAL_PENALTY

    total_raw = max(0.0, website_score + metadata_score + product_tag_score - negative_penalty)

    if DEBUG_SCORING:
        print(
            f"[saas_classify] category={category_id} "
            f"token_score={website_token_score:.2f} "
            f"phrase_score={website_phrase_score:.2f} "
            f"total_score={total_raw:.2f}"
        )

    breakdown: ScoreBreakdown = {
        "website_keyword_score": round(website_score, 2),
        "metadata_match_score": round(metadata_score, 2),
        "product_tag_score": round(product_tag_score, 2),
        "negative_penalty": round(-negative_penalty, 2),
        "total_raw": round(total_raw, 2),
    }
    return total_raw, breakdown


def classify(signals: ExtractedSignals) -> tuple[str, float, dict[str, ScoreBreakdown]]:
    """
    Scores all taxonomy categories and returns the winning category,
    confidence (0-1), and full score breakdown per category.
    Confidence is based on score gap: best / (best + second_best), clamped to [0, 1].
    """
    taxonomy = get_taxonomy()
    best_category = "Unknown"
    best_score = 0.0
    second_best_score = 0.0
    all_breakdowns: dict[str, ScoreBreakdown] = {}

    for category_id, definition in taxonomy.items():
        total_raw, breakdown = _score_category(category_id, definition, signals)
        all_breakdowns[category_id] = breakdown
        if total_raw > best_score:
            second_best_score = best_score
            best_score = total_raw
            best_category = category_id
        elif total_raw > second_best_score:
            second_best_score = total_raw

    # Confidence from decisiveness: best / (best + second_best); 0 if best is 0
    if best_score > 0:
        confidence = best_score / (best_score + second_best_score)
        confidence = max(0.0, min(1.0, confidence))
    else:
        confidence = 0.0

    return best_category, confidence, all_breakdowns
