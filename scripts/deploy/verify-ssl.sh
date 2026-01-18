#!/bin/bash
# SSL/HTTPS Verification Script
# Run post-deployment to verify SSL configuration
# Usage: bash scripts/deploy/verify-ssl.sh [domain]

set -e

DOMAIN="${1:-flowstate.yourdomain.com}"
TIMEOUT=10
ERRORS=0

echo "========================================"
echo "SSL/HTTPS Verification"
echo "Domain: $DOMAIN"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() {
  echo -e "${GREEN}OK${NC}: $1"
}

warn() {
  echo -e "${YELLOW}WARNING${NC}: $1"
}

err() {
  echo -e "${RED}ERROR${NC}: $1"
  ((ERRORS++))
}

echo "1. HTTP to HTTPS Redirect"
echo "-------------------------"

REDIRECT=$(curl -sI -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "http://$DOMAIN" 2>/dev/null || echo "FAILED")

if [ "$REDIRECT" = "301" ] || [ "$REDIRECT" = "302" ]; then
  ok "HTTP redirects to HTTPS (status: $REDIRECT)"
elif [ "$REDIRECT" = "FAILED" ]; then
  warn "Could not connect to http://$DOMAIN (timeout or DNS issue)"
else
  warn "No HTTPS redirect (status: $REDIRECT)"
fi

echo ""
echo "2. HTTPS Connectivity"
echo "---------------------"

HTTPS_STATUS=$(curl -sI -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "https://$DOMAIN" 2>/dev/null || echo "FAILED")

if [ "$HTTPS_STATUS" = "200" ]; then
  ok "HTTPS responding (status: $HTTPS_STATUS)"
elif [ "$HTTPS_STATUS" = "FAILED" ]; then
  err "Could not connect to https://$DOMAIN"
else
  warn "Unexpected HTTPS status: $HTTPS_STATUS"
fi

echo ""
echo "3. SSL Certificate"
echo "------------------"

# Get certificate info
CERT_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$CERT_INFO" ]; then
  ok "SSL certificate valid"

  # Extract subject
  SUBJECT=$(echo "$CERT_INFO" | grep "subject=" | sed 's/subject=//')
  echo "    Subject: $SUBJECT"

  # Extract dates
  NOT_BEFORE=$(echo "$CERT_INFO" | grep "notBefore=" | sed 's/notBefore=//')
  NOT_AFTER=$(echo "$CERT_INFO" | grep "notAfter=" | sed 's/notAfter=//')
  echo "    Valid from: $NOT_BEFORE"
  echo "    Valid until: $NOT_AFTER"

  # Calculate days until expiry
  EXPIRY_EPOCH=$(date -d "$NOT_AFTER" +%s 2>/dev/null || date -j -f "%b %d %H:%M:%S %Y %Z" "$NOT_AFTER" +%s 2>/dev/null)
  NOW_EPOCH=$(date +%s)

  if [ -n "$EXPIRY_EPOCH" ]; then
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

    if [ "$DAYS_LEFT" -lt 7 ]; then
      err "Certificate expires in $DAYS_LEFT days - CRITICAL!"
    elif [ "$DAYS_LEFT" -lt 14 ]; then
      warn "Certificate expires in $DAYS_LEFT days"
    elif [ "$DAYS_LEFT" -lt 30 ]; then
      ok "Certificate expires in $DAYS_LEFT days (consider renewal)"
    else
      ok "Certificate expires in $DAYS_LEFT days"
    fi
  fi
else
  err "Could not verify SSL certificate"
fi

echo ""
echo "4. Security Headers"
echo "-------------------"

# Get headers
HEADERS=$(curl -sI --max-time $TIMEOUT "https://$DOMAIN" 2>/dev/null)

# Check HSTS
if echo "$HEADERS" | grep -qi "strict-transport-security"; then
  HSTS=$(echo "$HEADERS" | grep -i "strict-transport-security")
  ok "HSTS header present"
  echo "    $HSTS"
else
  warn "HSTS header missing (recommended for security)"
fi

# Check X-Content-Type-Options
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  ok "X-Content-Type-Options header present"
else
  warn "X-Content-Type-Options header missing"
fi

# Check X-Frame-Options
if echo "$HEADERS" | grep -qi "x-frame-options"; then
  ok "X-Frame-Options header present"
else
  warn "X-Frame-Options header missing"
fi

echo ""
echo "5. Mixed Content Check"
echo "----------------------"
echo "(This check requires browser inspection for full accuracy)"

# Basic check - look for http:// in HTML
HTML=$(curl -s --max-time $TIMEOUT "https://$DOMAIN" 2>/dev/null | head -200)
HTTP_REFS=$(echo "$HTML" | grep -o 'http://[^"'"'"' ]*' | grep -v "http://www.w3.org" | head -5)

if [ -n "$HTTP_REFS" ]; then
  warn "Potential mixed content found:"
  echo "$HTTP_REFS"
else
  ok "No obvious mixed content in initial HTML"
fi

echo ""
echo "========================================"
if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}ISSUES FOUND${NC}: $ERRORS error(s)"
  exit 1
else
  echo -e "${GREEN}PASSED${NC}: SSL verification complete"
fi
echo "========================================"
