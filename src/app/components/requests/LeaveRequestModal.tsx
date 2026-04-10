import React, { useEffect, useMemo, useState, type ChangeEvent, type RefObject } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Paperclip,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '@/app/components/ui/utils';
import type { LeaveRequestFormData } from '@/lib/validations';
import type { RequestType } from '@/lib/services/requests.service';

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const WEEKDAY_LABELS = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];
const numberFormatter = new Intl.NumberFormat('ar-IQ-u-nu-arab', { useGrouping: false });
const paddedNumberFormatter = new Intl.NumberFormat('ar-IQ-u-nu-arab', {
  minimumIntegerDigits: 2,
  useGrouping: false,
});

type AnnualRangeState = {
  start: string | null;
  end: string | null;
};

type RequestTypeOption = {
  value: RequestType;
  label: string;
};

type LeaveRequestModalProps = {
  attachmentFile: File | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  form: UseFormReturn<LeaveRequestFormData>;
  onAttachmentChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onAttachmentRemove: () => void;
  onClose: () => void;
  onSubmit: (data: LeaveRequestFormData) => Promise<void> | void;
  requestTypes: RequestTypeOption[];
  submitting: boolean;
  uploading: boolean;
  workStartTime: string;
};

function formatArabicNumber(value: number) {
  return numberFormatter.format(value);
}

function formatArabicPaddedNumber(value: number) {
  return paddedNumberFormatter.format(value);
}

function normalizeDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getCalendarCells(month: Date) {
  const firstDayOfMonth = startOfMonth(month);
  const firstWeekday = firstDayOfMonth.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  while (cells.length < 35) {
    cells.push(null);
  }

  return cells;
}

function getMonthLabel(date: Date) {
  return `${ARABIC_MONTHS[date.getMonth()]} ${formatArabicNumber(date.getFullYear())}`;
}

function formatArabicDate(isoDate: string) {
  const date = parseIsoDate(isoDate);
  return `${formatArabicNumber(date.getDate())} ${ARABIC_MONTHS[date.getMonth()]} ${formatArabicNumber(date.getFullYear())}`;
}

function formatRangeSummary(startIso: string, endIso: string | null) {
  if (!endIso || endIso === startIso) {
    return formatArabicDate(startIso);
  }
  return `${formatArabicDate(startIso)} — ${formatArabicDate(endIso)}`;
}

function getRangeEnd(range: AnnualRangeState) {
  return range.end ?? range.start;
}

function getInclusiveDayCount(startIso: string | null, endIso: string | null) {
  if (!startIso) return 0;
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso ?? startIso);
  const startTime = normalizeDate(start).getTime();
  const endTime = normalizeDate(end).getTime();
  return Math.floor((endTime - startTime) / 86_400_000) + 1;
}

function getArabicUnitLabel(
  count: number,
  options: { one: string; two: string; few: string; many: string }
) {
  if (count === 1) return options.one;
  if (count === 2) return options.two;
  if (count >= 3 && count <= 10) return `${formatArabicNumber(count)} ${options.few}`;
  return `${formatArabicNumber(count)} ${options.many}`;
}

function formatSelectedDaysLabel(count: number) {
  return getArabicUnitLabel(count, {
    one: 'يوم واحد',
    two: 'يومان',
    few: 'أيام',
    many: 'يوماً',
  });
}

function formatDurationLabel(totalMinutes: number) {
  if (totalMinutes <= 0) return '';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes === 0) {
    return getArabicUnitLabel(hours, {
      one: 'ساعة واحدة',
      two: 'ساعتان',
      few: 'ساعات',
      many: 'ساعة',
    });
  }

  if (hours === 0) {
    return getArabicUnitLabel(minutes, {
      one: 'دقيقة واحدة',
      two: 'دقيقتان',
      few: 'دقائق',
      many: 'دقيقة',
    });
  }

  const hourLabel = getArabicUnitLabel(hours, {
    one: 'ساعة واحدة',
    two: 'ساعتان',
    few: 'ساعات',
    many: 'ساعة',
  });
  const minuteLabel = getArabicUnitLabel(minutes, {
    one: 'دقيقة واحدة',
    two: 'دقيقتان',
    few: 'دقائق',
    many: 'دقيقة',
  });
  return `${hourLabel} و${minuteLabel}`;
}

function formatTimeLabel(value?: string) {
  const [rawHour = '08', rawMinute = '00'] = (value ?? '08:00').split(':');
  const hour24 = Number(rawHour);
  const minute = Number(rawMinute);
  const period = hour24 >= 12 ? 'م' : 'ص';
  const hour12 = hour24 % 12 || 12;
  return `${formatArabicNumber(hour12)}:${formatArabicPaddedNumber(minute)} ${period}`;
}

function getMinutesFromTime(value?: string) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function isWeekend(date: Date) {
  const weekday = date.getDay();
  return weekday === 5 || weekday === 6;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-slate-700">{children}</label>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500">{message}</p>;
}

function TimeInputField({
  error,
  label,
  onChange,
  value,
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  value?: string;
}) {
  return (
    <div className="space-y-3 rounded-[26px] border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <SectionLabel>{label}</SectionLabel>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          {formatTimeLabel(value)}
        </span>
      </div>

      <input
        type="time"
        step={300}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
      />

      <FieldError message={error} />
    </div>
  );
}

function AnnualLeaveSection({
  errors,
  onSelectDate,
  range,
}: {
  errors: LeaveRequestModalProps['form']['formState']['errors'];
  onSelectDate: (isoDate: string) => void;
  range: AnnualRangeState;
}) {
  const today = useMemo(() => normalizeDate(new Date()), []);
  const todayIso = useMemo(() => formatIsoDate(today), [today]);
  const initialMonth = range.start ? startOfMonth(parseIsoDate(range.start)) : startOfMonth(today);
  const [visibleMonth, setVisibleMonth] = useState(initialMonth);
  const selectedEnd = getRangeEnd(range);
  const selectedDays = getInclusiveDayCount(range.start, selectedEnd);
  const canGoToPreviousMonth = visibleMonth > startOfMonth(today);
  const cells = useMemo(() => getCalendarCells(visibleMonth), [visibleMonth]);

  useEffect(() => {
    if (!range.start) return;
    const selectedMonth = startOfMonth(parseIsoDate(range.start));
    if (
      selectedMonth.getFullYear() !== visibleMonth.getFullYear() ||
      selectedMonth.getMonth() !== visibleMonth.getMonth()
    ) {
      setVisibleMonth(selectedMonth);
    }
  }, [range.start, visibleMonth]);

  return (
    <section className="space-y-4 rounded-[28px] border border-blue-100 bg-linear-to-br from-blue-50 via-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-slate-900">أيام الإجازة السنوية</h3>
          <p className="text-sm leading-6 text-slate-600">
            اختر تاريخ البداية ثم النهاية من التقويم الظاهر أدناه.
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => canGoToPreviousMonth && setVisibleMonth((current) => addMonths(current, -1))}
            disabled={!canGoToPreviousMonth}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="الشهر السابق"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="text-center">
            <div className="text-sm font-semibold text-slate-900">{getMonthLabel(visibleMonth)}</div>
            <div className="text-xs text-slate-500">حدد النطاق مباشرة من الشبكة</div>
          </div>

          <button
            type="button"
            onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50"
            aria-label="الشهر التالي"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500">
          {WEEKDAY_LABELS.map((dayLabel, index) => (
            <div
              key={dayLabel}
              className={cn(
                'py-2',
                index >= 5 ? 'rounded-full bg-slate-100 text-slate-400' : ''
              )}
            >
              {dayLabel}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="aspect-square rounded-2xl" />;
            }

            const isoDate = formatIsoDate(day);
            const isPast = day < today;
            const isToday = isoDate === todayIso;
            const isSelected =
              Boolean(range.start) &&
              isoDate >= range.start! &&
              isoDate <= (selectedEnd ?? range.start!);
            const isRangeStart = isoDate === range.start;
            const isRangeEnd = isoDate === selectedEnd;
            const isSingleDay =
              Boolean(range.start) &&
              (!range.end || (range.start === range.end && isRangeStart && isRangeEnd));

            return (
              <div
                key={isoDate}
                className={cn(
                  'relative aspect-square rounded-2xl',
                  isWeekend(day) ? 'bg-slate-50/80' : ''
                )}
              >
                {isSelected && !isSingleDay && (
                  <span
                    className={cn(
                      'absolute inset-y-1 bg-blue-100',
                      isRangeStart
                        ? 'right-1/2 left-1 rounded-r-full'
                        : isRangeEnd
                          ? 'left-1/2 right-1 rounded-l-full'
                          : 'inset-x-0'
                    )}
                  />
                )}

                <button
                  type="button"
                  disabled={isPast}
                  onClick={() => onSelectDate(isoDate)}
                  aria-label={`اختيار ${formatArabicDate(isoDate)}`}
                  className={cn(
                    'relative z-10 flex h-full w-full items-center justify-center rounded-2xl text-sm font-medium transition',
                    isPast
                      ? 'cursor-not-allowed text-slate-300'
                      : 'text-slate-700 hover:bg-slate-100',
                    isWeekend(day) && !isSelected && !isPast ? 'text-slate-500' : '',
                    isSelected && !isRangeStart && !isRangeEnd ? 'bg-blue-100 text-blue-700 rounded-none hover:bg-blue-100' : '',
                    (isRangeStart || isRangeEnd) && 'rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-600',
                    isSingleDay && isRangeStart && 'rounded-full bg-blue-600 text-white'
                  )}
                >
                  <span>{formatArabicNumber(day.getDate())}</span>
                  {isToday && (
                    <span
                      className={cn(
                        'absolute bottom-1.5 h-1.5 w-1.5 rounded-full',
                        isSelected ? 'bg-white' : 'bg-blue-500'
                      )}
                    />
                  )}
                  {isToday && !isSelected && (
                    <span className="absolute inset-1 rounded-full ring-1 ring-blue-300" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-[24px] border border-blue-100 bg-white/90 p-3 shadow-sm">
        {range.start ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="flex-1 text-sm font-medium leading-6 text-slate-700">
              {formatRangeSummary(range.start, selectedEnd)}
            </p>
            <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
              {formatSelectedDaysLabel(selectedDays)}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">اختر أيام الإجازة من التقويم</p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <FieldError message={errors.fromDate?.message} />
          <FieldError message={errors.toDate?.message} />
        </div>
      </div>
    </section>
  );
}

function HourlyLeaveSection({
  form,
}: {
  form: UseFormReturn<LeaveRequestFormData>;
}) {
  const errors = form.formState.errors;
  const fromDate = form.watch('fromDate');
  const fromTime = form.watch('fromTime');
  const toTime = form.watch('toTime');
  const todayIso = useMemo(() => formatIsoDate(normalizeDate(new Date())), []);

  useEffect(() => {
    if (!fromDate) return;
    if (form.getValues('toDate') !== fromDate) {
      form.setValue('toDate', fromDate, { shouldValidate: true });
    }
  }, [form, fromDate]);

  const durationText = useMemo(() => {
    const fromMinutes = getMinutesFromTime(fromTime);
    const toMinutes = getMinutesFromTime(toTime);
    if (fromMinutes === null || toMinutes === null || toMinutes <= fromMinutes) return '';
    return formatDurationLabel(toMinutes - fromMinutes);
  }, [fromTime, toTime]);

  return (
    <section className="space-y-4 rounded-[28px] border border-amber-100 bg-linear-to-br from-amber-50 via-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
          <Clock3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-slate-900">الإجازة الساعية</h3>
          <p className="text-sm leading-6 text-slate-600">
            اختر اليوم ثم حدّد وقت البداية والنهاية لمعرفة المدة مباشرة.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel>التاريخ</SectionLabel>
        <input
          type="date"
          min={todayIso}
          lang="ar"
          value={fromDate}
          onChange={(event) => {
            form.setValue('fromDate', event.target.value, { shouldDirty: true, shouldValidate: true });
            form.setValue('toDate', event.target.value, { shouldDirty: true, shouldValidate: true });
          }}
          className={cn(
            'h-12 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100',
            errors.fromDate ? 'border-red-300' : 'border-slate-200'
          )}
        />
        <FieldError message={errors.fromDate?.message || errors.toDate?.message} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <TimeInputField
          label="من الساعة"
          value={fromTime}
          error={errors.fromTime?.message}
          onChange={(value) => {
            form.setValue('fromTime', value, { shouldDirty: true, shouldValidate: true });
            void form.trigger(['fromTime', 'toTime']);
          }}
        />
        <TimeInputField
          label="إلى الساعة"
          value={toTime}
          error={errors.toTime?.message}
          onChange={(value) => {
            form.setValue('toTime', value, { shouldDirty: true, shouldValidate: true });
            void form.trigger(['fromTime', 'toTime', 'toDate']);
          }}
        />
      </div>

      <div className="rounded-[24px] border border-amber-100 bg-white/90 p-3 shadow-sm">
        {durationText ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">
              {durationText}
            </span>
            <span className="text-sm text-slate-600">مدة الإجازة المحتسبة</span>
          </div>
        ) : (
          <p className="text-sm text-slate-500">سيتم احتساب المدة بعد اختيار وقت بداية ونهاية صالحين.</p>
        )}
      </div>
    </section>
  );
}

function SickLeaveSection({
  form,
}: {
  form: UseFormReturn<LeaveRequestFormData>;
}) {
  const errors = form.formState.errors;
  const todayIso = useMemo(() => formatIsoDate(normalizeDate(new Date())), []);

  return (
    <section className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">تفاصيل الإجازة المرضية</h3>
        <p className="text-sm leading-6 text-slate-600">حدّد تاريخ البداية والنهاية بالطريقة المعتادة.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <SectionLabel>من تاريخ</SectionLabel>
          <input
            type="date"
            min={todayIso}
            lang="ar"
            {...form.register('fromDate')}
            className={cn(
              'h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100',
              errors.fromDate ? 'border-red-300' : 'border-slate-200'
            )}
          />
          <FieldError message={errors.fromDate?.message} />
        </div>

        <div className="space-y-2">
          <SectionLabel>إلى تاريخ</SectionLabel>
          <input
            type="date"
            min={form.watch('fromDate') || todayIso}
            lang="ar"
            {...form.register('toDate')}
            className={cn(
              'h-12 w-full rounded-2xl border bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100',
              errors.toDate ? 'border-red-300' : 'border-slate-200'
            )}
          />
          <FieldError message={errors.toDate?.message} />
        </div>
      </div>
    </section>
  );
}

function TimeAdjustmentSection({
  form,
  workStartTime,
}: {
  form: UseFormReturn<LeaveRequestFormData>;
  workStartTime: string;
}) {
  const errors = form.formState.errors;
  const todayIso = useMemo(() => formatIsoDate(normalizeDate(new Date())), []);

  return (
    <section className="space-y-4 rounded-[28px] border border-emerald-100 bg-linear-to-br from-emerald-50 via-white to-slate-50 p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">تعديل وقت الحضور</h3>
        <p className="text-sm leading-6 text-slate-600">
          هذا الطلب يثبت حضورك على وقت بداية الدوام الرسمي عند نسيان تسجيل البصمة.
        </p>
      </div>

      <div className="space-y-2 rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm">
        <SectionLabel>التاريخ</SectionLabel>
        <input
          type="date"
          min={todayIso}
          lang="ar"
          {...form.register('fromDate')}
          className={cn(
            'h-12 w-full rounded-2xl border bg-slate-50 px-4 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100',
            errors.fromDate ? 'border-red-300' : 'border-slate-200'
          )}
        />
        <FieldError message={errors.fromDate?.message} />
      </div>

      <div className="rounded-[24px] border border-emerald-100 bg-white/90 p-3 text-sm leading-6 text-slate-600 shadow-sm">
        سيتم اعتماد بداية الدوام الرسمية تلقائياً عند الإرسال: <span className="font-semibold text-slate-900">{formatTimeLabel(workStartTime)}</span>
      </div>
    </section>
  );
}

export function LeaveRequestModal({
  attachmentFile,
  fileInputRef,
  form,
  onAttachmentChange,
  onAttachmentRemove,
  onClose,
  onSubmit,
  requestTypes,
  submitting,
  uploading,
  workStartTime,
}: LeaveRequestModalProps) {
  const requestType = form.watch('type');
  const errors = form.formState.errors;
  const [annualRange, setAnnualRange] = useState<AnnualRangeState>({
    start: form.getValues('fromDate') || null,
    end:
      form.getValues('toDate') && form.getValues('toDate') !== form.getValues('fromDate')
        ? form.getValues('toDate')
        : null,
  });

  useEffect(() => {
    if (requestType !== 'annual_leave') return;
    form.setValue('fromDate', annualRange.start ?? '', { shouldValidate: false });
    form.setValue('toDate', annualRange.start ? annualRange.end ?? annualRange.start : '', {
      shouldValidate: false,
    });
  }, [annualRange.end, annualRange.start, form, requestType]);

  const handleAnnualDateSelect = (isoDate: string) => {
    setAnnualRange((current) => {
      if (!current.start || current.end) {
        form.clearErrors(['fromDate', 'toDate']);
        return { start: isoDate, end: null };
      }

      const orderedRange =
        isoDate < current.start
          ? { start: isoDate, end: current.start }
          : { start: current.start, end: isoDate };

      form.clearErrors(['fromDate', 'toDate']);
      return orderedRange;
    });
  };

  const attachmentHasFile = Boolean(attachmentFile);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        dir="rtl"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[30px] border border-white/70 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.2)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">طلب جديد</h2>
            <p className="text-xs text-slate-500">اختر النوع ثم أكمل التفاصيل المناسبة له.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 p-5">
          <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 shadow-sm">
            <SectionLabel>نوع الطلب</SectionLabel>
            <select
              {...form.register('type')}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            >
              {requestTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </section>

          <div key={requestType} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {requestType === 'annual_leave' ? (
              <AnnualLeaveSection
                errors={errors}
                range={annualRange}
                onSelectDate={handleAnnualDateSelect}
              />
            ) : requestType === 'hourly_permission' ? (
              <HourlyLeaveSection form={form} />
            ) : requestType === 'time_adjustment' ? (
              <TimeAdjustmentSection form={form} workStartTime={workStartTime} />
            ) : (
              <SickLeaveSection form={form} />
            )}
          </div>

          <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
            <SectionLabel>ملاحظات</SectionLabel>
            <textarea
              rows={4}
              placeholder="اكتب ملاحظاتك هنا..."
              {...form.register('note')}
              className="w-full resize-none rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </section>

          <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <Paperclip className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">إرفاق ملف (اختياري)</h3>
                  <p className="text-xs text-slate-500">يمكنك إضافة تقرير أو صورة أو ملف PDF.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <Upload className="h-4 w-4" />
                {attachmentHasFile ? 'تغيير الملف' : 'اختيار ملف'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx"
              className="hidden"
              onChange={onAttachmentChange}
            />

            {attachmentHasFile ? (
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{attachmentFile?.name}</p>
                  <p className="text-xs text-slate-500">تم تجهيز الملف للإرسال مع الطلب.</p>
                </div>
                <button
                  type="button"
                  onClick={onAttachmentRemove}
                  className="shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100"
                >
                  إزالة
                </button>
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                لا يوجد ملف مرفق حالياً.
              </div>
            )}
          </section>

          <button
            type="submit"
            disabled={submitting}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? 'جاري رفع المرفق...' : submitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
          </button>
        </form>
      </div>
    </div>
  );
}
