import React, { useEffect, useState } from 'react';
import {
  getDayScheduleValidationIssue,
  isOvernightDaySchedule,
  type DayKey,
  type DaySchedule,
  type WorkSchedule,
} from './workSchedule';

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
const FIELD_LABELS = {
  start: 'وقت البداية',
  end: 'وقت النهاية',
} as const;

const TIME_INPUT_CLASS =
  'w-24 max-w-full px-2.5 py-1.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none text-sm font-medium transition-all text-center';

function isInvalid(schedule: DaySchedule | undefined): boolean {
  return getDayScheduleValidationIssue(schedule) !== null;
}

export interface WorkScheduleEditorProps {
  value: WorkSchedule;
  onChange: (next: WorkSchedule) => void;
  disabled?: boolean;
}

export function WorkScheduleEditor({ value, onChange, disabled = false }: WorkScheduleEditorProps) {
  const [selectedDayKey, setSelectedDayKey] = useState<DayKey | null>(null);

  useEffect(() => {
    if (selectedDayKey && !value[selectedDayKey]) {
      setSelectedDayKey(null);
    }
  }, [selectedDayKey, value]);

  const sourceTemplate = selectedDayKey ? value[selectedDayKey] ?? null : null;

  function toggleDay(key: DayKey) {
    const next: WorkSchedule = { ...value };
    if (next[key]) {
      delete next[key];
      if (selectedDayKey === key) setSelectedDayKey(null);
    } else {
      next[key] = { start: DEFAULT_START, end: DEFAULT_END };
      setSelectedDayKey(key);
    }
    onChange(next);
  }

  function updateDay(
    key: DayKey,
    field: keyof typeof FIELD_LABELS,
    fieldValue: string,
  ) {
    const current = value[key];
    if (!current) return;
    const next: WorkSchedule = {
      ...value,
      [key]: { ...current, [field]: fieldValue },
    };
    setSelectedDayKey(key);
    onChange(next);
  }

  function applySameTimesToAll() {
    if (!selectedDayKey || !sourceTemplate) return;
    const next: WorkSchedule = {};
    for (const { key } of DAY_LABELS) {
      if (value[key]) {
        next[key] = { start: sourceTemplate.start, end: sourceTemplate.end };
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
        const issue = getDayScheduleValidationIssue(day);
        const isSelectedDay = selectedDayKey === key && active;
        return (
          <div
            key={key}
            role={active ? 'button' : undefined}
            tabIndex={active && !disabled ? 0 : undefined}
            data-testid={`schedule-row-${key}`}
            data-selected={isSelectedDay ? 'true' : 'false'}
            onClick={() => {
              if (!active || disabled) return;
              setSelectedDayKey(key);
            }}
            onKeyDown={(event) => {
              if (!active || disabled) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelectedDayKey(key);
              }
            }}
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-2xl border transition-all ${
              active
                ? isSelectedDay
                  ? 'border-blue-200 bg-gradient-to-l from-blue-50/80 via-white to-white shadow-[0_10px_25px_rgba(59,130,246,0.08)]'
                  : 'bg-white border-gray-200'
                : 'bg-gray-50 border-gray-100'
            } ${invalid ? 'ring-2 ring-red-300' : isSelectedDay ? 'ring-2 ring-blue-100' : ''} ${
              active && !disabled ? 'cursor-pointer' : ''
            }`}
          >
            <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={active}
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
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

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:flex-1 sm:w-auto">
              {active && day ? (
                <>
                  <input
                    type="time"
                    dir="ltr"
                    disabled={disabled}
                    value={day.start}
                    step={600}
                    aria-label={`${label} ${FIELD_LABELS.start}`}
                    data-testid={`schedule-${key}-start`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(e) => updateDay(key, 'start', e.target.value)}
                    className={TIME_INPUT_CLASS}
                  />
                  <span className="text-xs text-gray-400 font-medium">–</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="time"
                      dir="ltr"
                      disabled={disabled}
                      value={day.end}
                      step={600}
                      aria-label={`${label} ${FIELD_LABELS.end}`}
                      data-testid={`schedule-${key}-end`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(e) => updateDay(key, 'end', e.target.value)}
                      className={TIME_INPUT_CLASS}
                    />
                    {isOvernightDaySchedule(day) && (
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1 py-0.5 whitespace-nowrap">
                        +1
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <span className="text-xs text-gray-400 font-medium">راحة</span>
              )}
            </div>

            {invalid && (
              <p className="w-full text-xs text-red-500 font-medium sm:pr-6">
                {issue?.message}
              </p>
            )}
          </div>
        );
      })}

      {workingDayCount > 1 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={applySameTimesToAll}
            disabled={disabled || !selectedDayKey}
            className="w-full text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 py-2.5 rounded-xl transition-colors font-medium disabled:opacity-50 disabled:hover:text-blue-600 disabled:hover:bg-blue-50"
          >
            تطبيق هذا الوقت على جميع الايام
          </button>
        </div>
      )}
    </div>
  );
}

export default WorkScheduleEditor;
