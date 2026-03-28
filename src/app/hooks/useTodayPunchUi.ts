import { useEffect, useState } from 'react';
import {
  getTodayPunchUiState,
  type TodayPunchUiState,
  type TodayRecord,
} from '@/lib/services/attendance.service';
import { now } from '@/lib/time';

/** Keeps punch CTA/badge state in sync with wall clock when a shift exists (matches TodayStatusCard tick). */
export function useTodayPunchUi(today: TodayRecord): TodayPunchUiState {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!today.shift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [today.shift]);

  return getTodayPunchUiState(today, now());
}
