/**
 * Module purpose:
 * Renders a reusable, count-aware attendance chip bar for filterable status views.
 */

import { getStatusConfig, type ChipConfig } from '../attendance';

export interface StatusCountChipsProps {
  chips: ChipConfig[];
  counts: Record<string, number>;
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

function getActiveChipClasses(chip: ChipConfig): string {
  const primaryStatus = chip.themeStatus ?? chip.matchStatuses?.[0];
  if (!primaryStatus) {
    return 'bg-slate-700 text-white border-slate-700';
  }

  const config = getStatusConfig(primaryStatus);
  return [config.dotColor, 'text-white border-transparent'].join(' ');
}

export function StatusCountChips({
  chips,
  counts,
  activeKey,
  onSelect,
  className,
}: StatusCountChipsProps) {
  const wrapperClasses = [
    'overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClasses} dir="rtl">
      <div className="flex min-w-max gap-2">
        {chips.map((chip) => {
          const count = counts[chip.key] ?? 0;
          const active = chip.key === activeKey;
          const buttonClasses = [
            'min-w-fit whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
            active
              ? getActiveChipClasses(chip)
              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50',
            count === 0 ? 'opacity-60' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const countClasses = [
            'rounded-full px-1.5 py-0.5 text-xs leading-none',
            active ? 'bg-white/15 text-white' : count === 0 ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-500',
          ].join(' ');

          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onSelect(chip.key)}
              className={buttonClasses}
            >
              <span className="inline-flex items-center gap-1.5">
                <span>{chip.label}</span>
                <span className={countClasses}>{count}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
