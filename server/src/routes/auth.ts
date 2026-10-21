import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../index';
import { userStore } from '../services/userStore';
import { leadStore } from '../services/leadStore';
import { sendPasswordResetEmail } from '../services/mailer';
import { otpService } from '../services/otpService';
import { applyDailyTokenReset, getTodayDateString, PLAN_DAILY_TOKENS } from '../services/tokenManager';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Provision System Accounts: Ashley Super Admin & Bicon Ghose User Account
async function provisionSystemAccounts() {
  try {
    // 1. Ashley Super Admin (strictly SUPER_ADMIN only, password: Maybach@$#051995)
    const superAdminHash = await bcrypt.hash('Maybach@$#051995', 10);
    
    // Check Firestore first so credentials connected from any device are preserved
    let firestoreSuperData: any = {};
    try {
      const fsSnap = await db.collection('users').doc('user_ashleyghose64').get();
      if (fsSnap.exists) {
        firestoreSuperData = fsSnap.data() || {};
      }
    } catch {}

    const localSuper = userStore.getUserById('user_ashleyghose64') || userStore.getUserByEmail('ashleyghose64@gmail.com');
    const existingSuper = { ...firestoreSuperData, ...localSuper };
    const resolvedSerpKey = existingSuper?.serpapi_key || firestoreSuperData?.serpapi_key || process.env.SERPAPI_KEY || '';

    const superAdminUser: any = {
      ...existingSuper,
      _id: 'user_ashleyghose64',
      profile_picture: existingSuper?.profile_picture || '',
      email: 'ashleyghose64@gmail.com',
      name: 'Ashley',
      phone: '+919004804043',
      role: 'SUPER_ADMIN',
      plan: 'pro',
      lead_credits: existingSuper?.lead_credits !== undefined ? existingSuper.lead_credits : 1500,
      base_daily_credits: existingSuper?.base_daily_credits || 1500,
      topup_credits: existingSuper?.topup_credits !== undefined ? existingSuper.topup_credits : 0,
      emails_limit: 5000,
      emails_sent: existingSuper?.emails_sent !== undefined ? existingSuper.emails_sent : 0,
      ai_pitches_limit: -1,
      ai_pitches_used: existingSuper?.ai_pitches_used !== undefined ? existingSuper.ai_pitches_used : 0,
      password: superAdminHash,
      onboarding_complete: true,
      two_factor_enabled: false,
      phone_verified: true,
      createdAt: existingSuper?.createdAt || '2026-10-14T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };

    if (resolvedSerpKey) {
      superAdminUser.serpapi_key = resolvedSerpKey;
      superAdminUser.serpapi_connected = true;
      superAdminUser.serpapi_plan = existingSuper?.serpapi_plan || 'free';
      superAdminUser.serpapi_plan_name = existingSuper?.serpapi_plan_name || 'Free';
      superAdminUser.serpapi_searches_left = existingSuper?.serpapi_searches_left ?? 100;
      superAdminUser.serpapi_searches_per_month = existingSuper?.serpapi_searches_per_month || 100;
      superAdminUser.serpapi_this_month_usage = existingSuper?.serpapi_this_month_usage || 0;
    }

    userStore.saveUser(superAdminUser);
    try {
      await db.collection('users').doc(superAdminUser._id).set(superAdminUser, { merge: true });
    } catch {}

    // 2. Bicon Ghose User Account (password: Ashley1234)
    const biconPasswordHash = await bcrypt.hash('Ashley1234', 10);
    
    let firestoreBiconData: any = {};
    try {
      const fsSnap = await db.collection('users').doc('user_ashleyghose28').get();
      if (fsSnap.exists) {
        firestoreBiconData = fsSnap.data() || {};
      }
    } catch {}

    const localBicon = userStore.getUserById('user_ashleyghose28') || userStore.getUserByEmail('ashleyghose28@gmail.com');
    const existingBicon = { ...firestoreBiconData, ...localBicon };
    const biconPlan = existingBicon?.plan && existingBicon.plan !== 'free' ? existingBicon.plan : 'basic';
    const emailLimits: Record<string, number> = { free: 50, basic: 1500, pro: 5000 };
    const aiLimits: Record<string, number> = { free: 5, basic: 250, pro: -1 };

    const biconUser: any = {
      ...existingBicon,
      _id: 'user_ashleyghose28',
      profile_picture: existingBicon?.profile_picture || '',
      email: 'ashleyghose28@gmail.com',
      name: 'Bicon Ghose',
      phone: '+919004804043',
      role: 'USER',
      plan: biconPlan,
      lead_credits: existingBicon?.lead_credits !== undefined ? existingBicon.lead_credits : (biconPlan === 'basic' ? 600 : 15),
      base_daily_credits: existingBicon?.base_daily_credits || (biconPlan === 'basic' ? 600 : 15),
      topup_credits: existingBicon?.topup_credits !== undefined ? existingBicon.topup_credits : 0,
      emails_limit: existingBicon?.emails_limit !== undefined && existingBicon.emails_limit >= 1500 ? existingBicon.emails_limit : (emailLimits[biconPlan] || 1500),
      emails_sent: existingBicon?.emails_sent !== undefined ? existingBicon.emails_sent : 0,
      ai_pitches_limit: existingBicon?.ai_pitches_limit !== undefined ? existingBicon.ai_pitches_limit : (aiLimits[biconPlan] !== undefined ? aiLimits[biconPlan] : 250),
      ai_pitches_used: existingBicon?.ai_pitches_used !== undefined ? existingBicon.ai_pitches_used : 0,
      password: biconPasswordHash,
      onboarding_complete: true,
      two_factor_enabled: false,
      phone_verified: true,
      createdAt: existingBicon?.createdAt || '2026-10-14T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    };

    userStore.saveUser(biconUser);
    try {
      await db.collection('users').doc(biconUser._id).set(biconUser, { merge: true });
    } catch {}

    console.log('[Auth] System accounts successfully configured:');
    console.log('[Auth] - ashleyghose64@gmail.com -> Ashley (SUPER_ADMIN, Pro, Maybach@$#051995)');
    console.log('[Auth] - ashleyghose28@gmail.com -> Bicon Ghose (USER, Free tier with leads, Ashley1234)');
  } catch (err: any) {
    console.warn('[Auth] System account provisioning note:', err.message);
  }
}
provisionSystemAccounts().catch(() => {});


export async function syncUserPoolCredits(userId: string, data: any): Promise<any> {
  const cleanEmail = (data.email || '').toLowerCase().trim();
  const isAshleySuperAdmin = userId === 'user_ashleyghose64' || cleanEmail === 'ashleyghose64@gmail.com';

  if (isAshleySuperAdmin) {
    data.role = 'SUPER_ADMIN';
    data.plan = 'pro';
    data.name = 'Ashley';
    data.two_factor_enabled = false;
    data.base_daily_credits = data.base_daily_credits !== undefined ? data.base_daily_credits : 1500;
    data.lead_credits = data.lead_credits !== undefined ? data.lead_credits : 1500;
    data.topup_credits = data.topup_credits !== undefined ? data.topup_credits : 0;
    data.emails_limit = 5000;
    data.ai_pitches_limit = -1;
    data.last_token_reset_date = data.last_token_reset_date || getTodayDateString();
    userStore.updateUser(userId, data);
    return data;
  }

  // Apply daily token reset (Basic resets to 600 everyday, Pro resets to 1500 everyday, Topup stays intact)
  const { userData: updatedWithDaily, didReset } = applyDailyTokenReset(data);
  data = updatedWithDaily;

  const plan = (data.plan || 'free').toLowerCase();

  // If daily reset occurred, persist to Firestore
  if (didReset) {
    try {
      await db.collection('users').doc(userId).set({
        lead_credits: data.lead_credits,
        base_daily_credits: data.base_daily_credits,
        topup_credits: data.topup_credits,
        last_token_reset_date: data.last_token_reset_date
      }, { merge: true });
    } catch {}
  }

  // Email & AI Pitch Tier Quotas
  const tierEmailLimit = plan === 'pro' ? 5000 : plan === 'basic' ? 1500 : 50;
  const tierAiLimit = plan === 'pro' ? -1 : plan === 'basic' ? 250 : 5;

  if (data.emails_limit === undefined || (plan !== 'free' && data.emails_limit < tierEmailLimit)) {
    data.emails_limit = tierEmailLimit;
  }
  if (data.emails_sent === undefined) {
    data.emails_sent = 0;
  }
  if (data.ai_pitches_limit === undefined || (plan !== 'free' && data.ai_pitches_limit < tierAiLimit && tierAiLimit !== -1)) {
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
  let userId = (req.headers.userid as string) || '';

  if (!userId && req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) userId = decoded.id;
    } catch {}
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized: missing user identifier' });

  const clean = userId.toLowerCase().trim();
  const isSuperAshley = clean === 'user_ashleyghose64' || clean.includes('ashleyghose64');
  const isBicon = clean === 'user_ashleyghose28' || clean.includes('ashleyghose28');

  try {
    let userData: any = null;
    let docId = userId;

    if (isSuperAshley) {
      docId = 'user_ashleyghose64';
      userData = userStore.getUserById('user_ashleyghose64') || userStore.getUserByEmail('ashleyghose64@gmail.com');
    } else if (isBicon) {
      docId = 'user_ashleyghose28';
      userData = userStore.getUserById('user_ashleyghose28') || userStore.getUserByEmail('ashleyghose28@gmail.com');
    }

    // 1. Try local persistent store first
    if (!userData) {
      const localUser = userStore.getUserById(userId) || (userId.includes('@') ? userStore.getUserByEmail(userId) : null);
      if (localUser) {
        userData = { ...localUser };
        docId = localUser._id;
      }
    }

    // 2. Try Firestore
    if (!userData) {
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
    }

    // 3. Fallback to default authentic user record if first run
    if (!userData) {
      const fallbackRecord = {
        _id: docId,
        email: isSuperAshley ? 'ashleyghose64@gmail.com' : isBicon ? 'ashleyghose28@gmail.com' : (userId.includes('@') ? userId : `${userId}@strovr.space`),
        name: isSuperAshley ? 'Ashley' : isBicon ? 'Bicon Ghose' : 'Strovr User',
        role: isSuperAshley ? 'SUPER_ADMIN' : 'USER',
        plan: isSuperAshley ? 'pro' : 'free',
        lead_credits: isSuperAshley ? 1500 : 15,
        base_daily_credits: isSuperAshley ? 1500 : 15,
        topup_credits: 0,
        pool_refreshed_at: new Date().toISOString(),
        emails_limit: isSuperAshley ? 5000 : 50,
        emails_sent: 0,
        ai_pitches_limit: isSuperAshley ? -1 : 5,
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
        const isSuper = email.toLowerCase().trim() === 'ashleyghose64@gmail.com';
        const role = isSuper ? 'SUPER_ADMIN' : 'USER';
        const plan = isSuper ? 'pro' : 'free';
        const lead_credits = isSuper ? 1500 : 15;
        const emails_limit = isSuper ? 5000 : 50;
        const ai_pitches_limit = isSuper ? -1 : 5;
        userId = isSuper ? 'user_ashleyghose64' : `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newUser = {
          _id: userId,
          googleId,
          email,
          name: isSuper ? 'Ashley' : (name || 'Strovr User'),
          role,
          lead_credits,
          base_daily_credits: lead_credits,
          topup_credits: 0,
          plan,
          pool_refreshed_at: new Date().toISOString(),
          emails_limit,
          emails_sent: 0,
          ai_pitches_limit,
          ai_pitches_used: 0,
          onboarding_complete: isSuper ? true : false,
          two_factor_enabled: isSuper ? false : true,
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

// POST /api/auth/send-register-otp - Optional/Deprecated (Mobile OTP no longer required for signup)
router.post('/send-register-otp', async (req, res) => {
  return res.json({
    success: true,
    message: 'Mobile OTP is no longer required for registration.'
  });
});

router.post('/register', async (req, res) => {
  const { email, password, name, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }

  const cleanEmail = email.toLowerCase().trim();
  const normalizedPhone = phone ? otpService.normalizePhone(phone) : '';

  try {
    // Check local store for duplicate email
    const localExistingEmail = userStore.getUserByEmail(cleanEmail);
    if (localExistingEmail) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    if (normalizedPhone) {
      const localExistingPhone = userStore.getUserByPhone(normalizedPhone);
      if (localExistingPhone) {
        return res.status(400).json({ error: 'This mobile number is already registered to another account.' });
      }
    }

    // Check Firestore
    try {
      const usersRef = db.collection('users');
      const emailSnap = await usersRef.where('email', '==', cleanEmail).get();
      if (!emailSnap.empty) {
        return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
      }
    } catch {}

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdmin = cleanEmail === 'ashleyghose64@gmail.com';
    const role = isSuperAdmin ? 'SUPER_ADMIN' : 'USER';
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    const newUser = {
      _id: userId,
      email: cleanEmail,
      password: hashedPassword,
      name: name.trim(),
      phone: normalizedPhone || '',
      phone_verified: !!normalizedPhone,
      two_factor_enabled: false,
      role,
      lead_credits: isSuperAdmin ? 1500 : 15,
      base_daily_credits: isSuperAdmin ? 1500 : 15,
      topup_credits: 0,
      plan: isSuperAdmin ? 'pro' : 'free',
      pool_refreshed_at: new Date().toISOString(),
      emails_limit: isSuperAdmin ? 5000 : 50,
      emails_sent: 0,
      ai_pitches_limit: isSuperAdmin ? -1 : 5,
      ai_pitches_used: 0,
      onboarding_complete: false,
      createdAt: new Date().toISOString()
    };
    
    userStore.saveUser(newUser);

    // Sync to Firestore in background
    try {
      await db.collection('users').doc(userId).set(newUser);
    } catch {}

    const userDoc = { ...newUser } as any;
    delete userDoc.password;
    
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err: any) {
    console.error('[Auth] register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  const cleanEmail = email.toLowerCase().trim();

  try {
    let rawData: any = null;
    let userId: string = '';

    // 1. Look up in local userStore first (the SaaS's persistent brain)
    const localUser = userStore.getUserByEmail(cleanEmail) || userStore.getUserById(cleanEmail);
    if (localUser) {
      userId = localUser._id;
      rawData = { ...localUser };
    }

    // 2. Query Firestore and merge
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', cleanEmail).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const fsData = doc.data() || {};
        if (!rawData) {
          userId = doc.id;
          rawData = { ...fsData };
        } else {
          // Preserve upgraded plan from userStore
          const activePlan = (localUser?.plan && localUser.plan !== 'free') ? localUser.plan : (fsData.plan || 'free');
          rawData = {
            ...fsData,
            ...rawData,
            plan: activePlan
          };
        }
      }
    } catch {}

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

    // Direct session authentication (2FA omitted per user configuration)
    const syncedData = await syncUserPoolCredits(userId, rawData);
    const userDoc = { _id: userId, ...syncedData } as any;
    delete userDoc.password;
    userStore.saveUser(userDoc);

    const token = jwt.sign({ id: userDoc._id, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, user: userDoc });
  } catch (err: any) {
    console.error('[Auth] login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// POST /api/auth/verify-2fa - Verifies 6-digit 2FA OTP and issues full session JWT
router.post('/verify-2fa', async (req, res) => {
  const { tempToken, otp } = req.body;
  if (!tempToken || !otp) {
    return res.status(400).json({ error: 'Verification session and 6-digit OTP code are required.' });
  }

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET) as any;
    } catch {
      return res.status(401).json({ error: 'Verification session has expired. Please sign in again.' });
    }

    if (!decoded || decoded.stage !== '2fa_pending' || !decoded.id) {
      return res.status(400).json({ error: 'Invalid verification session. Please sign in again.' });
    }

    const userId = decoded.id;
    let rawUser: any = userStore.getUserById(userId);
    if (!rawUser) {
      try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) rawUser = doc.data();
      } catch {}
    }

    if (!rawUser || !rawUser.phone) {
      return res.status(400).json({ error: 'User record or mobile number not found for verification.' });
    }

    const otpResult = otpService.verifyOtp(rawUser.phone, otp, '2fa');
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'Invalid or expired 2FA code.' });
    }

    const syncedData = await syncUserPoolCredits(userId, rawUser);
    const userDoc = { _id: userId, ...syncedData } as any;
    delete userDoc.password;
    userStore.saveUser(userDoc);

    const token = jwt.sign({ id: userDoc._id, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    console.log(`[Auth] 2FA verified successfully for ${userDoc.email} (${userDoc.role})`);

    return res.json({ token, user: userDoc });
  } catch (err: any) {
    console.error('[Auth] verify-2fa error:', err);
    return res.status(500).json({ error: 'Server error during 2FA verification.' });
  }
});

// POST /api/auth/resend-2fa-otp - Resends a fresh 6-digit 2FA OTP
router.post('/resend-2fa-otp', async (req, res) => {
  const { tempToken } = req.body;
  if (!tempToken) {
    return res.status(400).json({ error: 'Verification session token is required.' });
  }

  try {
    let decoded: any;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET) as any;
    } catch {
      return res.status(401).json({ error: 'Verification session has expired. Please sign in again.' });
    }

    if (!decoded || decoded.stage !== '2fa_pending' || !decoded.id) {
      return res.status(400).json({ error: 'Invalid verification session. Please sign in again.' });
    }

    const userId = decoded.id;
    let rawUser: any = userStore.getUserById(userId);
    if (!rawUser) {
      try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) rawUser = doc.data();
      } catch {}
    }

    if (!rawUser || !rawUser.phone) {
      return res.status(400).json({ error: 'Mobile number not found for this account.' });
    }

    const otpRes = await otpService.generateAndSendOtp(rawUser.phone, '2fa', rawUser.email);
    return res.json({
      success: true,
      phoneMasked: otpRes.phoneMasked,
      devOtp: otpRes.devOtp,
      message: `A fresh 6-digit verification code has been dispatched to ${otpRes.phoneMasked}.`
    });
  } catch (err: any) {
    console.error('[Auth] resend-2fa-otp error:', err);
    return res.status(500).json({ error: 'Server error while resending verification code.' });
  }
});

// POST /api/auth/forgot-password-otp - Dispatches password reset OTP to mobile number
router.post('/forgot-password-otp', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier || typeof identifier !== 'string') {
    return res.status(400).json({ error: 'Registered mobile number or email address is required.' });
  }

  const cleanInput = identifier.trim();

  try {
    let user: any = null;

    if (cleanInput.includes('@')) {
      user = userStore.getUserByEmail(cleanInput);
      if (!user) {
        try {
          const snap = await db.collection('users').where('email', '==', cleanInput.toLowerCase()).get();
          if (!snap.empty) user = snap.docs[0].data();
        } catch {}
      }
    } else {
      user = userStore.getUserByPhone(cleanInput);
      if (!user) {
        const norm = otpService.normalizePhone(cleanInput);
        user = userStore.getUserByPhone(norm);
      }
    }

    if (!user || !user.phone) {
      return res.status(400).json({
        error: 'No registered account with a verified mobile number was found for this input.'
      });
    }

    const otpRes = await otpService.generateAndSendOtp(user.phone, 'forgot_password', user.email);

    return res.json({
      success: true,
      phone: otpRes.phone,
      phoneMasked: otpRes.phoneMasked,
      devOtp: otpRes.devOtp,
      message: `Password reset verification code dispatched to ${otpRes.phoneMasked}`
    });
  } catch (err: any) {
    console.error('[Auth] forgot-password-otp error:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch reset code.' });
  }
});

// POST /api/auth/reset-password-otp - Resets password using mobile OTP verification
router.post('/reset-password-otp', async (req, res) => {
  const { phone, otp, newPassword } = req.body;
  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ error: 'Mobile number, verification code, and new password are required.' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const normalizedPhone = otpService.normalizePhone(phone);

  try {
    const verifyRes = otpService.verifyOtp(normalizedPhone, otp, 'forgot_password');
    if (!verifyRes.valid) {
      return res.status(400).json({ error: verifyRes.error || 'Invalid or expired verification code.' });
    }

    let user: any = userStore.getUserByPhone(normalizedPhone);
    let userId: string = user?._id || '';

    if (!user) {
      try {
        const snap = await db.collection('users').where('phone', '==', normalizedPhone).get();
        if (!snap.empty) {
          const doc = snap.docs[0];
          userId = doc.id;
          user = doc.data();
        }
      } catch {}
    }

    if (!user || !userId) {
      return res.status(400).json({ error: 'Account matching this mobile number was not found.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updates = {
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires_at: null,
      updatedAt: new Date().toISOString()
    };

    userStore.updateUser(userId, updates);
    try {
      await db.collection('users').doc(userId).update(updates);
    } catch {}

    const syncedData = await syncUserPoolCredits(userId, { ...user, ...updates });
    const userDoc = { _id: userId, ...syncedData } as any;
    delete userDoc.password;

    const token = jwt.sign({ id: userDoc._id, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });
    console.log(`[Auth] Password reset via mobile OTP successfully completed for ${userDoc.email}`);

    return res.json({
      success: true,
      message: 'Password successfully updated! You are now logged in.',
      token,
      user: userDoc
    });
  } catch (err: any) {
    console.error('[Auth] reset-password-otp error:', err);
    return res.status(500).json({ error: 'Server error while resetting password.' });
  }
});

router.patch('/profile', async (req, res) => {
  let userId = (req.headers.userid as string) || '';
  const userEmail = (req.headers.useremail as string || req.body.email || '').toLowerCase().trim();

  if (!userId && userEmail) {
    const found = userStore.getUserByEmail(userEmail);
    if (found) userId = found._id;
    else userId = userEmail;
  }

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const cleanUid = userId.toLowerCase().trim();
  const isSuperAshley = cleanUid === 'user_ashleyghose64' || cleanUid.includes('ashleyghose64') || userEmail === 'ashleyghose64@gmail.com';
  const isBicon = cleanUid === 'user_ashleyghose28' || cleanUid.includes('ashleyghose28') || userEmail === 'ashleyghose28@gmail.com';
  const targetDocId = isSuperAshley ? 'user_ashleyghose64' : (isBicon ? 'user_ashleyghose28' : (userId || userEmail));

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
    profile_picture,
    serpapi_key,
    serpapi_connected
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
    if (serpapi_key !== undefined) updates.serpapi_key = serpapi_key;
    if (serpapi_connected !== undefined) updates.serpapi_connected = serpapi_connected;
    updates.updatedAt = new Date().toISOString();

    // 1. Update in local persistent store across primary and alias accounts
    let localUpdated = userStore.updateUser(targetDocId, updates);
    if (!localUpdated) {
      const existing = userStore.getUserById(targetDocId) || (userEmail ? userStore.getUserByEmail(userEmail) : null);
      if (existing) {
        localUpdated = userStore.updateUser(existing._id, updates);
      } else {
        localUpdated = userStore.saveUser({
          _id: targetDocId,
          email: userEmail || (targetDocId.includes('@') ? targetDocId : `${targetDocId}@strovr.space`),
          name: name || (isSuperAshley ? 'Ashley' : isBicon ? 'Bicon Ghose' : 'Strovr User'),
          ...updates
        });
      }
    }

    // Mirror to alias keys for Ashley & Bicon so both ID and email lookups have the exact same profile data
    if (isSuperAshley) {
      userStore.updateUser('user_ashleyghose64', updates);
      const ashEmailDoc = userStore.getUserByEmail('ashleyghose64@gmail.com');
      if (ashEmailDoc && ashEmailDoc._id !== 'user_ashleyghose64') {
        userStore.updateUser(ashEmailDoc._id, updates);
      }
    } else if (isBicon) {
      userStore.updateUser('user_ashleyghose28', updates);
      const biconEmailDoc = userStore.getUserByEmail('ashleyghose28@gmail.com');
      if (biconEmailDoc && biconEmailDoc._id !== 'user_ashleyghose28') {
        userStore.updateUser(biconEmailDoc._id, updates);
      }
    }

    // 2. Persist to Firestore with set merge: true (never throws NOT_FOUND)
    try {
      await db.collection('users').doc(targetDocId).set(updates, { merge: true });
      if (userEmail && userEmail !== targetDocId) {
        await db.collection('users').doc(userEmail).set(updates, { merge: true }).catch(() => {});
      }
    } catch (fsErr: any) {
      console.warn('[Auth] Firestore update skipped for profile:', fsErr.message);
    }

    const currentUser = localUpdated || userStore.getUserById(targetDocId) || { _id: targetDocId, ...updates };
    const syncedData = await syncUserPoolCredits(targetDocId, currentUser);
    const userData = { _id: targetDocId, ...syncedData };
    delete (userData as any).password;

    res.json({ message: 'Profile updated successfully', user: userData });
  } catch (err) {
    console.error('Failed to update profile:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/rehydrate-profile - Allows any client (mobile/PC) to rehydrate missing profile data into server memory
router.post('/rehydrate-profile', async (req, res) => {
  let userId = (req.headers.userid as string) || '';
  const userEmail = (req.headers.useremail as string || req.body.email || '').toLowerCase().trim();
  const { profile_picture, company_name, field_of_work, phone, niche, target_audience, goals, name } = req.body;

  if (!userId && !userEmail) return res.status(400).json({ error: 'Missing user identifier' });

  const cleanUid = userId.toLowerCase().trim();
  const isSuperAshley = cleanUid === 'user_ashleyghose64' || cleanUid.includes('ashleyghose64') || userEmail === 'ashleyghose64@gmail.com';
  const isBicon = cleanUid === 'user_ashleyghose28' || cleanUid.includes('ashleyghose28') || userEmail === 'ashleyghose28@gmail.com';
  const targetDocId = isSuperAshley ? 'user_ashleyghose64' : (isBicon ? 'user_ashleyghose28' : (userId || userEmail));

  try {
    const existing = userStore.getUserById(targetDocId) || (userEmail ? userStore.getUserByEmail(userEmail) : null);
    const updates: any = { updatedAt: new Date().toISOString() };

    if (profile_picture && (!existing?.profile_picture || existing.profile_picture.length < 50)) {
      updates.profile_picture = profile_picture;
    }
    if (company_name && !existing?.company_name) updates.company_name = company_name;
    if (field_of_work && !existing?.field_of_work) updates.field_of_work = field_of_work;
    if (phone && !existing?.phone) updates.phone = phone;
    if (niche && !existing?.niche) updates.niche = niche;
    if (target_audience && !existing?.target_audience) updates.target_audience = target_audience;
    if (goals && !existing?.goals) updates.goals = goals;
    if (name && !existing?.name) updates.name = name;

    let updated = existing;
    if (Object.keys(updates).length > 1) {
      if (existing) {
        updated = userStore.updateUser(existing._id, updates);
      } else {
        updated = userStore.saveUser({
          _id: targetDocId,
          email: userEmail || `${targetDocId}@strovr.space`,
          name: name || (isSuperAshley ? 'Ashley' : 'Strovr User'),
          ...updates
        });
      }

      if (isSuperAshley) {
        userStore.updateUser('user_ashleyghose64', updates);
      } else if (isBicon) {
        userStore.updateUser('user_ashleyghose28', updates);
      }

      try {
        await db.collection('users').doc(targetDocId).set(updates, { merge: true });
      } catch {}
    }

    res.json({ message: 'Profile rehydrated successfully', user: updated });
  } catch (err: any) {
    console.error('Failed to rehydrate profile:', err);
    res.status(500).json({ error: 'Rehydration failed' });
  }
});

// POST /api/auth/forgot-password - Dispatches a secure verification link to user's email
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    let rawUser: any = null;
    let userId: string = '';

    // 1. Check Firestore
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', normalizedEmail).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userId = doc.id;
        rawUser = doc.data();
      }
    } catch (fsErr: any) {
      console.warn('[Auth] Firestore query error in forgot-password:', fsErr.message);
    }

    // 2. Check local userStore
    if (!rawUser) {
      const localUser = userStore.getUserByEmail(normalizedEmail);
      if (localUser) {
        userId = localUser._id;
        rawUser = { ...localUser };
      }
    }

    // If account not found, return 200 with standard response to prevent user enumeration
    if (!rawUser || !userId) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset verification link has been dispatched.'
      });
    }

    // Generate secure 32-byte hex token (64 characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour expiration window

    const updates = {
      reset_password_token: resetToken,
      reset_password_expires_at: expiresAt
    };

    userStore.updateUser(userId, updates);
    try {
      await db.collection('users').doc(userId).update(updates);
    } catch {}

    // Resolve base client URL for the verification link
    const origin = req.headers.origin || req.headers.referer || process.env.CLIENT_URL || 'https://www.strovr.space';
    const cleanOrigin = String(origin).replace(/\/+$/, '').split('?')[0].split('#')[0];
    const resetVerificationLink = `${cleanOrigin}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log(`[Auth] Dispatched password reset verification link for ${normalizedEmail}: ${resetVerificationLink}`);

    // Dispatch verification link via email (SendGrid Web API over HTTPS)
    await sendPasswordResetEmail(normalizedEmail, rawUser.name || 'Strovr User', resetVerificationLink);

    return res.json({
      success: true,
      message: 'Password reset verification link has been dispatched to your email address.',
      // In dev or test environments, previewUrl is returned for convenience
      previewUrl: process.env.NODE_ENV !== 'production' ? resetVerificationLink : undefined
    });
  } catch (err: any) {
    console.error('[Auth] forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/verify-reset-token - Verifies that the reset token is valid and unexpired
router.post('/verify-reset-token', async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ valid: false, error: 'Email and verification token are required' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    let rawUser: any = null;

    // Check Firestore
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', normalizedEmail).get();
      if (!snapshot.empty) {
        rawUser = snapshot.docs[0].data();
      }
    } catch {}

    // Fallback to local store
    if (!rawUser) {
      const localUser = userStore.getUserByEmail(normalizedEmail);
      if (localUser) rawUser = { ...localUser };
    }

    if (!rawUser) {
      return res.status(400).json({ valid: false, error: 'User account not found' });
    }

    if (!rawUser.reset_password_token || rawUser.reset_password_token !== token) {
      return res.status(400).json({ valid: false, error: 'Invalid or expired password reset verification token' });
    }

    const expiresAt = new Date(rawUser.reset_password_expires_at || 0).getTime();
    if (Date.now() > expiresAt) {
      return res.status(400).json({ valid: false, error: 'This verification link has expired (1-hour window exceeded). Please request a new link.' });
    }

    return res.json({ valid: true, email: normalizedEmail });
  } catch (err: any) {
    console.error('[Auth] verify-reset-token error:', err);
    res.status(500).json({ valid: false, error: 'Server error while verifying token' });
  }
});

// POST /api/auth/reset-password - Sets a new password using verified token
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: 'Email, token, and new password are required' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  try {
    let rawUser: any = null;
    let userId: string = '';

    // Check Firestore
    try {
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('email', '==', normalizedEmail).get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userId = doc.id;
        rawUser = doc.data();
      }
    } catch {}

    // Fallback to local store
    if (!rawUser) {
      const localUser = userStore.getUserByEmail(normalizedEmail);
      if (localUser) {
        userId = localUser._id;
        rawUser = { ...localUser };
      }
    }

    if (!rawUser || !userId) {
      return res.status(400).json({ error: 'User account not found' });
    }

    if (!rawUser.reset_password_token || rawUser.reset_password_token !== token) {
      return res.status(400).json({ error: 'Invalid or already used verification token' });
    }

    const expiresAt = new Date(rawUser.reset_password_expires_at || 0).getTime();
    if (Date.now() > expiresAt) {
      return res.status(400).json({ error: 'This verification link has expired. Please request a new link.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    const updates = {
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires_at: null,
      updatedAt: new Date().toISOString()
    };

    userStore.updateUser(userId, updates);
    try {
      await db.collection('users').doc(userId).update(updates);
    } catch {}

    // Authenticate user directly and return new session token
    const syncedData = await syncUserPoolCredits(userId, { ...rawUser, ...updates });
    const userDoc = { _id: userId, ...syncedData } as any;
    delete userDoc.password;

    const authToken = jwt.sign({ id: userDoc._id, role: userDoc.role }, JWT_SECRET, { expiresIn: '1d' });

    console.log(`[Auth] Password successfully reset for user ${normalizedEmail}`);

    return res.json({
      success: true,
      message: 'Password successfully updated. You are now logged in.',
      token: authToken,
      user: userDoc
    });
  } catch (err: any) {
    console.error('[Auth] reset-password error:', err);
    res.status(500).json({ error: 'Server error while resetting password' });
  }
});

// POST /api/auth/change-password - Changes user password by verifying current password
router.post('/change-password', async (req, res) => {
  let userId = (req.headers.userid as string) || (req.body.userId as string);
  if (!userId && req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) userId = decoded.id;
    } catch {}
  }

  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please sign in to update your password.' });
  }

  if (!currentPassword || typeof currentPassword !== 'string') {
    return res.status(400).json({ error: 'Current password is required.' });
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  try {
    let rawUser: any = userStore.getUserById(userId);
    let docId = userId;

    if (!rawUser) {
      try {
        const doc = await db.collection('users').doc(userId).get();
        if (doc.exists) {
          rawUser = doc.data();
          docId = doc.id;
        }
      } catch {}
    }

    if (!rawUser) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    if (!rawUser.password) {
      return res.status(400).json({ error: 'This account was authenticated with Google OAuth. Password change is unavailable.' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, rawUser.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect. Please verify and try again.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updates = {
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    };

    userStore.updateUser(docId, updates);
    try {
      await db.collection('users').doc(docId).update(updates);
    } catch {}

    console.log(`[Auth] Password successfully updated for user ${rawUser.email} (${docId})`);
    return res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err: any) {
    console.error('[Auth] change-password error:', err);
    return res.status(500).json({ error: 'Server error while updating password.' });
  }
});

export default router;
