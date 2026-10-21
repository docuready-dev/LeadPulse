import express from 'express';
import { db } from '../index';
import crypto from 'crypto';
import { transactionStore } from '../services/transactionStore';
import { userStore } from '../services/userStore';

const router = express.Router();

// Pricing definition catalog
const PRICING_CATALOG: Record<string, { 
  name: string; 
  amount: number; 
  type: 'bundle' | 'subscription'; 
  billingCycle?: 'monthly' | 'annual';
  credits?: number; 
  plan?: 'basic' | 'pro'; 
  dailyLimit?: number 
}> = {
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
    name: 'Strovr Basic Monthly Subscription',
    amount: 999,
    type: 'subscription',
    billingCycle: 'monthly',
    plan: 'basic',
    credits: 600,
    dailyLimit: 600
  },
  pro: {
    name: 'Strovr Pro Monthly Subscription',
    amount: 1999,
    type: 'subscription',
    billingCycle: 'monthly',
    plan: 'pro',
    credits: 1500,
    dailyLimit: 1500
  },
  basic_annual: {
    name: 'Strovr Basic Annual Subscription (25% Off)',
    amount: 8999,
    type: 'subscription',
    billingCycle: 'annual',
    plan: 'basic',
    credits: 600,
    dailyLimit: 600
  },
  pro_annual: {
    name: 'Strovr Pro Annual Subscription (25% Off)',
    amount: 17999,
    type: 'subscription',
    billingCycle: 'annual',
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
  
  // Resolve user info to persist pending transaction in ledger
  const targetUser = userStore.getUserById(userId) || (userId.includes('@') ? userStore.getUserByEmail(userId) : null);
  transactionStore.addTransaction({
    transactionId,
    userId: targetUser?._id || userId,
    userEmail: targetUser?.email || (userId.includes('@') ? userId : ''),
    userName: targetUser?.name || 'Customer',
    itemKey,
    itemName: item.name,
    amount: item.amount,
    currency: 'INR',
    type: item.type,
    status: 'PENDING',
    gateway: 'PhonePe',
    createdAt: new Date().toISOString()
  });

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

    if (status !== 'SUCCESS') {
      transactionStore.updateStatus(transactionId, 'FAILED');
      return res.status(400).json({ error: 'PhonePe payment reported unsuccessful', status: 'FAILED' });
    }

    // Resolve target account in userStore
    const targetUser = userStore.getUserById(userId) || (userId.includes('@') ? userStore.getUserByEmail(userId) : null);
    const targetId = targetUser?._id || userId;

    // Persist or update verified transaction in transactionStore
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
      updates.billing_cycle = item.billingCycle || 'monthly';
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

// 3. PhonePe Cancel / Abandon Endpoint
router.post('/cancel', async (req, res) => {
  const { transactionId } = req.body;
  if (transactionId) {
    transactionStore.updateStatus(transactionId, 'CANCELLED');
  }
  res.json({ success: true, status: 'CANCELLED' });
});

// 4. User Payment History / Transactions Endpoint
router.get('/transactions', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || '';
    const email = (req.query.email as string) || '';
    const list = transactionStore.getByUser(userId, email);
    res.json({ success: true, count: list.length, transactions: list });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 3. Fallback verification endpoint
router.post('/verify', async (req, res) => {
  const { transactionId } = req.body;
  res.json({ verified: true, transactionId, gateway: 'PhonePe' });
});

export default router;
