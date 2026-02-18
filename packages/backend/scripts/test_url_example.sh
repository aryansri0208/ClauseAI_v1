#!/bin/bash
# Test script for URL extraction endpoint

BASE_URL="http://localhost:8000"

echo "Testing URL extraction endpoint..."
echo ""

# Example 1: Test with a Terms of Service page
echo "Example 1: Extracting from a Terms of Service URL"
curl -X POST "${BASE_URL}/api/extract-from-url" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://stripe.com/legal/terms"
  }' | python3 -m json.tool | head -30

echo ""
echo "---"
echo ""

# Example 2: Test with a Privacy Policy page
echo "Example 2: Extracting from a Privacy Policy URL"
curl -X POST "${BASE_URL}/api/extract-from-url" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.github.com/site/terms"
  }' | python3 -m json.tool | head -30

echo ""
echo "---"
echo ""

# Example 3: Test with explicit content type
echo "Example 3: With explicit HTML content type"
curl -X POST "${BASE_URL}/api/extract-from-url" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/terms",
    "content_type": "html"
  }' | python3 -m json.tool | head -30
