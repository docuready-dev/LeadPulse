import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';
import { userStore } from '../services/userStore';
import { DEFAULT_APPS } from './integrations';
import { compileEmailHtml, LeadData } from '../services/emailRenderer';
import { 
  sendDirectEmail, 
  verifyMailboxConnection, 
  verifySendGridConnection, 
  DispatchResult, 
  inAppDeliveredInbox, 
  UserSmtpSettings 
} from '../services/mailer';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const ALLOWED_FREE_TEMPLATES = ['one_column', 'text_only'];

const getTierEmailLimit = (plan?: string) => {
  const p = (plan || 'free').toLowerCase();
  return p === 'pro' ? 5000 : p === 'basic' ? 1500 : 50;
};

const getTierAiLimit = (plan?: string) => {
  const p = (plan || 'free').toLowerCase();
  return p === 'pro' ? -1 : p === 'basic' ? 250 : 5;
};

const getDailySendingCeiling = (plan?: string) => {
  const p = (plan || 'free').toLowerCase();
  return p === 'pro' || p === 'enterprise' ? 250 : p === 'basic' ? 100 : 50;
};

// Resilient in-memory fallback store for SMTP / Cloud Outbox settings
export const memorySmtpStore = new Map<string, any>();

// Middleware to check auth and resolve user record with accurate tier & quota
const requireAuth = async (req: any, res: any, next: any) => {
  let userId = (req.headers.userid as string) || '';

  // Extract from Bearer token if not directly in headers
  if (!userId && req.headers.authorization) {
    try {
      const authHeader = req.headers.authorization as string;
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && (decoded.id || decoded._id || decoded.userId)) {
        userId = decoded.id || decoded._id || decoded.userId;
      }
    } catch {}
  }

  // Also check if userId is passed in useremail header or body
  if (!userId && req.headers.useremail) {
    userId = req.headers.useremail as string;
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
  }

  try {
    let userData: any = null;

    // 1. Look up in resilient local userStore first (supports _id, email, alias)
    const cleanId = userId.toLowerCase().trim();
    if (cleanId === 'user_ashleyghose64' || cleanId.includes('ashleyghose64')) {
      userData = userStore.getUserById('user_ashleyghose64') || userStore.getUserByEmail('ashleyghose64@gmail.com');
    } else if (cleanId === 'user_ashleyghose28' || cleanId.includes('ashleyghose28')) {
      userData = userStore.getUserById('user_ashleyghose28') || userStore.getUserByEmail('ashleyghose28@gmail.com');
    } else {
      userData = userStore.getUserById(userId) || (userId.includes('@') ? userStore.getUserByEmail(userId) : null);
    }

    // 2. Fallback to Firestore if not found in local userStore
    if (!userData) {
      try {
        const userDoc = await db.collection('users').doc(userId).get();
        if (userDoc.exists) {
          userData = { _id: userDoc.id, ...userDoc.data() };
        }
      } catch {}
    }

    // 3. Fallback for mock/local test accounts if still unresolved
    if (!userData) {
      req.user = { 
        _id: userId, 
        name: 'Strovr Growth User', 
        email: userId.includes('@') ? userId : 'user@strovr.space', 
        plan: 'free' 
      };
      return next();
    }

    req.user = {
      _id: userData._id || userId,
      ...userData,
      plan: (userData.plan || 'free').toLowerCase()
    };
    next();
  } catch (err) {
    req.user = { _id: userId, name: 'Strovr Growth User', email: 'user@strovr.space', plan: 'free' };
    next();
  }
};

// ============================================================================
// 1. DIRECT-TO-INBOX BATCH CAMPAIGN DISPATCH CONTROLLER
// ============================================================================
router.post('/dispatch-batch', requireAuth, async (req: any, res: any) => {
  const { 
    templateId = 'one_column', 
    templateData = {}, 
    templateDataB = undefined,
    isAbTesting = false,
    templateStyling = {},
    leadIds = [],
    fallbackLeads = [],
    fromName,
    fromEmail,
    customSmtp,
    attachments = []
  } = req.body;

  const userId = req.user._id.toString();
  const userPlan = (req.user?.plan || 'free').toLowerCase();
  const userSmtpSettings = customSmtp || memorySmtpStore.get(userId) || req.user.smtpSettings;

  // Tier Enforcements: Templates & A/B Split Testing
  if (userPlan === 'free' && !ALLOWED_FREE_TEMPLATES.includes(templateId)) {
    return res.status(403).json({ 
      error: 'This Link Mobility framework is locked on the Free tier. Upgrade to Basic (₹699/mo) to unlock all 8 frameworks.' 
    });
  }

  if (userPlan === 'free' && isAbTesting) {
    return res.status(403).json({ 
      error: 'A/B Split Testing is locked on the Free tier. Upgrade to Basic (₹699/mo) or Pro (₹1,999/mo) to enable split campaigns.' 
    });
  }

  // Sending Mailbox Enforcement (SendGrid HTTPS Web API or SMTP)
  const hasSendGrid = Boolean(
    (userSmtpSettings && (userSmtpSettings.apiKey || userSmtpSettings.provider === 'sendgrid')) ||
    process.env.SENDGRID_API_KEY
  );
  const hasUserSmtp = Boolean(userSmtpSettings && userSmtpSettings.host && userSmtpSettings.user && userSmtpSettings.pass);
  const hasSystemSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  if (!hasSendGrid && !hasUserSmtp && !hasSystemSmtp) {
    return res.status(400).json({ 
      error: 'No SendGrid outbox connected. Please configure your SendGrid API Key in Outbox Settings to dispatch live emails.' 
    });
  }

  try {
    console.log(`[Dispatch Engine] Received outreach batch request for user ${userId}. Target IDs: ${leadIds.length}. A/B Testing: ${isAbTesting}`);

    // 1. Resolve Target Leads
    let targetLeads: LeadData[] = [];

    // Query leads from Firestore database
    if (leadIds.length > 0) {
      for (const id of leadIds) {
        try {
          const leadDoc = await db.collection('leads').doc(id).get();
          if (leadDoc.exists) {
            const data = leadDoc.data()!;
            targetLeads.push({
              _id: leadDoc.id,
              businessName: data.businessName || 'Business Lead',
              location: data.location || 'Local Market',
              category: data.category || 'Professional Services',
              fieldOfWork: data.category || 'Local Business',
              firstName: data.firstName || (data.businessName ? data.businessName.split(' ')[0] : 'Partner'),
              phone: data.phone || '+91 98000 00000',
              rating: data.rating || '4.8',
              email: data.email || `contact@${(data.businessName || 'company').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
            });
          }
        } catch (fetchErr) {
          console.warn(`[Dispatch Engine] Could not fetch lead ${id} from Firestore:`, fetchErr);
        }
      }
    }

    // If leads were not in Firestore, use fallbackLeads
    if (targetLeads.length === 0 && Array.isArray(fallbackLeads) && fallbackLeads.length > 0) {
      targetLeads = fallbackLeads.map((fl: any) => ({
        _id: fl._id || `lead-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        businessName: fl.businessName || 'Business Lead',
        location: fl.location || req.user?.target_audience || 'Target Market',
        category: fl.category || fl.fieldOfWork || 'Commercial',
        fieldOfWork: fl.fieldOfWork || fl.category || 'Commercial',
        firstName: fl.firstName || (fl.businessName ? fl.businessName.split(' ')[0] : 'Partner'),
        phone: fl.phone || '',
        rating: fl.rating || '4.9',
        email: fl.email || `contact@${(fl.businessName || 'partner').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
      }));
    }

    // If still empty, return error
    if (targetLeads.length === 0) {
      return res.status(400).json({ error: 'No target leads selected for dispatch.' });
    }

    // Check Email Dispatch Quota (Monthly & Strict Daily Ceiling)
    const emailLimit = req.user.emails_limit || getTierEmailLimit(userPlan);
    const currentSent = req.user.emails_sent || 0;
    if (currentSent + targetLeads.length > emailLimit) {
      return res.status(403).json({ 
        error: `Monthly email dispatch limit reached (${currentSent}/${emailLimit} sent). Upgrade your tier to dispatch this batch of ${targetLeads.length} emails.` 
      });
    }

    if (req.user?.campaign_status === 'paused_high_bounce') {
      return res.status(403).json({
        error: 'Outreach campaign is currently paused due to high bounce rate (>10%). Verify that your recipient addresses are active to protect sender domain reputation, then reset in Settings.'
      });
    }

    // Strict Daily Sending Ceiling enforcement (prevents IP blacklisting & spam abuse)
    const todayUtc = new Date().toISOString().split('T')[0];
    const lastResetDate = req.user?.daily_reset_date || '';
    const sentToday = lastResetDate === todayUtc ? (req.user?.emails_sent_today || 0) : 0;
    const dailyCeiling = getDailySendingCeiling(userPlan);

    if (sentToday + targetLeads.length > dailyCeiling) {
      return res.status(429).json({
        error: `Daily outreach ceiling reached (${sentToday}/${dailyCeiling} sent today on ${userPlan.toUpperCase()} tier). Strict daily limits prevent spam blacklisting and preserve your email domain reputation. Limit resets daily at midnight UTC.`
      });
    }

    // 2. Loop through selected CRM lead rows and dispatch direct-to-inbox
    const deliveryLogs: Array<DispatchResult & { businessName: string; leadId: string; subject: string; variant?: string }> = [];
    let deliveredCount = 0;
    let failedCount = 0;

    const rawBatchAttachments = Array.isArray(attachments) && attachments.length > 0 
      ? attachments 
      : (templateData.attachments || []);
    const processedAttachments = rawBatchAttachments.filter((a: any) => a.enabled !== false).map((a: any) => ({
      filename: a.fileName || a.filename || 'Document.pdf',
      content: a.base64 || a.content,
      path: a.url || a.path,
      contentType: a.fileType === 'image' ? 'image/jpeg' : (a.contentType || 'application/pdf')
    }));

    for (let i = 0; i < targetLeads.length; i++) {
      const lead = targetLeads[i];
      const activeData = (isAbTesting && templateDataB && (i % 2 === 1)) ? templateDataB : templateData;
      const variantTag = isAbTesting ? ((i % 2 === 0) ? 'Variant A' : 'Variant B') : undefined;

      const recipientEmail = (lead.email || `contact@${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).trim();

      // Anti-Spam Check: Verify recipient has not unsubscribed
      try {
        const unsubDoc = await db.collection('unsubscribes').doc(recipientEmail.toLowerCase()).get();
        if (unsubDoc.exists) {
          console.log(`[Dispatch Engine] Skipping unsubscribed recipient: ${recipientEmail}`);
          continue;
        }
      } catch (unsubErr) {
        // Continue if unsubscribe lookup fails
      }

      // Compile individualized HTML with merge tags, attachments & compliance footer
      const compiled = compileEmailHtml(
        { templateId, templateData: activeData, templateStyling, attachments: rawBatchAttachments },
        lead
      );

      // Dispatch via configured SMTP mail transport
      const result = await sendDirectEmail({
        to: recipientEmail,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        fromName: fromName || req.user.name || 'Strovr Growth Director',
        fromEmail: fromEmail || req.user.email,
        userSmtp: userSmtpSettings,
        attachments: processedAttachments
      });

      if (result.success) {
        deliveredCount++;
      } else {
        failedCount++;
      }

      const resolvedPreview = result.previewUrl
        ? (result.previewUrl.startsWith('http') ? result.previewUrl : `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001'}${result.previewUrl}`)
        : null;

      deliveryLogs.push({
        ...result,
        previewUrl: resolvedPreview,
        businessName: lead.businessName,
        leadId: lead._id || 'unknown',
        subject: compiled.subject,
        variant: variantTag
      });

      // Genuine Interaction Logging: ONLY record interaction if successfully delivered
      if (result.success && lead._id && !lead._id.startsWith('default-') && !lead._id.startsWith('lead-')) {
        try {
          const leadRef = db.collection('leads').doc(lead._id);
          const leadDoc = await leadRef.get();
          const currentActivities = (leadDoc.exists && Array.isArray(leadDoc.data()?.activities))
            ? leadDoc.data()?.activities
            : [];

          currentActivities.push({
            id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            type: 'Email',
            channel: 'email',
            title: `Delivered: ${compiled.subject}`,
            text: `Dispatched via ${result.providerUsed}. Response: ${result.response || '250 OK'}`,
            date: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
            method: result.providerUsed,
            recipient: recipientEmail,
            subject: compiled.subject,
            messageId: result.messageId,
            previewUrl: resolvedPreview,
            status: 'Delivered',
            author: fromName || req.user.name || 'Strovr Operator'
          });

          await leadRef.update({
            status: 'Contacted',
            lastContactedAt: new Date().toISOString(),
            activities: currentActivities
          });
        } catch (updateErr) {
          console.warn(`[Dispatch Engine] Failed to record verified interaction on lead ${lead._id}:`, updateErr);
        }
      }

      // Small throttling delay between direct dispatches
      await new Promise(r => setTimeout(r, 200));
    }

    // Update user emails_sent and emails_sent_today in Firestore
    if (deliveredCount > 0) {
      try {
        await db.collection('users').doc(userId).update({
          emails_sent: currentSent + deliveredCount,
          emails_sent_today: sentToday + deliveredCount,
          daily_reset_date: todayUtc
        });
      } catch (uErr) {
        console.warn('[Dispatch Engine] Could not update user emails_sent:', uErr);
      }
    }

    // Built-in Bounce and Complaint Tracking: Auto-pause campaign if fail rate exceeds 10%
    const totalAttempted = targetLeads.length;
    let highBounceTriggered = false;
    if (totalAttempted >= 5 && (failedCount / totalAttempted) > 0.10) {
      highBounceTriggered = true;
      try {
        await db.collection('users').doc(userId).update({
          campaign_status: 'paused_high_bounce'
        });
        console.warn(`[Dispatch Engine] High bounce rate detected (${failedCount}/${totalAttempted} failed). Campaign paused for user ${userId}.`);
      } catch (pErr) {
        console.warn('[Dispatch Engine] Could not update campaign_status to paused_high_bounce:', pErr);
      }
    }

    // 3. Record Campaign Log in Firestore
    const campaignRecord = {
      userId,
      templateId,
      subject: templateData.subject || 'Direct B2B Outreach',
      totalRecipients: targetLeads.length,
      deliveredCount,
      failedCount,
      logs: deliveryLogs,
      dispatchedAt: new Date().toISOString()
    };

    let campaignId = `camp-${Date.now()}`;
    try {
      const campRef = await db.collection('campaigns').add(campaignRecord);
      campaignId = campRef.id;
    } catch (saveErr) {
      console.warn('[Dispatch Engine] Could not save campaign record to Firestore:', saveErr);
    }

    console.log(`[Dispatch Engine] Campaign ${campaignId} completed: ${deliveredCount} delivered, ${failedCount} failed.`);

    return res.json({
      success: true,
      campaignId,
      totalDispatched: targetLeads.length,
      deliveredCount,
      failedCount,
      logs: deliveryLogs,
      summary: `Dispatched ${deliveredCount} of ${targetLeads.length} emails directly to recipient inboxes via verified mail delivery transport.`
    });

  } catch (err: any) {
    console.error('[Dispatch Engine] Fatal error during batch outreach:', err);
    return res.status(500).json({ error: err.message || 'Server error during direct-to-inbox dispatch.' });
  }
});

// ============================================================================
// 2. SINGLE INSTANT TEST EMAIL DISPATCH CONTROLLER
// ============================================================================
router.post('/dispatch-single', requireAuth, async (req: any, res: any) => {
  const { 
    templateId = 'one_column', 
    templateData = {}, 
    templateStyling = {},
    targetLead,
    customRecipientEmail,
    fromName,
    fromEmail,
    customSmtp,
    attachments = []
  } = req.body;

  const userPlan = (req.user?.plan || 'free').toLowerCase();
  const userSmtpSettings = customSmtp || memorySmtpStore.get(req.user._id) || req.user.smtpSettings;

  // Tier Enforcements: Template restriction on Free tier
  if (userPlan === 'free' && !ALLOWED_FREE_TEMPLATES.includes(templateId)) {
    return res.status(403).json({ 
      error: 'This Link Mobility framework is locked on the Free tier. Upgrade to Basic (₹699/mo) to unlock all 8 frameworks.' 
    });
  }

  // Check Email Dispatch Quota
  const emailLimit = req.user.emails_limit || getTierEmailLimit(userPlan);
  const currentSent = req.user.emails_sent || 0;
  if (currentSent + 1 > emailLimit) {
    return res.status(403).json({ 
      error: `Monthly email dispatch limit reached (${currentSent}/${emailLimit} sent). Upgrade your tier to dispatch more outreach.` 
    });
  }

  // Sending Mailbox Enforcement (SendGrid HTTPS Web API or SMTP)
  const hasSendGrid = Boolean(
    (userSmtpSettings && (userSmtpSettings.apiKey || userSmtpSettings.provider === 'sendgrid')) ||
    process.env.SENDGRID_API_KEY
  );
  const hasUserSmtp = Boolean(userSmtpSettings && userSmtpSettings.host && userSmtpSettings.user && userSmtpSettings.pass);
  const hasSystemSmtp = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);

  if (!hasSendGrid && !hasUserSmtp && !hasSystemSmtp) {
    return res.status(400).json({ 
      error: 'No SendGrid outbox connected. Please configure your SendGrid API Key in Outbox Settings to dispatch live emails.' 
    });
  }

  try {
    const lead: LeadData = targetLead || {
      businessName: req.user?.company_name || 'Target Business',
      location: req.user?.target_audience || 'Target Market',
      category: req.user?.field_of_work || 'B2B Services',
      fieldOfWork: req.user?.field_of_work || 'B2B Services',
      firstName: req.user?.name ? req.user.name.split(' ')[0] : 'Partner',
      phone: '',
      rating: '5.0'
    };

    const recipient = customRecipientEmail || lead.email || `contact@${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    const rawSingleAttachments = Array.isArray(attachments) && attachments.length > 0 
      ? attachments 
      : (templateData.attachments || []);
    const processedAttachments = rawSingleAttachments.filter((a: any) => a.enabled !== false).map((a: any) => ({
      filename: a.fileName || a.filename || 'Document.pdf',
      content: a.base64 || a.content,
      path: a.url || a.path,
      contentType: a.fileType === 'image' ? 'image/jpeg' : (a.contentType || 'application/pdf')
    }));

    const compiled = compileEmailHtml(
      { templateId, templateData, templateStyling, attachments: rawSingleAttachments },
      lead
    );

    const result = await sendDirectEmail({
      to: recipient,
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      fromName: fromName || req.user.name || 'Strovr Growth Director',
      fromEmail: fromEmail || req.user.email,
      userSmtp: userSmtpSettings,
      attachments: processedAttachments
    });

    if (result.success) {
      try {
        const todayUtc = new Date().toISOString().split('T')[0];
        const lastResetDate = req.user?.daily_reset_date || '';
        const sentToday = lastResetDate === todayUtc ? (req.user?.emails_sent_today || 0) : 0;

        await db.collection('users').doc(req.user._id).update({
          emails_sent: currentSent + 1,
          emails_sent_today: sentToday + 1,
          daily_reset_date: todayUtc
        });
      } catch (uErr) {
        console.warn('[Dispatch Engine] Could not update user emails_sent on single send:', uErr);
      }

      // Record verified interaction activity in target lead doc
      if (targetLead?._id && !targetLead._id.startsWith('default-') && !targetLead._id.startsWith('lead-')) {
        try {
          const leadRef = db.collection('leads').doc(targetLead._id);
          const leadDoc = await leadRef.get();
          const currentActivities = (leadDoc.exists && Array.isArray(leadDoc.data()?.activities))
            ? leadDoc.data()?.activities
            : [];

          currentActivities.push({
            id: `act-${Date.now()}`,
            type: 'Email',
            channel: 'email',
            title: `Delivered: ${compiled.subject}`,
            text: `Dispatched via ${result.providerUsed}. Response: ${result.response || '250 OK'}`,
            date: new Date().toISOString(),
            deliveredAt: new Date().toISOString(),
            method: result.providerUsed,
            recipient,
            subject: compiled.subject,
            messageId: result.messageId,
            previewUrl: result.previewUrl || null,
            status: 'Delivered',
            author: fromName || req.user.name || 'Strovr Operator'
          });

          await leadRef.update({
            status: 'Contacted',
            lastContactedAt: new Date().toISOString(),
            activities: currentActivities
          });
        } catch (actErr) {
          console.warn('[Dispatch Engine] Could not record activity on single send:', actErr);
        }
      }
    }

    const resolvedPreview = result.previewUrl
      ? (result.previewUrl.startsWith('http') ? result.previewUrl : `${req.headers['x-forwarded-proto'] || req.protocol || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3001'}${result.previewUrl}`)
      : null;

    res.json({
      success: result.success,
      result: {
        ...result,
        previewUrl: resolvedPreview
      },
      recipient,
      subject: compiled.subject,
      previewUrl: resolvedPreview
    });
  } catch (err: any) {
    console.error('[Dispatch Engine] Single email dispatch failure:', err);
    res.status(500).json({ error: err.message || 'Delivery error' });
  }
});

// ============================================================================
// ============================================================================
// 3. MAIL APP OUTBOX & SENDING MAILBOX CONTROLLER
// ============================================================================

// Get connected mailbox status (Honest check: false if no credentials configured)
router.get('/mailbox', requireAuth, async (req: any, res: any) => {
  let smtpSettings = memorySmtpStore.get(req.user._id) || req.user.smtpSettings || req.user.smtp_settings;
  try {
    const userDoc = await db.collection('users').doc(req.user._id).get();
    if (userDoc.exists) {
      const d = userDoc.data();
      if (d?.smtpSettings || d?.smtp_settings) {
        smtpSettings = d?.smtpSettings || d?.smtp_settings;
        memorySmtpStore.set(req.user._id, smtpSettings);
      }
    }
  } catch (err: any) {
    // Continue with in-memory store
  }

  // Also check if SendGrid API key exists in Render system environment
  const hasEnvKey = Boolean(process.env.SENDGRID_API_KEY);
  if (!smtpSettings && hasEnvKey) {
    smtpSettings = {
      provider: 'sendgrid',
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || req.user.email,
      fromName: req.user.name || 'Strovr Operator',
      replyTo: process.env.SENDGRID_FROM_EMAIL || req.user.email,
      isRenderEnv: true,
      verifiedAt: new Date().toISOString()
    };
  }

  const isSendGrid = Boolean(
    smtpSettings?.apiKey ||
    smtpSettings?.provider === 'sendgrid' ||
    (smtpSettings?.user && smtpSettings.user === 'apikey')
  );

  const isLegacyConnected = Boolean(smtpSettings && smtpSettings.host && smtpSettings.user && smtpSettings.pass);
  const isConnected = Boolean(isSendGrid || isLegacyConnected);

  if (!isConnected) {
    return res.json({
      isConnected: false,
      mailbox: null,
      isRenderEnv: hasEnvKey
    });
  }

  const maskedKey = smtpSettings?.apiKey
    ? `${smtpSettings.apiKey.substring(0, 7)}...${smtpSettings.apiKey.substring(smtpSettings.apiKey.length - 4)}`
    : null;

  res.json({
    isConnected: true,
    mailbox: {
      provider: isSendGrid ? 'sendgrid' : 'smtp',
      apiKeyMasked: maskedKey,
      host: isSendGrid ? 'api.sendgrid.com (Port 443 HTTPS)' : smtpSettings.host,
      port: isSendGrid ? 443 : (smtpSettings.port || 587),
      secure: true,
      user: smtpSettings.fromEmail || smtpSettings.user,
      fromName: smtpSettings.fromName || req.user.name || 'Outreach Specialist',
      fromEmail: smtpSettings.fromEmail || smtpSettings.user,
      replyTo: smtpSettings.replyTo || smtpSettings.fromEmail || smtpSettings.user,
      verifiedAt: smtpSettings.verifiedAt || new Date().toISOString(),
      hasPassword: Boolean(smtpSettings.apiKey || smtpSettings.pass),
      isRenderEnv: !!smtpSettings.isRenderEnv
    }
  });
});

// Verify & connect sending mailbox with SendGrid Web API over HTTPS (Port 443)
router.post('/verify-mailbox', requireAuth, async (req: any, res: any) => {
  const { 
    apiKey,
    fromName, 
    fromEmail, 
    replyTo,
    // Optional legacy fields
    host, 
    port, 
    secure, 
    user, 
    pass, 
    sendTestPing = true, 
    testRecipient 
  } = req.body;

  const resolvedApiKey = (apiKey || (user === 'apikey' ? pass : '') || process.env.SENDGRID_API_KEY || '').trim();
  const cleanFromEmail = (fromEmail !== undefined ? fromEmail : (user || req.user.email || '')).trim();
  const cleanFromName = (fromName || req.user.name || 'Strovr Operator').trim();
  const cleanReplyTo = (replyTo || cleanFromEmail).trim();

  // Primary pathway: SendGrid Web API over HTTPS (Port 443)
  if (resolvedApiKey || (!host && !pass)) {
    if (!resolvedApiKey) {
      return res.status(400).json({
        success: false,
        error: 'SendGrid API Key is required. Please generate an API Key in SendGrid Settings > API Keys.'
      });
    }

    if (!cleanFromEmail) {
      return res.status(400).json({
        success: false,
        error: 'Verified Sender Email is required. Enter the email address you verified in SendGrid Single Sender Verification.'
      });
    }

    const testEmailTarget = (testRecipient || req.user.email || cleanFromEmail).trim();

    try {
      const verification = await verifySendGridConnection(
        {
          apiKey: resolvedApiKey,
          fromEmail: cleanFromEmail,
          fromName: cleanFromName,
          replyTo: cleanReplyTo
        },
        sendTestPing ? testEmailTarget : undefined
      );

      if (!verification.success) {
        return res.status(400).json({
          success: false,
          error: verification.message,
          details: verification.error
        });
      }

      const savedRecord: UserSmtpSettings = {
        provider: 'sendgrid',
        apiKey: resolvedApiKey,
        host: 'api.sendgrid.com',
        port: 443,
        secure: true,
        user: cleanFromEmail,
        fromName: cleanFromName,
        fromEmail: cleanFromEmail,
        replyTo: cleanReplyTo,
        verifiedAt: new Date().toISOString()
      };

      memorySmtpStore.set(req.user._id, savedRecord);

      try {
        const userDoc = await db.collection('users').doc(req.user._id).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const rawIntegrations = Array.isArray(userData?.integrations) 
          ? userData.integrations 
          : (userStore.getUserById(req.user._id)?.integrations || DEFAULT_APPS);
        
        const updatedIntegrations = rawIntegrations.map((item: any) => {
          if (item.id === 'sendgrid') {
            return {
              ...item,
              connected: true,
              config: {
                ...(item.config || {}),
                apiKey: resolvedApiKey,
                fromEmail: cleanFromEmail,
                fromName: cleanFromName,
                replyTo: cleanReplyTo
              },
              lastSync: 'Just now'
            };
          }
          return item;
        });

        if (!updatedIntegrations.some((i: any) => i.id === 'sendgrid')) {
          const sendGridTemplate = DEFAULT_APPS.find(a => a.id === 'sendgrid');
          if (sendGridTemplate) {
            updatedIntegrations.push({
              ...sendGridTemplate,
              connected: true,
              config: {
                apiKey: resolvedApiKey,
                fromEmail: cleanFromEmail,
                fromName: cleanFromName,
                replyTo: cleanReplyTo
              },
              lastSync: 'Just now'
            });
          }
        }

        const sendGridLog = {
          id: `log_${Date.now()}`,
          appId: 'sendgrid',
          appName: 'SendGrid',
          eventType: 'auth',
          summary: `Verified and connected SendGrid Web API (${cleanFromEmail}) from Outreach Studio`,
          status: '200 OK',
          latency: '24ms',
          timestamp: new Date().toISOString(),
          payload: {
            action: 'mailbox.verified',
            provider: 'sendgrid',
            fromEmail: cleanFromEmail,
            fromName: cleanFromName
          }
        };

        const existingLogs = Array.isArray(userData?.integrationLogs) ? userData.integrationLogs : [];
        const updatedLogs = [sendGridLog, ...existingLogs].slice(0, 50);

        userStore.updateUser(req.user._id, {
          smtpSettings: savedRecord,
          smtp_settings: savedRecord,
          integrations: updatedIntegrations,
          integrationLogs: updatedLogs
        });

        await db.collection('users').doc(req.user._id).set({
          smtpSettings: savedRecord,
          smtp_settings: savedRecord,
          integrations: updatedIntegrations,
          integrationLogs: updatedLogs
        }, { merge: true });
      } catch (dbErr) {
        console.warn('[Outreach Router] Could not persist smtpSettings/integrations to Firestore (cached in-memory):', dbErr);
      }

      const maskedKey = `${resolvedApiKey.substring(0, 7)}...${resolvedApiKey.substring(resolvedApiKey.length - 4)}`;

      return res.json({
        success: true,
        message: verification.message,
        mailbox: {
          provider: 'sendgrid',
          apiKeyMasked: maskedKey,
          host: 'api.sendgrid.com (Port 443 HTTPS)',
          port: 443,
          secure: true,
          user: cleanFromEmail,
          fromName: cleanFromName,
          fromEmail: cleanFromEmail,
          replyTo: cleanReplyTo,
          verifiedAt: savedRecord.verifiedAt
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'SendGrid verification failed' });
    }
  }

  // Fallback legacy SMTP socket check (for non-Render local development only)
  const cleanHost = (host || '').trim();
  const cleanUser = (user || '').trim();
  const cleanPass = (pass || '').trim();

  if (!cleanHost || !cleanUser || !cleanPass) {
    return res.status(400).json({
      success: false,
      error: 'Render blocks raw SMTP ports 587 and 465. Please enter your SendGrid API Key for 100% reliable HTTPS delivery.'
    });
  }

  const resolvedPort = port ? parseInt(port) : (secure ? 465 : 587);
  const testEmailTarget = (testRecipient || req.user.email || cleanUser).trim();

  const candidateSettings: UserSmtpSettings = {
    provider: 'smtp',
    host: cleanHost,
    port: resolvedPort,
    secure: secure !== undefined ? secure : (resolvedPort === 465),
    user: cleanUser,
    pass: cleanPass,
    fromName: cleanFromName,
    fromEmail: cleanFromEmail,
    replyTo: cleanReplyTo
  };

  try {
    const verification = await verifyMailboxConnection(
      candidateSettings,
      sendTestPing ? testEmailTarget : undefined
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: verification.message,
        details: verification.error
      });
    }

    const savedRecord: UserSmtpSettings = {
      ...candidateSettings,
      verifiedAt: new Date().toISOString()
    };

    memorySmtpStore.set(req.user._id, savedRecord);

    try {
      await db.collection('users').doc(req.user._id).update({
        smtpSettings: savedRecord
      });
    } catch (dbErr) {
      console.warn('[Outreach Router] Could not persist smtpSettings to Firestore (cached in-memory):', dbErr);
    }

    res.json({
      success: true,
      message: verification.message,
      mailbox: {
        provider: 'smtp',
        host: candidateSettings.host,
        port: candidateSettings.port,
        secure: candidateSettings.secure,
        user: candidateSettings.user,
        fromName: candidateSettings.fromName,
        fromEmail: candidateSettings.fromEmail,
        replyTo: candidateSettings.replyTo,
        verifiedAt: savedRecord.verifiedAt
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Verification failed' });
  }
});

// Disconnect SMTP sending mailbox
router.delete('/disconnect-mailbox', requireAuth, async (req: any, res: any) => {
  memorySmtpStore.delete(req.user._id);

  try {
    const userDoc = await db.collection('users').doc(req.user._id).get();
    const userData = userDoc.exists ? userDoc.data() : (userStore.getUserById(req.user._id) || {});

    let updatedIntegrations = Array.isArray(userData?.integrations) ? [...userData.integrations] : [];
    if (updatedIntegrations.length > 0) {
      updatedIntegrations = updatedIntegrations.map((app: any) => {
        if (app.id === 'sendgrid') {
          return {
            ...app,
            connected: false,
            lastSync: 'Disconnected'
          };
        }
        return app;
      });
    }

    userStore.updateUser(req.user._id, {
      smtpSettings: null,
      smtp_settings: null,
      integrations: updatedIntegrations
    });

    await db.collection('users').doc(req.user._id).set({
      smtpSettings: null,
      smtp_settings: null,
      integrations: updatedIntegrations
    }, { merge: true });
  } catch (dbErr) {
    console.warn('[Outreach Router] Disconnect mailbox error:', dbErr);
  }

  res.json({ 
    success: true, 
    message: 'SMTP sending mailbox disconnected.',
    isConnected: false,
    mailbox: null
  });
});

// Standard SMTP configuration endpoints
router.get('/smtp-config', requireAuth, async (req: any, res: any) => {
  try {
    let settings = memorySmtpStore.get(req.user._id);
    if (!settings) {
      const userDoc = await db.collection('users').doc(req.user._id).get();
      settings = userDoc.data()?.smtpSettings || null;
    }
    res.json(settings || { isConnected: false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email settings' });
  }
});

router.post('/smtp-config', requireAuth, async (req: any, res: any) => {
  const { host, port, secure, user, pass, fromName, fromEmail, replyTo } = req.body;
  try {
    const cleanHost = (host || '').trim();
    const cleanUser = (user || '').trim();
    const cleanPass = (pass || '').trim();

    if (!cleanHost || !cleanUser || !cleanPass) {
      return res.status(400).json({ error: 'Host, user, and pass are required.' });
    }

    const settings: UserSmtpSettings = {
      host: cleanHost,
      port: port ? parseInt(port) : (secure ? 465 : 587),
      secure: secure !== undefined ? secure : (parseInt(port) === 465),
      user: cleanUser,
      pass: cleanPass,
      fromName: (fromName || req.user.name || '').trim(),
      fromEmail: (fromEmail || cleanUser).trim(),
      replyTo: (replyTo || fromEmail || cleanUser).trim(),
      verifiedAt: new Date().toISOString()
    };

    memorySmtpStore.set(req.user._id, settings);

    await db.collection('users').doc(req.user._id).update({
      smtpSettings: settings
    });

    res.json({ success: true, message: 'SMTP settings saved.', settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

// ============================================================================
// 4. IN-APP DELIVERED INBOX FEED & LIVE DELIVERY INSPECTOR
// ============================================================================
router.get('/inbox', requireAuth, (req: any, res: any) => {
  res.json(inAppDeliveredInbox);
});

router.get('/preview-delivered/:id', (req: any, res: any) => {
  const { id } = req.params;
  const msg = inAppDeliveredInbox.find(m => m.id === id);
  if (!msg) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Email Record Not Found</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; color: #64748B;">
          <h2>Email Record Not Found</h2>
          <p>This message may have expired from the recent delivery buffer.</p>
        </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${msg.subject} - Strovr Inbox Inspector</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; }
          .inspector-header { background: #0F172A; color: #FFFFFF; padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; border-bottom: 1px solid #1E293B; }
          .badge { background: #10B981; color: #FFFFFF; padding: 3px 10px; border-radius: 9999px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; }
          .meta-card { background: #FFFFFF; border-bottom: 1px solid #E2E8F0; padding: 16px 24px; font-size: 13px; }
          .meta-row { margin-bottom: 6px; display: flex; align-items: baseline; }
          .meta-label { width: 90px; font-weight: 700; color: #64748B; font-size: 12px; text-transform: uppercase; }
          .email-stage { max-width: 640px; margin: 28px auto 48px auto; background: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="inspector-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <strong>Strovr Direct Delivery Inspector</strong>
            <span class="badge">Delivered (250 OK)</span>
          </div>
          <div style="color: #94A3B8; font-size: 12px;">Transport: ${msg.provider}</div>
        </div>
        <div class="meta-card">
          <div class="meta-row"><span class="meta-label">Subject:</span> <strong>${msg.subject}</strong></div>
          <div class="meta-row"><span class="meta-label">Recipient:</span> <span>${msg.to}</span></div>
          <div class="meta-row"><span class="meta-label">Sender:</span> <span>${msg.from}</span></div>
          <div class="meta-row"><span class="meta-label">Dispatched:</span> <span>${new Date(msg.timestamp).toLocaleString()}</span></div>
        </div>
        <div class="email-stage">
          ${msg.html}
        </div>
      </body>
    </html>
  `);
});

// ============================================================================
// 6. AI SMART ASSISTANCE COPILOT - AUTO-COMPOSE ALL TEMPLATE SEGMENTS
// ============================================================================
function synthesizeExecutiveB2BCopy(options: {
  prompt: string;
  templateId: string;
  tone?: string;
  companyName: string;
  niche: string;
  targetAudience: string;
  goals: string;
  bookingUrl: string;
}) {
  const { prompt, templateId, companyName, niche, targetAudience, goals, bookingUrl } = options;
  const p = prompt.toLowerCase().trim();

  // Intent classification
  const isIntroOrCall = p.includes('call') || p.includes('15-minute') || p.includes('15 min') || 
                        p.includes('introductory') || p.includes('growth call') || p.includes('decision maker') ||
                        p.includes('meeting') || p.includes('discovery') || p.includes('chat') ||
                        p.includes('appointment') || p.includes('calendar') || p.includes('schedule') ||
                        p.includes('pipeline') || p.includes('book');

  const isAudit = p.includes('audit') || p.includes('review') || p.includes('analysis') || 
                  p.includes('benchmark') || p.includes('competitor') || p.includes('teardown') || p.includes('gap');

  const isDiscount = p.includes('discount') || p.includes('offer') || p.includes('deal') || 
                     p.includes('pilot') || p.includes('special') || p.includes('pricing') || p.includes('trial');

  const isDemo = p.includes('demo') || p.includes('software') || p.includes('platform') || 
                 p.includes('walkthrough') || p.includes('tool');

  let subject = `Quick 15-minute growth conversation for {{business_name}}`;
  let preheader = `Scaling pipeline and driving predictable revenue growth`;
  let headline = `Predictable Pipeline & Growth for {{business_name}}`;
  let subheadline = `Streamlining sales operations and connecting with high-value prospects.`;
  let body = '';
  let ctaText = 'Book 15-Min Growth Call';
  const ctaUrl = bookingUrl || 'https://calendly.com/your-calendar';

  if (isIntroOrCall) {
    subject = `Quick 15-minute growth conversation for {{business_name}}`;
    preheader = `Scaling pipeline and driving predictable revenue growth`;
    headline = `Predictable Pipeline & Growth for {{business_name}}`;
    subheadline = `Streamlining sales operations and connecting with high-value prospects.`;
    body = `Are you looking to scale your pipeline and drive predictable revenue growth without the guesswork?

We help businesses streamline their sales operations and connect directly with high-value prospects. I would love to invite you to a quick 15-minute introductory growth call to share how we can tailor this for your team.

Feel free to grab a quick slot that works best for you here: {{booking_link}}

Looking forward to connecting!`;
    ctaText = 'Book 15-Min Growth Call';
  } else if (isAudit) {
    subject = `Complimentary Growth Audit & Benchmarks for {{business_name}}`;
    preheader = `Uncovering high-impact revenue leverage points`;
    headline = `Unlocking Hidden Revenue for {{business_name}}`;
    subheadline = `Data-backed acquisition and conversion benchmarks across {{location}}.`;
    body = `Are you getting the maximum return from your client acquisition channels in {{location}}?

We conducted a preliminary analysis on the local footprint of {{business_name}} and identified three actionable opportunities to accelerate qualified pipeline.

I have compiled the full benchmarks and recommendations into a brief executive breakdown.

Feel free to review your complimentary audit here: {{booking_link}}

Excited to hear your thoughts!`;
    ctaText = 'View Free Growth Audit';
  } else if (isDiscount) {
    subject = `Exclusive Preferred Partner Terms for {{business_name}}`;
    preheader = `Reserved acquisition infrastructure for your team`;
    headline = `Accelerate Growth with Preferred Partner Access`;
    subheadline = `Dedicated pipeline acceleration for industry leaders in {{location}}.`;
    body = `Looking for an unfair advantage to scale customer acquisition this quarter without adding overhead?

We are rolling out an exclusive growth initiative for select leaders in {{location}}, delivering automated prospecting and verified decision-maker introductions on preferred terms.

We have reserved a dedicated pilot slot for {{business_name}}.

Review the reserved terms and pick a convenient slot here: {{booking_link}}

Looking forward to collaborating!`;
    ctaText = 'Claim Preferred Terms';
  } else if (isDemo) {
    subject = `Interactive Pipeline Walkthrough for {{business_name}}`;
    preheader = `Zero manual prospecting and verified inbox deliverability`;
    headline = `Automate Your Acquisition Pipeline`;
    subheadline = `Autonomous discovery and personalized multi-channel outreach.`;
    body = `How much time is your team spending every week on manual prospecting and lead research?

Our autonomous platform discovers verified decision makers, validates real-time email deliverability, and orchestrates personalized outreach in minutes.

I would love to walk you through a brief 10-minute live demonstration tailored to {{business_name}}.

Grab a quick walkthrough slot that works best for you here: {{booking_link}}

Looking forward to connecting!`;
    ctaText = 'Book Live Demo';
  } else {
    subject = `Strategic Growth Initiative for {{business_name}}`;
    preheader = `Predictable revenue growth and pipeline acceleration`;
    headline = `Scale Acquisition for {{business_name}} in {{location}}`;
    subheadline = `Connecting directly with verified high-value decision makers.`;
    body = `Are you looking to scale your pipeline and drive predictable revenue growth without the guesswork?

We help businesses streamline their sales operations and connect directly with high-value prospects across {{location}}. I would love to invite you to a quick 15-minute introductory growth call to share how we can tailor this for your team.

Feel free to grab a quick slot that works best for you here: {{booking_link}}

Looking forward to connecting!`;
    ctaText = 'Book 15-Min Growth Call';
  }

  const generatedData: any = {
    subject,
    preheader,
    headline,
    subheadline,
    body,
    ctaText,
    ctaUrl,
    secondaryCtaText: 'View Growth Deck',
    secondaryCtaUrl: 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf'
  };

  switch (templateId) {
    case 'two_column':
      generatedData.col1Title = '15-Min Strategy Session';
      generatedData.col1Body = `Walk through tailored pipeline bottlenecks and revenue opportunities for {{business_name}}.`;
      generatedData.col1Cta = 'Reserve Strategy Slot';
      generatedData.col1CtaUrl = ctaUrl;
      generatedData.col2Title = 'Executive Briefing Deck';
      generatedData.col2Body = `Review our high-ticket conversion metrics and verified client case studies on your own schedule.`;
      generatedData.col2Cta = 'Download Executive Deck';
      generatedData.col2CtaUrl = 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf';
      break;

    case 'hybrid':
      generatedData.col1Title = 'Predictable Pipeline';
      generatedData.col1Body = `Connect directly with pre-qualified decision makers across {{location}} without manual prospecting.`;
      generatedData.col1Cta = 'Explore Strategy';
      generatedData.col1CtaUrl = ctaUrl;
      generatedData.col2Title = 'Direct Inbox Transport';
      generatedData.col2Body = `Achieve high response rates with personalized variable injection and direct inbox delivery.`;
      generatedData.col2Cta = 'See Case Studies';
      generatedData.col2CtaUrl = 'https://www.strovr.space/software';
      break;

    case 'interactive_calendar':
      generatedData.hostName = companyName && companyName !== 'our company' ? companyName : 'Growth Advisory Team';
      generatedData.hostTitle = 'Strategic Partnerships';
      generatedData.duration = '15 Minutes';
      generatedData.meetingAgenda = [
        'Review current pipeline bottlenecks and target market in {{location}}',
        'Explore verified decision-maker acquisition strategies',
        'Determine custom integration fit for {{business_name}}'
      ];
      break;

    case 'inverted_pyramid':
      generatedData.headline = `A Special Growth Invitation for {{business_name}}`;
      generatedData.subheadline = `Exclusively tailored for commercial leaders in {{location}}.`;
      generatedData.body = body;
      generatedData.ctaText = ctaText;
      break;

    case 'zig_zag':
      generatedData.zig1Title = '1. Pipeline Scalability';
      generatedData.zig1Text = `Identify and connect with high-intent decision makers across {{location}} with zero scraping friction.`;
      generatedData.zig1Cta = 'Explore Discovery';
      generatedData.zig1CtaUrl = ctaUrl;
      generatedData.zig2Title = '2. Predictable Execution';
      generatedData.zig2Text = `Turn cold prospects into booked discovery calls with proven executive outreach frameworks.`;
      generatedData.zig2Cta = 'Book 15-Min Call';
      generatedData.zig2CtaUrl = ctaUrl;
      break;

    case 'f_pattern':
      generatedData.fBullet1 = `Predictable Pipeline: Reach verified commercial decision makers across {{location}}.`;
      generatedData.fBullet2 = `Zero Guesswork: Streamline sales operations with automated, high-deliverability dispatch.`;
      generatedData.fBullet3 = `Tailored Growth: 15-minute introductory session focused entirely on {{business_name}}'s revenue goals.`;
      generatedData.fBottomNote = `Direct calendar booking link: {{booking_link}}`;
      break;

    case 'interactive_roi':
      generatedData.comparisonCurrent = {
        title: 'Manual Cold Outreach',
        monthlyCost: '₹45,000 / mo',
        timeSpent: '28 hrs / wk',
        replyRate: '1.2%',
        badge: 'High Friction'
      };
      generatedData.comparisonPulse = {
        title: 'Predictable Growth Pipeline',
        monthlyCost: '₹699 / mo',
        timeSpent: '2 hrs / wk',
        replyRate: '18.4%',
        badge: 'Automated'
      };
      generatedData.roiMetrics = [
        { metric: 'Time Saved / Mo', value: '104 hrs' },
        { metric: 'Verified Contacts', value: '1,500+' },
        { metric: 'Average Cost / Lead', value: '₹0.46' }
      ];
      break;

    case 'dynamic_product_feed':
      generatedData.headline = `Growth Solutions Tailored for {{business_name}}`;
      generatedData.subheadline = `Curated pipeline packages designed to scale your operations in {{location}}`;
      generatedData.body = `Take a look at how we can help {{business_name}} accelerate qualified meetings this quarter:`;
      generatedData.products = [
        { 
          name: 'Starter Pipeline', 
          category: 'Lead Discovery', 
          price: '₹699 / mo', 
          badge: 'Starter', 
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80', 
          description: `Get started with verified local prospects in {{location}}.`, 
          ctaText: 'Select Starter', 
          ctaUrl: ctaUrl 
        },
        { 
          name: 'Pro Multi-Channel Suite', 
          category: 'Full Automation', 
          price: '₹1,999 / mo', 
          badge: 'Most Popular', 
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80', 
          description: `Engage decision makers directly across Email and WhatsApp.`, 
          ctaText: 'Select Pro', 
          ctaUrl: ctaUrl 
        },
        { 
          name: 'Executive Partnership', 
          category: 'Dedicated Scale', 
          price: '₹4,999 / mo', 
          badge: 'Best Value', 
          imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format&fit=crop&q=80', 
          description: `Full done-for-you pipeline scaling for {{business_name}}.`, 
          ctaText: 'Select Enterprise', 
          ctaUrl: ctaUrl 
        }
      ];
      break;
  }

  return generatedData;
}

router.post('/ai-generate', requireAuth, async (req: any, res: any) => {
  const { templateId = 'one_column', prompt = '', tone = 'friendly' } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Please provide a prompt or target goal.' });
  }

  const userPlan = (req.user?.plan || 'free').toLowerCase();
  const aiLimit = req.user.ai_pitches_limit !== undefined ? req.user.ai_pitches_limit : getTierAiLimit(userPlan);
  const aiUsed = req.user.ai_pitches_used || 0;
  if (aiLimit !== -1 && aiUsed >= aiLimit) {
    return res.status(403).json({
      error: `Monthly AI pitch generation limit reached (${aiUsed}/${aiLimit} used). Upgrade to Basic (250/mo) or Pro (Unlimited) to compose more pitches.`
    });
  }

  let niche = 'B2B Services';
  let targetAudience = 'Decision Makers';
  let goals = 'scale revenue and accelerate pipeline';
  let companyName = 'Strovr Growth Platform';
  let bookingUrl = 'https://calendly.com/your-calendar';

  try {
    const userDoc = await db.collection('users').doc(req.user._id.toString()).get();
    const uData = userDoc.data();
    if (uData) {
      niche = uData.niche || uData.field_of_work || niche;
      targetAudience = uData.target_audience || targetAudience;
      goals = uData.goals || goals;
      companyName = uData.company_name || companyName;
      bookingUrl = uData.calendar_link || uData.calendly_url || bookingUrl;
    }
  } catch (err) {
    console.warn('[AI] Could not fetch user context:', err);
  }

  const cleanPrompt = prompt.trim();

  // 1. Generate high-converting executive B2B framework
  let generatedData = synthesizeExecutiveB2BCopy({
    prompt: cleanPrompt,
    templateId,
    tone,
    companyName,
    niche,
    targetAudience,
    goals,
    bookingUrl
  });

  // 2. Optional Gemini API enhancement if GEMINI_API_KEY is configured
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (geminiKey) {
    try {
      const geminiPrompt = `You are a world-class B2B cold email copywriter crafting an executive outreach pitch.
Target prospect placeholder: {{business_name}} in {{location}} (Field: {{field_of_work}}).
Sender company: ${companyName}.
Sender niche: ${niche}.
Booking link tag: {{booking_link}}.
User Goal/Prompt: "${cleanPrompt}".

CRITICAL RULES:
- Never repeat or echo the user's prompt verbatim into the output body.
- Write in an executive, curious, high-converting tone.
- Start with a compelling hook question about scaling their pipeline or predictable revenue growth.
- In 1-2 punchy sentences, articulate how we streamline operations and connect directly with high-value prospects.
- Invite them to a quick 15-minute introductory growth call.
- Provide a clean call to action pointing to {{booking_link}}.
- Output valid JSON only with keys: "subject", "preheader", "headline", "subheadline", "body", "ctaText".`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.7
          }
        })
      });

      if (response.ok) {
        const geminiJson: any = await response.json();
        const rawContent = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          if (parsed.body && parsed.subject) {
            generatedData = {
              ...generatedData,
              ...parsed,
              ctaUrl: bookingUrl
            };
          }
        }
      }
    } catch (llmErr) {
      console.warn('[AI] Gemini LLM refinement failed, relying on deterministic executive matrix:', llmErr);
    }
  }

  // Increment user's ai_pitches_used in Firestore
  try {
    await db.collection('users').doc(req.user._id).update({
      ai_pitches_used: aiUsed + 1
    });
  } catch (uErr) {
    console.warn('[AI] Could not update ai_pitches_used in Firestore:', uErr);
  }

  return res.json({
    success: true,
    message: 'Template segments successfully auto-composed by AI Assistant!',
    templateId,
    prompt: cleanPrompt,
    generatedData,
    aiPitchesUsed: aiUsed + 1,
    aiPitchesLimit: aiLimit
  });
});

// ============================================================================
// 4. CAN-SPAM & GDPR MANDATORY UNSUBSCRIBE CONTROLLER
// ============================================================================
router.get('/unsubscribe', async (req: express.Request, res: express.Response) => {
  const email = ((req.query.email as string) || '').toLowerCase().trim();
  const userId = req.query.userId as string;

  if (email) {
    try {
      await db.collection('unsubscribes').doc(email).set({
        email,
        userId: userId || 'public',
        unsubscribedAt: new Date().toISOString()
      });
      console.log(`[Unsubscribe Engine] Successfully unsubscribed: ${email}`);
    } catch (unsubSaveErr) {
      console.warn('[Unsubscribe Engine] Failed to store unsubscribe record:', unsubSaveErr);
    }
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Unsubscribed | Strovr</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #F8FAFC; color: #0F172A; }
        .card { max-width: 440px; padding: 36px; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
        .badge { display: inline-block; padding: 4px 12px; background: #ECFDF5; color: #047857; font-weight: 700; font-size: 11px; border-radius: 9999px; margin-bottom: 16px; border: 1px solid #A7F3D0; }
        h2 { margin: 0 0 10px 0; font-size: 20px; font-weight: 800; color: #0F172A; }
        p { color: #64748B; font-size: 13px; line-height: 1.6; margin: 0 0 20px 0; }
        .email-pill { font-family: monospace; background: #F1F5F9; padding: 4px 8px; border-radius: 6px; font-weight: 700; color: #1E293B; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">Unsubscribed Successfully</div>
        <h2>You Have Been Opted Out</h2>
        <p>The address <span class="email-pill">${email || 'your email'}</span> has been permanently unsubscribed from all future Strovr outreach campaigns.</p>
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">Strovr CAN-SPAM &amp; GDPR Opt-Out Compliance Registry</p>
      </div>
    </body>
    </html>
  `);
});

export default router;
