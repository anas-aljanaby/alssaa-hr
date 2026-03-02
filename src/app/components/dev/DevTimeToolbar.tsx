import React, { useState } from 'react';
import { Clock, RotateCcw, Database } from 'lucide-react';
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

const SPEEDS: { value: SpeedMultiplier; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 10, label: '10x' },
  { value: 60, label: '60x' },
];

export function DevTimeToolbar() {
  const devTime = useDevTime();
  const [open, setOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  if (!devTime) return null;

  const { isOverrideActive, override, setOverride, reset, now } = devTime;
  const current = now();
  const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(current.getHours()).padStart(2, '0')}:${String(current.getMinutes()).padStart(2, '0')}`;

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-[9999] h-10 w-10 rounded-full shadow-lg border-2 border-amber-400 bg-amber-50 hover:bg-amber-100"
          title="Dev time & seed"
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
            <Input
              type="date"
              value={override?.date ?? dateStr}
              onChange={(e) => {
                const v = e.target.value;
                setOverride(v, override?.time ?? timeStr, override?.speed ?? 1);
              }}
            />
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

          <div className="border-t pt-3">
            <Label className="text-xs text-muted-foreground">Dev seed</Label>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-1"
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
  );
}
