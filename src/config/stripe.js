// ============================================================
// config/stripe.js — Stripe SDK (mocked) initialisation
// Mocked checkout + webhook flow for Pro subscription lifecycle
// ============================================================
const Stripe = require('stripe');
const env = require('./env');

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY) : null;
module.exports = stripe;
