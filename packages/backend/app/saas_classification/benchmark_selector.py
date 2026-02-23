"""
BenchmarkSelector: maps SaaS category -> benchmark group key.

Extensible: add or change entries in CATEGORY_TO_BENCHMARK to support new benchmarks.
"""

# Default mapping: category label -> benchmark key used downstream
CATEGORY_TO_BENCHMARK: dict[str, str] = {
    "Payments": "fintech_benchmark_v1",
    "Analytics": "analytics_benchmark_v1",
    "CRM": "crm_sales_benchmark_v1",
    "DevTools": "devtools_growth_benchmark",
    "Marketing Automation": "marketing_automation_benchmark_v1",
    "HRTech": "hrtech_benchmark_v1",
    "Cybersecurity": "cybersecurity_benchmark_v1",
    "Infrastructure": "infrastructure_benchmark_v1",
    "Collaboration": "collaboration_benchmark_v1",
}

# Fallback when category is unknown or not in map
DEFAULT_BENCHMARK_KEY = "general_saas_benchmark_v1"


def get_benchmark_key(category: str) -> str:
    """
    Returns the benchmark selection key for a given category.
    Extensible: update CATEGORY_TO_BENCHMARK for new categories or keys.
    """
    key = CATEGORY_TO_BENCHMARK.get(category)
    return key if key is not None else DEFAULT_BENCHMARK_KEY
