"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger
    data-slot="select-trigger"
    className={cn("flex h-10 min-w-28 cursor-pointer items-center justify-between gap-3 rounded-lg border border-[#a8b9a9] bg-white px-3 text-sm font-medium text-[#20372b] shadow-sm outline-none transition-colors hover:border-[#56806a] hover:bg-[#f4f8f2] focus-visible:ring-2 focus-visible:ring-[#56806a] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)}
    {...props}
  >{children}<SelectPrimitive.Icon asChild><ChevronDown className="size-4 text-[#56806a]" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}

function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content
    data-slot="select-content"
    position="popper"
    sideOffset={5}
    className={cn("z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-[#cbd2c7] bg-white p-1 text-[#20372b] shadow-lg", className)}
    {...props}
  >
    <SelectPrimitive.ScrollUpButton className="flex justify-center py-1"><ChevronUp className="size-4" /></SelectPrimitive.ScrollUpButton>
    <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    <SelectPrimitive.ScrollDownButton className="flex justify-center py-1"><ChevronDown className="size-4" /></SelectPrimitive.ScrollDownButton>
  </SelectPrimitive.Content></SelectPrimitive.Portal>;
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item
    data-slot="select-item"
    className={cn("relative flex cursor-pointer select-none items-center rounded-md py-2 pr-8 pl-3 text-sm outline-none focus:bg-[#e8eee7] data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40", className)}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-2"><Check className="size-4 text-[#285640]" /></SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>;
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
