import React from 'react';
import type { DaySchedule, WorkSchedule } from './workSchedule';

const DAY_LABELS: { key: '0' | '1' | '2' | '3' | '4' | '5' | '6'; label: string }[] = [
  { key: '0', label: 'الأحد' },
  { key: '1', label: 'الاثنين' },
  { key: '2', label: 'الثلاثاء' },
  { key: '3', label: 'الأربعاء' },
  { key: '4', label: 'الخميس' },
  { key: '5', label: 'الجمعة' },
  { key: '6', label: 'السبت' },
];

const DEFAULT_START = '08:00';
const DEFAULT_END = '16:00';

const TIME_INPUT_CLASS =
  'w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-sm font-medium transition-colors text-center';

function isInvalid(schedule: DaySchedule | undefined): boolean {
  if (!schedule) return false;
  return !schedule.start || !schedule.end || schedule.end <= schedule.start;
}

export interface WorkScheduleEditorProps {
  value: WorkSchedule;
  onChange: (next: WorkSchedule) => void;
  disabled?: boolean;
}

export function WorkScheduleEditor({ value, onChange, disabled = false }: WorkScheduleEditorProps) {
  function toggleDay(key: '0' | '1' | '2' | '3' | '4' | '5' | '6') {
    const next: WorkSchedule = { ...value };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = { start: DEFAULT_START, end: DEFAULT_END };
    }
    onChange(next);
  }

  function updateDay(
    key: '0' | '1' | '2' | '3' | '4' | '5' | '6',
    patch: Partial<DaySchedule>,
  ) {
    const current = value[key];
    if (!current) return;
    const next: WorkSchedule = {
      ...value,
      [key]: { ...current, ...patch },
    };
    onChange(next);
  }

  function applySameTimesToAll() {
    const firstWorking = DAY_LABELS.find(({ key }) => value[key]);
    if (!firstWorking) return;
    const template = value[firstWorking.key]!;
    const next: WorkSchedule = {};
    for (const { key } of DAY_LABELS) {
      if (value[key]) {
        next[key] = { start: template.start, end: template.end };
      }
    }
    onChange(next);
  }

  const workingDayCount = DAY_LABELS.filter(({ key }) => value[key]).length;

  return (
    <div dir="rtl" className="space-y-2">
      {DAY_LABELS.map(({ key, label }) => {
        const day = value[key];
        const active = Boolean(day);
        const invalid = isInvalid(day);
        return (
          <div
            key={key}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
            } ${invalid ? 'ring-2 ring-red-300' : ''}`}
          >
            <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                disabled={disabled}
                onChange={() => toggleDay(key)}
                className="w-4 h-4 accent-blue-600"
              />
              <span
                className={`text-sm font-semibold ${
                  active ? 'text-gray-800' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </label>

            <div className="flex-1 flex items-center justify-end gap-2">
              {active && day ? (
                <>
                  <input
                    type="time"
                    dir="ltr"
                    disabled={disabled}
                    value={day.start}
                    onChange={(e) => updateDay(key, { start: e.target.value })}
                    className={TIME_INPUT_CLASS}
                  />
                  <span className="text-xs text-gray-400 font-medium">–</span>
                  <input
                    type="time"
                    dir="ltr"
                    disabled={disabled}
                    value={day.end}
                    onChange={(e) => updateDay(key, { end: e.target.value })}
                    className={TIME_INPUT_CLASS}
                  />
                </>
              ) : (
                <span className="text-xs text-gray-400 font-medium">راحة</span>
              )}
            </div>

            {invalid && (
              <p className="text-xs text-red-500 font-medium whitespace-nowrap">
                النهاية يجب أن تكون بعد البداية
              </p>
            )}
          </div>
        );
      })}

      {workingDayCount > 1 && (
        <button
          type="button"
          onClick={applySameTimesToAll}
          disabled={disabled}
          className="w-full text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
        >
          تطبيق نفس الوقت على جميع الأيام
        </button>
      )}
    </div>
  );
}

export default WorkScheduleEditor;
