import express from 'express';
import { db } from '../index';
import { scraperQueue } from '../services/scraperQueue';
import { userStore } from '../services/userStore';
import { leadStore } from '../services/leadStore';

const router = express.Router();

import { adminSecurity } from '../middleware/adminSecurity';

router.use(adminSecurity);

// 1. Mission Control Overview & Telemetry
router.get('/stats', async (req, res) => {
  try {
    let totalUsers = userStore.getAllUsers().length;
    let totalLeads = leadStore.getLeads().length;
    let totalRevenue = 0;

    try {
      const usersSnapshot = await db.collection('users').get();
      if (!usersSnapshot.empty) totalUsers = Math.max(totalUsers, usersSnapshot.size);
      const leadsSnapshot = await db.collection('leads').get();
      if (!leadsSnapshot.empty) totalLeads = Math.max(totalLeads, leadsSnapshot.size);
      const txSnapshot = await db.collection('transactions').where('status', '==', 'SUCCESS').get();
      txSnapshot.forEach(doc => {
        totalRevenue += doc.data().amount || 0;
      });
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
        delete data.password; // Never expose hashed passwords
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
      userMap.set(u._id, u);
    }
    for (const u of firestoreUsers) {
      userMap.set(u._id, { ...(userMap.get(u._id) || {}), ...u });
    }

    res.json(Array.from(userMap.values()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Adjust or Set Credits
router.post('/users/:id/credits', async (req, res) => {
  const { id } = req.params;
  const { amount, mode } = req.body; // mode: 'add' or 'set'
  
  try {
    const userRef = db.collection('users').doc(id);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    
    let newCredits = doc.data()?.lead_credits || 0;
    if (mode === 'set') {
      newCredits = Number(amount);
    } else {
      newCredits += Number(amount);
    }
    if (newCredits < 0) newCredits = 0;

    await userRef.update({ lead_credits: newCredits });
    res.json({ success: true, lead_credits: newCredits });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credits' });
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
  if (id === 'user_ashleyghose64' || (existing?.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
    return res.status(403).json({ error: 'The Super Admin account ashleyghose64@gmail.com is strictly locked to SUPER_ADMIN only.' });
  }

  try {
    userStore.updateUser(id, { role });
    await db.collection('users').doc(id).update({ role });
    res.json({ success: true, role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Reset Onboarding (allows re-testing full onboarding lifecycle)
router.post('/users/:id/reset-onboarding', async (req, res) => {
  const { id } = req.params;
  try {
    userStore.updateUser(id, { onboarding_complete: false });
    await db.collection('users').doc(id).update({ onboarding_complete: false });
    res.json({ success: true, message: 'Onboarding reset successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset onboarding' });
  }
});

// Delete User
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  const existing = userStore.getUserById(id);
  if (id === 'user_ashleyghose64' || (existing?.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
    return res.status(403).json({ error: 'The Super Admin account ashleyghose64@gmail.com cannot be deleted.' });
  }

  try {
    userStore.deleteUser(id);
    await db.collection('users').doc(id).delete();
    // Also remove user's leads
    const leadsSnapshot = await db.collection('leads').where('userId', '==', id).get();
    const batch = db.batch();
    leadsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true, message: 'User and associated data purged' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// 3. Platform Workflow Settings (A-to-Z Config)
router.get('/settings', async (req, res) => {
  try {
    const configDoc = await db.collection('system').doc('config').get();
    if (!configDoc.exists) {
      // Default system workflow settings
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
      await db.collection('system').doc('config').set(defaults);
      return res.json(defaults);
    }
    res.json(configDoc.data());
  } catch (err) {
    res.status(500).json({ error: 'Failed to load system config' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const newConfig = req.body;
    await db.collection('system').doc('config').set(newConfig, { merge: true });
    res.json({ success: true, settings: newConfig });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save system config' });
  }
});

// 4. Scraper Engine Controls
router.post('/scraper/clear', (req, res) => {
  const dropped = scraperQueue.clearQueue();
  res.json({ success: true, droppedJobs: dropped });
});

// 5. Global Leads Governance
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
    const snapshot = await db.collection('leads').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true, deletedCount: snapshot.size });
  } catch (err) {
    res.status(500).json({ error: 'Failed to purge leads' });
  }
});

export default router;
