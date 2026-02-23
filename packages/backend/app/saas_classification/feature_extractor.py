"""
FeatureExtractor: normalizes vendor metadata, tokenizes text, extracts keywords, deduplicates.

Produces structured signals for the ClassificationEngine. No ML or external APIs.
"""

import re
from typing import TypedDict


class ExtractedSignals(TypedDict):
    """
    Structured output for scoring. All sets are lowercased and deduplicated.
    website_text_normalized: combined website/description/name text for phrase-level matching.
    """
    website_tokens: set[str]
    metadata_values: set[str]
    product_tags: set[str]
    website_text_normalized: str


# Tokenization: split on non-alphanumeric, keep words of min length
MIN_TOKEN_LENGTH = 2
# Ignore tokens that are pure digits (optional; keeps "2fa" etc. if we allow short)
DIGITS_ONLY_PATTERN = re.compile(r"^\d+$")


def _normalize_text(text: str) -> str:
    """Lowercase and collapse whitespace for consistent matching."""
    if not text or not isinstance(text, str):
        return ""
    return " ".join(text.lower().split())


def _tokenize(text: str) -> list[str]:
    """
    Split text into words: letters and numbers, min length MIN_TOKEN_LENGTH.
    Deduplication is done at the set level by the caller.
    """
    if not text:
        return []
    # Split on non-alphanumeric (underscore can be kept for dev-style tokens)
    tokens = re.findall(r"[a-z0-9_]+", _normalize_text(text))
    return [t for t in tokens if len(t) >= MIN_TOKEN_LENGTH and not DIGITS_ONLY_PATTERN.match(t)]


def _normalize_metadata_value(value: object) -> list[str]:
    """Turn a metadata value into a list of normalized tokens/strings."""
    if value is None:
        return []
    if isinstance(value, bool):
        return []
    if isinstance(value, (int, float)):
        return []  # Skip raw numbers for keyword matching
    if isinstance(value, str):
        normalized = _normalize_text(value)
        if not normalized:
            return []
        # Return both full string and tokenized parts for flexible matching
        tokens = _tokenize(normalized)
        out = [normalized]
        out.extend(tokens)
        return out
    if isinstance(value, (list, tuple)):
        result = []
        for item in value:
            result.extend(_normalize_metadata_value(item))
        return result
    if isinstance(value, dict):
        result = []
        for k, v in value.items():
            result.extend(_normalize_metadata_value(k))
            result.extend(_normalize_metadata_value(v))
        return result
    return []


def extract_signals(vendor_input: dict) -> ExtractedSignals:
    """
    Normalizes vendor metadata, tokenizes website/description text,
    extracts product tags, and deduplicates. Returns structured signals.

    Args:
        vendor_input: Dict with optional keys: website_text, description,
                     name, product_tags, metadata.

    Returns:
        ExtractedSignals with website_tokens, metadata_values, product_tags (all sets).
    """
    website_text = vendor_input.get("website_text") or ""
    description = vendor_input.get("description") or ""
    name = vendor_input.get("name") or ""
    product_tags = vendor_input.get("product_tags") or []
    metadata = vendor_input.get("metadata") or {}

    # Combine all text for tokenization and phrase matching (website + description + name)
    combined_text = " ".join(filter(None, [website_text, description, name]))
    website_text_normalized = _normalize_text(combined_text)
    tokens = _tokenize(website_text_normalized)
    website_tokens = set(tokens)

    # Metadata: flatten and normalize all values (and keys) for matching
    metadata_values: set[str] = set()
    for k, v in metadata.items():
        for part in _normalize_metadata_value(k):
            if part:
                metadata_values.add(part)
        for part in _normalize_metadata_value(v):
            if part:
                metadata_values.add(part)

    # Product tags: normalize and deduplicate
    tag_list = product_tags if isinstance(product_tags, (list, tuple)) else []
    product_tags_set: set[str] = set()
    for t in tag_list:
        if isinstance(t, str) and t.strip():
            normalized = _normalize_text(t.strip())
            product_tags_set.add(normalized)
            # Also add tokenized form for multi-word tags
            for tok in _tokenize(normalized):
                product_tags_set.add(tok)

    return ExtractedSignals(
        website_tokens=website_tokens,
        metadata_values=metadata_values,
        product_tags=product_tags_set,
        website_text_normalized=website_text_normalized,
    )
