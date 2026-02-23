"""
Quick validation script for SaaS category classification on real websites.

Runs classification on:
  - aws.com
  - cloud.google.com
  - stripe.com

Prints:
  - category
  - confidence
  - ranked products (top 3)

Usage:
  cd packages/backend
  ./venv/bin/python scripts/validate_saas_classification_urls.py
"""

from __future__ import annotations

import re
import sys
import urllib.request
import html as html_lib

# Allow importing `app` when run as a script from /packages/backend
sys.path.insert(0, ".")

from app.saas_classification import classify_saas


URLS = [
    "https://aws.amazon.com/",
    "https://cloud.google.com/",
    "https://stripe.com/",
]

def _fetch_html(url: str) -> str:
    """
    Minimal URL fetch for validation purposes.
    Uses stdlib only (no external dependencies) so it can run in a fresh venv.
    """
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            )
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
        # Try to respect declared charset when present.
        content_type = resp.headers.get("content-type", "")
        m = re.search(r"charset=([\\w\\-]+)", content_type, flags=re.IGNORECASE)
        encoding = m.group(1) if m else "utf-8"
        return raw.decode(encoding, errors="ignore")


def _html_to_text(html: str) -> str:
    """
    Lightweight HTML -> text (best-effort).
    Good enough for keyword-based classification validation.
    """
    if not html:
        return ""
    # Remove scripts/styles
    html = re.sub(r"(?is)<script.*?>.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?>.*?</style>", " ", html)
    # Strip tags
    html = re.sub(r"(?is)<[^>]+>", " ", html)
    # Unescape entities and collapse whitespace
    text = html_lib.unescape(html)
    return " ".join(text.split())


def _classify_url(url: str) -> None:
    website_html = _fetch_html(url)
    website_text = _html_to_text(website_html)
    result = classify_saas({"website_text": website_text})

    category = result["category"]
    confidence = result["confidence"]
    profile = result.get("category_profile", {})
    top_products = profile.get("top_products", [])

    print("\n---")
    print("url:", url)
    print("category:", category)
    print("confidence:", confidence)
    print("ranked_products:", top_products)

def main() -> None:
    for url in URLS:
        try:
            _classify_url(url)
        except Exception as e:
            print("\n---")
            print("url:", url)
            print("error:", str(e))


if __name__ == "__main__":
    main()

