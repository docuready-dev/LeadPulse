import express from 'express';
import { db } from '../index';
import { automationWorker } from '../services/automationWorker';

const router = express.Router();

const DEFAULT_STARTER_JOURNEYS = [
  {
    name: 'New Lead Welcome & Qualification Sequence',
    trigger: 'Lead Created (Lead Finder or Inbound Form)',
    status: 'active',
    totalEnrolled: 42,
    conversions: 11,
    steps: [
      {
        id: 'step_1',
        type: 'trigger',
        title: 'Trigger: Contact Enters LeadPulse',
        description: 'New contact captured via Form or harvested in Lead Finder.',
        config: {}
      },
      {
        id: 'step_2',
        type: 'email',
        title: 'Step 1: Automated Personalized Icebreaker',
        description: 'Send dynamic hook referencing their business niche & location.',
        config: {
          emailSubject: 'Quick question regarding your growth at {{company}}',
          emailBody: 'Hi {{name}}, saw your team is expanding in {{location}}. Would love to share how LeadPulse automates your pipeline.'
        }
      },
      {
        id: 'step_3',
        type: 'delay',
        title: 'Wait 2 Business Days',
        description: 'Allow prospect natural window to review email.',
        config: { delayDays: 2 }
      },
      {
        id: 'step_4',
        type: 'condition',
        title: 'Check: Did prospect reply?',
        description: 'Branch based on outreach telemetry.',
        config: { conditionType: 'no_reply' }
      },
      {
        id: 'step_5',
        type: 'whatsapp',
        title: 'Step 2: WhatsApp Courtesy Ping',
        description: 'Direct follow-up if mobile phone number is verified.',
        config: {
          whatsappMessage: 'Hey {{name}}, sent an email earlier this week regarding {{company}} - wanted to ensure you received it!'
        }
      },
      {
        id: 'step_6',
        type: 'crm_update',
        title: 'Advance Stage: WhatsApp Contacted',
        description: 'Move prospect card to active engagement column in CRM.',
        config: { targetStage: 'WhatsApp Contacted' }
      }
    ]
  },
  {
    name: 'Post-Proposal Nurture & Decision Driver',
    trigger: 'CRM Stage updated to "Proposal Sent"',
    status: 'active',
    totalEnrolled: 18,
    conversions: 6,
    steps: [
      {
        id: 'step_1',
        type: 'trigger',
        title: 'Trigger: Stage = Proposal Sent',
        description: 'Fired the moment a proposal or quote is dispatched.',
        config: {}
      },
      {
        id: 'step_2',
        type: 'delay',
        title: 'Wait 3 Days',
        description: 'Give decision-maker review interval.',
        config: { delayDays: 3 }
      },
      {
        id: 'step_3',
        type: 'email',
        title: 'Case Study & ROI Proof',
        description: 'Deliver case study metrics proving payback timeline.',
        config: {
          emailSubject: 'ROI breakdown & client benchmark for {{company}}',
          emailBody: 'Hi {{name}}, here is how a similar business in {{category}} generated 40+ booked meetings within 3 weeks.'
        }
      }
    ]
  },
  {
    name: 'Cold Outreach Multi-Channel Blitz',
    trigger: 'Segment: Verified Emails & WhatsApp Ready',
    status: 'paused',
    totalEnrolled: 85,
    conversions: 14,
    steps: [
      {
        id: 'step_1',
        type: 'trigger',
        title: 'Trigger: High-Priority Lead Harvest',
        description: 'Enrolls all enriched contacts with verified phone & email.',
        config: {}
      },
      {
        id: 'step_2',
        type: 'email',
        title: 'Value Proposition Intro',
        description: 'Send targeted cold email highlighting immediate value.',
        config: {
          emailSubject: 'Ideas for {{company}} client acquisition',
          emailBody: 'Hi {{name}}, noticed your team does great work in {{location}}...'
        }
      }
    ]
  }
];

// GET /api/automations - Fetch all user workflows
router.get('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const automationsRef = db.collection('automations');
    const snapshot = await automationsRef.where('userId', '==', userId).get();

    if (snapshot.empty) {
      return res.json([]);
    }

    const list = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(list);
  } catch (err: any) {
    console.error('[Automations] Failed to fetch:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch automations' });
  }
});

// POST /api/automations - Create new journey
router.post('/', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, trigger, status = 'active', steps = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Journey Name is required' });

  try {
    const automationsRef = db.collection('automations');
    const newJourney = {
      userId,
      name,
      trigger: trigger || 'New Contact Added',
      status,
      totalEnrolled: 0,
      conversions: 0,
      steps: steps.length > 0 ? steps : [
        {
          id: 'step_init',
          type: 'trigger',
          title: `Trigger: ${trigger || 'New Contact Added'}`,
          description: 'Enrolls prospect when event fires.',
          config: {}
        },
        {
          id: 'step_email',
          type: 'email',
          title: 'Automated Outreach Email',
          description: 'Dispatches custom personalized AI template.',
          config: {
            emailSubject: 'Quick question for {{company}}',
            emailBody: 'Hi {{name}}, wanted to connect regarding your outreach...'
          }
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await automationsRef.add(newJourney);
    res.json({ _id: docRef.id, ...newJourney });
  } catch (err: any) {
    console.error('[Automations] Failed to create:', err);
    res.status(500).json({ error: err.message || 'Failed to create journey' });
  }
});

// PATCH /api/automations/:id - Update journey (toggle active/paused, update steps, rename)
router.patch('/:id', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  try {
    const docRef = db.collection('automations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Journey not found' });

    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    await docRef.update(updates);
    const updated = await docRef.get();
    res.json({ _id: updated.id, ...updated.data() });
  } catch (err: any) {
    console.error('[Automations] Failed to update:', err);
    res.status(500).json({ error: err.message || 'Failed to update journey' });
  }
});

// DELETE /api/automations/:id - Remove journey
router.delete('/:id', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  try {
    await db.collection('automations').doc(id).delete();
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('[Automations] Failed to delete:', err);
    res.status(500).json({ error: err.message || 'Failed to delete journey' });
  }
});

// POST /api/automations/:id/trigger - Test Run / Simulate journey on real leads
router.post('/:id/trigger', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { id } = req.params;

  try {
    const docRef = db.collection('automations').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: 'Journey not found' });

    // Increment enrolled count
    const data = doc.data()!;
    const newEnrolled = (data.totalEnrolled || 0) + 1;
    await docRef.update({
      totalEnrolled: newEnrolled,
      updatedAt: new Date().toISOString()
    });

    res.json({
      success: true,
      message: `Journey "${data.name}" triggered successfully! 1 new contact enrolled.`,
      totalEnrolled: newEnrolled
    });
  } catch (err: any) {
    console.error('[Automations] Failed to trigger:', err);
    res.status(500).json({ error: err.message || 'Failed to trigger journey' });
  }
});

// GET /api/automations/queue - List active enrollments and pending tasks for current user
router.get('/queue', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const enrollments = automationWorker.getEnrollmentsForUser(userId);
  const pendingTasks = enrollments.filter(e => e.status === 'pending_task');
  const waitingDelays = enrollments.filter(e => e.status === 'waiting_delay');
  const activeCount = enrollments.filter(e => e.status === 'active' || e.status === 'waiting_delay').length;

  res.json({
    enrollments,
    pendingTasks,
    waitingDelays,
    stats: {
      total: enrollments.length,
      active: activeCount,
      pendingTasks: pendingTasks.length,
      completed: enrollments.filter(e => e.status === 'completed').length,
      repliedExited: enrollments.filter(e => e.status === 'replied_exited').length
    }
  });
});

// POST /api/automations/worker/run-now - On-demand evaluation trigger
router.post('/worker/run-now', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await automationWorker.runTick(userId);
    const updated = automationWorker.getEnrollmentsForUser(userId);
    res.json({
      success: true,
      message: `Drip engine executed: evaluated ${result.processed} prospects, executed ${result.executedSteps} steps.`,
      result,
      enrollments: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Worker execution failed' });
  }
});

// POST /api/automations/queue/:id/cancel - Stop/Cancel active sequence
router.post('/queue/:id/cancel', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const ok = automationWorker.cancel(req.params.id);
  res.json({ success: ok });
});

// POST /api/automations/queue/:id/complete-task - Complete a pending WhatsApp task
router.post('/queue/:id/complete-task', async (req, res) => {
  const userId = req.headers.userid as string;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const ok = automationWorker.completeTask(req.params.id);
  res.json({ success: ok });
});

// Helper to trigger active automations when events fire (Inbound Form, Webhook, Lead Creation)
export async function triggerMatchingAutomations(userId: string, eventName: string, leadData: any) {
  try {
    const automationsRef = db.collection('automations');
    const snapshot = await automationsRef.where('userId', '==', userId).where('status', '==', 'active').get();
    if (snapshot.empty) return 0;

    let triggeredCount = 0;
    const lowerEvent = (eventName || '').toLowerCase();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const trig = (data.trigger || '').toLowerCase();
      
      const isMatch = 
        trig.includes('inbound') ||
        trig.includes('form') ||
        trig.includes('webhook') ||
        trig.includes('lead created') ||
        trig.includes('contact added') ||
        trig.includes(lowerEvent);

      if (isMatch) {
        const newEnrolled = (data.totalEnrolled || 0) + 1;
        await doc.ref.update({
          totalEnrolled: newEnrolled,
          updatedAt: new Date().toISOString()
        });

        // Actively enroll lead into the background drip scheduler
        await automationWorker.enroll(userId, { _id: doc.id, ...data }, leadData);
        triggeredCount++;
        console.log(`[Automations] Auto-enrolled lead (${leadData.email || leadData.businessName}) into journey "${data.name}"`);
      }
    }
    return triggeredCount;
  } catch (err: any) {
    console.warn('[Automations] Failed to trigger matching automations:', err.message);
    return 0;
  }
}

export default router;
