'use client';

import { useState, useEffect } from 'react';
import { Coins, ShoppingBag, BookImage, TrendingUp } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useCredits } from '@/hooks/use-credits';

interface AccountStatsProps {
  userId: string;
}

interface Stats {
  wardrobeItems: number;
  lookbooks: number;
  totalPurchases: number;
  totalSpent: number;
}

export function AccountStats({ userId }: AccountStatsProps) {
  const { balance } = useCredits();
  const [stats, setStats] = useState<Stats>({
    wardrobeItems: 0,
    lookbooks: 0,
    totalPurchases: 0,
    totalSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchStats();
    }
  }, [userId]);

  const fetchStats = async () => {
    try {
      const supabase = createClient();

      // Fetch wardrobe items count
      const { count: wardrobeCount } = await supabase
        .from('wardrobe_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Fetch lookbooks count
      const { count: lookbooksCount } = await supabase
        .from('lookbooks')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', userId);

      // Fetch purchase stats
      const { data: purchases } = await supabase
        .from('credit_purchases')
        .select('amount_usd')
        .eq('user_id', userId)
        .eq('status', 'completed');

      const totalSpent = purchases?.reduce((sum, p) => sum + (p.amount_usd || 0), 0) || 0;

      setStats({
        wardrobeItems: wardrobeCount || 0,
        lookbooks: lookbooksCount || 0,
        totalPurchases: purchases?.length || 0,
        totalSpent,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: 'Credit Balance',
      value: balance !== null ? balance.toLocaleString() : '—',
      icon: Coins,
    },
    {
      label: 'Wardrobe Items',
      value: stats.wardrobeItems.toLocaleString(),
      icon: ShoppingBag,
    },
    {
      label: 'Lookbooks Created',
      value: stats.lookbooks.toLocaleString(),
      icon: BookImage,
    },
    {
      label: 'Total Spent',
      value: `$${stats.totalSpent.toFixed(2)}`,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-white border border-border rounded-2xl p-6 hover:border-accent-1/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent-1/20 to-accent-2/20">
                <Icon className="h-6 w-6 text-accent-1" />
              </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {stat.label}
            </p>
            <p className="text-3xl font-bold text-foreground">
              {loading ? (
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
              ) : (
                stat.value
              )}
            </p>
          </div>
        );
      })}
    </div>
  );
}
