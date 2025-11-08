"use client";

import { Coins, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CreditBadge() {
  const { balance, loading, isLow, isEmpty } = useCredits();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (balance === null) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => router.push('/credits')}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium transition-colors hover:bg-accent",
              isEmpty
                ? "border-destructive bg-destructive/10 text-destructive"
                : isLow
                ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                : "border-border bg-background text-foreground"
            )}
          >
            <Coins
              className={cn(
                "h-3.5 w-3.5",
                isEmpty
                  ? "text-destructive"
                  : isLow
                  ? "text-yellow-600 dark:text-yellow-400"
                  : "text-primary"
              )}
            />
            <span className="tabular-nums">{balance}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isEmpty
              ? "Out of credits! Click to purchase more."
              : isLow
              ? "Running low on credits. Click to top up."
              : `${balance} credits remaining. Click to manage.`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
