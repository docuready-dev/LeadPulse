import express from 'express';
import { db } from '../index';
import { compileEmailHtml, LeadData } from '../services/emailRenderer';
import { sendDirectEmail, verifyMailboxConnection, DispatchResult, inAppDeliveredInbox, UserSmtpSettings } from '../services/mailer';

const router = express.Router();

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

// Middleware to check auth
const requireAuth = async (req: any, res: any, next: any) => {
  const userId = req.headers.userid;
  if (!userId) return res.status(401).json({ error: 'Unauthorized: Missing User ID' });
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      // Fallback for mock/local test accounts
      req.user = { _id: userId, name: 'LeadPulse Growth User', email: 'user@leadpulse.io', plan: 'free' };
      return next();
    }
    req.user = { _id: userDoc.id, ...userDoc.data() };
    next();
  } catch (err) {
    req.user = { _id: userId, name: 'LeadPulse Growth User', email: 'user@leadpulse.io', plan: 'free' };
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
    customSmtp
  } = req.body;

  const userId = req.user._id.toString();
  const userPlan = (req.user?.plan || 'free').toLowerCase();
  const userSmtpSettings = customSmtp || req.user.smtpSettings || undefined;

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

  // Sending Mailbox Enforcement
  if (!userSmtpSettings || (!userSmtpSettings.user && !userSmtpSettings.resendApiKey && !process.env.SMTP_USER)) {
    return res.status(400).json({ 
      error: 'No sending mailbox connected. Please connect your email account (Gmail, Brevo, Outlook, Yahoo, Zoho, or Custom SMTP) in Mailbox Settings to dispatch live outreach to real inboxes.' 
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

      // Compile individualized HTML with merge tags & compliance footer
      const compiled = compileEmailHtml(
        { templateId, templateData: activeData, templateStyling },
        lead
      );

      // Dispatch via configured SMTP mail transport
      const result = await sendDirectEmail({
        to: recipientEmail,
        subject: compiled.subject,
        html: compiled.html,
        text: compiled.text,
        fromName: fromName || req.user.name || 'LeadPulse Growth Director',
        fromEmail: fromEmail || req.user.email,
        userSmtp: userSmtpSettings
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
            author: fromName || req.user.name || 'LeadPulse Operator'
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
    customSmtp
  } = req.body;

  const userPlan = (req.user?.plan || 'free').toLowerCase();
  const userSmtpSettings = customSmtp || req.user.smtpSettings || undefined;

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

  // Sending Mailbox Enforcement
  if (!userSmtpSettings || (!userSmtpSettings.user && !userSmtpSettings.resendApiKey && !process.env.SMTP_USER)) {
    return res.status(400).json({ 
      error: 'No sending mailbox connected. Please connect your email account (Gmail, Brevo, Outlook, Yahoo, Zoho, or Custom SMTP) in Mailbox Settings to dispatch live outreach to real inboxes.' 
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

    const compiled = compileEmailHtml(
      { templateId, templateData, templateStyling },
      lead
    );

    const result = await sendDirectEmail({
      to: recipient,
      subject: compiled.subject,
      html: compiled.html,
      text: compiled.text,
      fromName: fromName || req.user.name || 'LeadPulse Growth Director',
      fromEmail: fromEmail || req.user.email,
      userSmtp: userSmtpSettings
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
            author: fromName || req.user.name || 'LeadPulse Operator'
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
// 3. MAIL APP OUTBOX & SENDING MAILBOX CONTROLLER
// ============================================================================

// Get connected mailbox status
router.get('/mailbox', requireAuth, async (req: any, res: any) => {
  try {
    const userDoc = await db.collection('users').doc(req.user._id).get();
    const smtpSettings = userDoc.data()?.smtpSettings;
    const isConnected = !!(smtpSettings && (smtpSettings.user || smtpSettings.resendApiKey));

    res.json({
      isConnected,
      mailbox: isConnected ? {
        provider: smtpSettings.provider || 'gmail',
        user: smtpSettings.user || '',
        host: smtpSettings.host || '',
        port: smtpSettings.port || 587,
        fromName: smtpSettings.fromName || req.user.name || '',
        fromEmail: smtpSettings.fromEmail || smtpSettings.user || '',
        verifiedAt: smtpSettings.verifiedAt || null,
        hasPassword: !!smtpSettings.pass
      } : null
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch mailbox settings' });
  }
});

// Verify & connect sending mailbox (with real test email option)
router.post('/verify-mailbox', requireAuth, async (req: any, res: any) => {
  const { 
    provider = 'gmail', 
    host, 
    port, 
    secure, 
    user, 
    pass, 
    fromName, 
    fromEmail, 
    resendApiKey, 
    sendTestPing = true, 
    testRecipient 
  } = req.body;

  const cleanUser = (user || '').trim();
  const cleanPass = (pass || '').replace(/\s+/g, '').trim();
  const testEmailTarget = (testRecipient || req.user.email || cleanUser).trim();

  const candidateSettings: UserSmtpSettings = {
    provider,
    host: host || '',
    port: port ? parseInt(port) : 587,
    secure: secure !== undefined ? secure : (parseInt(port) === 465),
    user: cleanUser,
    pass: cleanPass,
    fromName: fromName || req.user.name || 'LeadPulse Operator',
    fromEmail: fromEmail || cleanUser || req.user.email || 'outreach@leadpulse.io',
    resendApiKey: (resendApiKey || '').trim()
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

    // Save verified mailbox to user profile in Firestore
    const savedRecord = {
      ...candidateSettings,
      verifiedAt: new Date().toISOString()
    };

    await db.collection('users').doc(req.user._id).update({
      smtpSettings: savedRecord
    });

    res.json({
      success: true,
      message: verification.message,
      mailbox: {
        provider: candidateSettings.provider,
        user: candidateSettings.user,
        fromName: candidateSettings.fromName,
        fromEmail: candidateSettings.fromEmail,
        verifiedAt: savedRecord.verifiedAt
      }
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Verification failed' });
  }
});

// Disconnect sending mailbox
router.delete('/disconnect-mailbox', requireAuth, async (req: any, res: any) => {
  try {
    await db.collection('users').doc(req.user._id).update({
      smtpSettings: null
    });
    res.json({ success: true, message: 'Sending mailbox disconnected.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect mailbox' });
  }
});

// Backwards-compatible smtp-config endpoints
router.get('/smtp-config', requireAuth, async (req: any, res: any) => {
  try {
    const userDoc = await db.collection('users').doc(req.user._id).get();
    const smtpSettings = userDoc.data()?.smtpSettings || {
      provider: 'gmail',
      fromName: req.user.name || 'LeadPulse Growth Director',
      fromEmail: req.user.email || 'outreach@leadpulse.io'
    };
    res.json(smtpSettings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email settings' });
  }
});

router.post('/smtp-config', requireAuth, async (req: any, res: any) => {
  const { provider, host, port, user, pass, resendApiKey, sendgridApiKey, fromName, fromEmail } = req.body;
  try {
    const settings = {
      provider: provider || 'gmail',
      host: host || '',
      port: port ? parseInt(port) : 587,
      user: user || '',
      pass: pass || '',
      resendApiKey: resendApiKey || '',
      sendgridApiKey: sendgridApiKey || '',
      fromName: fromName || '',
      fromEmail: fromEmail || '',
      updatedAt: new Date().toISOString()
    };

    await db.collection('users').doc(req.user._id).update({
      smtpSettings: settings
    });

    res.json({ success: true, message: 'Email sending configuration saved!', settings });
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
        <title>${msg.subject} - LeadPulse Inbox Inspector</title>
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
            <strong>LeadPulse Direct Delivery Inspector</strong>
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

  let niche = 'general clients';
  let targetAudience = 'high-value clients';
  let goals = 'scale your operations and increase revenue';
  let companyName = 'our company';
  try {
    const userDoc = await db.collection('users').doc(req.user._id.toString()).get();
      const uData = userDoc.data();
      if (uData) {
        niche = uData.niche || uData.field_of_work || niche;
        targetAudience = uData.target_audience || targetAudience;
        goals = uData.goals || goals;
        companyName = uData.company_name || companyName;
      }
  } catch (err) {
    console.warn('[AI] Could not fetch user context:', err);
  }
  const cleanPrompt = prompt.trim();
  const isDiscount = cleanPrompt.toLowerCase().includes('discount') || cleanPrompt.toLowerCase().includes('offer');
  
  const generatedData: any = {
    subject: isDiscount ? `Special Offer from ${companyName} for {{business_name}}` : `Quick question regarding {{business_name}} and ${niche}`,
    preheader: `Exciting news tailored for {{business_name}}`,
    headline: isDiscount ? `Claim Your Exclusive ${companyName} Deal` : `Helping {{business_name}} reach ${targetAudience} effortlessly`,
    subheadline: `Tailored ${niche} solutions designed to help you ${goals}.`,
    body: `Hi {{first_name}},

${cleanPrompt}.

At ${companyName}, our primary focus is helping businesses just like yours in the ${niche} space connect with ${targetAudience}. Our ultimate goal? To help you ${goals} without the usual stress or guesswork.

Would you be open to a quick, friendly chat this week to see if we'd be a good fit for {{business_name}}?`,
    ctaText: isDiscount ? 'Claim Offer' : 'Let\'s Chat',
    ctaUrl: 'https://calendly.com/your-calendar',
    secondaryCtaText: 'Learn More',
    secondaryCtaUrl: 'https://yourwebsite.com'
  };
  
  switch (templateId) {
    case 'two_column':
      generatedData.col1Title = 'Option 1: Done-For-You';
      generatedData.col1Body = `We handle the heavy lifting to engage ${targetAudience} for {{business_name}}.`;
      generatedData.col1Cta = 'View Option 1';
      generatedData.col1CtaUrl = 'https://example.com/1';
      generatedData.col2Title = 'Option 2: Do-It-Yourself';
      generatedData.col2Body = `Use our simple ${niche} toolkit to ${goals} at your own pace.`;
      generatedData.col2Cta = 'View Option 2';
      generatedData.col2CtaUrl = 'https://example.com/2';
      break;
    case 'hybrid':
      generatedData.col1Title = 'Market Insights';
      generatedData.col1Body = `Discover how ${niche} businesses in {{location}} are capturing more ${targetAudience}.`;
      generatedData.col1Cta = 'Read Tips';
      generatedData.col1CtaUrl = 'https://example.com';
      generatedData.col2Title = 'Direct Outreach';
      generatedData.col2Body = `Easily start a conversation with ${targetAudience} in {{location}}.`;
      generatedData.col2Cta = 'See How';
      generatedData.col2CtaUrl = 'https://example.com';
      break;
    case 'inverted_pyramid':
      generatedData.headline = `A Special Invitation for {{business_name}}`;
      generatedData.subheadline = `Exclusively for ${niche} businesses in {{location}}.`;
      generatedData.body = `We are looking for partners who want to ${goals}. We think {{business_name}} is a perfect fit for our new ${targetAudience} initiative. ${cleanPrompt}.`;
      generatedData.ctaText = 'Learn More';
      break;
    case 'zig_zag':
      generatedData.zig1Title = '1. Understand Your Audience';
      generatedData.zig1Text = `We help {{business_name}} pinpoint exactly what ${targetAudience} in {{location}} are looking for.`;
      generatedData.zig1Cta = 'Learn More';
      generatedData.zig1CtaUrl = 'https://example.com';
      generatedData.zig2Title = '2. Achieve Your Goals';
      generatedData.zig2Text = `With our tools, you can finally ${goals} consistently and reliably.`;
      generatedData.zig2Cta = 'View Steps';
      generatedData.zig2CtaUrl = 'https://example.com';
      break;
    case 'f_pattern':
      generatedData.fBullet1 = `Tailored strategy for ${niche} in {{location}}.`;
      generatedData.fBullet2 = `Engage directly with ${targetAudience}.`;
      generatedData.fBullet3 = `Achieve your ultimate objective: ${goals}.`;
      generatedData.fBottomNote = `Let's make it happen for {{business_name}}!`;
      break;
    case 'dynamic_product_feed':
      generatedData.headline = `Our ${niche} Offerings for {{business_name}}`;
      generatedData.subheadline = `Curated specifically to help you ${goals}`;
      generatedData.body = `Take a look at how we can support {{business_name}} in {{location}}:`;
      generatedData.products = [
        { name: 'Starter Package', category: niche, price: '₹699 / mo', badge: 'Starter', imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80', description: `Essential ${niche} setup.`, ctaText: 'Select Starter', ctaUrl: '#' },
        { name: 'Pro Suite', category: 'Full Automation', price: '₹1,999 / mo', badge: 'Most Popular', imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80', description: `Engage ${targetAudience} at scale.`, ctaText: 'Select Pro', ctaUrl: '#' },
        { name: 'Enterprise', category: 'Dedicated', price: '₹4,999 / mo', badge: 'Best Value', imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format&fit=crop&q=80', description: `Achieve ${goals} effortlessly.`, ctaText: 'Select Enterprise', ctaUrl: '#' }
      ];
      break;
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
      <title>Unsubscribed | LeadPulse</title>
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
        <p>The address <span class="email-pill">${email || 'your email'}</span> has been permanently unsubscribed from all future LeadPulse outreach campaigns.</p>
        <p style="font-size: 11px; color: #94A3B8; margin: 0;">LeadPulse CAN-SPAM &amp; GDPR Opt-Out Compliance Registry</p>
      </div>
    </body>
    </html>
  `);
});

export default router;
