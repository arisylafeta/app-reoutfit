"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins } from "lucide-react";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  required: number;
  available: number;
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  required,
  available,
}: InsufficientCreditsDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-destructive" />
            <AlertDialogTitle>Insufficient Credits</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            This operation requires <strong>{required} credits</strong>, but you
            only have <strong>{available} credits</strong> remaining.
            <br />
            <br />
            Please purchase more credits to continue using AI features.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Got it
          </AlertDialogAction>
          {/* TODO: Add "Purchase Credits" button when payment is implemented */}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
