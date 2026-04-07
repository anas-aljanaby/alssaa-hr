import type { CSSProperties } from 'react';

export const DEPARTMENT_COLOR_VALUES = [
  '#2563EB',
  '#059669',
  '#D97706',
  '#DB2777',
  '#7C3AED',
  '#0891B2',
] as const;

export type DepartmentColorValue = (typeof DEPARTMENT_COLOR_VALUES)[number];

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeDepartmentColor(color: string | null | undefined): DepartmentColorValue {
  if (color && DEPARTMENT_COLOR_VALUES.includes(color as DepartmentColorValue)) {
    return color as DepartmentColorValue;
  }

  return DEPARTMENT_COLOR_VALUES[0];
}

export function getNextDepartmentColor(
  existingColors: Array<string | null | undefined>
): DepartmentColorValue {
  const counts = new Map<DepartmentColorValue, number>(
    DEPARTMENT_COLOR_VALUES.map((color) => [color, 0])
  );

  existingColors.forEach((color) => {
    const normalized = normalizeDepartmentColor(color);
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return DEPARTMENT_COLOR_VALUES.reduce((selected, current) => {
    const selectedCount = counts.get(selected) ?? 0;
    const currentCount = counts.get(current) ?? 0;
    return currentCount < selectedCount ? current : selected;
  }, DEPARTMENT_COLOR_VALUES[0]);
}

export function getDepartmentColorTokens(color: string | null | undefined): {
  value: DepartmentColorValue;
  iconStyle: CSSProperties;
  cardStyle: CSSProperties;
  rowStyle: CSSProperties;
  headerStyle: CSSProperties;
  sectionAccentStyle: CSSProperties;
} {
  const value = normalizeDepartmentColor(color);

  return {
    value,
    iconStyle: {
      backgroundColor: hexToRgba(value, 0.12),
      color: value,
    },
    cardStyle: {
      backgroundColor: hexToRgba(value, 0.07),
      borderColor: hexToRgba(value, 0.16),
    },
    rowStyle: {
      backgroundColor: hexToRgba(value, 0.08),
      borderColor: hexToRgba(value, 0.16),
    },
    headerStyle: {
      background: `linear-gradient(135deg, ${hexToRgba(value, 0.14)} 0%, ${hexToRgba(
        value,
        0.05
      )} 48%, rgba(255, 255, 255, 0.98) 100%)`,
      borderColor: hexToRgba(value, 0.2),
    },
    sectionAccentStyle: {
      boxShadow: `inset 3px 0 0 ${hexToRgba(value, 0.9)}`,
    },
  };
}
