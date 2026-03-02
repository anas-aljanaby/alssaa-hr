#!/usr/bin/env bash
# Deploy all Supabase Edge Functions used by the app.
# Run from repo root. Requires: supabase CLI, project linked (supabase link).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

FUNCTIONS=(invite-user dev-seed-attendance dev-reset-attendance)

echo "Deploying Edge Functions..."
for fn in "${FUNCTIONS[@]}"; do
  echo "  → $fn"
  supabase functions deploy "$fn"
done
echo "Done."
