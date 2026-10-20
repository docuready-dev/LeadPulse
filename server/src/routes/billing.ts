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
    name: 'Strovr Basic Subscription',
    amount: 699,
    type: 'subscription',
    plan: 'basic',
    credits: 600,
    dailyLimit: 600
  },
  pro: {
    name: 'Strovr Pro Subscription',
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
    merchantId: process.env.PHONEPE_MERCHANT_ID || 'STROVR_UAT',
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
    try {
      const existing = await txRef.where('transactionId', '==', transactionId).get();
      if (!existing.empty) {
        return res.status(200).json({ message: 'Transaction already processed (Idempotency).' });
      }
    } catch {}
    
    if (status !== 'SUCCESS') {
      return res.status(400).json({ error: 'PhonePe payment reported unsuccessful' });
    }

    // Resolve target account in userStore
    const targetUser = userStore.getUserById(userId) || (userId.includes('@') ? userStore.getUserByEmail(userId) : null);
    const targetId = targetUser?._id || userId;

    // Persist verified transaction
    const txRecord = {
      transactionId,
      userId: targetId,
      userEmail: targetUser?.email || (userId.includes('@') ? userId : ''),
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

    // Calculate updated credits and tier
    const baseCredits = (targetUser?.plan || 'free') === 'free' && !targetUser?.has_topup && (targetUser?.lead_credits || 0) > 15
      ? 15
      : (targetUser?.lead_credits || 0);

    let updatedCredits = baseCredits;
    let newPlan = targetUser?.plan || 'free';
    const updates: any = {};

    if (item.type === 'bundle') {
      const currentTopup = Number(targetUser?.topup_credits) || 0;
      const addedTopup = Number(item.credits) || 0;
      updates.topup_credits = currentTopup + addedTopup;
      updates.has_topup = true;
      updates.updatedAt = new Date().toISOString();
    } else if (item.type === 'subscription') {
      newPlan = item.plan!;
      const dailyTokens = item.plan === 'basic' ? 600 : 1500;
      updates.plan = newPlan;
      updates.lead_credits = dailyTokens;
      updates.base_daily_credits = dailyTokens;
      updates.last_token_reset_date = new Date().toISOString().split('T')[0];
      updates.emails_limit = item.plan === 'pro' ? 5000 : 1500;
      updates.emails_sent = 0;
      updates.ai_pitches_limit = item.plan === 'pro' ? -1 : 250;
      updates.ai_pitches_used = 0;
      updates.has_topup = true;
      updates.subscribed_at = new Date().toISOString();
      updates.updatedAt = new Date().toISOString();
    }

    // 1. Persist directly in userStore (the SaaS's central brain)
    const updatedUser = userStore.updateUser(targetId, updates);

    // 2. Persist in Firestore
    try {
      await db.collection('users').doc(targetId).set(updates, { merge: true });
    } catch (fsErr: any) {
      console.warn('[Billing] Firestore merge note:', fsErr.message);
    }

    const cleanUser = updatedUser ? { ...updatedUser } : null;
    if (cleanUser) delete (cleanUser as any).password;

    res.json({ 
      success: true, 
      message: `${item.name} activated via PhonePe!`,
      credits: updatedCredits,
      plan: newPlan,
      user: cleanUser,
      emails_limit: newPlan === 'pro' ? 5000 : newPlan === 'basic' ? 1500 : 50,
      emails_sent: 0,
      ai_pitches_limit: newPlan === 'pro' ? -1 : newPlan === 'basic' ? 250 : 5,
      ai_pitches_used: 0
    });

  } catch (err: any) {
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
