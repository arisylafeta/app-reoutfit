# Stripe Credit Purchase Setup Guide

This guide will help you set up Stripe for credit purchases in Reoutfit.

## Why Stripe?

- ✅ **Lower fees**: 2.9% + $0.30 per transaction (vs 8%+ with payment aggregators)
- ✅ **Direct control**: Full access to customer data and payment flows
- ✅ **Robust API**: Industry-leading documentation and developer tools
- ✅ **Global reach**: Support for 135+ currencies and local payment methods

## 1. Create Stripe Account

1. Go to [Stripe](https://stripe.com) and create an account
2. Complete business verification (required for live payments)
3. Enable your account for production

## 2. Get API Keys

### Test Mode (for development)
1. In Stripe Dashboard, ensure **Test mode** toggle is ON (top right)
2. Go to **Developers** → **API keys**
3. Copy your **Publishable key** (starts with `pk_test_`)
4. Reveal and copy your **Secret key** (starts with `sk_test_`)

### Live Mode (for production)
1. Toggle **Test mode** OFF
2. Go to **Developers** → **API keys**
3. Copy your **Publishable key** (starts with `pk_live_`)
4. Reveal and copy your **Secret key** (starts with `sk_live_`)

## 3. Set Up Webhook

Webhooks allow Stripe to notify your app when payments succeed or fail.

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL:
   - **Production**: `https://your-domain.com/api/webhooks/stripe`
   - **Development**: Use [Stripe CLI](#local-development-with-stripe-cli) (recommended)
4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `charge.refunded`
   - ✅ `payment_intent.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_`)

## 4. Configure Environment Variables

Add these to your `.env.local` file in the `app-reoutfit` directory:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Public keys (for frontend - if needed in future)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# App URL (for checkout redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change to your production URL in production
```

### Production Environment Variables

For production, update to live keys:

```bash
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

## 5. Install Stripe Package

```bash
cd app-reoutfit
npm install stripe
```

## 6. Apply Database Migration

Run the migration to create the `credit_purchases` table:

```bash
cd ..
supabase db push
```

## 7. Test the Integration

### Test Mode
1. Start your development server:
   ```bash
   cd app-reoutfit
   npm run dev
   ```

2. Navigate to `/credits` page
3. Click "Purchase" on any tier
4. Use Stripe test cards:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **Requires authentication**: `4000 0025 0000 3155`
   - Use any future expiry date, any CVC, any ZIP

5. Verify:
   - ✅ Checkout redirects to Stripe
   - ✅ Payment completes successfully
   - ✅ Redirects back to `/credits?success=true`
   - ✅ Credits are added to balance
   - ✅ Purchase appears in transaction history

### Check Webhook Delivery
1. Go to **Developers** → **Webhooks** in Stripe Dashboard
2. Click on your webhook endpoint
3. View recent deliveries and check for errors

## 8. Local Development with Stripe CLI

The Stripe CLI is the best way to test webhooks locally without exposing your localhost.

### Install Stripe CLI

**macOS (Homebrew)**:
```bash
brew install stripe/stripe-cli/stripe
```

**Other platforms**: See [Stripe CLI installation](https://stripe.com/docs/stripe-cli#install)

### Login to Stripe
```bash
stripe login
```

### Forward Webhooks to Local Server
```bash
# Start your Next.js dev server first
npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will output a webhook signing secret (starts with `whsec_`). Use this in your `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxx  # From stripe listen command
```

### Test a Payment
```bash
stripe trigger checkout.session.completed
```

## 9. Go Live Checklist

Before accepting real payments:

- [ ] Switch to **Live mode** API keys
- [ ] Update webhook endpoint to production URL
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Test a real payment (you can refund it)
- [ ] Verify webhook delivery in production
- [ ] Set up proper error monitoring (e.g., Sentry)
- [ ] Review Stripe Dashboard for any issues

## 10. Monitoring & Maintenance

### View Payments
- **Stripe Dashboard** → **Payments**: See all transactions
- **Customers**: View customer details and payment history
- **Disputes**: Handle chargebacks (rare for digital goods)

### Refunds
To refund a purchase:
1. Go to **Payments** in Stripe Dashboard
2. Find the payment
3. Click **Refund**
4. The webhook will automatically update the purchase status to "refunded"

### Failed Payments
- Check **Developers** → **Webhooks** for delivery failures
- Review application logs for errors
- Verify webhook signing secret is correct

## Troubleshooting

### Webhook not receiving events
- ✅ Check webhook URL is correct and accessible
- ✅ Verify webhook signing secret matches `.env.local`
- ✅ Check Stripe Dashboard webhook logs for delivery errors
- ✅ Ensure your server is running and accessible

### Credits not being added
- ✅ Check Supabase logs for RPC function errors
- ✅ Verify `user_id` is in session metadata
- ✅ Check `credit_purchases` table for purchase records
- ✅ Look for errors in webhook handler logs

### Checkout not opening
- ✅ Check browser console for errors
- ✅ Verify API endpoint `/api/checkout/stripe` is working
- ✅ Ensure Stripe secret key is valid
- ✅ Check network tab for failed requests

### "Invalid API Key" error
- ✅ Verify you're using the correct key (test vs live)
- ✅ Check for extra spaces in `.env.local`
- ✅ Restart Next.js dev server after changing env vars

## Security Best Practices

- ✅ **Never expose secret keys**: Keep `STRIPE_SECRET_KEY` server-side only
- ✅ **Always verify webhooks**: Use signature verification (already implemented)
- ✅ **Use HTTPS in production**: Required by Stripe
- ✅ **Validate amounts**: Ensure prices match on server-side
- ✅ **Log everything**: Keep audit trail of all transactions
- ✅ **Handle errors gracefully**: Don't expose internal errors to users

## Pricing & Fees

### Stripe Fees (US)
- **Card payments**: 2.9% + $0.30 per successful charge
- **International cards**: +1.5%
- **Currency conversion**: +1%

### Example Calculation
For a $12.99 purchase:
- Gross: $12.99
- Stripe fee: $0.68 (2.9% + $0.30)
- Net: $12.31

## Support

### Stripe Support
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com/)
- [Stripe Status](https://status.stripe.com/)

### Integration Issues
- Check application logs
- Review Supabase dashboard
- Test with Stripe CLI
- Verify environment variables

## Additional Resources

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe API Reference](https://stripe.com/docs/api)

---

**Ready to go live?** Follow the [Go Live Checklist](#9-go-live-checklist) above! 🚀
