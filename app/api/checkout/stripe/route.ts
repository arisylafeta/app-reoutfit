import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/utils/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

interface CreditTier {
  id: string;
  credits: number;
  price: number;
  name: string;
}

const CREDIT_TIERS: Record<string, CreditTier> = {
  starter: {
    id: 'starter',
    credits: 100,
    price: 4.99,
    name: 'Starter Pack - 100 Credits',
  },
  popular: {
    id: 'popular',
    credits: 300,
    price: 12.99,
    name: 'Popular Pack - 300 Credits',
  },
  power: {
    id: 'power',
    credits: 1000,
    price: 34.99,
    name: 'Power Pack - 1000 Credits',
  },
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tierId } = await request.json();
    const tier = CREDIT_TIERS[tierId];

    if (!tier) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: tier.name,
              description: `${tier.credits} credits for Reoutfit product searches`,
              images: ['https://your-domain.com/credits-icon.png'], // Optional: Add your logo
            },
            unit_amount: Math.round(tier.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/credits?canceled=true`,
      customer_email: user.email,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        credits: tier.credits.toString(),
        tier_id: tier.id,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[CHECKOUT] Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
