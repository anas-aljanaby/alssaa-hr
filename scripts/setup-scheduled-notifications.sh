#!/usr/bin/env bash
# Sets up a pg_cron job to call the send-scheduled-notifications edge function
# every minute — mirrors the setup-auto-punch-out-schedule.sh pattern.
#
# Usage:
#   ./scripts/setup-scheduled-notifications.sh [PROJECT_REF]
#
# The AUTO_PUNCH_OUT_CRON_TOKEN env var is reused as auth for this function too.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_REF="${1:-$(cat supabase/.temp/project-ref)}"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
JOB_NAME="send-scheduled-notifications-every-minute"
CRON_TOKEN="${AUTO_PUNCH_OUT_CRON_TOKEN:-}"

if [[ -z "$CRON_TOKEN" ]]; then
  API_KEYS_JSON="$(supabase projects api-keys --output json --project-ref "$PROJECT_REF")"
  CRON_TOKEN="$(
    node -e "
const keys = JSON.parse(process.argv[1]);
const serviceRole = keys.find((key) => key.id === 'service_role');
if (!serviceRole?.api_key) {
  console.error('Could not find legacy service_role key for project.');
  process.exit(1);
}
process.stdout.write(serviceRole.api_key);
" "$API_KEYS_JSON"
  )"
fi

read -r -d '' SQL <<SQL || true
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid)
from cron.job
where jobname = '${JOB_NAME}';

select cron.schedule(
  '${JOB_NAME}',
  '* * * * *',
  \$\$
  select
    net.http_post(
      url := '${PROJECT_URL}/functions/v1/send-scheduled-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${CRON_TOKEN}'
      ),
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now()),
      timeout_milliseconds := 10000
    ) as request_id
  \$\$
);
SQL

supabase db query --linked "$SQL"

echo "Configured cron job '${JOB_NAME}' for project ${PROJECT_REF}."
echo ""
echo "Optional: to enable web push notifications, set the following Supabase secrets:"
echo "  supabase secrets set VAPID_PUBLIC_KEY=<your-public-key>"
echo "  supabase secrets set VAPID_PRIVATE_KEY=<your-private-key>"
echo "  supabase secrets set VAPID_SUBJECT=mailto:<your-email>"
echo ""
echo "Generate VAPID keys with: npx web-push generate-vapid-keys"
echo "Then add VITE_VAPID_PUBLIC_KEY=<public-key> to your .env file."
