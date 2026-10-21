import express from 'express';
import { db } from '../index';
import { scraperQueue } from '../services/scraperQueue';
import { syncUserPoolCredits } from './auth';
import { leadStore } from '../services/leadStore';
import { userStore } from '../services/userStore';
import { triggerMatchingAutomations } from './automations';
import { applyDailyTokenReset, deductTokens } from '../services/tokenManager';

const router = express.Router();

export function resolveUserContext(req: express.Request): { userId: string; userEmail?: string } | null {
  const rawUserId = (req.headers.userid as string || (req.body && req.body.userId) || '').trim();
  const rawUserEmail = (req.headers.useremail as string || (req.body && req.body.userEmail) || '').trim().toLowerCase();
  
  if (!rawUserId && !rawUserEmail) return null;

  let localUser = rawUserId ? userStore.getUserById(rawUserId) : null;
  if (!localUser && rawUserEmail) {
    localUser = userStore.getUserByEmail(rawUserEmail);
  }

  const effectiveEmail = rawUserEmail || localUser?.email?.toLowerCase().trim() || (rawUserId.includes('@') ? rawUserId.toLowerCase().trim() : undefined);
  const effectiveUserId = rawUserId || localUser?._id || (effectiveEmail ? `user_${effectiveEmail.replace(/[^a-zA-Z0-9]/g, '_')}` : 'anonymous');

  return {
    userId: effectiveUserId,
    userEmail: effectiveEmail
  };
}

router.get('/', async (req, res) => {
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;
  
  let firestoreLeads: any[] = [];
  try {
    const leadsRef = db.collection('leads');
    const snapshot = await leadsRef.where('userId', '==', userId).limit(500).get();
    firestoreLeads = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

    // If user has alternate ID/email, also fetch those leads from Firestore
    if (userEmail && userEmail !== userId) {
      const emailSnapshot = await leadsRef.where('userEmail', '==', userEmail).limit(500).get();
      const existingIds = new Set(firestoreLeads.map(l => l._id));
      emailSnapshot.docs.forEach(doc => {
        if (!existingIds.has(doc.id)) {
          firestoreLeads.push({ _id: doc.id, ...doc.data() });
        }
      });
    }
  } catch (err: any) {
    console.warn('[Leads] Firestore unauthenticated or offline, serving from local store:', err.message);
  }

  // Merge with local persistent store
  const localLeads = leadStore.getLeads(userId, userEmail);
  const seenIds = new Set(firestoreLeads.map(l => l._id));
  const merged = [...firestoreLeads];

  for (const lead of localLeads) {
    if (!seenIds.has(lead._id)) {
      seenIds.add(lead._id);
      merged.push(lead);
    }
  }

  // Back-propagate any firestore leads to local leadStore
  for (const fLead of firestoreLeads) {
    if (!leadStore.getLeadById(fLead._id)) {
      leadStore.addLead(fLead);
    }
  }

  merged.sort((a: any, b: any) => {
    const timeB = new Date(b.harvestedAt || b.createdAt || 0).getTime();
    const timeA = new Date(a.harvestedAt || a.createdAt || 0).getTime();
    return timeB - timeA;
  });
  res.json(merged);
});

// Bi-directional lead vault synchronization endpoint
router.post('/sync-vault', async (req, res) => {
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;

  const { leads = [] } = req.body;
  if (!Array.isArray(leads) || leads.length === 0) {
    const current = leadStore.getLeads(userId, userEmail);
    return res.json({ success: true, count: current.length, leads: current });
  }

  const mergedLeads = leadStore.upsertSyncVault(leads, userId, userEmail);

  // Attempt async sync to Firestore in background
  try {
    const batch = db.collection('leads').firestore.batch();
    let batchCount = 0;
    for (const item of mergedLeads.slice(0, 100)) {
      if (item && item._id) {
        const leadRef = db.collection('leads').doc(item._id);
        const { _id, ...firestoreData } = item;
        batch.set(leadRef, firestoreData, { merge: true });
        batchCount++;
      }
    }
    if (batchCount > 0) {
      await batch.commit().catch(() => {});
    }
  } catch {}

  res.json({
    success: true,
    count: mergedLeads.length,
    leads: mergedLeads
  });
});

// Manual Contact / Lead Creation
router.post('/', async (req, res) => {
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;

  const { businessName, email, phone, category, location, city, website, status = 'New', tags = [], source = 'Manual Entry' } = req.body;
  if (!businessName && !email) {
    return res.status(400).json({ error: 'Business Name or Email is required' });
  }

  const resolvedLocation = (location || city || '').trim();
  const resolvedCity = (city || resolvedLocation).split(',')[0].trim();
  const nowIso = new Date().toISOString();

  const newLead = {
    userId,
    userEmail,
    businessName: businessName || (email ? email.split('@')[0] : 'New Contact'),
    email: email || '',
    phone: phone || '',
    category: category || 'General B2B',
    location: resolvedLocation,
    city: resolvedCity,
    website: website || '',
    status: status || 'New',
    tags: Array.isArray(tags) ? tags : [tags].filter(Boolean),
    source,
    saved: true,
    harvestedAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso
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

// CORS Preflight for Public Form and Webhook endpoints
router.options('/form-submit/:userId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

router.options('/webhook/:userId', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Public Form Capture Endpoint (No auth header required so external website forms can submit from any domain)
router.post('/form-submit/:userId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { userId } = req.params;
  const { name, email, phone, company, formId = 'website-embed', notes, category } = req.body;

  if (!email && !phone) {
    return res.status(400).json({ error: 'Either Email or Phone number is required' });
  }

  // User strategy: Always create a new lead record so each inbound submission is treated as a distinct sales opportunity
  const newLead = {
    userId,
    businessName: company || name || (email ? email.split('@')[0] : 'Inbound Prospect'),
    email: email || '',
    phone: phone || '',
    category: category || 'Inbound Form',
    location: 'Website Inbound',
    website: '',
    status: 'New',
    tags: ['Inbound Lead', formId],
    source: `Form: ${formId}`,
    notes: notes || '',
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

  const stored = leadStore.addLead({ ...newLead, _id: savedId });

  // Auto-enroll in any active matching automations
  triggerMatchingAutomations(userId, 'Inbound Form Submitted', stored).catch(e => {
    console.warn('[Leads] Auto-enrollment error:', e.message);
  });

  res.json({ success: true, message: 'Lead captured successfully!', id: savedId, lead: stored });
});

// Universal Inbound Webhook Endpoint (For Zapier, Make, Typeform, Webflow, n8n, Calendly, etc.)
router.post('/webhook/:userId', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  const { userId } = req.params;
  const b = req.body || {};

  // Smart payload extraction across various payload conventions
  const email = (b.email || b.mail || b.email_address || b.contact_email || b.Email || '').trim();
  const rawName = (b.name || b.fullName || b.full_name || b.contact_name || b.Name || '').trim();
  const firstName = (b.firstName || b.first_name || '').trim();
  const lastName = (b.lastName || b.last_name || '').trim();
  const combinedName = rawName || (firstName ? `${firstName} ${lastName}`.trim() : (email ? email.split('@')[0] : 'Inbound Webhook Lead'));
  const company = (b.company || b.businessName || b.business_name || b.org || b.organization || b.Company || combinedName).trim();
  const phone = (b.phone || b.mobile || b.tel || b.phoneNumber || b.phone_number || b.whatsapp || b.Phone || '').trim();
  const category = (b.category || b.industry || b.niche || 'Webhook Inbound').trim();
  const location = (b.location || b.city || b.country || 'External Webhook').trim();
  const notes = (b.notes || b.message || b.comment || b.description || b.text || '').trim();
  const sourceName = (b.source || b.provider || 'Webhook Integration').trim();

  if (!email && !phone && !company) {
    return res.status(400).json({ error: 'Payload must contain at least an email, phone number, or company name.' });
  }

  // Create fresh lead record (Always Create New policy)
  const newLead = {
    userId,
    businessName: company,
    email,
    phone,
    category,
    location,
    website: b.website || b.url || '',
    status: 'New',
    tags: ['Webhook Inbound', sourceName],
    source: `Webhook: ${sourceName}`,
    notes,
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
    console.warn('[Leads] Firestore webhook lead write failed, stored in local persistent store:', err.message);
  }

  const stored = leadStore.addLead({ ...newLead, _id: savedId });

  // Auto-enroll in any active matching automations
  triggerMatchingAutomations(userId, 'Webhook Inbound', stored).catch(e => {
    console.warn('[Leads] Auto-enrollment error for webhook lead:', e.message);
  });

  res.json({
    success: true,
    message: 'Webhook lead ingested successfully!',
    id: savedId,
    lead: stored
  });
});

// ============================================================================
// SERPAPI ENGINE INTEGRATION & TIER STATUS
// ============================================================================
export const memorySerpApiStore = new Map<string, any>();

// Check SerpApi engine connection and live quota
router.get('/serpapi/status', async (req, res) => {
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;

  try {
    let serpInfo = memorySerpApiStore.get(userId) || (userEmail ? memorySerpApiStore.get(userEmail) : null);
    let apiKey = serpInfo?.apiKey;

    if (!apiKey) {
      // 1. Check local persistent UserStore first
      const localUser = userStore.getUserById(userId) || (userEmail ? userStore.getUserByEmail(userEmail) : null);
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
        if (userEmail) memorySerpApiStore.set(userEmail, serpInfo);
      }
    }

    if (!apiKey) {
      // 2. Query Firestore and back-propagate to UserStore
      try {
        let userDoc = await db.collection('users').doc(userId).get();
        if (!userDoc.exists && userEmail) {
          const snap = await db.collection('users').where('email', '==', userEmail).limit(1).get();
          if (!snap.empty) userDoc = snap.docs[0];
        }
        if (userDoc && userDoc.exists) {
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
            if (userEmail) memorySerpApiStore.set(userEmail, serpInfo);
            userStore.updateUser(userId, {
              serpapi_key: apiKey,
              serpapi_connected: true,
              serpapi_plan: serpInfo.plan_id,
              serpapi_plan_name: serpInfo.plan_name,
              serpapi_searches_left: serpInfo.plan_searches_left
            });
            if (userEmail && userEmail !== userId) {
              userStore.updateUser(userEmail, {
                serpapi_key: apiKey,
                serpapi_connected: true,
                serpapi_plan: serpInfo.plan_id,
                serpapi_plan_name: serpInfo.plan_name,
                serpapi_searches_left: serpInfo.plan_searches_left
              });
            }
          }
        }
      } catch (dbErr) {}
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
        if (userEmail) memorySerpApiStore.set(userEmail, updated);
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
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;

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
    if (userEmail) memorySerpApiStore.set(userEmail, accountRecord);

    const updatePayload = {
      serpapi_key: cleanKey,
      serpapi_connected: true,
      serpapi_plan: accountRecord.plan_id,
      serpapi_plan_name: accountRecord.plan_name,
      serpapi_searches_left: accountRecord.plan_searches_left,
      serpapi_searches_per_month: accountRecord.searches_per_month,
      serpapi_this_month_usage: accountRecord.this_month_usage,
      serpapi_updated_at: new Date().toISOString()
    };

    userStore.updateUser(userId, updatePayload);
    if (userEmail && userEmail !== userId) {
      userStore.updateUser(userEmail, updatePayload);
    }

    try {
      await db.collection('users').doc(userId).set(updatePayload, { merge: true });
      if (userEmail && userEmail !== userId) {
        await db.collection('users').doc(userEmail).set(updatePayload, { merge: true }).catch(() => {});
      }
    } catch (err) {
      console.warn('[Leads] Could not persist SerpApi info to Firestore:', err);
    }

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
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;

  memorySerpApiStore.delete(userId);
  if (userEmail) memorySerpApiStore.delete(userEmail);

  const disconnectPayload = {
    serpapi_key: undefined,
    serpapi_connected: false,
    serpapi_plan: undefined,
    serpapi_plan_name: undefined,
    serpapi_searches_left: undefined
  };

  userStore.updateUser(userId, disconnectPayload);
  if (userEmail && userEmail !== userId) {
    userStore.updateUser(userEmail, disconnectPayload);
  }

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
  const userCtx = resolveUserContext(req);
  if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
  const { userId, userEmail } = userCtx;
  const { keyword, location, scope = 'quick' } = req.body;
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
      const localU = userStore.getUserById(userId) || (userEmail ? userStore.getUserByEmail(userEmail) : null);
      if (localU) {
        userData = { ...localU };
      }
    }

    // 1. Apply daily token reset (Basic resets to 600 everyday, Pro resets to 1500 everyday, Topup stays intact)
    const { userData: freshUser } = applyDailyTokenReset(userData);
    userData = freshUser;

    const currentBase = Math.max(0, Number(userData?.lead_credits) || 0);
    const currentTopup = Math.max(0, Number(userData?.topup_credits) || 0);
    const totalAvailable = currentBase + currentTopup;
    const userPlan = (userData?.plan || 'free').toLowerCase();

    const isDeep = scope === 'deep';
    const costPerContact = isDeep ? 2 : 1;

    // STRICT CHECK: Reject immediately if user has insufficient tokens for the chosen scope
    if (totalAvailable < costPerContact) {
      return res.status(403).json({
        error: isDeep
          ? `Insufficient tokens. Deep Harvest requires 2 tokens per contact (2 tokens = 1 contact). You have ${totalAvailable} token(s) available (${currentBase} base + ${currentTopup} top-up). Switch to Quick Scan (1 token = 1 contact) or top up your pool.`
          : 'Insufficient tokens. You have exhausted all tokens in your pool (0 remaining). Tokens auto-reset everyday (600 for Basic, 1500 for Pro), or you can top up / upgrade your plan.',
        needsTopUp: true,
        creditsRemaining: totalAvailable,
        lead_credits: currentBase,
        topup_credits: currentTopup
      });
    }

    // Check SerpApi engine requirement
    const userSerpInfo = memorySerpApiStore.get(userId) || (userEmail ? memorySerpApiStore.get(userEmail) : null);
    const resolvedSerpKey = userSerpInfo?.apiKey || userData?.serpapi_key || process.env.SERPAPI_KEY || '';

    if (!resolvedSerpKey) {
      return res.status(400).json({
        error: 'SerpApi connection required for lead harvesting. Please connect your SerpApi account.',
        needsSerpApi: true
      });
    }

    const maxPerQuery = userPlan === 'free' ? 10 : 20;
    // Cap query limit strictly by affordable contacts
    const maxContactsAffordable = Math.floor(totalAvailable / costPerContact);
    let limit = Math.min(maxPerQuery, maxContactsAffordable);
    let tokensUsed = limit * costPerContact;

    // Deduct tokens (Top-Up tokens are deducted FIRST, then Base Daily Tokens)
    const deduction = deductTokens(userData, tokensUsed);
    if (!deduction.success) {
      return res.status(403).json({
        error: 'Insufficient tokens to launch this harvest query.',
        needsTopUp: true,
        creditsRemaining: totalAvailable
      });
    }

    const tokenUpdates = {
      lead_credits: deduction.newBase,
      topup_credits: deduction.newTopup,
      last_token_reset_date: userData.last_token_reset_date,
      base_daily_credits: userData.base_daily_credits,
      has_topup: userData.has_topup || deduction.newTopup > 0,
      updatedAt: new Date().toISOString()
    };

    // Persist in local store
    userStore.updateUser(userId, tokenUpdates);
    if (userEmail && userEmail !== userId) {
      userStore.updateUser(userEmail, tokenUpdates);
    }

    // Persist in Firestore
    try {
      await db.collection('users').doc(userId).set(tokenUpdates, { merge: true });
    } catch (fsErr: any) {
      console.warn('[Leads] Firestore token update note:', fsErr.message);
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    scraperQueue.add({ 
      id: jobId,
      userId, 
      userEmail,
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
      creditsRemaining: deduction.totalRemaining,
      lead_credits: deduction.newBase,
      topup_credits: deduction.newTopup,
      tokensUsed,
      contactsTarget: limit,
      costPerContact,
      scope,
      plan: userPlan,
      poolRefreshedAt: userData.pool_refreshed_at || new Date().toISOString(),
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
    const userCtx = resolveUserContext(req);
    if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, userEmail } = userCtx;
    const { ids, all, saved = true } = req.body;

    const localCount = leadStore.batchSaveStatus(Array.isArray(ids) ? ids : [], saved, userId, userEmail);

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
    const userCtx = resolveUserContext(req);
    if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
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
    const userCtx = resolveUserContext(req);
    if (!userCtx) return res.status(401).json({ error: 'Unauthorized' });
    const { userId, userEmail } = userCtx;

    const localDeleted = leadStore.deleteAll(userId, userEmail);

    try {
      const leadsRef = db.collection('leads');
      const snapshot = await leadsRef.where('userId', '==', userId).get();
      const docsToDelete = [...snapshot.docs];

      if (userEmail && userEmail !== userId) {
        const emailSnap = await leadsRef.where('userEmail', '==', userEmail).get();
        const existingIds = new Set(docsToDelete.map(d => d.id));
        emailSnap.docs.forEach(d => {
          if (!existingIds.has(d.id)) docsToDelete.push(d);
        });
      }
      
      if (docsToDelete.length > 0) {
        const chunkSize = 400;
        for (let i = 0; i < docsToDelete.length; i += chunkSize) {
          const chunk = docsToDelete.slice(i, i + chunkSize);
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
