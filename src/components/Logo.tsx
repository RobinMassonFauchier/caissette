import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/25">
        <ReceiptText className="size-5" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="text-[17px] font-semibold tracking-tight text-stone-900">
          Caissette
        </span>
      )}
    </span>
  );
}
