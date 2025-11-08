"use server";

import { createClient } from "@/utils/supabase/server";
import { InsufficientCreditsError } from "./credits-types";

// Re-export for convenience
export { InsufficientCreditsError };

/**
 * Get current credit balance for a user
 */
export async function getUserCredits(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();

  if (error) {
    // If user doesn't exist in credits table, initialize them
    if (error.code === "PGRST116") {
      const { data: newData, error: insertError } = await supabase
        .from("user_credits")
        .insert({ user_id: userId, balance: 50 })
        .select("balance")
        .single();

      if (insertError) throw insertError;
      return newData.balance;
    }
    throw error;
  }

  return data.balance;
}

/**
 * Check if user has enough credits
 */
export async function hasEnoughCredits(
  userId: string,
  amount: number
): Promise<boolean> {
  const balance = await getUserCredits(userId);
  return balance >= amount;
}

/**
 * Deduct credits from user balance (atomic operation)
 * Throws InsufficientCreditsError if balance is insufficient
 */
export async function deductCredits(
  userId: string,
  amount: number,
  operation: string
): Promise<number> {
  const supabase = await createClient();

  // First check if user has enough credits
  const currentBalance = await getUserCredits(userId);
  if (currentBalance < amount) {
    throw new InsufficientCreditsError(amount, currentBalance);
  }

  // Atomic deduction with WHERE clause to prevent race conditions
  const { data, error } = await supabase.rpc("deduct_credits", {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    // If RPC doesn't exist yet, fall back to direct UPDATE
    const { data: updateData, error: updateError } = await supabase
      .from("user_credits")
      .update({ balance: currentBalance - amount })
      .eq("user_id", userId)
      .eq("balance", currentBalance) // Optimistic locking
      .select("balance")
      .single();

    if (updateError) throw updateError;
    return updateData.balance;
  }

  return data;
}
