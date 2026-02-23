"""
Example usage of SaaS category classification.

Run from repo root:
  cd packages/backend && python -m examples.saas_classification_example
"""

import sys

# Allow importing app when run as script
sys.path.insert(0, ".")

from app.saas_classification import classify_saas


def main() -> None:
    # Example 1: Payments vendor
    result = classify_saas({
        "name": "Stripe",
        "description": "Payment processing for the internet.",
        "product_tags": ["payments", "api", "fintech"],
    })
    print("Example 1 (Payments):", result)

    # Example 2: DevTools vendor
    result2 = classify_saas({
        "name": "Acme CI",
        "website_text": "CI/CD and deployment. API and SDK for developers.",
        "product_tags": ["devtools", "api"],
    })
    print("Example 2 (DevTools):", result2)

    # Example 3: CRM vendor
    result3 = classify_saas({
        "description": "Sales pipeline and CRM. Lead and contact management.",
        "metadata": {"segment": "sales"},
    })
    print("Example 3 (CRM):", result3)


if __name__ == "__main__":
    main()
