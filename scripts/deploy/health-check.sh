#!/bin/bash
# Health Check Script for PWA Deployment
# Run periodically to verify deployment health
# Usage: bash scripts/deploy/health-check.sh [domain]

set -e

DOMAIN="${1:-https://pomoflow.yourdomain.com}"
TIMEOUT=15
ERRORS=0

echo "========================================"
echo "PWA Health Check"
echo "Domain: $DOMAIN"
echo "Time: $(date)"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() {
  echo -e "${GREEN}[OK]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

err() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((ERRORS++))
}

# 1. Basic connectivity
echo "1. Connectivity"
echo "---------------"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DOMAIN" 2>/dev/null || echo "000")
RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" --max-time $TIMEOUT "$DOMAIN" 2>/dev/null || echo "timeout")

if [ "$HTTP_CODE" = "200" ]; then
  ok "Site responding (HTTP $HTTP_CODE, ${RESPONSE_TIME}s)"
elif [ "$HTTP_CODE" = "000" ]; then
  err "Site not reachable (connection failed)"
else
  err "Unexpected response (HTTP $HTTP_CODE)"
fi

# 2. Health endpoint (if available)
echo ""
echo "2. Health Endpoint"
echo "------------------"

HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$DOMAIN/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
  HEALTH_RESPONSE=$(curl -s --max-time $TIMEOUT "$DOMAIN/health" 2>/dev/null)
  ok "Health endpoint responding"
  echo "    Response: $HEALTH_RESPONSE"
elif [ "$HEALTH_CODE" = "404" ]; then
  warn "Health endpoint not found (consider adding /health route)"
else
  warn "Health endpoint returned HTTP $HEALTH_CODE"
fi

# 3. Critical resources
echo ""
echo "3. Critical Resources"
echo "---------------------"

RESOURCES=(
  "/ (main page)"
  "/manifest.webmanifest"
  "/sw.js"
)

RESOURCE_URLS=(
  "$DOMAIN/"
  "$DOMAIN/manifest.webmanifest"
  "$DOMAIN/sw.js"
)

for i in "${!RESOURCES[@]}"; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "${RESOURCE_URLS[$i]}" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    ok "${RESOURCES[$i]}"
  elif [ "$CODE" = "404" ]; then
    # SW and manifest may not exist until PWA is implemented
    if [[ "${RESOURCES[$i]}" == *"sw.js"* ]] || [[ "${RESOURCES[$i]}" == *"manifest"* ]]; then
      warn "${RESOURCES[$i]} - not found (PWA not yet implemented)"
    else
      err "${RESOURCES[$i]} - not found (404)"
    fi
  else
    err "${RESOURCES[$i]} - HTTP $CODE"
  fi
done

# 4. SSL certificate check
echo ""
echo "4. SSL Certificate"
echo "------------------"

# Extract domain without protocol
DOMAIN_ONLY=$(echo "$DOMAIN" | sed 's|https://||' | sed 's|/.*||')

CERT_EXPIRY=$(echo | openssl s_client -servername "$DOMAIN_ONLY" -connect "$DOMAIN_ONLY:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)

if [ -n "$CERT_EXPIRY" ]; then
  EXPIRY_EPOCH=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$CERT_EXPIRY" +%s 2>/dev/null)
  NOW_EPOCH=$(date +%s)

  if [ -n "$EXPIRY_EPOCH" ]; then
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

    if [ "$DAYS_LEFT" -lt 7 ]; then
      err "SSL expires in $DAYS_LEFT days - RENEW IMMEDIATELY"
    elif [ "$DAYS_LEFT" -lt 14 ]; then
      warn "SSL expires in $DAYS_LEFT days"
    else
      ok "SSL valid for $DAYS_LEFT more days"
    fi
  else
    warn "Could not parse certificate expiry date"
  fi
else
  err "Could not check SSL certificate"
fi

# 5. Performance check
echo ""
echo "5. Performance"
echo "--------------"

# Time to first byte
TTFB=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time $TIMEOUT "$DOMAIN" 2>/dev/null || echo "timeout")

if [ "$TTFB" != "timeout" ]; then
  TTFB_MS=$(echo "$TTFB * 1000" | bc 2>/dev/null || echo "N/A")

  if (( $(echo "$TTFB < 0.5" | bc -l 2>/dev/null || echo "0") )); then
    ok "Time to First Byte: ${TTFB_MS}ms (excellent)"
  elif (( $(echo "$TTFB < 1.0" | bc -l 2>/dev/null || echo "0") )); then
    ok "Time to First Byte: ${TTFB_MS}ms (good)"
  elif (( $(echo "$TTFB < 2.0" | bc -l 2>/dev/null || echo "0") )); then
    warn "Time to First Byte: ${TTFB_MS}ms (needs improvement)"
  else
    warn "Time to First Byte: ${TTFB_MS}ms (slow)"
  fi
else
  err "Could not measure TTFB"
fi

# 6. Summary
echo ""
echo "========================================"
echo "Health Check Summary"
echo "========================================"

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}STATUS: HEALTHY${NC}"
  echo "All critical checks passed."
  exit 0
else
  echo -e "${RED}STATUS: UNHEALTHY${NC}"
  echo "$ERRORS critical issue(s) found."
  exit 1
fi
