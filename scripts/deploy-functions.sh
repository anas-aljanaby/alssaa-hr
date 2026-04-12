#!/usr/bin/env bash
# Deploy all Supabase Edge Functions used by the app.
# Run from repo root. Requires: supabase CLI, project linked (supabase link).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

FUNCTIONS=(invite-user delete-user auto-punch-out mark-absent)

echo "Deploying Edge Functions..."
for fn in "${FUNCTIONS[@]}"; do
  echo "  → $fn"
  if [[ "$fn" == "invite-user" || "$fn" == "delete-user" ]]; then
    # invite-user/delete-user perform auth/role checks internally; disable gateway JWT verification
    # to avoid "Invalid JWT" rejections for valid authenticated user tokens.
    supabase functions deploy "$fn" --no-verify-jwt
  else
    supabase functions deploy "$fn"
  fi
done
echo "Done."
