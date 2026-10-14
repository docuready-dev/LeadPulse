import express from 'express';
import { db } from '../index';
import { scraperQueue } from '../services/scraperQueue';
import { syncUserPoolCredits } from './auth';

const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const leadsRef = db.collection('leads');
    const snapshot = await leadsRef.where('userId', '==', userId).limit(300).get();
    
    const leads = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    leads.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(leads);
  } catch (err) {
    console.error('[Leads] Error fetching leads:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Manual Contact / Lead Creation
router.post('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { businessName, email, phone, category, location, website, status = 'New', tags = [], source = 'Manual Entry' } = req.body;
  if (!businessName && !email) {
    return res.status(400).json({ error: 'Business Name or Email is required' });
  }

  try {
    const leadsRef = db.collection('leads');
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

    const docRef = await leadsRef.add(newLead);
    res.json({ _id: docRef.id, ...newLead });
  } catch (err: any) {
    console.error('Failed to create lead:', err);
    res.status(500).json({ error: err.message || 'Failed to create lead' });
  }
});

// Public Form Capture Endpoint (No auth header required so external website forms can submit!)
router.post('/form-submit/:userId', async (req, res) => {
  const { userId } = req.params;
  const { name, email, phone, company, formId = 'website-embed' } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const leadsRef = db.collection('leads');
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

    const docRef = await leadsRef.add(newLead);
    res.json({ success: true, message: 'Lead captured successfully!', id: docRef.id });
  } catch (err: any) {
    console.error('Failed to capture lead via form:', err);
    res.status(500).json({ error: 'Failed to capture lead' });
  }
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
        // Continue with memory store
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

    // Check SerpApi engine requirement
    const userSerpInfo = memorySerpApiStore.get(userId);
    const resolvedSerpKey = userSerpInfo?.apiKey || userData?.serpapi_key || process.env.SERPAPI_KEY || '';

    if (!resolvedSerpKey) {
      return res.status(400).json({
        error: 'SerpApi connection required for lead harvesting. Please connect your SerpApi account.',
        needsSerpApi: true
      });
    }

    // Normalize Free tier pool (15 tokens max, 1 token = 1 contact) before transaction
    if (userData) {
      await syncUserPoolCredits(userId, userData).catch(() => {});
    }

    let creditsRemaining = userData?.lead_credits ?? 15;
    let userPlan = (userData?.plan || 'free').toLowerCase();
    let poolRefreshedAt = userData?.pool_refreshed_at || new Date().toISOString();
    let limit = userPlan === 'free' ? 10 : 20;
    let tokensUsed = 0;

    // Deduct 1 Token per Contact scraped (1 Token = 1 Contact)
    try {
      await db.runTransaction(async (t) => {
        const doc = await t.get(userRef);
        if (!doc.exists) return;
        const data = doc.data()!;
        userPlan = (data.plan || 'free').toLowerCase();
        poolRefreshedAt = data.pool_refreshed_at || new Date().toISOString();

        let currentCredits = data.lead_credits ?? 15;

        // Check 4-day auto-refresh & free-tier 15-token cap
        if (userPlan === 'free') {
          const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
          const lastRefresh = data.pool_refreshed_at ? new Date(data.pool_refreshed_at).getTime() : 0;
          if (!data.pool_refreshed_at || Date.now() - lastRefresh >= fourDaysMs) {
            currentCredits = 15;
            poolRefreshedAt = new Date().toISOString();
          } else if (!data.has_topup && currentCredits > 15) {
            currentCredits = 15;
          }
        }

        if (currentCredits < 1) {
          throw new Error("Insufficient credits");
        }

        // Max contacts per query: 10 on Free tier, 20 on Basic/Pro, capped by available tokens (1 Token = 1 Contact)
        const maxPerQuery = userPlan === 'free' ? 10 : 20;
        limit = Math.min(maxPerQuery, currentCredits);
        tokensUsed = limit; // 1 token = 1 contact scraped
        creditsRemaining = currentCredits - tokensUsed;

        t.update(userRef, { 
          lead_credits: creditsRemaining,
          pool_refreshed_at: poolRefreshedAt
        });
      });
    } catch (txErr: any) {
      if (txErr.message === "Insufficient credits") {
        return res.status(403).json({ error: 'Insufficient credits', needsTopUp: true });
      }
      // If Firestore transaction fails due to offline/permission, proceed with default quota
      const maxPerQuery = userPlan === 'free' ? 10 : 20;
      limit = Math.min(maxPerQuery, creditsRemaining > 0 ? creditsRemaining : maxPerQuery);
      tokensUsed = limit;
      creditsRemaining = Math.max(0, creditsRemaining - tokensUsed);
    }
    
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    scraperQueue.add({ 
      id: jobId,
      userId, 
      keyword, 
      location, 
      scope, 
      limit,
      serpApiKey: resolvedSerpKey
    });
    
    res.json({ 
      message: 'Scraping started via Lead Finder Wizard', 
      jobId,
      creditsRemaining,
      tokensUsed,
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

    const leadsRef = db.collection('leads');
    let docRefs: FirebaseFirestore.DocumentReference[] = [];

    if (all) {
      const snapshot = await leadsRef.where('userId', '==', userId).get();
      docRefs = snapshot.docs.map(d => d.ref);
    } else if (Array.isArray(ids) && ids.length > 0) {
      docRefs = ids.map(id => leadsRef.doc(id));
    }

    if (docRefs.length > 0) {
      // Chunk in 400s for Firestore batch limit
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

    res.json({ success: true, count: docRefs.length });
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

    res.json({ success: true, deleted: ids.length });
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

    res.json({ success: true, deleted: snapshot.docs.length });
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
    const docRef = db.collection('leads').doc(id);
    await docRef.update({
      ...updates,
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await docRef.get();
    res.json({ success: true, lead: { _id: id, ...updatedDoc.data() }, message: 'Lead updated successfully' });
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
    
    await db.collection('leads').doc(id).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
