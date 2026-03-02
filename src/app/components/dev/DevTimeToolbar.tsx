import React, { useState, useRef, useEffect } from 'react';
import { Clock, RotateCcw, Database, ChevronLeft, ChevronRight, Trash2, Check } from 'lucide-react';
import { useDevTime, type SpeedMultiplier, DEV_TIME_STORAGE_KEY } from '@/app/contexts/DevTimeContext';
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

const SPEEDS: { value: SpeedMultiplier; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 10, label: '10x' },
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
  const [resetting, setResetting] = useState(false);

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

  if (!devTime) return null;

  const { isOverrideActive, override, setOverride, reset, now } = devTime;
  const current = now();
  const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;

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

  const handleResetDevData = async () => {
    setResetting(true);
    setOpen(false);
    try {
      const { data, error } = await supabase.functions.invoke('dev-reset-attendance', {
        method: 'POST',
      });
      if (error) throw error;
      reset();
      toast.success(data?.message ?? 'Dev data reset');
      setTimeout(() => window.location.reload(), 100);
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Reset failed';
      toast.error(msg);
    } finally {
      setResetting(false);
    }
  };

  const handleResetAllData = () => {
    setOpen(false);
    localStorage.removeItem(DEV_TIME_STORAGE_KEY);
    toast.success('Dev time reset — reloading…');
    // Force full reload so app reinitializes with no override
    setTimeout(() => {
      window.location.href = window.location.href;
    }, 100);
  };

  const handleConfirmReload = () => {
    setOpen(false);
    window.location.reload();
  };

  const goPrevDay = () => {
    const d = override?.date ?? dateStr;
    setOverride(addDays(d, -1), override?.time ?? timeStr, override?.speed ?? 1);
  };

  const goNextDay = () => {
    const d = override?.date ?? dateStr;
    setOverride(addDays(d, 1), override?.time ?? timeStr, override?.speed ?? 1);
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
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Input
                  type="date"
                  className="flex-1"
                  value={override?.date ?? dateStr}
                  onChange={(e) => {
                    const v = e.target.value;
                    setOverride(v, override?.time ?? timeStr, override?.speed ?? 1);
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs">Time</Label>
              <Input
                type="time"
                value={override?.time ?? timeStr}
                onChange={(e) => {
                  const v = e.target.value;
                  setOverride(override?.date ?? dateStr, v, override?.speed ?? 1);
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
                        override?.time ?? timeStr,
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
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to real time
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="w-full border-amber-200 bg-amber-50 hover:bg-amber-100"
              onClick={handleResetDevData}
              disabled={resetting}
              title="Delete dev attendance records, reset time override, and refresh"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {resetting ? 'Resetting…' : 'Reset Dev Data'}
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

            <div className="border-t pt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleResetAllData}
                title="Reset dev override and local state"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Reset all data
              </Button>
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={handleConfirmReload}
                title="Reload the site"
              >
                <Check className="h-4 w-4 mr-1" />
                Confirm
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
