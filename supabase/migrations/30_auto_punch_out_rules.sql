-- Add auto_punch_out_rules JSONB column to attendance_policy
-- Each rule: { id, title, time, sessionType ('all' | 'overtime' | 'regular'), enabled }
ALTER TABLE attendance_policy
ADD COLUMN IF NOT EXISTS auto_punch_out_rules JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed a default 3 am overtime-only auto punch-out rule (disabled by default)
UPDATE attendance_policy
SET auto_punch_out_rules = '[
  {
    "id": "default-3am-overtime",
    "title": "انصراف تلقائي 3 صباحاً (عمل إضافي)",
    "time": "03:00",
    "sessionType": "overtime",
    "enabled": false
  }
]'::jsonb
WHERE auto_punch_out_rules = '[]'::jsonb;
