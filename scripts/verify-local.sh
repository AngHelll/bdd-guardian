#!/usr/bin/env bash
# Capa A: verificación automática local (sin UI VS Code).
# Capa B: imprime checklist manual fijo + hint de spec extras.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SPEC_HINT="${1:-}"

echo "== BDD Guardian verify:local (Capa A) =="

echo ""
echo "-- lint --"
npm run lint

echo ""
echo "-- unit tests (compile + vitest) --"
npm test

echo ""
echo "-- package VSIX --"
npm run package
if [[ ! -f bdd-guardian.vsix ]]; then
  echo "error: bdd-guardian.vsix not found" >&2
  exit 1
fi
echo "VSIX OK: bdd-guardian.vsix ($(wc -c < bdd-guardian.vsix | tr -d ' ') bytes)"

echo ""
echo "=============================================="
echo "  CAPA B — CHECKLIST MANUAL (tu intervención)"
echo "=============================================="
echo ""
echo "  [ ] 1. Instalar bdd-guardian.vsix"
echo "         Cursor → Extensions → ... → Install from VSIX..."
echo "         Ruta: $ROOT/bdd-guardian.vsix"
echo ""
echo "  [ ] 2. Abrir workspace samples/binding-demo"
echo "         Status bar: Indexing… → Ready"
echo ""
echo "  [ ] 3. CodeLens + navegación"
echo "         CodeLens ✅ en un step · Go to Definition abre SampleSteps.cs"
echo ""
if [[ -n "$SPEC_HINT" ]]; then
  echo "  Extras de spec: docs-internal/specs/$SPEC_HINT"
  echo ""
fi
echo "  Cuando OK: di \"verificado, ship\" o pide más cambios."
echo "  Git (commit/push/tag): solo con orden explícita."
echo ""
echo "  Tras ship docs + Capa B OK:"
echo "  npm run publish:check        # Capa C preflight (VSCE_PAT en config/maintainer.local)"
echo "  npm run publish:marketplace  # solo con orden explícita \"publish\""
echo ""
