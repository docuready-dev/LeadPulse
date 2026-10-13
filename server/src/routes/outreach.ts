import express from 'express';
import { db } from '../index';
import { compileEmailHtml, LeadData } from '../services/emailRenderer';
import { sendDirectEmail, DispatchResult, inAppDeliveredInbox } from '../services/mailer';

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

    // Check Email Dispatch Quota
    const emailLimit = req.user.emails_limit || getTierEmailLimit(userPlan);
    const currentSent = req.user.emails_sent || 0;
    if (currentSent + targetLeads.length > emailLimit) {
      return res.status(403).json({ 
        error: `Monthly email dispatch limit reached (${currentSent}/${emailLimit} sent). Upgrade your tier to dispatch this batch of ${targetLeads.length} emails.` 
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

      // Compile individualized HTML with merge tags & compliance footer
      const compiled = compileEmailHtml(
        { templateId, templateData: activeData, templateStyling },
        lead
      );

      const recipientEmail = lead.email || `contact@${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

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

      deliveryLogs.push({
        ...result,
        businessName: lead.businessName,
        leadId: lead._id || 'unknown',
        subject: compiled.subject,
        variant: variantTag
      });

      // Update lead status in Firestore to 'Contacted'
      if (lead._id && !lead._id.startsWith('default-') && !lead._id.startsWith('lead-')) {
        try {
          await db.collection('leads').doc(lead._id).update({
            status: 'Contacted',
            lastContactedAt: new Date().toISOString()
          });
        } catch (updateErr) {
          console.warn(`[Dispatch Engine] Failed to update lead ${lead._id} status:`, updateErr);
        }
      }

      // Small throttling delay between direct dispatches
      await new Promise(r => setTimeout(r, 200));
    }

    // Update user emails_sent in Firestore
    if (deliveredCount > 0) {
      try {
        await db.collection('users').doc(userId).update({
          emails_sent: currentSent + deliveredCount
        });
      } catch (uErr) {
        console.warn('[Dispatch Engine] Could not update user emails_sent:', uErr);
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
        await db.collection('users').doc(req.user._id).update({
          emails_sent: currentSent + 1
        });
      } catch (uErr) {
        console.warn('[Dispatch Engine] Could not update user emails_sent on single send:', uErr);
      }
    }

    res.json({
      success: result.success,
      result,
      recipient,
      subject: compiled.subject,
      previewUrl: result.previewUrl
    });
  } catch (err: any) {
    console.error('[Dispatch Engine] Single email dispatch failure:', err);
    res.status(500).json({ error: err.message || 'Delivery error' });
  }
});

// ============================================================================
// 3. SMTP & EMAIL PROVIDER SETTINGS CONTROLLER
// ============================================================================
router.get('/smtp-config', requireAuth, async (req: any, res: any) => {
  try {
    const userDoc = await db.collection('users').doc(req.user._id).get();
    const smtpSettings = userDoc.data()?.smtpSettings || {
      provider: 'test',
      fromName: req.user.name || 'LeadPulse Growth Director',
      fromEmail: req.user.email || 'outreach@leadpulse.io'
    };
    res.json(smtpSettings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch email settings' });
  }
});

router.post('/smtp-config', requireAuth, async (req: any, res: any) => {
  const { provider, host, port, user, pass, resendApiKey, fromName, fromEmail } = req.body;
  try {
    const settings = {
      provider: provider || 'gmail',
      host: host || '',
      port: port ? parseInt(port) : 587,
      user: user || '',
      pass: pass || '',
      resendApiKey: resendApiKey || '',
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
// 4. IN-APP DELIVERED INBOX FEED
// ============================================================================
router.get('/inbox', requireAuth, (req: any, res: any) => {
  res.json(inAppDeliveredInbox);
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

export default router;
