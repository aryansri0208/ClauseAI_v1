#!/bin/bash
# ============================================================
# ClauseAI — Generate dummy Anthropic API usage
# ============================================================
# This script sends requests to the Anthropic API using your
# REGULAR API key (sk-ant-api...) to generate usage data that
# the Admin API key can then read during a ClauseAI scan.
#
# Usage:
#   chmod +x generate-anthropic-usage.sh
#   ./generate-anthropic-usage.sh
#
# It will prompt you for your API key if not set as env var.
# ============================================================

set -e

# --- API Key ---
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "Enter your REGULAR Anthropic API key (sk-ant-api...):"
  read -r ANTHROPIC_API_KEY
  echo ""
fi

if [[ "$ANTHROPIC_API_KEY" == sk-ant-admin* ]]; then
  echo "ERROR: That's an Admin key. You need a regular API key (sk-ant-api...)."
  echo "Go to console.anthropic.com → API Keys to get one."
  exit 1
fi

API_URL="https://api.anthropic.com/v1/messages"
HEADERS=(
  -H "x-api-key: $ANTHROPIC_API_KEY"
  -H "anthropic-version: 2023-06-01"
  -H "content-type: application/json"
)

success=0
fail=0

send_request() {
  local model="$1"
  local prompt="$2"
  local label="$3"

  response=$(curl -s -w "\n%{http_code}" "$API_URL" \
    "${HEADERS[@]}" \
    -d '{
      "model": "'"$model"'",
      "max_tokens": 50,
      "messages": [{"role": "user", "content": "'"$prompt"'"}]
    }')

  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo "  ✓ $label (HTTP $http_code)"
    ((success++))
  else
    echo "  ✗ $label (HTTP $http_code)"
    echo "    $body" | head -1
    ((fail++))
  fi
}

# --- Validate key with a single request first ---
echo "Validating API key..."
send_request "claude-haiku-4-5-20251001" "Say ok" "Key validation"

if [ "$fail" -gt 0 ]; then
  echo ""
  echo "API key is invalid. Check your key and try again."
  exit 1
fi

echo ""
echo "Key is valid. Sending dummy requests..."
echo ""

# --- Haiku requests (cheap, $0.80/M input) ---
echo "── Haiku (10 requests) ──"
for i in {1..10}; do
  send_request "claude-haiku-4-5-20251001" "Count to $i" "Haiku #$i"
  sleep 0.3
done

echo ""

# --- Sonnet requests (mid-tier, $3/M input) ---
echo "── Sonnet (5 requests) ──"
languages=("French" "Spanish" "Japanese" "German" "Italian")
for i in {0..4}; do
  send_request "claude-sonnet-4-20250514" "Say hello in ${languages[$i]}" "Sonnet #$((i+1))"
  sleep 0.3
done

echo ""

# --- Summary ---
total=$((success + fail))
echo "============================================"
echo "  Done! $success/$total requests succeeded"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Wait ~5 minutes for usage data to propagate"
echo "  2. Connect your ADMIN key (sk-ant-admin...) in ClauseAI"
echo "  3. Run the scan — you should see real token counts"
echo "     for both claude-haiku-4-5 and claude-sonnet-4"
echo ""