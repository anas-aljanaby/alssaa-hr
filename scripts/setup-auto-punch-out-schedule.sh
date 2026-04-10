#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PROJECT_REF="${1:-$(cat supabase/.temp/project-ref)}"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
JOB_NAME="auto-punch-out-every-minute"

API_KEYS_JSON="$(supabase projects api-keys --output json --project-ref "$PROJECT_REF")"
SERVICE_ROLE_KEY="$(
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
      url := '${PROJECT_URL}/functions/v1/auto-punch-out',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ${SERVICE_ROLE_KEY}'
      ),
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now()),
      timeout_milliseconds := 10000
    ) as request_id
  \$\$
);
SQL

supabase db query --linked "$SQL"

echo "Configured cron job '${JOB_NAME}' for project ${PROJECT_REF}."
