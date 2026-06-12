#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAIL=0

check() {
  local desc="$1"
  local pattern="$2"
  local dirs="${3:-.}"
  local excludes="${4:-node_modules dist .git coverage}"

  local exclude_args=()
  for ex in $excludes; do
    exclude_args+=(--exclude-dir="$ex")
  done

  local matches
  matches=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" \
    "${exclude_args[@]}" -l "$pattern" $dirs 2>/dev/null || true)

  if [ -n "$matches" ]; then
    echo -e "${RED}FAIL${NC} $desc"
    echo "$matches" | sed 's/^/       /'
    FAIL=1
  else
    echo -e "${GREEN}PASS${NC} $desc"
  fi
}

echo "Velo pre-launch security audit"
echo "================================"
echo ""

echo "--- Secrets & keys ---"
check "No sk_live_ keys in source" 'sk_live_[a-zA-Z0-9]' "velo-backend velo-frontend velo-sdk"
check "No hardcoded JWT secrets" 'jwt.*secret.*=.*['\''"][a-zA-Z0-9]' "velo-backend"
check "No hardcoded database URLs with credentials" 'postgresql://[^:]+:[^@]+@' "velo-backend"

echo ""
echo "--- Storage security ---"
check "No sessionStorage usage" 'sessionStorage' "velo-frontend"
check "No localStorage for tokens" 'localStorage\.(setItem|getItem).*[Tt]oken' "velo-frontend"
check "No localStorage for auth" 'localStorage\.(setItem|getItem).*[Aa]uth' "velo-frontend"

echo ""
echo "--- postMessage security ---"
check "No postMessage with wildcard origin" "postMessage.*'\*'" "velo-frontend velo-sdk"
check "No postMessage with wildcard origin (double quote)" 'postMessage.*"\*"' "velo-frontend velo-sdk"

echo ""
echo "--- CORS security ---"
check "No CORS origin:true" 'origin:\s*true' "velo-backend"
check "No CORS origin wildcard" "origin:\s*['\"]\\*['\"]" "velo-backend"

echo ""
echo "--- SSRF prevention ---"
check "Webhook fetch uses redirect:error" '' . . 2>/dev/null || true
# Positive check — ensure redirect:'error' exists in webhooks service
if grep -q "redirect.*error" velo-backend/src/webhooks/webhooks.service.ts 2>/dev/null; then
  echo -e "${GREEN}PASS${NC} webhook fetch has redirect:'error'"
else
  echo -e "${RED}FAIL${NC} webhook fetch missing redirect:'error' in webhooks.service.ts"
  FAIL=1
fi

echo ""
echo "--- API key security ---"
if grep -q "createApiKey" velo-backend/src/auth/auth.service.ts 2>/dev/null; then
  if grep -q "SHA-256\|sha256\|createHash" velo-backend/src/auth/auth.service.ts 2>/dev/null; then
    echo -e "${GREEN}PASS${NC} API keys hashed before storage"
  else
    echo -e "${RED}FAIL${NC} API key storage may not be hashed"
    FAIL=1
  fi
fi

echo ""
echo "--- Environment variables ---"
if [ -f .env ]; then
  echo -e "${YELLOW}WARN${NC} .env file exists — ensure it is in .gitignore"
  if grep -q "^\.env" .gitignore 2>/dev/null; then
    echo -e "${GREEN}PASS${NC} .env is gitignored"
  else
    echo -e "${RED}FAIL${NC} .env is NOT in .gitignore"
    FAIL=1
  fi
fi

echo ""
echo "================================"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}All checks passed — ready for launch${NC}"
  exit 0
else
  echo -e "${RED}Audit failed — fix issues before launching${NC}"
  exit 1
fi
