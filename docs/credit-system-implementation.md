# Credit System Implementation Plan

## Overview

Implement a credit-based system to track and limit AI operations across both frontend API routes and agent backend. Credits are stored in Supabase with hard stops when balance reaches zero.

## Design Decisions

✅ **Storage**: Credits stored in Supabase (shared database between app-reoutfit and agent)
✅ **Enforcement**: Hard stop with 402 error when insufficient credits
✅ **Caching**: Always charge credits, even for cached operations (consistent UX)
✅ **History**: Track current balance only (no transaction history table)
✅ **Concurrency**: Atomic deductions to prevent race conditions
✅ **Timing**: Credit checks BEFORE operations (fail fast)
✅ **Agent**: Deduct at tool execution, not artifact render

## Credit Costs

| Operation | Cost | Location |
|-----------|------|----------|
| Avatar generation | 5 credits | `/api/lookbook/generate-avatar` |
| Studio look generation | 3 credits | `/api/studio/generate-look` |
| Wardrobe prettify | 1 credit | `/api/wardrobe/prettify` |
| Product enrichment | 2 credits | `/api/products/enrich` |
| Shopping search | 1 credit | Agent backend (SerpAPI) |
| Lens search | 2 credits | Agent backend (SerpAPI) |

**Initial balance**: 50 credits on user signup

## Implementation Tasks

### 1. Database Schema (Supabase)

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_credits_system.sql`

```sql
-- Create user_credits table
CREATE TABLE IF NOT EXISTS public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 50 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own credits
CREATE POLICY "Users can view own credits"
  ON public.user_credits
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Service role can manage all credits (for agent backend)
CREATE POLICY "Service role can manage credits"
  ON public.user_credits
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger: Initialize credits on user signup
CREATE OR REPLACE FUNCTION public.initialize_user_credits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 50)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_user_credits();

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- Grant permissions
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
```

### 2. Server Actions (app-reoutfit)

**File**: `lib/db/credits.ts`

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";

export class InsufficientCreditsError extends Error {
  constructor(
    public required: number,
    public available: number
  ) {
    super(`Insufficient credits. Required: ${required}, Available: ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

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
```

**Additional migration for atomic RPC**:

```sql
-- Add to the migration file
-- RPC function for atomic credit deduction
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  UPDATE public.user_credits
  SET balance = balance - p_amount
  WHERE user_id = p_user_id AND balance >= p_amount
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Frontend API Routes (app-reoutfit)

#### a) `/api/lookbook/generate-avatar/route.ts`

```typescript
// Add at the top after imports
import { getUserCredits, deductCredits, InsufficientCreditsError } from "@/lib/db/credits";

// Add after line 17 (after user auth check)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Credit check (5 credits for avatar generation)
  const COST = 5;
  try {
    const balance = await getUserCredits(user.id);
    if (balance < COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: COST,
          available: balance
        },
        { status: 402 }
      );
    }

    // Deduct credits BEFORE expensive operation
    await deductCredits(user.id, COST, "generate-avatar");
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: error.required,
          available: error.available
        },
        { status: 402 }
      );
    }
    throw error;
  }

  // Continue with existing logic...
}
```

#### b) `/api/products/enrich/route.ts`

```typescript
// Add at the top after imports
import { getUserCredits, deductCredits, InsufficientCreditsError } from "@/lib/db/credits";

// Add after line 33 (after parallel auth/cache check)
export async function POST(request: Request) {
  // ... existing code for auth and cache check ...

  // Credit check (2 credits for enrichment, regardless of cache)
  const COST = 2;
  try {
    const balance = await getUserCredits(user.id);
    if (balance < COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: COST,
          available: balance
        },
        { status: 402 }
      );
    }

    // Deduct credits (even if we return cached data)
    await deductCredits(user.id, COST, "enrich-product");
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: error.required,
          available: error.available
        },
        { status: 402 }
      );
    }
    throw error;
  }

  // Continue with existing logic...
}
```

#### c) `/api/studio/generate-look/route.ts`

```typescript
// Add at the top after imports
import { getUserCredits, deductCredits, InsufficientCreditsError } from "@/lib/db/credits";

// Add after line 99 (after user auth check)
export async function POST(request: Request) {
  // ... existing code ...

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Credit check (3 credits for look generation)
  const COST = 3;
  try {
    const balance = await getUserCredits(user.id);
    if (balance < COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: COST,
          available: balance
        },
        { status: 402 }
      );
    }

    // Deduct credits BEFORE expensive operation
    await deductCredits(user.id, COST, "generate-look");
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: error.required,
          available: error.available
        },
        { status: 402 }
      );
    }
    throw error;
  }

  // Continue with existing logic...
}
```

#### d) `/api/wardrobe/prettify/route.ts`

```typescript
// Add at the top after imports
import { getUserCredits, deductCredits, InsufficientCreditsError } from "@/lib/db/credits";

// Add after line 17 (after user auth check)
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Credit check (1 credit for prettify)
  const COST = 1;
  try {
    const balance = await getUserCredits(user.id);
    if (balance < COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: COST,
          available: balance
        },
        { status: 402 }
      );
    }

    // Deduct credits BEFORE expensive operation
    await deductCredits(user.id, COST, "prettify-wardrobe");
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: error.required,
          available: error.available
        },
        { status: 402 }
      );
    }
    throw error;
  }

  // Continue with existing logic...
}
```

### 4. Agent Backend (agent)

#### a) Setup Supabase Client in Agent

**File**: `agent/src/agent_server/core/supabase.py` (new file)

```python
"""Supabase client for credit system"""
import os
from typing import Optional
from supabase import create_client, Client

_supabase_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create Supabase client (singleton)"""
    global _supabase_client

    if _supabase_client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for backend

        if not url or not key:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set"
            )

        _supabase_client = create_client(url, key)

    return _supabase_client

async def get_user_credits(user_id: str) -> int:
    """Get current credit balance for user"""
    supabase = get_supabase_client()

    response = supabase.table("user_credits") \
        .select("balance") \
        .eq("user_id", user_id) \
        .single() \
        .execute()

    if not response.data:
        # Initialize user if not exists
        init_response = supabase.table("user_credits") \
            .insert({"user_id": user_id, "balance": 50}) \
            .execute()
        return 50

    return response.data["balance"]

async def deduct_credits(user_id: str, amount: int, operation: str) -> int:
    """
    Deduct credits from user balance (atomic operation)
    Raises ValueError if insufficient credits
    """
    supabase = get_supabase_client()

    # Use RPC for atomic deduction
    try:
        response = supabase.rpc(
            "deduct_credits",
            {"p_user_id": user_id, "p_amount": amount}
        ).execute()

        return response.data
    except Exception as e:
        if "Insufficient credits" in str(e):
            current_balance = await get_user_credits(user_id)
            raise ValueError(
                f"Insufficient credits. Required: {amount}, Available: {current_balance}"
            )
        raise

async def has_enough_credits(user_id: str, amount: int) -> bool:
    """Check if user has enough credits"""
    balance = await get_user_credits(user_id)
    return balance >= amount
```

#### b) Modify Tools Node

**File**: `agent/graphs/react_agent/nodes/tools.py`

```python
# Add imports at top
from agent_server.core.supabase import has_enough_credits, deduct_credits, get_user_credits

# Modify custom_tool_node function
async def custom_tool_node(state: MessagesState, config: RunnableConfig, *, store: BaseStore) -> dict:
    """Execute tools with credit checks for search operations"""

    # Define costs for search tools
    TOOL_COSTS = {
        "search_product_online": 1,      # Shopping search
        "search_product_image_online": 2, # Lens search
    }

    outputs = []
    for tool_call in state["messages"][-1].tool_calls:
        tool_name = tool_call["name"]

        # Credit check for search tools
        if tool_name in TOOL_COSTS:
            cost = TOOL_COSTS[tool_name]

            # Extract user_id from config
            user_id = config.get("configurable", {}).get("user_id")
            if not user_id:
                # Fallback: try to get from thread metadata
                thread_id = config.get("configurable", {}).get("thread_id")
                # You may need to fetch user_id from thread metadata here
                outputs.append(
                    ToolMessage(
                        content="Error: User ID not found in context",
                        name=tool_name,
                        tool_call_id=tool_call["id"],
                    )
                )
                continue

            # Check and deduct credits
            try:
                balance = await get_user_credits(user_id)
                if balance < cost:
                    outputs.append(
                        ToolMessage(
                            content=f"⚠️ Insufficient credits. This search requires {cost} credit{'s' if cost > 1 else ''}, but you only have {balance}. Please purchase more credits to continue.",
                            name=tool_name,
                            tool_call_id=tool_call["id"],
                        )
                    )
                    continue

                # Deduct credits BEFORE executing tool
                new_balance = await deduct_credits(user_id, cost, tool_name)

            except Exception as e:
                outputs.append(
                    ToolMessage(
                        content=f"Error checking credits: {str(e)}",
                        name=tool_name,
                        tool_call_id=tool_call["id"],
                    )
                )
                continue

        # Execute tool normally
        tool_result = await tool_executor.ainvoke(tool_call)
        outputs.append(tool_result)

    # ... rest of existing logic ...
```

#### c) Pass User ID in Context

**File**: `agent/src/agent_server/main.py`

Modify the thread execution endpoint to extract and pass user_id:

```python
# In the stream endpoint handler
@app.post("/threads/{thread_id}/runs/stream")
async def stream_run(thread_id: str, request: Request):
    # Extract user from Bearer token
    auth_header = request.headers.get("authorization", "")
    user_id = None

    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        # Decode Supabase JWT to get user_id
        try:
            import jwt
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get("sub")
        except Exception:
            pass

    # Pass user_id in config
    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": user_id,  # Add this
        }
    }

    # ... rest of endpoint logic ...
```

### 5. UI Components (app-reoutfit)

#### a) Credits Balance Hook

**File**: `hooks/use-credits.ts`

```typescript
"use client";

import { useEffect, useState } from "react";
import { getUserCredits } from "@/lib/db/credits";
import { useSupabase } from "@/lib/supabase/client";

export function useCredits() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useSupabase();

  const refresh = async () => {
    if (!user?.id) {
      setBalance(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const credits = await getUserCredits(user.id);
      setBalance(credits);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [user?.id]);

  return {
    balance,
    loading,
    error,
    refresh,
    isLow: balance !== null && balance < 10,
    isEmpty: balance === 0,
  };
}
```

#### b) Credits Badge Component

**File**: `components/credits/credit-badge.tsx`

```typescript
"use client";

import { Coins, Loader2 } from "lucide-react";
import { useCredits } from "@/hooks/use-credits";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function CreditBadge() {
  const { balance, loading, isLow, isEmpty } = useCredits();

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
              ? "Out of credits! Purchase more to continue."
              : isLow
              ? "Running low on credits"
              : `${balance} credits remaining`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

#### c) Add Badge to Chat Header

**File**: `components/chat/chat-header.tsx`

```typescript
// Add import at top
import { CreditBadge } from "@/components/credits/credit-badge";

// Modify the right section (around line 73-89)
export function ChatHeader(props: {
  // ... existing props ...
}) {
  // ... existing code ...

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      {/* Left: Buttons */}
      <div className="flex items-center gap-2">
        {/* ... existing sidebar toggle and new chat buttons ... */}
      </div>

      {/* Right: Credits Badge, Studio Button, and Wordmark */}
      <div className="ml-auto flex items-center gap-2">
        {/* Credits Badge - show for all authenticated users */}
        <CreditBadge />

        {/* Studio Button - only show if thread exists */}
        {threadId && <StudioToggle />}

        {/* Logo */}
        {!opened && (
          <Image
            src="/logo.png"
            alt="Reoutfit"
            width={36}
            height={36}
          />
        )}
      </div>
    </header>
  );
}
```

#### d) Error Handling Component

**File**: `components/credits/insufficient-credits-dialog.tsx`

```typescript
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
```

### 6. Environment Variables

#### app-reoutfit (.env.local)
```bash
# Existing variables...

# No new variables needed - uses existing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### agent (.env)
```bash
# Existing variables...

# Supabase for credit system
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_SERVICE_KEY=<your-service-role-key>  # Service role for backend access
```

### 7. Frontend Usage Examples

#### In wardrobe upload form:
```typescript
import { useCredits } from "@/hooks/use-credits";
import { InsufficientCreditsDialog } from "@/components/credits/insufficient-credits-dialog";

function WardrobeUpload() {
  const { balance, refresh } = useCredits();
  const [showCreditError, setShowCreditError] = useState(false);
  const [creditError, setCreditError] = useState({ required: 0, available: 0 });

  const handlePrettify = async () => {
    try {
      const response = await fetch("/api/wardrobe/prettify", {
        method: "POST",
        body: formData,
      });

      if (response.status === 402) {
        const error = await response.json();
        setCreditError({ required: error.required, available: error.available });
        setShowCreditError(true);
        return;
      }

      // Success - refresh credits display
      await refresh();

    } catch (error) {
      // Handle other errors
    }
  };

  return (
    <>
      {/* Upload form */}
      <InsufficientCreditsDialog
        open={showCreditError}
        onOpenChange={setShowCreditError}
        required={creditError.required}
        available={creditError.available}
      />
    </>
  );
}
```

## Testing Checklist

### Database
- [ ] Migration runs successfully on fresh database
- [ ] New users automatically get 50 credits on signup
- [ ] RLS policies prevent users from viewing other users' credits
- [ ] Service role can read/write all credits
- [ ] Atomic deduction RPC prevents race conditions
- [ ] CHECK constraint prevents negative balances

### Frontend API Routes
- [ ] `/api/lookbook/generate-avatar` deducts 5 credits
- [ ] `/api/studio/generate-look` deducts 3 credits
- [ ] `/api/wardrobe/prettify` deducts 1 credit
- [ ] `/api/products/enrich` deducts 2 credits (even on cache hit)
- [ ] All routes return 402 when credits insufficient
- [ ] Concurrent requests don't cause over-deduction

### Agent Backend
- [ ] Shopping search deducts 1 credit
- [ ] Lens search deducts 2 credits
- [ ] Agent returns user-friendly message when credits insufficient
- [ ] User ID properly extracted from Bearer token
- [ ] Credits deducted before SerpAPI call (not on artifact render)

### UI Components
- [ ] Credit badge displays current balance
- [ ] Badge shows yellow when balance < 10
- [ ] Badge shows red when balance = 0
- [ ] Tooltip shows helpful messages
- [ ] Balance refreshes after operations
- [ ] Error dialog shows when operations fail due to credits

### Edge Cases
- [ ] User with 0 credits cannot perform any operations
- [ ] User with 2 credits can enrich product but not generate avatar
- [ ] Cached enrichment still costs credits
- [ ] Failed operations don't deduct credits
- [ ] Loading states handled gracefully

## Future Enhancements

1. **Credit Packages**: Add purchasable credit tiers (e.g., $5 for 100 credits)
2. **Transaction History**: Track all credit operations for audit
3. **Free Tier Refills**: Daily/weekly auto-refill of credits
4. **Credit Gifting**: Allow users to gift credits to friends
5. **Usage Analytics**: Show users which features consume most credits
6. **Refund System**: Refund credits on operation failures
7. **Subscription Plans**: Unlimited credits for monthly subscribers

## Notes

- All credit operations are atomic to prevent race conditions
- Frontend operations fail fast with clear error messages
- Agent operations provide conversational error feedback
- System designed for easy addition of new credited operations
- No transaction history table keeps initial implementation simple
- Credit costs can be easily adjusted in centralized constants
