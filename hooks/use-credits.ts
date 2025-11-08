"use client";

import { useEffect, useState } from "react";
import { getUserCredits } from "@/lib/db/credits";
import { createClient } from "@/utils/supabase/client";

export function useCredits() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Get initial user
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUserId(session.user.id);
        } else {
          setUserId(null);
          setBalance(null);
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch credits when userId changes
  useEffect(() => {
    if (!userId) {
      setBalance(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchCredits = async () => {
      try {
        setLoading(true);
        const credits = await getUserCredits(userId);
        if (!cancelled) {
          setBalance(credits);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCredits();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Subscribe to Realtime updates for credits
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    console.log('[CREDITS] 🔔 Subscribing to realtime updates for user:', userId);

    // Create a channel for this user's credits
    const channel = supabase
      .channel(`user-credits-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[CREDITS] 📬 Realtime update received:', payload);
          
          // Update balance from the new record
          if (payload.new && 'balance' in payload.new) {
            const newBalance = payload.new.balance as number;
            console.log('[CREDITS] ✅ Updating balance:', newBalance);
            setBalance(newBalance);
          }
        }
      )
      .subscribe((status) => {
        console.log('[CREDITS] 📡 Subscription status:', status);
      });

    return () => {
      console.log('[CREDITS] 🔕 Unsubscribing from realtime updates');
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return {
    balance,
    loading,
    error,
    isLow: balance !== null && balance < 10,
    isEmpty: balance === 0,
  };
}
