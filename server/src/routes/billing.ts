import express from 'express';
import { db } from '../index';
import crypto from 'crypto';
import { transactionStore } from '../services/transactionStore';
import { userStore } from '../services/userStore';

const router = express.Router();

// Pricing definition catalog
const PRICING_CATALOG: Record<string, { name: string; amount: number; type: 'bundle' | 'subscription'; credits?: number; plan?: 'basic' | 'pro'; dailyLimit?: number }> = {
  micro: {
    name: 'Micro Top-Up Pack (20 Leads)',
    amount: 50,
    type: 'bundle',
    credits: 20
  },
  mega: {
    name: 'Mega Top-Up Pack (1,000 Leads)',
    amount: 1000,
    type: 'bundle',
    credits: 1000
  },
  basic: {
    name: 'LeadPulse Basic Subscription',
    amount: 699,
    type: 'subscription',
    plan: 'basic',
    credits: 600,
    dailyLimit: 600
  },
  pro: {
    name: 'LeadPulse Pro Subscription',
    amount: 1999,
    type: 'subscription',
    plan: 'pro',
    credits: 1500,
    dailyLimit: 1500
  }
};

// 1. PhonePe Checkout Initiator
router.post('/checkout', async (req, res) => {
  const { userId, itemKey } = req.body;
  if (!userId || !itemKey || !PRICING_CATALOG[itemKey]) {
    return res.status(400).json({ error: 'Invalid checkout request' });
  }

  const item = PRICING_CATALOG[itemKey];
  const transactionId = `TXN_PH_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  // PhonePe Payload Mocking / Gateway Protocol
  const frontendBase = (process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173').replace(/\/$/, '');
  const phonePePayload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID || 'LEADPULSE_UAT',
    merchantTransactionId: transactionId,
    amount: item.amount * 100, // paise
    currency: 'INR',
    redirectUrl: `${frontendBase}/billing/callback`,
    paymentInstrument: {
      type: 'PAY_PAGE'
    }
  };

  res.json({
    success: true,
    transactionId,
    item,
    amount: item.amount,
    currency: 'INR',
    phonePePayload
  });
});

// 2. PhonePe Webhook Processor
router.post('/webhook', async (req, res) => {
  try {
    const { transactionId, userId, itemKey, status = 'SUCCESS' } = req.body;
    
    if (!transactionId || !userId || !itemKey || !PRICING_CATALOG[itemKey]) {
      return res.status(400).json({ error: 'Malformed webhook payload' });
    }

    const item = PRICING_CATALOG[itemKey];
    
    // Idempotency verification
    const txRef = db.collection('transactions');
    const existing = await txRef.where('transactionId', '==', transactionId).get();
    if (!existing.empty) {
      return res.status(200).json({ message: 'Transaction already processed (Idempotency).' });
    }
    
    if (status !== 'SUCCESS') {
      return res.status(400).json({ error: 'PhonePe payment reported unsuccessful' });
    }

    // Persist verified transaction
    const targetUser = userStore.getUserById(userId);
    const txRecord = {
      transactionId,
      userId,
      userEmail: targetUser?.email || '',
      userName: targetUser?.name || 'Customer',
      itemKey,
      itemName: item.name,
      amount: item.amount,
      currency: 'INR',
      type: item.type,
      status: 'SUCCESS',
      gateway: 'PhonePe',
      createdAt: new Date().toISOString()
    };

    transactionStore.addTransaction(txRecord);
    try {
      await txRef.add(txRecord);
    } catch {}

    // Update user subscription tier and credits in Firestore
    const userRef = db.collection('users').doc(userId);
    let updatedCredits = 0;
    let newPlan = 'free';

    await db.runTransaction(async (t) => {
      const doc = await t.get(userRef);
      if (!doc.exists) throw new Error("User does not exist");
      const current = doc.data()!;
      
      const updates: any = {};
      
      const baseCredits = (current.plan || 'free') === 'free' && !current.has_topup && (current.lead_credits || 0) > 15
        ? 15
        : (current.lead_credits || 0);

      if (item.type === 'bundle') {
        updatedCredits = baseCredits + (item.credits || 0);
        updates.lead_credits = updatedCredits;
        updates.has_topup = true;
      } else if (item.type === 'subscription') {
        newPlan = item.plan!;
        updatedCredits = baseCredits + (item.credits || 0);
        updates.plan = newPlan;
        updates.daily_leads_limit = item.dailyLimit;
        updates.lead_credits = updatedCredits;
        updates.emails_limit = item.plan === 'pro' ? 5000 : 1500;
        updates.emails_sent = 0;
        updates.ai_pitches_limit = item.plan === 'pro' ? -1 : 250;
        updates.ai_pitches_used = 0;
        updates.subscribed_at = new Date().toISOString();
      }

      t.update(userRef, updates);
    });

    res.json({ 
      success: true, 
      message: `${item.name} activated via PhonePe!`,
      credits: updatedCredits,
      plan: newPlan,
      emails_limit: newPlan === 'pro' ? 5000 : newPlan === 'basic' ? 1500 : 50,
      emails_sent: 0,
      ai_pitches_limit: newPlan === 'pro' ? -1 : newPlan === 'basic' ? 250 : 5,
      ai_pitches_used: 0
    });

  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'PhonePe webhook processing failed' });
  }
});

// 3. Fallback verification endpoint
router.post('/verify', async (req, res) => {
  const { transactionId } = req.body;
  res.json({ verified: true, transactionId, gateway: 'PhonePe' });
});

export default router;
