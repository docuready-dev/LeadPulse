import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export async function syncUserPoolCredits(userId: string, data: any): Promise<any> {
  const userRef = db.collection('users').doc(userId);
  const plan = (data.plan || 'free').toLowerCase();
  const fourDaysMs = 4 * 24 * 60 * 60 * 1000;
  const lastRefresh = data.pool_refreshed_at ? new Date(data.pool_refreshed_at).getTime() : 0;

  if (plan === 'free') {
    if (!data.pool_refreshed_at || Date.now() - lastRefresh >= fourDaysMs) {
      const nowIso = new Date().toISOString();
      await userRef.update({
        lead_credits: 15,
        pool_refreshed_at: nowIso
      });
      data.lead_credits = 15;
      data.pool_refreshed_at = nowIso;
    } else if (!data.has_topup) {
      const leadsSnap = await db.collection('leads').where('userId', '==', userId).get().catch(() => ({ size: 0 } as any));
      const expectedMaxCredits = Math.max(0, 15 - (leadsSnap.size || 0));
      if (data.lead_credits === undefined || data.lead_credits > 15 || data.lead_credits > expectedMaxCredits) {
        await userRef.update({
          lead_credits: expectedMaxCredits
        });
        data.lead_credits = expectedMaxCredits;
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

  return data;
}

// GET /api/auth/me - Fetch latest synced user profile & token balance
router.get('/me', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

    const data = await syncUserPoolCredits(userId, doc.data() || {});
    const userDoc = { _id: doc.id, ...data };
    delete (userDoc as any).password;
    res.json({ user: userDoc });
  } catch (err) {
    console.error('[Auth] /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.post('/google', async (req, res) => {
  const { googleId, email, name } = req.body;
  
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    let userDoc: any;
    let userId: string;
    
    if (snapshot.empty) {
      // Auto-assign SUPER_ADMIN
      const role = email === 'ashleyghose64@gmail.com' ? 'SUPER_ADMIN' : 'USER';
      const newUser = {
        googleId,
        email,
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
      
      const docRef = await usersRef.add(newUser);
      userId = docRef.id;
      userDoc = { _id: userId, ...newUser };
    } else {
      userId = snapshot.docs[0].id;
      const data = await syncUserPoolCredits(userId, snapshot.docs[0].data());
      userDoc = { _id: userId, ...data };
    }
    
    const token = jwt.sign({ id: userId, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/onboarding', async (req, res) => {
  const { userId, company_name, field_of_work, niche, target_audience, goals } = req.body;
  
  try {
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await userRef.update({
      company_name,
      field_of_work,
      niche: niche || field_of_work || '',
      target_audience: target_audience || '',
      goals: goals || '',
      onboarding_complete: true
    });
    
    const updated = await userRef.get();
    const syncedData = await syncUserPoolCredits(userId, updated.data() || {});
    res.json({ _id: updated.id, ...syncedData });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

import bcrypt from 'bcrypt';

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });

  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    if (!snapshot.empty) {
      return res.status(400).json({ error: 'User already exists. Please login.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = email === 'ashleyghose64@gmail.com' ? 'SUPER_ADMIN' : 'USER';
    
    const newUser = {
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
    
    const docRef = await usersRef.add(newUser);
    const userDoc = { _id: docRef.id, ...newUser };
    // Dont send back password to client
    delete (userDoc as any).password;
    
    const token = jwt.sign({ id: docRef.id, role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    
    if (snapshot.empty) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const doc = snapshot.docs[0];
    const rawData = doc.data();
    
    if (!rawData.password) {
      return res.status(400).json({ error: 'Please use Login with Google.' });
    }
    
    const isMatch = await bcrypt.compare(password, rawData.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const syncedData = await syncUserPoolCredits(doc.id, rawData);
    const userDoc = { _id: doc.id, ...syncedData } as any;
    delete userDoc.password;
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
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });

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

    await userRef.update(updates);
    const updatedDoc = await userRef.get();
    const syncedData = await syncUserPoolCredits(userId, updatedDoc.data() || {});
    const userData = { _id: updatedDoc.id, ...syncedData };
    delete (userData as any).password;

    res.json({ message: 'Profile updated successfully', user: userData });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
