// src/stripe/stripeProvider.js
// Shared Stripe.js initialization — single loadStripe call for the app
import { loadStripe } from '@stripe/stripe-js';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripePromise = key ? loadStripe(key) : null;
