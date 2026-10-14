import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from '../index';
import { userStore } from '../services/userStore';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function syncUserPoolCredits(userId: string, data: any): Promise<any> {
  const plan = (data.plan || 'free').toLowerCase();
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const lastRefresh = data.pool_refreshed_at ? new Date(data.pool_refreshed_at).getTime() : 0;

  if (plan === 'free') {
    if (!data.pool_refreshed_at || Date.now() - lastRefresh >= fourDaysMs) {
      const nowIso = new Date().toISOString();
      data.lead_credits = 15;
      data.pool_refreshed_at = nowIso;
      try {
        await db.collection('users').doc(userId).update({
          lead_credits: 15,
          pool_refreshed_at: nowIso
        });
      } catch {}
    } else if (!data.has_topup) {
      const leadsSnap = await db.collection('leads').where('userId', '==', userId).get().catch(() => ({ size: 0 } as any));
      const expectedMaxCredits = Math.max(0, 15 - (leadsSnap.size || 0));
      if (data.lead_credits === undefined || data.lead_credits > 15 || data.lead_credits > expectedMaxCredits) {
        data.lead_credits = expectedMaxCredits;
        try {
          await db.collection('users').doc(userId).update({
            lead_credits: expectedMaxCredits
          });
        } catch {}
      }
    }
  }

  // Email & AI Pitch Tier Quotas
  const tierEmailLimit = plan === 'pro' ? 5000 : plan === 'basic' ? 1500 : 50;
  const tierAiLimit = plan === 'pro' ? -1 : plan === 'basic' ? 250 : 5;

  if (data.emails_limit === undefined) {
    data.emails_limit = tierEmailLimit;
  }
  if (data.emails_sent === undefined) {
    data.emails_sent = 0;
  }
  if (data.ai_pitches_limit === undefined) {
    data.ai_pitches_limit = tierAiLimit;
  }
  if (data.ai_pitches_used === undefined) {
    data.ai_pitches_used = 0;
  }

  // Update local persistent user store
  userStore.updateUser(userId, data);

  return data;
}

// GET /api/auth/me - Fetch latest synced user profile & token balance
router.get('/me', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    let userData: any = null;
    let docId = userId;

    // 1. Try Firestore
    try {
      const userRef = db.collection('users').doc(userId);
      const doc = await userRef.get();
      if (doc.exists) {
        userData = doc.data();
        docId = doc.id;
      }
    } catch (fsErr: any) {
      console.warn('[Auth] Firestore offline or unauthenticated for /me:', fsErr.message);
    }

    // 2. Fallback to local persistent user store
    if (!userData) {
      const localUser = userStore.getUserById(userId);
      if (localUser) {
        userData = { ...localUser };
        docId = localUser._id;
      }
    }

    // 3. Fallback to default authentic user record if first run
    if (!userData) {
      const isSuper = userId.toLowerCase().includes('ashley');
      const fallbackRecord = {
        _id: userId,
        email: `${userId}@leadpulse.io`,
        name: isSuper ? 'Ashley Ghose' : 'LeadPulse User',
        role: isSuper ? 'SUPER_ADMIN' : 'USER',
        plan: 'free',
        lead_credits: 15,
        pool_refreshed_at: new Date().toISOString(),
        emails_limit: 50,
        emails_sent: 0,
        ai_pitches_limit: 5,
        ai_pitches_used: 0,
        onboarding_complete: true,
        createdAt: new Date().toISOString()
      };
      userStore.saveUser(fallbackRecord);
      userData = fallbackRecord;
    }

    const data = await syncUserPoolCredits(docId, userData || {});
    const userDoc = { _id: docId, ...data };
    delete (userDoc as any).password;
    res.json({ user: userDoc });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.post('/google', async (req, res) => {
  const { googleId, email, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  
  try {
    let userDoc: any;
    let userId: string;
    let existingDoc: any = null;

    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).get();
      if (!snapshot.empty) {
        existingDoc = snapshot.docs[0];
      }
    } catch (fsErr: any) {
      console.warn('[Auth] Firestore query error during Google auth, checking local store:', fsErr.message);
    }

    if (!existingDoc) {
      const localUser = userStore.getUserByEmail(email);
      if (localUser) {
        userId = localUser._id;
        const data = await syncUserPoolCredits(userId, localUser);
        userDoc = { _id: userId, ...data };
      } else {
        // Auto-assign SUPER_ADMIN
        const role = email === 'ashleyghose64@gmail.com' ? 'SUPER_ADMIN' : 'USER';
        userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newUser = {
          _id: userId,
          googleId,
          email,
          name: name || 'LeadPulse User',
          role,
          lead_credits: 15,
          plan: 'free',
          pool_refreshed_at: new Date().toISOString(),
          emails_limit: 50,
          emails_sent: 0,
          ai_pitches_limit: 5,
          ai_pitches_used: 0,
          onboarding_complete: false,
          createdAt: new Date().toISOString()
        };

        userStore.saveUser(newUser);
        userDoc = newUser;

        // Try syncing to Firestore in background
        db.collection('users').doc(userId).set(newUser).catch(() => {});
      }
    } else {
      userId = existingDoc.id;
      const data = await syncUserPoolCredits(userId, existingDoc.data());
      userDoc = { _id: userId, ...data };
      userStore.saveUser(userDoc);
    }
    
    delete (userDoc as any).password;
    const token = jwt.sign({ id: userId, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/onboarding', async (req, res) => {
  const { userId, company_name, field_of_work, niche, target_audience, goals } = req.body;
  if (!userId) return res.status(400).json({ error: 'User ID required' });
  
  try {
    const updates = {
      company_name,
      field_of_work,
      niche: niche || field_of_work || '',
      target_audience: target_audience || '',
      goals: goals || '',
      onboarding_complete: true,
      updatedAt: new Date().toISOString()
    };

    // Update local persistent store
    const localUpdated = userStore.updateUser(userId, updates);

    // Update Firestore if available
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update(updates);
    } catch {}
    
    const currentUser = localUpdated || userStore.getUserById(userId) || { _id: userId, ...updates };
    const syncedData = await syncUserPoolCredits(userId, currentUser);
    delete (syncedData as any).password;
    res.json({ _id: userId, ...syncedData });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

  try {
    // Check local store first
    const localExisting = userStore.getUserByEmail(email);
    if (localExisting) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }

    // Check Firestore
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).get();
      if (!snapshot.empty) {
        return res.status(400).json({ error: 'User already exists. Please login.' });
      }
    } catch {}

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === 'ashleyghose64@gmail.com' ? 'SUPER_ADMIN' : 'USER';
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const newUser = {
      _id: userId,
      email,
      password: hashedPassword,
      name,
      role,
      lead_credits: 15,
      plan: 'free',
      pool_refreshed_at: new Date().toISOString(),
      emails_limit: 50,
      emails_sent: 0,
      ai_pitches_limit: 5,
      ai_pitches_used: 0,
      onboarding_complete: false,
      createdAt: new Date().toISOString()
    };
    
    userStore.saveUser(newUser);

    // Sync to Firestore in background
    try {
      await db.collection('users').doc(userId).set(newUser);
    } catch {}

    const userDoc = { ...newUser };
    delete (userDoc as any).password;
    
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  try {
    let rawData: any = null;
    let userId: string = '';

    // Check Firestore
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', email).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userId = doc.id;
        rawData = doc.data();
      }
    } catch {}

    // Fallback to local store
    if (!rawData) {
      const localUser = userStore.getUserByEmail(email);
      if (localUser) {
        userId = localUser._id;
        rawData = { ...localUser };
      }
    }

    if (!rawData) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    if (!rawData.password) {
      return res.status(400).json({ error: 'Please use Login with Google.' });
    }
    
    const isMatch = await bcrypt.compare(password, rawData.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const syncedData = await syncUserPoolCredits(userId, rawData);
    const userDoc = { _id: userId, ...syncedData } as any;
    delete userDoc.password;
    userStore.saveUser(userDoc);

    const token = jwt.sign({ id: userDoc._id, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/profile', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { 
    name, 
    company_name, 
    field_of_work, 
    phone,
    smtp_settings,
    outreach_defaults,
    niche,
    target_audience,
    goals,
    profile_picture
  } = req.body;

  try {
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (company_name !== undefined) updates.company_name = company_name;
    if (field_of_work !== undefined) updates.field_of_work = field_of_work;
    if (phone !== undefined) updates.phone = phone;
    if (smtp_settings !== undefined) updates.smtp_settings = smtp_settings;
    if (outreach_defaults !== undefined) updates.outreach_defaults = outreach_defaults;
    if (niche !== undefined) updates.niche = niche;
    if (target_audience !== undefined) updates.target_audience = target_audience;
    if (goals !== undefined) updates.goals = goals;
    if (profile_picture !== undefined) updates.profile_picture = profile_picture;
    updates.updatedAt = new Date().toISOString();

    // 1. Update in local persistent store
    const localUpdated = userStore.updateUser(userId, updates);

    // 2. Update in Firestore
    try {
      const userRef = db.collection('users').doc(userId);
      await userRef.update(updates);
    } catch (fsErr: any) {
      console.warn('[Auth] Firestore update skipped for profile:', fsErr.message);
    }

    const currentUser = localUpdated || userStore.getUserById(userId) || { _id: userId, ...updates };
    const syncedData = await syncUserPoolCredits(userId, currentUser);
    const userData = { _id: userId, ...syncedData };
    delete (userData as any).password;

    res.json({ message: 'Profile updated successfully', user: userData });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
