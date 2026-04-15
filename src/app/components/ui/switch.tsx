"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 rounded-full border border-transparent outline-none transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute top-1/2 block size-5 -translate-y-1/2 rounded-full bg-card shadow-sm ring-0 transition-[inset-inline-start] duration-200 ease-out [inset-inline-start:2px] data-[state=checked]:[inset-inline-start:calc(100%-1.25rem-2px)] dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-card-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
