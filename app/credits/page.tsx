'use client';

import { useState, useEffect } from 'react';
import { Coins, Sparkles, Zap, Crown, Check, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChatHeader } from '@/components/chat/chat-header';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import { useCredits } from '@/hooks/use-credits';
import { createClient } from '@/utils/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CreditTier {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
  icon: typeof Sparkles;
  features: string[];
}

const CREDIT_TIERS: CreditTier[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 4.99,
    icon: Sparkles,
    features: ['100 product searches', 'Perfect for trying out', 'Never expires'],
  },
  {
    id: 'popular',
    name: 'Popular Pack',
    credits: 300,
    price: 12.99,
    popular: true,
    icon: Zap,
    features: ['300 product searches', 'Best value per credit', 'Never expires', 'Most popular choice'],
  },
  {
    id: 'power',
    name: 'Power Pack',
    credits: 1000,
    price: 34.99,
    icon: Crown,
    features: ['1000 product searches', 'Maximum savings', 'Never expires', 'For power users'],
  },
];

interface Purchase {
  id: string;
  credits_purchased: number;
  amount_usd: number;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export default function CreditsPage() {
  const router = useRouter();
  const { chatHistoryOpen, toggleSidebar, isLargeScreen } = useChatSidebar();
  const { balance, loading: creditsLoading } = useCredits();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [purchasingTier, setPurchasingTier] = useState<string | null>(null);

  // Handle success/cancel query params from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const canceled = params.get('canceled');

    if (success === 'true') {
      toast.success('Payment successful! Your credits have been added.');
      // Clean up URL
      router.replace('/credits', { scroll: false });
    } else if (canceled === 'true') {
      toast.error('Payment canceled. No charges were made.');
      // Clean up URL
      router.replace('/credits', { scroll: false });
    }
  }, [router]);

  // Fetch purchase history
  useEffect(() => {
    const fetchPurchases = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setLoadingPurchases(false);
        return;
      }

      const { data, error } = await supabase
        .from('credit_purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching purchases:', error);
        toast.error('Failed to load purchase history');
      } else {
        setPurchases(data || []);
      }
      
      setLoadingPurchases(false);
    };

    fetchPurchases();
  }, []);

  const handlePurchase = async (tier: CreditTier) => {
    setPurchasingTier(tier.id);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Please sign in to purchase credits');
        router.push('/login');
        return;
      }

      // Create Stripe checkout session
      const response = await fetch('/api/checkout/stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tierId: tier.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe checkout
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setPurchasingTier(null);
    }
  };

  const getStatusIcon = (status: Purchase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'failed':
      case 'refunded':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusText = (status: Purchase['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <ChatHeader
        chatStarted={true}
        isOverlayLayout={false}
        isLargeScreen={isLargeScreen}
        chatHistoryOpen={chatHistoryOpen}
        onToggleSidebar={toggleSidebar}
        onNewThread={() => router.push('/')}
        opened={chatHistoryOpen && isLargeScreen}
      />

      {/* Title Section with Blob Background */}
      <div className="bg-white pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Blob SVG Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -top-20 -right-10 w-64 h-64"
            >
              <path
                fill="#BFB4DC"
                d="M46.5,-44.6C57.2,-35.9,60.7,-17.9,57.1,-3.6C53.5,10.8,42.9,21.6,32.3,32.7C21.6,43.8,10.8,55.2,-5.3,60.5C-21.4,65.8,-42.7,64.9,-56.7,53.8C-70.7,42.7,-77.3,21.4,-73.8,3.5C-70.3,-14.4,-56.7,-28.7,-42.7,-37.5C-28.7,-46.3,-14.4,-49.6,1.8,-51.3C17.9,-53.1,35.9,-53.4,46.5,-44.6Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>

          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-3">
              <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                Credits
              </span>{' '}
              & Billing
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Purchase credits to power your fashion searches
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          {/* Current Balance Card */}
          <div className="bg-gradient-to-br from-accent-1/10 to-accent-2/10 rounded-2xl p-8 border border-accent-1/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Current Balance</p>
                <div className="flex items-baseline gap-2">
                  {creditsLoading ? (
                    <div className="h-12 w-32 bg-muted animate-pulse rounded" />
                  ) : (
                    <>
                      <h2 className="text-5xl font-bold bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                        {balance ?? 0}
                      </h2>
                      <span className="text-2xl text-muted-foreground">credits</span>
                    </>
                  )}
                </div>
              </div>
              <div className="hidden sm:block">
                <Coins className="h-24 w-24 text-accent-1/30" />
              </div>
            </div>
          </div>

          {/* Credit Tiers */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Purchase Credits</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {CREDIT_TIERS.map((tier) => {
                const Icon = tier.icon;
                return (
                  <div
                    key={tier.id}
                    className={cn(
                      'relative rounded-2xl border-2 p-6 transition-all hover:shadow-lg',
                      tier.popular
                        ? 'border-accent-1 bg-gradient-to-br from-accent-1/5 to-accent-2/5'
                        : 'border-border bg-white hover:border-accent-1/50'
                    )}
                  >
                    {tier.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-accent-1 to-accent-2 text-white text-xs font-bold px-3 py-1 rounded-full">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent-1/20 to-accent-2/20 mb-4">
                        <Icon className="h-6 w-6 text-accent-1" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{tier.name}</h3>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-foreground">${tier.price}</span>
                        <span className="text-muted-foreground">USD</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tier.credits} credits
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent-1 mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      onClick={() => handlePurchase(tier)}
                      disabled={purchasingTier === tier.id}
                      className={cn(
                        'w-full',
                        tier.popular && 'bg-gradient-to-r from-accent-1 to-accent-2 hover:opacity-90'
                      )}
                    >
                      {purchasingTier === tier.id ? 'Redirecting to checkout...' : 'Purchase'}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transaction History */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Transaction History</h2>
            {loadingPurchases ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : purchases.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-lg">
                <Coins className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground">No purchases yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your purchase history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {purchases.map((purchase) => (
                  <div
                    key={purchase.id}
                    className="flex items-center justify-between p-4 bg-white border border-border rounded-lg hover:border-accent-1/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent-1/10">
                        <Coins className="h-5 w-5 text-accent-1" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {purchase.credits_purchased} credits
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(purchase.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold text-foreground">
                          ${purchase.amount_usd.toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1 justify-end">
                          {getStatusIcon(purchase.status)}
                          <span className="text-xs text-muted-foreground">
                            {getStatusText(purchase.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
