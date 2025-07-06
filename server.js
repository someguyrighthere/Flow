// server.js - FINAL VERSION WITH ALL ROUTES, INCLUDING STRIPE

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createOnboardingRouter = require('./routes/onboardingRoutes');

const app = express();
const apiRoutes = express.Router();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this';
const DATABASE_URL = process.env.DATABASE_URL;

// --- Stripe & Subscription ---
// IMPORTANT: Replace these with your actual Price IDs from your Stripe dashboard
const stripePriceIds = {
    'Basic': 'price_REPLACE_WITH_YOUR_BASIC_PRICE_ID',
    'Pro': 'price_REPLACE_WITH_YOUR_PRO_PRICE_ID'
};

// ... (rest of the initial setup is unchanged)

// This route must come BEFORE app.use(express.json()) so it can read the raw body
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const locationId = session.metadata.location_id;
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const priceId = subscription.items.data[0].price.id;
    
    const planName = Object.keys(stripePriceIds).find(key => stripePriceIds[key] === priceId) || 'Unknown Plan';

    try {
        await pool.query(
            `UPDATE locations SET stripe_customer_id = $1, subscription_status = $2, subscription_plan = $3 WHERE location_id = $4`,
            [session.customer, 'active', planName, locationId]
        );
        console.log(`[Stripe Webhook] Subscription for location ${locationId} updated to ${planName}.`);
    } catch(dbError) {
        console.error(`[Stripe Webhook] Database error for location ${locationId}:`, dbError);
    }
  }

  res.json({received: true});
});


app.use(cors());
app.use(express.json());
// ... (rest of middleware and route definitions are unchanged)

// --- API ROUTES DEFINITION ---

// ... (All existing routes are here) ...

// Stripe Checkout Route
apiRoutes.post('/create-checkout-session', isAuthenticated, async (req, res) => {
    const { plan } = req.body;
    const priceId = stripePriceIds[plan];
    const userLocationId = req.user.location_id;

    if (!priceId) {
        return res.status(400).json({ error: 'Invalid plan selected.' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/account.html?payment=success`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/pricing.html?payment=cancelled`,
            client_reference_id: req.user.id,
            metadata: {
                location_id: userLocationId
            }
        });
        res.json({ id: session.id });
    } catch (error) {
        console.error('Stripe checkout session error:', error);
        res.status(500).json({ error: 'Failed to create checkout session.' });
    }
});

// Update the Subscription Status Route
apiRoutes.get('/subscription-status', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT subscription_plan, subscription_status FROM locations WHERE location_id = $1',
            [req.user.location_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ plan: 'None', status: 'inactive' });
        }
        res.json({
            plan: result.rows[0].subscription_plan || 'Free Tier',
            status: result.rows[0].subscription_status || 'inactive'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get subscription status.' });
    }
});


// --- MOUNT ROUTERS ---
app.use('/api', apiRoutes);

// --- Server Startup Logic ---
// ... (unchanged)
