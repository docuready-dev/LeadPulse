import express from 'express';
import { db } from '../index';
import { scraperQueue } from '../services/scraperQueue';
import { userStore } from '../services/userStore';
import { leadStore } from '../services/leadStore';
import { transactionStore } from '../services/transactionStore';
import { adminSecurity } from '../middleware/adminSecurity';
import { applyDailyTokenReset, getTodayDateString, PLAN_DAILY_TOKENS } from '../services/tokenManager';

const router = express.Router();

router.use(adminSecurity);

// 1. Mission Control Overview & Telemetry
router.get('/stats', async (req, res) => {
  try {
    let totalUsers = userStore.getAllUsers().length;
    let totalLeads = leadStore.getLeads().length;
    let totalRevenue = transactionStore.getTotalRevenue();

    try {
      const usersSnapshot = await db.collection('users').get();
      if (!usersSnapshot.empty) totalUsers = Math.max(totalUsers, usersSnapshot.size);
      const leadsSnapshot = await db.collection('leads').get();
      if (!leadsSnapshot.empty) totalLeads = Math.max(totalLeads, leadsSnapshot.size);
      const txSnapshot = await db.collection('transactions').where('status', '==', 'SUCCESS').get();
      let fsRevenue = 0;
      txSnapshot.forEach(doc => {
        fsRevenue += doc.data().amount || 0;
      });
      if (fsRevenue > totalRevenue) totalRevenue = fsRevenue;
    } catch {}

    const queueStats = scraperQueue.getStats();

    res.json({
      totalUsers,
      totalLeads,
      totalRevenue,
      scraper: {
        activeWorkers: queueStats.isProcessing ? 1 : 0,
        queuedJobs: queueStats.queueLength,
        status: queueStats.isProcessing ? 'BUSY' : 'IDLE'
      },
      system: {
        database: 'Google Cloud Firestore',
        uptime: Math.round(process.uptime()),
        nodeVersion: process.version,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB'
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve admin stats' });
  }
});

// 2. User Management
router.get('/users', async (req, res) => {
  try {
    let firestoreUsers: any[] = [];
    try {
      const usersSnapshot = await db.collection('users').get();
      firestoreUsers = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        delete data.password;
        return { _id: doc.id, ...data };
      });
    } catch {}

    const localUsers = userStore.getAllUsers().map(u => {
      const copy = { ...u };
      delete (copy as any).password;
      return copy;
    });

    const userMap = new Map<string, any>();
    for (const u of localUsers) {
      const key = (u.email || u._id).toLowerCase().trim();
      // Apply daily token reset on view
      const { userData } = applyDailyTokenReset(u);
      userMap.set(key, userData);
    }

    for (const u of firestoreUsers) {
      const key = (u.email || u._id).toLowerCase().trim();
      const existingLocal = userMap.get(key);
      if (existingLocal) {
        // Never allow stale Firestore doc to wipe out newer userStore lead_credits or topup_credits
        const localUpdated = existingLocal.updatedAt ? new Date(existingLocal.updatedAt).getTime() : 0;
        const firestoreUpdated = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
        if (localUpdated >= firestoreUpdated) {
          userMap.set(key, { ...u, ...existingLocal });
        } else {
          userMap.set(key, { ...existingLocal, ...u });
        }
      } else {
        const { userData } = applyDailyTokenReset(u);
        userMap.set(key, userData);
      }
    }

    // Ensure Ashley Super Admin is strictly present
    const ashleyRecord = userStore.getUserById('user_ashleyghose64') || userStore.getUserByEmail('ashleyghose64@gmail.com');
    if (ashleyRecord) {
      const copy = { ...ashleyRecord };
      delete (copy as any).password;
      userMap.set('ashleyghose64@gmail.com', copy);
    }

    // Ensure Bicon Ghose is strictly present
    const biconRecord = userStore.getUserById('user_ashleyghose28') || userStore.getUserByEmail('ashleyghose28@gmail.com');
    if (biconRecord) {
      const copy = { ...biconRecord };
      delete (copy as any).password;
      userMap.set('ashleyghose28@gmail.com', copy);
    }

    res.json(Array.from(userMap.values()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Adjust or Set Credits (supports topup tokens or daily base tokens)
router.post('/users/:id/credits', async (req, res) => {
  const { id } = req.params;
  const { amount, mode, target = 'topup' } = req.body; // mode: 'add' or 'set', target: 'topup' | 'base'
  
  try {
    let existing = userStore.getUserById(id) || (id.includes('@') ? userStore.getUserByEmail(id) : null);
    let firestoreDocId = id;

    if (!existing) {
      try {
        const docSnap = await db.collection('users').doc(id).get();
        if (docSnap.exists) {
          existing = userStore.saveUser({ _id: docSnap.id, ...(docSnap.data() as any) });
          firestoreDocId = docSnap.id;
        } else if (id.includes('@')) {
          const qSnap = await db.collection('users').where('email', '==', id.toLowerCase().trim()).get();
          if (!qSnap.empty) {
            const d = qSnap.docs[0];
            existing = userStore.saveUser({ _id: d.id, ...(d.data() as any) });
            firestoreDocId = d.id;
          }
        }
      } catch {}
    }

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetId = existing._id;
    const userPlan = (existing.plan || 'free').toLowerCase();
    const defaultBase = userPlan === 'basic' ? 600 : userPlan === 'pro' ? 1500 : 15;
    let currentBase = existing.lead_credits !== undefined ? Number(existing.lead_credits) : defaultBase;
    let currentTopup = existing.topup_credits !== undefined ? Number(existing.topup_credits) : 0;
    const numAmount = Number(amount) || 0;

    let newBase = currentBase;
    let newTopup = currentTopup;

    if (target === 'base') {
      newBase = mode === 'set' ? numAmount : currentBase + numAmount;
      if (newBase < 0) newBase = 0;
    } else {
      // Default: adjust topup tokens (used first, never resets daily)
      newTopup = mode === 'set' ? numAmount : currentTopup + numAmount;
      if (newTopup < 0) newTopup = 0;
    }

    const updates: any = { 
      lead_credits: newBase,
      topup_credits: newTopup,
      base_daily_credits: target === 'base' && mode === 'set' ? Math.max(1, newBase) : (existing.base_daily_credits || defaultBase),
      has_topup: true,
      admin_credits_granted: true,
      pool_refreshed_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedUser = userStore.updateUser(targetId, updates);
    if (existing.email) {
      userStore.updateUser(existing.email, updates);
    }

    try {
      await db.collection('users').doc(firestoreDocId).set(updates, { merge: true });
      if (targetId !== firestoreDocId) {
        await db.collection('users').doc(targetId).set(updates, { merge: true });
      }
    } catch {}

    const cleanUser = updatedUser ? { ...updatedUser } : null;
    if (cleanUser) delete (cleanUser as any).password;

    res.json({ 
      success: true, 
      lead_credits: newBase, 
      topup_credits: newTopup,
      total_credits: newBase + newTopup,
      user: cleanUser 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credits' });
  }
});

// Change Plan / Tier (free, basic, pro)
router.post('/users/:id/tier', async (req, res) => {
  const { id } = req.params;
  const { plan } = req.body;
  if (!['free', 'basic', 'pro'].includes(plan?.toLowerCase())) {
    return res.status(400).json({ error: 'Invalid tier/plan. Must be free, basic, or pro.' });
  }

  let existing = userStore.getUserById(id) || (id.includes('@') ? userStore.getUserByEmail(id) : null);
  let firestoreDocId = id;
  if (!existing) {
    try {
      const docSnap = await db.collection('users').doc(id).get();
      if (docSnap.exists) {
        existing = userStore.saveUser({ _id: docSnap.id, ...(docSnap.data() as any) });
        firestoreDocId = docSnap.id;
      }
    } catch {}
  }

  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const targetId = existing._id;
  if (targetId === 'user_ashleyghose64' || (existing?.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
    if (plan.toLowerCase() !== 'pro') {
      return res.status(403).json({ error: 'The Super Admin account ashleyghose64@gmail.com is strictly locked to pro plan.' });
    }
  }

  try {
    const normalizedPlan = plan.toLowerCase();
    const dailyTokens = normalizedPlan === 'basic' ? 600 : normalizedPlan === 'pro' ? 1500 : 15;
    const emailLimits: Record<string, number> = { free: 50, basic: 1500, pro: 5000 };
    const aiLimits: Record<string, number> = { free: 5, basic: 250, pro: -1 };

    const updates: any = {
      plan: normalizedPlan,
      lead_credits: dailyTokens,
      base_daily_credits: dailyTokens,
      last_token_reset_date: getTodayDateString(),
      emails_limit: emailLimits[normalizedPlan] || 50,
      ai_pitches_limit: aiLimits[normalizedPlan] !== undefined ? aiLimits[normalizedPlan] : 5,
      has_topup: true,
      updatedAt: new Date().toISOString()
    };

    const updatedUser = userStore.updateUser(targetId, updates);
    if (existing.email) {
      userStore.updateUser(existing.email, updates);
    }

    try {
      await db.collection('users').doc(firestoreDocId).set(updates, { merge: true });
      if (targetId !== firestoreDocId) {
        await db.collection('users').doc(targetId).set(updates, { merge: true });
      }
    } catch {}

    const cleanUser = updatedUser ? { ...updatedUser } : null;
    if (cleanUser) delete (cleanUser as any).password;

    res.json({ success: true, plan: normalizedPlan, user: cleanUser, updates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user tier' });
  }
});

// Change Role (SUPER_ADMIN vs USER)
router.post('/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!['SUPER_ADMIN', 'USER'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existing = userStore.getUserById(id);
  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const targetId = existing._id;
  if (targetId === 'user_ashleyghose64' || (existing?.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
    return res.status(403).json({ error: 'The Super Admin account ashleyghose64@gmail.com is strictly locked to SUPER_ADMIN only.' });
  }

  try {
    const updatedUser = userStore.updateUser(targetId, { role });
    try {
      await db.collection('users').doc(targetId).set({ role }, { merge: true });
    } catch {}
    const cleanUser = updatedUser ? { ...updatedUser } : null;
    if (cleanUser) delete (cleanUser as any).password;
    res.json({ success: true, role, user: cleanUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Reset Onboarding (allows re-testing full onboarding lifecycle)
router.post('/users/:id/reset-onboarding', async (req, res) => {
  const { id } = req.params;
  const existing = userStore.getUserById(id);
  const targetId = existing?._id || id;
  try {
    const updatedUser = userStore.updateUser(targetId, { onboarding_complete: false });
    try {
      await db.collection('users').doc(targetId).set({ onboarding_complete: false }, { merge: true });
    } catch {}
    const cleanUser = updatedUser ? { ...updatedUser } : null;
    if (cleanUser) delete (cleanUser as any).password;
    res.json({ success: true, message: 'Onboarding reset successfully', user: cleanUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const existing = userStore.getUserById(id);
  const targetId = existing?._id || id;
  if (targetId === 'user_ashleyghose64' || (existing?.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
    return res.status(403).json({ error: 'The Super Admin account ashleyghose64@gmail.com cannot be deleted.' });
  }

  try {
    userStore.deleteUser(targetId);
    try {
      await db.collection('users').doc(targetId).delete();
      const leadsSnapshot = await db.collection('leads').where('userId', '==', targetId).get();
      const batch = db.batch();
      leadsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch {}
    res.json({ success: true, message: 'User and associated data purged' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 3. Payments & Financial Transactions Ledger
router.get('/transactions', async (req, res) => {
  try {
    const localTxs = transactionStore.getAll();
    let firestoreTxs: any[] = [];
    try {
      const snap = await db.collection('transactions').orderBy('createdAt', 'desc').limit(100).get();
      firestoreTxs = snap.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } catch {}

    const txMap = new Map<string, any>();
    for (const t of localTxs) {
      txMap.set(t.transactionId, t);
    }
    for (const t of firestoreTxs) {
      if (t.transactionId) {
        txMap.set(t.transactionId, { ...(txMap.get(t.transactionId) || {}), ...t });
      }
    }

    const merged = Array.from(txMap.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    res.json(merged);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// 4. Platform Workflow Settings (A-to-Z Config)
router.get('/settings', async (req, res) => {
  try {
    const defaults = {
      freeCreditsOnSignup: 15,
      creditCostPerSearch: 1,
      scraperConcurrency: 2,
      scrapeTimeoutSecs: 30,
      proxyRotation: false,
      deepEnrichment: true,
      smtpProvider: 'System Nodemailer / SendGrid',
      maxOutreachPerHour: 50,
      complianceFooterEnforced: true,
      suppressionList: ['test@example.com', 'spam@domain.com']
    };

    try {
      const configDoc = await db.collection('system').doc('config').get();
      if (configDoc.exists) {
        return res.json(configDoc.data());
      }
      await db.collection('system').doc('config').set(defaults);
    } catch {}

    res.json(defaults);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load system config' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const newConfig = req.body;
    try {
      await db.collection('system').doc('config').set(newConfig, { merge: true });
    } catch {}
    res.json({ success: true, settings: newConfig });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save system config' });
  }
});

// 5. Scraper Engine Controls
router.post('/scraper/clear', (req, res) => {
  const dropped = scraperQueue.clearQueue();
  res.json({ success: true, droppedJobs: dropped });
});

// 6. Global Leads Governance
router.get('/leads', async (req, res) => {
  try {
    let leads: any[] = [];
    try {
      const snapshot = await db.collection('leads').orderBy('createdAt', 'desc').limit(200).get();
      leads = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } catch {}

    if (leads.length === 0) {
      leads = leadStore.getLeads().slice(0, 200);
    }
    res.json(leads);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch global leads' });
  }
});

router.delete('/leads/purge', async (req, res) => {
  try {
    let deletedCount = 0;
    try {
      const snapshot = await db.collection('leads').get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      deletedCount = snapshot.size;
    } catch {}

    res.json({ success: true, deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purge leads' });
  }
});

export default router;
