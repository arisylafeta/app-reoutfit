import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-10-29.clover',
});

// Initialize Supabase with service role key for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    console.error('[WEBHOOK] Missing Stripe signature');
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[WEBHOOK] Signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log('[WEBHOOK] Received event:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Get metadata from session
        const userId = session.metadata?.user_id || session.client_reference_id;
        const credits = parseInt(session.metadata?.credits || '0');
        
        if (!userId || !credits) {
          console.error('[WEBHOOK] Missing user_id or credits in metadata');
          return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
        }

        // Create purchase record
        const { error: purchaseError } = await supabaseAdmin
          .from('credit_purchases')
          .insert({
            user_id: userId,
            stripe_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent as string,
            stripe_customer_id: session.customer as string,
            credits_purchased: credits,
            amount_usd: (session.amount_total || 0) / 100, // Convert from cents
            currency: session.currency?.toUpperCase() || 'USD',
            status: session.payment_status === 'paid' ? 'completed' : 'pending',
            customer_email: session.customer_details?.email || session.customer_email,
            customer_name: session.customer_details?.name,
            completed_at: session.payment_status === 'paid' ? new Date().toISOString() : null,
          });

        if (purchaseError) {
          console.error('[WEBHOOK] Error creating purchase record:', purchaseError);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        // Add credits to user balance if payment is complete
        if (session.payment_status === 'paid') {
          const { data: balanceData, error: balanceError } = await supabaseAdmin.rpc(
            'add_credits',
            {
              p_user_id: userId,
              p_amount: credits,
            }
          );

          if (balanceError) {
            console.error('[WEBHOOK] Error adding credits:', balanceError);
            return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 });
          }

          console.log('[WEBHOOK] ✅ Added', credits, 'credits. New balance:', balanceData);
        }

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = charge.payment_intent as string;

        // Update purchase status to refunded
        const { error: updateError } = await supabaseAdmin
          .from('credit_purchases')
          .update({ 
            status: 'refunded', 
            updated_at: new Date().toISOString() 
          })
          .eq('stripe_payment_intent_id', paymentIntentId);

        if (updateError) {
          console.error('[WEBHOOK] Error updating refund status:', updateError);
          return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        console.log('[WEBHOOK] ✅ Marked charge as refunded:', paymentIntentId);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        // Update purchase status to failed
        const { error: updateError } = await supabaseAdmin
          .from('credit_purchases')
          .update({ 
            status: 'failed', 
            updated_at: new Date().toISOString() 
          })
          .eq('stripe_payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error('[WEBHOOK] Error updating failed status:', updateError);
        }

        console.log('[WEBHOOK] ⚠️ Payment failed:', paymentIntent.id);
        break;
      }

      default:
        console.log('[WEBHOOK] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error processing event:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
