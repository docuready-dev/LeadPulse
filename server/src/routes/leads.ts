import express from 'express';
import { db } from '../index';
import { scraperQueue } from '../services/scraperQueue';
import { syncUserPoolCredits } from './auth';
import { leadStore } from '../services/leadStore';
import { userStore } from '../services/userStore';

const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  let firestoreLeads: any[] = [];
  try {
    const leadsRef = db.collection('leads');
    const snapshot = await leadsRef.where('userId', '==', userId).limit(300).get();
    firestoreLeads = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
  } catch (err: any) {
    console.warn('[Leads] Firestore unauthenticated or offline, serving from local store:', err.message);
  }

  // Merge with local persistent store
  const localLeads = leadStore.getLeads(userId);
  const seenIds = new Set(firestoreLeads.map(l => l._id));
  const merged = [...firestoreLeads];

  for (const lead of localLeads) {
    if (!seenIds.has(lead._id)) {
      seenIds.add(lead._id);
      merged.push(lead);
    }
  }

  merged.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  res.json(merged);
});

// Manual Contact / Lead Creation
router.post('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { businessName, email, phone, category, location, website, status = 'New', tags = [], source = 'Manual Entry' } = req.body;
  if (!businessName && !email) {
    return res.status(400).json({ error: 'Business Name or Email is required' });
  }

  const newLead = {
    userId,
    businessName: businessName || (email ? email.split('@')[0] : 'New Contact'),
    email: email || '',
    phone: phone || '',
    category: category || 'General B2B',
    location: location || '',
    website: website || '',
    status: status || 'New',
    tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    source,
    saved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let savedId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const leadsRef = db.collection('leads');
    const docRef = await leadsRef.add(newLead);
    savedId = docRef.id;
  } catch (err: any) {
    console.warn('[Leads] Firestore write failed, stored in local persistent store:', err.message);
  }

  const savedLead = leadStore.addLead({ ...newLead, _id: savedId });
  res.json(savedLead);
});

// Public Form Capture Endpoint (No auth header required so external website forms can submit!)
router.post('/form-submit/:userId', async (req, res) => {
  const { userId } = req.params;
  const { name, email, phone, company, formId = 'website-embed' } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  const newLead = {
    userId,
    businessName: company || name || email.split('@')[0],
    email,
    phone: phone || '',
    category: 'Inbound Form',
    location: 'Website Inbound',
    website: '',
    status: 'New',
    tags: ['Inbound Lead', formId],
    source: `Form: ${formId}`,
    saved: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let savedId = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const leadsRef = db.collection('leads');
    const docRef = await leadsRef.add(newLead);
    savedId = docRef.id;
  } catch (err: any) {
    console.warn('[Leads] Firestore form capture write failed, stored in local persistent store:', err.message);
  }

  leadStore.addLead({ ...newLead, _id: savedId });
  res.json({ success: true, message: 'Lead captured successfully!', id: savedId });
});

// ============================================================================
// SERPAPI ENGINE INTEGRATION & TIER STATUS
// ============================================================================
export const memorySerpApiStore = new Map<string, any>();

// Check SerpApi engine connection and live quota
router.get('/serpapi/status', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let serpInfo = memorySerpApiStore.get(userId);
    let apiKey = serpInfo?.apiKey;

    if (!apiKey) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const udata = userDoc.data() || {};
          apiKey = udata.serpapi_key;
          if (apiKey) {
            serpInfo = {
              apiKey,
              plan_id: udata.serpapi_plan || 'free',
              plan_name: udata.serpapi_plan_name || 'Free',
              searches_per_month: udata.serpapi_searches_per_month || 100,
              plan_searches_left: udata.serpapi_searches_left ?? 100,
              this_month_usage: udata.serpapi_this_month_usage || 0
            };
            memorySerpApiStore.set(userId, serpInfo);
          }
        }
      } catch (dbErr) {
        const localUser = userStore.getUserById(userId);
        if (localUser && localUser.serpapi_key) {
          apiKey = localUser.serpapi_key;
          serpInfo = {
            apiKey,
            plan_id: localUser.serpapi_plan || 'free',
            plan_name: localUser.serpapi_plan_name || 'Free',
            searches_per_month: localUser.serpapi_searches_per_month || 100,
            plan_searches_left: localUser.serpapi_searches_left ?? 100,
            this_month_usage: localUser.serpapi_this_month_usage || 0
          };
          memorySerpApiStore.set(userId, serpInfo);
        }
      }
    }

    if (!apiKey) {
      return res.json({
        isConnected: false,
        account: null
      });
    }

    // Attempt live usage refresh from SerpApi account API
    try {
      const resp = await fetch(`https://serpapi.com/account?api_key=${apiKey}`);
      const data: any = await resp.json();
      if (data && !data.error && data.plan_id) {
        const updated = {
          apiKey,
          plan_id: data.plan_id || 'free',
          plan_name: data.plan_name || 'Free',
          searches_per_month: data.searches_per_month || 100,
          plan_searches_left: data.plan_searches_left ?? (data.total_searches_left ?? 100),
          this_month_usage: data.this_month_usage ?? 0,
          account_email: data.account_email || ''
        };
        memorySerpApiStore.set(userId, updated);
        return res.json({
          isConnected: true,
          account: updated
        });
      }
    } catch (apiErr) {
      // Continue with cached details
    }

    res.json({
      isConnected: true,
      account: serpInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check SerpApi status' });
  }
});

// Verify & connect user SerpApi key
router.post('/serpapi/connect', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { apiKey } = req.body;
  const cleanKey = (apiKey || '').trim();

  if (!cleanKey) {
    return res.status(400).json({ success: false, error: 'SerpApi API key is required.' });
  }

  try {
    const resp = await fetch(`https://serpapi.com/account?api_key=${cleanKey}`);
    const data: any = await resp.json();

    if (data.error || !data.plan_id) {
      return res.status(400).json({
        success: false,
        error: data.error || 'Invalid SerpApi API key. Please check your key at https://serpapi.com/manage-api-key'
      });
    }

    const accountRecord = {
      apiKey: cleanKey,
      plan_id: data.plan_id || 'free',
      plan_name: data.plan_name || 'Free',
      searches_per_month: data.searches_per_month || 100,
      plan_searches_left: data.plan_searches_left ?? (data.total_searches_left ?? 100),
      this_month_usage: data.this_month_usage ?? 0,
      account_email: data.account_email || ''
    };

    memorySerpApiStore.set(userId, accountRecord);
    userStore.updateUser(userId, {
      serpapi_key: cleanKey,
      serpapi_connected: true,
      serpapi_plan: accountRecord.plan_id,
      serpapi_plan_name: accountRecord.plan_name,
      serpapi_searches_left: accountRecord.plan_searches_left,
      serpapi_searches_per_month: accountRecord.searches_per_month,
      serpapi_this_month_usage: accountRecord.this_month_usage,
      serpapi_updated_at: new Date().toISOString()
    });

    await db.collection('users').doc(userId).update({
      serpapi_key: cleanKey,
      serpapi_connected: true,
      serpapi_plan: accountRecord.plan_id,
      serpapi_plan_name: accountRecord.plan_name,
      serpapi_searches_left: accountRecord.plan_searches_left,
      serpapi_searches_per_month: accountRecord.searches_per_month,
      serpapi_this_month_usage: accountRecord.this_month_usage,
      serpapi_updated_at: new Date().toISOString()
    }).catch(err => {
      console.warn('[Leads] Could not persist SerpApi info to Firestore:', err);
    });

    res.json({
      success: true,
      message: 'SerpApi engine connected and verified successfully!',
      account: accountRecord
    });
  } catch (err: any) {
    console.error('[Leads] SerpApi connection error:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to connect to SerpApi' });
  }
});

// Disconnect SerpApi key
router.delete('/serpapi/disconnect', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  memorySerpApiStore.delete(userId);
  userStore.updateUser(userId, {
    serpapi_key: undefined,
    serpapi_connected: false,
    serpapi_plan: undefined,
    serpapi_plan_name: undefined,
    serpapi_searches_left: undefined
  });

  try {
    await db.collection('users').doc(userId).update({
      serpapi_key: null,
      serpapi_connected: false,
      serpapi_plan: null,
      serpapi_plan_name: null,
      serpapi_searches_left: null
    });
  } catch {}

  res.json({ success: true, message: 'SerpApi engine disconnected.' });
});

router.post('/scrape', async (req, res) => {
  const userId = req.headers.userid as string;
  const { keyword, location, scope = 'quick' } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!keyword || !location) return res.status(400).json({ error: 'Keyword and Location required' });

  try {
    const userRef = db.collection('users').doc(userId);
    let preSnap: any = null;
    let userData: any = null;

    try {
      preSnap = await userRef.get();
      if (preSnap && preSnap.exists) {
        userData = preSnap.data();
      }
    } catch (dbErr) {
      console.warn('[Leads] Could not fetch user doc from Firestore:', dbErr);
    }

    if (!userData) {
      const localU = userStore.getUserById(userId);
      if (localU) {
        userData = { ...localU };
      }
    }

    // Normalize Free tier pool (15 tokens max, 1 token = 1 contact) before transaction
    if (userData) {
      await syncUserPoolCredits(userId, userData).catch(() => {});
    }

    let currentCredits = userData?.lead_credits ?? 15;
    let userPlan = (userData?.plan || 'free').toLowerCase();
    let poolRefreshedAt = userData?.pool_refreshed_at || new Date().toISOString();

    const isDeep = scope === 'deep';
    const costPerContact = isDeep ? 2 : 1;

    // STRICT CHECK: Reject immediately if user has insufficient tokens for the chosen scope
    if (currentCredits < costPerContact) {
      return res.status(403).json({
        error: isDeep
          ? `Insufficient tokens. Deep Harvest requires 2 tokens per contact (2 tokens = 1 contact). You have ${currentCredits} token(s) remaining. Switch to Quick Scan (1 token = 1 contact) or top up your pool.`
          : 'Insufficient tokens. You have exhausted all tokens in your Free Tier pool (0 / 15 remaining). Tokens auto-refresh every 4 days, or you can top up / upgrade to Basic or Pro.',
        needsTopUp: true,
        creditsRemaining: currentCredits
      });
    }

    // Check SerpApi engine requirement
    const userSerpInfo = memorySerpApiStore.get(userId);
    const resolvedSerpKey = userSerpInfo?.apiKey || userData?.serpapi_key || process.env.SERPAPI_KEY || '';

    if (!resolvedSerpKey) {
      return res.status(400).json({
        error: 'SerpApi connection required for lead harvesting. Please connect your SerpApi account.',
        needsSerpApi: true
      });
    }

    const maxPerQuery = userPlan === 'free' ? 10 : 20;
    // Cap query limit strictly by affordable contacts
    const maxContactsAffordable = Math.floor(currentCredits / costPerContact);
    let limit = Math.min(maxPerQuery, maxContactsAffordable);
    let tokensUsed = limit * costPerContact;
    let creditsRemaining = Math.max(0, currentCredits - tokensUsed);

    // Deduct tokens upfront (Quick: 1 Token/Contact, Deep: 2 Tokens/Contact)
    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) return;
        const data = doc.data()!;
        userPlan = (data.plan || 'free').toLowerCase();
        poolRefreshedAt = data.pool_refreshed_at || new Date().toISOString();

        let liveCredits = data.lead_credits ?? 15;

        // Check 4-day auto-refresh & free-tier 15-token cap
        if (userPlan === 'free') {
          const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
          const lastRefresh = data.pool_refreshed_at ? new Date(data.pool_refreshed_at).getTime() : 0;
          if (lastRefresh > 0 && Date.now() - lastRefresh >= fourDaysMs) {
            liveCredits = 15;
            poolRefreshedAt = new Date().toISOString();
          } else if (!data.has_topup && liveCredits > 15) {
            liveCredits = 15;
          }
        }

        if (liveCredits < costPerContact) {
          throw new Error("Insufficient credits");
        }

        const maxAffordable = Math.floor(liveCredits / costPerContact);
        limit = Math.min(maxPerQuery, maxAffordable);
        tokensUsed = limit * costPerContact;
        creditsRemaining = Math.max(0, liveCredits - tokensUsed);

        t.update(userRef, { 
          lead_credits: creditsRemaining,
          pool_refreshed_at: poolRefreshedAt
        });
      });
    } catch (txErr: any) {
      if (txErr.message === "Insufficient credits") {
        return res.status(403).json({ 
          error: isDeep
            ? `Insufficient tokens. Deep Harvest requires 2 tokens per contact (2 tokens = 1 contact). You have ${currentCredits} token(s) remaining.`
            : 'Insufficient tokens. You have exhausted all tokens in your Free Tier pool (0 / 15 remaining).', 
          needsTopUp: true, 
          creditsRemaining: currentCredits 
        });
      }
      // If Firestore transaction fails due to offline/permission, proceed with local deduction
      userStore.updateUser(userId, { lead_credits: creditsRemaining });
    }
    
    // Always persist deduction in local store
    userStore.updateUser(userId, { lead_credits: creditsRemaining });
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    scraperQueue.add({ 
      id: jobId,
      userId, 
      keyword, 
      location, 
      scope, 
      limit,
      tokensReserved: tokensUsed,
      costPerContact,
      serpApiKey: resolvedSerpKey
    });
    
    res.json({ 
      message: 'Scraping started via Lead Finder Wizard', 
      jobId,
      creditsRemaining,
      tokensUsed,
      contactsTarget: limit,
      costPerContact,
      scope,
      plan: userPlan,
      poolRefreshedAt,
      limit
    });
  } catch (err: any) {
    if (err.message === "Insufficient credits") {
      return res.status(403).json({ error: 'Insufficient credits', needsTopUp: true });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;
  const status = scraperQueue.getJobStatus(jobId);
  if (!status) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(status);
});

router.get('/active-job', (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const activeJob = scraperQueue.getActiveJobForUser(userId);
  res.json({ activeJob: activeJob || null });
});

// Batch Save / Update Leads
router.post('/batch-save', async (req, res) => {
  try {
    const userId = req.headers.userid as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ids, all, saved = true } = req.body;

    const localCount = leadStore.batchSaveStatus(Array.isArray(ids) ? ids : [], saved, userId);

    try {
      const leadsRef = db.collection('leads');
      let docRefs: FirebaseFirestore.DocumentReference[] = [];

      if (all) {
        const snapshot = await leadsRef.where('userId', '==', userId).get();
        docRefs = snapshot.docs.map(d => d.ref);
      } else if (Array.isArray(ids) && ids.length > 0) {
        docRefs = ids.map(id => leadsRef.doc(id));
      }

      if (docRefs.length > 0) {
        const chunkSize = 400;
        for (let i = 0; i < docRefs.length; i += chunkSize) {
          const chunk = docRefs.slice(i, i + chunkSize);
          const batch = db.batch();
          chunk.forEach(ref => {
            batch.update(ref, { saved, updatedAt: new Date().toISOString() });
          });
          await batch.commit();
        }
      }
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore batch save failed (saved locally):', fsErr.message);
    }

    res.json({ success: true, count: localCount || (Array.isArray(ids) ? ids.length : 0) });
  } catch (err: any) {
    console.error('Failed to batch save leads:', err);
    res.status(500).json({ error: err.message || 'Failed to batch save leads' });
  }
});

// Batch Delete Specific Leads
router.post('/batch-delete', async (req, res) => {
  try {
    const userId = req.headers.userid as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No lead IDs provided' });
    }

    const localDeleted = leadStore.batchDelete(ids);

    try {
      const leadsRef = db.collection('leads');
      const chunkSize = 400;
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const batch = db.batch();
        chunk.forEach(id => {
          batch.delete(leadsRef.doc(id));
        });
        await batch.commit();
      }
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore batch delete failed (deleted locally):', fsErr.message);
    }

    res.json({ success: true, deleted: localDeleted || ids.length });
  } catch (err: any) {
    console.error('Failed to batch delete leads:', err);
    res.status(500).json({ error: err.message || 'Failed to batch delete leads' });
  }
});

// Delete All User Leads
router.delete('/all', async (req, res) => {
  try {
    const userId = req.headers.userid as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const localDeleted = leadStore.deleteAll(userId);

    try {
      const leadsRef = db.collection('leads');
      const snapshot = await leadsRef.where('userId', '==', userId).get();
      
      if (snapshot.docs.length > 0) {
        const chunkSize = 400;
        for (let i = 0; i < snapshot.docs.length; i += chunkSize) {
          const chunk = snapshot.docs.slice(i, i + chunkSize);
          const batch = db.batch();
          chunk.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore delete all failed (deleted locally):', fsErr.message);
    }

    res.json({ success: true, deleted: localDeleted });
  } catch (err: any) {
    console.error('Failed to delete all leads:', err);
    res.status(500).json({ error: err.message || 'Failed to delete all leads' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers.userid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const updates = req.body;
    const localUpdated = leadStore.updateLead(id, updates);

    try {
      const docRef = db.collection('leads').doc(id);
      await docRef.update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore patch failed (updated locally):', fsErr.message);
    }

    res.json({ 
      success: true, 
      lead: localUpdated || { _id: id, ...updates }, 
      message: 'Lead updated successfully' 
    });
  } catch (err: any) {
    console.error('Failed to update lead:', err);
    res.status(500).json({ error: err.message || 'Failed to update lead' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.headers.userid;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    leadStore.deleteLead(id);

    try {
      await db.collection('leads').doc(id).delete();
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore delete failed (deleted locally):', fsErr.message);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
