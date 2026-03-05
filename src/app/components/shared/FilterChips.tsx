import React from 'react';

type FilterTab<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

interface FilterChipsProps<T extends string> {
  tabs: FilterTab<T>[];
  activeValue: T;
  onChange: (value: T) => void;
}

export function FilterChips<T extends string>({
  tabs,
  activeValue,
  onChange,
}: FilterChipsProps<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const active = tab.value === activeValue;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              active
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                  active ? 'bg-white/20' : 'bg-amber-100 text-amber-600'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

