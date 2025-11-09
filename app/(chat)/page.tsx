"use client";

import { Thread } from "@/components/chat/chat";
import React, { useEffect } from "react";
import { useThreads } from "@/providers/Thread";
import { useSearchParams } from "next/navigation";

export default function ChatHomePage(): React.ReactNode {
  const { setCurrentThreadId } = useThreads();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q');

  // Clear threadId when on home page
  useEffect(() => {
    setCurrentThreadId(null);
  }, [setCurrentThreadId]);

  return <Thread initialQuery={initialQuery || undefined} />;
}
