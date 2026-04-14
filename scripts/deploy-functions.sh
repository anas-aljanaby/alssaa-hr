#!/usr/bin/env bash
# Deploy all Supabase Edge Functions used by the app.
# Run from repo root. Requires: supabase CLI, project linked (supabase link).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

FUNCTIONS=(invite-user delete-user punch auto-punch-out mark-absent send-scheduled-notifications send-test-notification)

echo "Deploying Edge Functions..."
for fn in "${FUNCTIONS[@]}"; do
  echo "  → $fn"
  # All current functions validate bearer tokens and roles inside the handler.
  # Disable gateway JWT verification to avoid Supabase gateway JWT mismatches
  # with otherwise valid tokens, and keep deployment behavior aligned with config.toml.
  supabase functions deploy "$fn" --no-verify-jwt
done
echo "Done."
