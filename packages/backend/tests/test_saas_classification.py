"""
Tests for SaaS category classification module.

Covers classify_saas public API and unit-testable helpers (extract_signals, classify).
"""

import pytest
from app.saas_classification import (
    classify_saas,
    extract_signals,
    classify,
    get_benchmark_key,
)
from app.saas_classification.types import ClassifySaaSResult


# ---------------------------------------------------------------------------
# Example test case 1: Payments / Fintech vendor
# ---------------------------------------------------------------------------
def test_classify_saas_payments_fintech():
    """Payments-like vendor (e.g. Stripe) should classify as Payments and return fintech benchmark."""
    vendor_input = {
        "name": "Stripe",
        "description": "Payment processing for the internet. APIs for payments, billing, and more.",
        "product_tags": ["payments", "api", "fintech"],
        "metadata": {"industry": "fintech"},
    }
    result = classify_saas(vendor_input)

    assert isinstance(result, dict)
    assert result["category"] == "Payments"
    assert result["benchmark_key"] == "fintech_benchmark_v1"
    assert 0 <= result["confidence"] <= 1
    assert result["confidence"] > 0.5


# ---------------------------------------------------------------------------
# Example test case 2: DevTools vendor
# ---------------------------------------------------------------------------
def test_classify_saas_devtools():
    """Developer tools / API-focused vendor should classify as DevTools."""
    vendor_input = {
        "name": "Acme Dev API",
        "description": "CI/CD and developer APIs. SDKs for deployment and observability.",
        "website_text": "Build with our API. Debug and monitor your services. Kubernetes and Docker.",
        "product_tags": ["devtools", "api", "sdk", "ci/cd"],
    }
    result = classify_saas(vendor_input)

    assert result["category"] == "DevTools"
    assert result["benchmark_key"] == "devtools_growth_benchmark"
    assert 0 <= result["confidence"] <= 1


# ---------------------------------------------------------------------------
# Example test case 3: CRM / Sales vendor
# ---------------------------------------------------------------------------
def test_classify_saas_crm():
    """Sales pipeline and contact management should classify as CRM."""
    vendor_input = {
        "name": "SalesHub",
        "description": "CRM and sales pipeline. Lead management and contact management.",
        "product_tags": ["crm", "sales", "lead"],
        "metadata": {"segment": "sales"},
    }
    result = classify_saas(vendor_input)

    assert result["category"] == "CRM"
    assert result["benchmark_key"] == "crm_sales_benchmark_v1"
    assert result["confidence"] > 0


# ---------------------------------------------------------------------------
# Unit tests: feature extraction and benchmark selector
# ---------------------------------------------------------------------------
def test_extract_signals_deduplicates_and_normalizes():
    """FeatureExtractor should lowercase and deduplicate tokens and tags."""
    signals = extract_signals({
        "website_text": "Payment PAYMENT payment",
        "product_tags": ["Payments", "payments"],
    })
    assert "payment" in signals["website_tokens"]
    assert len(signals["website_tokens"]) >= 1
    assert "payments" in signals["product_tags"]
    assert len(signals["product_tags"]) == 1


def test_classify_returns_unknown_for_empty_input():
    """Empty or minimal input should yield Unknown category and default benchmark."""
    signals = extract_signals({})
    category, confidence, breakdown = classify(signals)
    assert category == "Unknown"
    assert confidence == 0.0

    result = classify_saas({})
    assert result["category"] == "Unknown"
    assert result["benchmark_key"] == "general_saas_benchmark_v1"
    assert result["confidence"] == 0.0


def test_get_benchmark_key_returns_default_for_unknown_category():
    """BenchmarkSelector should return default key for unknown category."""
    assert get_benchmark_key("Unknown") == "general_saas_benchmark_v1"
    assert get_benchmark_key("NonExistent") == "general_saas_benchmark_v1"
    assert get_benchmark_key("Payments") == "fintech_benchmark_v1"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
