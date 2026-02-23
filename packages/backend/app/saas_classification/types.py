"""
Type definitions for SaaS category classification.

All input/output structures are defined here for clarity and reuse.
"""

from typing import TypedDict, Any, NotRequired


class VendorInput(TypedDict, total=False):
    """
    Input payload for classify_saas.
    All fields optional; at least one of website_text, description, or product_tags
    is recommended for meaningful classification.
    """
    # Raw or pre-extracted website/marketing copy
    website_text: str
    # Short description (e.g. from a vendor directory)
    description: str
    # Product/vendor name
    name: str
    # Explicit product tags (e.g. ["payments", "api", "fintech"])
    product_tags: list[str]
    # Arbitrary metadata key-value pairs (e.g. industry, segment)
    metadata: dict[str, Any]


class ScoreBreakdown(TypedDict):
    """Per-category score components for explainability."""
    website_keyword_score: float
    metadata_match_score: float
    product_tag_score: float
    negative_penalty: float
    total_raw: float


class ClassificationResult(TypedDict):
    """Full result from ClassificationEngine (before benchmark key is attached)."""
    category: str
    confidence: float
    score_breakdown: dict[str, ScoreBreakdown]


class ClassifySaaSResult(TypedDict):
    """
    Public API result: category, confidence, and benchmark key.
    Additional fields may be added over time in a backwards-compatible way.
    """
    category: str
    confidence: float
    benchmark_key: str
    category_profile: NotRequired[dict[str, Any]]


class RankedProduct(TypedDict):
    name: str
    score: float
    reason: str


class CategoryProfile(TypedDict):
    category_name: str
    confidence: float
    top_products: list[RankedProduct]
