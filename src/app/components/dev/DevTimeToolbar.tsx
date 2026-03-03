import React, { useState, useRef, useEffect } from 'react';
import { Clock, Database, ChevronLeft, ChevronRight, FastForward } from 'lucide-react';
import { useDevTime, type SpeedMultiplier } from '@/app/contexts/DevTimeContext';
import { Button } from '@/app/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getPolicy } from '@/lib/services/policy.service';

const SPEEDS: { value: SpeedMultiplier; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 60, label: '60x' },
];

const DRAG_THRESHOLD = 5;

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function DevTimeToolbar() {
  const devTime = useDevTime();
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [workEndTime, setWorkEndTime] = useState<string | null>(null);

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window === 'undefined') return { x: 16, y: 200 };
    return { x: 16, y: window.innerHeight - 56 - 16 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const didDrag = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: PointerEvent) => {
      const start = dragStart.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) didDrag.current = true;
      setPosition({ x: start.startX + dx, y: start.startY + dy });
    };
    const onUp = () => {
      if (didDrag.current) suppressClickRef.current = true;
      dragStart.current = null;
      didDrag.current = false;
      setIsDragging(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isDragging]);

  useEffect(() => {
    let cancelled = false;
    getPolicy()
      .then((policy) => {
        if (!cancelled && policy?.work_end_time) {
          setWorkEndTime(policy.work_end_time);
        }
      })
      .catch(() => {
        // ignore; skip button will show a toast if used without policy
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!devTime) return null;

  const { isOverrideActive, override, setOverride } = devTime;

  // Defaults should always be based on real current time,
  // regardless of any active dev-time override.
  const realNow = new Date();
  const dateStr = `${realNow.getFullYear()}-${String(realNow.getMonth() + 1).padStart(2, '0')}-${String(realNow.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(realNow.getHours()).padStart(2, '0')}:${String(realNow.getMinutes()).padStart(2, '0')}`;

  // If there is an override time but it is invalid (e.g. legacy '--:--'),
  // fall back to the real current time so the input never shows an empty/placeholder value.
  const overrideTime = override?.time;
  const effectiveTime =
    overrideTime && /^\d{2}:\d{2}$/.test(overrideTime) ? overrideTime : timeStr;

  const handleTriggerPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y,
    };
    didDrag.current = false;
    setIsDragging(true);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke('dev-seed-attendance', {
        method: 'POST',
      });
      if (error) throw error;
      toast.success(data?.message ?? `Seeded ${data?.daysCreated ?? '?'} days`);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Seed failed';
      toast.error(msg);
    } finally {
      setSeeding(false);
    }
  };

  const handleSkipToEndOfDay = () => {
    if (!workEndTime) {
      toast.error('لا يوجد وقت نهاية دوام محدد في الإعدادات');
      return;
    }

    const baseDate = override?.date ?? dateStr;

    // workEndTime comes from Postgres TIME, typically "HH:MM:SS" (or "HH:MM").
    // Parse it safely and compute "3 seconds before" while staying on the same day.
    const [hStr, mStr = '0', sStr = '0'] = workEndTime.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const s = Number(sStr);

    if ([h, m, s].some((v) => Number.isNaN(v))) {
      toast.error('وقت نهاية الدوام غير صالح');
      return;
    }

    let totalSeconds = h * 3600 + m * 60 + s;
    totalSeconds = Math.max(0, totalSeconds - 3);

    const newH = Math.floor(totalSeconds / 3600);
    const newM = Math.floor((totalSeconds % 3600) / 60);

    const hh = String(newH).padStart(2, '0');
    const mm = String(newM).padStart(2, '0');
    const newDate = baseDate;
    const newTime = `${hh}:${mm}`;

    // Jump to just before the end of the workday on the same selected day, at normal speed.
    setOverride(newDate, newTime, 1);
  };

  const goPrevDay = () => {
    const d = override?.date ?? dateStr;
    setOverride(addDays(d, -1), effectiveTime, override?.speed ?? 1);
  };

  const goNextDay = () => {
    const d = override?.date ?? dateStr;
    setOverride(addDays(d, 1), effectiveTime, override?.speed ?? 1);
  };

  return (
    <div
      className="fixed z-[9999] w-10 h-10"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handleTriggerPointerDown}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full shadow-lg border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 cursor-grab active:cursor-grabbing"
            title="Dev time & seed (drag to move)"
            onClick={handleTriggerClick}
          >
            <Clock className="h-5 w-5 text-amber-600" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" side="top" className="w-72">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Dev time</span>
              {isOverrideActive && (
                <span className="text-xs text-amber-600">Override on</span>
              )}
            </div>

            <div className="grid gap-2">
              <Label className="text-xs">Date</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={goPrevDay}
                  title="Previous day"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  className="flex-1"
                  value={override?.date ?? dateStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOverride(v, effectiveTime, override?.speed ?? 1);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={goNextDay}
                  title="Next day"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={effectiveTime}
                onChange={(e) => {
                  const v = e.target.value;
                  setOverride(override?.date ?? dateStr, v || timeStr, override?.speed ?? 1);
                }}
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Speed</Label>
              <div className="flex gap-1">
                {SPEEDS.map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={override?.speed === value ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      setOverride(
                        override?.date ?? dateStr,
                        effectiveTime,
                        value
                      )
                    }
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSkipToEndOfDay}
              title="Skip to last 3 seconds of the day"
            >
              <FastForward className="h-4 w-4 mr-1" />
              Skip to day end (3s left)
            </Button>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs text-muted-foreground">Dev seed</Label>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={handleSeed}
                disabled={seeding}
              >
                <Database className="h-4 w-4 mr-1" />
                {seeding ? 'Seeding…' : 'Seed 1 month attendance'}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
