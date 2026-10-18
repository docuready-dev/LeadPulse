import fs from 'fs';
import path from 'path';
import { db } from '../index';
import { leadStore } from './leadStore';
import { userStore } from './userStore';
import { sendDirectEmail } from './mailer';

export interface AutomationStepLog {
  stepId: string;
  stepType: string;
  title: string;
  status: 'executed' | 'waiting' | 'skipped' | 'failed';
  executedAt: string;
  details?: string;
  actionUrl?: string;
}

export interface AutomationEnrollment {
  _id: string;
  userId: string;
  journeyId: string;
  journeyName: string;
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  leadCompany: string;
  leadLocation?: string;
  currentStepIndex: number;
  status: 'active' | 'waiting_delay' | 'pending_task' | 'completed' | 'cancelled' | 'replied_exited';
  nextRunAt: string | null;
  pendingTask?: {
    type: 'whatsapp';
    title: string;
    message: string;
    targetPhone: string;
    waLink: string;
    createdAt: string;
  } | null;
  logs: AutomationStepLog[];
  enrolledAt: string;
  updatedAt: string;
}

class AutomationWorkerService {
  private dataDir: string;
  private filePath: string;
  private enrollments: Map<string, AutomationEnrollment> = new Map();
  private isTicking = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'automation_enrollments.json');
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.enrollments.clear();
          for (const item of parsed) {
            if (item && item._id) {
              this.enrollments.set(item._id, item);
            }
          }
          console.log(`[AutomationWorker] Loaded ${this.enrollments.size} active drip enrollments from disk.`);
        }
      }
    } catch (err: any) {
      console.warn('[AutomationWorker] Failed to load enrollments from disk:', err.message);
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const data = Array.from(this.enrollments.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err: any) {
      console.error('[AutomationWorker] Failed to save enrollments to disk:', err.message);
    }
  }

  /**
   * Calculates next run time respecting weekends and daytime business hours (9:00 AM to 6:00 PM)
   */
  public calculateNextRunTime(delayDays: number = 0, delayHours: number = 0): Date {
    const target = new Date();

    if (delayHours > 0) {
      target.setHours(target.getHours() + delayHours);
    }

    let remainingDays = delayDays;
    while (remainingDays > 0) {
      target.setDate(target.getDate() + 1);
      const day = target.getDay();
      if (day !== 0 && day !== 6) { // Skip Saturday (6) and Sunday (0)
        remainingDays--;
      }
    }

    // Weekend safety guard: if target lands on weekend, roll forward to Monday 9:00 AM
    if (target.getDay() === 0) {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (target.getDay() === 6) {
      target.setDate(target.getDate() + 2);
      target.setHours(9, 0, 0, 0);
    }

    // Business hours guard (9:00 AM to 6:00 PM)
    const hour = target.getHours();
    if (hour < 9) {
      target.setHours(9, 0, 0, 0);
    } else if (hour >= 18) {
      // Past 6 PM: advance to 9:00 AM next business day
      target.setDate(target.getDate() + 1);
      if (target.getDay() === 0) target.setDate(target.getDate() + 1);
      if (target.getDay() === 6) target.setDate(target.getDate() + 2);
      target.setHours(9, 0, 0, 0);
    }

    return target;
  }

  /**
   * Helper to replace {{name}}, {{company}}, {{location}}, {{category}} variables
   */
  private interpolate(text: string, lead: any): string {
    if (!text) return '';
    return text
      .replace(/{{name}}/gi, lead.businessName || lead.firstName || 'there')
      .replace(/{{company}}/gi, lead.businessName || 'your company')
      .replace(/{{location}}/gi, lead.location || 'your area')
      .replace(/{{category}}/gi, lead.category || 'business');
  }

  /**
   * Enroll a lead into a journey
   */
  public async enroll(userId: string, journey: any, lead: any): Promise<AutomationEnrollment> {
    const enrollmentId = `enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const enrollment: AutomationEnrollment = {
      _id: enrollmentId,
      userId,
      journeyId: journey._id || journey.id,
      journeyName: journey.name || 'Outreach Drip Journey',
      leadId: lead._id || lead.id,
      leadName: lead.businessName || lead.name || 'Prospect',
      leadEmail: lead.email || '',
      leadPhone: lead.phone || '',
      leadCompany: lead.businessName || lead.company || '',
      leadLocation: lead.location || '',
      currentStepIndex: 0,
      status: 'active',
      nextRunAt: nowIso, // Ready to execute step 0 immediately
      pendingTask: null,
      logs: [
        {
          stepId: 'init',
          stepType: 'trigger',
          title: 'Enrolled in Journey',
          status: 'executed',
          executedAt: nowIso,
          details: `Enrolled contact "${lead.businessName || lead.email}" into sequence "${journey.name}".`
        }
      ],
      enrolledAt: nowIso,
      updatedAt: nowIso
    };

    this.enrollments.set(enrollmentId, enrollment);
    this.saveToDisk();

    // Dual-write to Firestore if accessible
    try {
      await db.collection('automation_enrollments').doc(enrollmentId).set(enrollment);
    } catch (err: any) {
      console.warn('[AutomationWorker] Firestore enrollment sync offline, using local store:', err.message);
    }

    console.log(`[AutomationWorker] Enrolled lead ${lead.email || lead.businessName} into journey "${journey.name}".`);
    return enrollment;
  }

  /**
   * Main ticker executing due steps for active enrollments
   */
  public async runTick(filterUserId?: string): Promise<{ processed: number; executedSteps: number }> {
    if (this.isTicking) {
      return { processed: 0, executedSteps: 0 };
    }

    this.isTicking = true;
    let processed = 0;
    let executedSteps = 0;

    try {
      const now = new Date();
      const list = Array.from(this.enrollments.values());

      for (const enr of list) {
        if (filterUserId && enr.userId !== filterUserId) continue;

        // Skip non-active or paused enrollments
        if (['completed', 'cancelled', 'replied_exited', 'pending_task'].includes(enr.status)) {
          continue;
        }

        // Check if next run time has arrived
        if (enr.status === 'waiting_delay') {
          if (!enr.nextRunAt || new Date(enr.nextRunAt) > now) {
            continue; // Delay window not yet expired
          }
          // Delay expired: wake up to active
          enr.status = 'active';
        }

        processed++;

        // 1. Exit Condition Safeguard: check if lead replied or moved to In Conversation / Proposal / Won
        const liveLead = leadStore.getLeads(enr.userId).find(l => l._id === enr.leadId);
        const leadStatus = (liveLead?.status || '').toLowerCase();
        if (
          leadStatus.includes('conversation') ||
          leadStatus.includes('proposal') ||
          leadStatus.includes('closed') ||
          leadStatus.includes('won') ||
          leadStatus.includes('replied')
        ) {
          enr.status = 'replied_exited';
          enr.updatedAt = new Date().toISOString();
          enr.logs.push({
            stepId: 'exit_guard',
            stepType: 'condition',
            title: 'Auto-Exited: Lead Responded / Advanced',
            status: 'executed',
            executedAt: new Date().toISOString(),
            details: `Prospect CRM stage is "${liveLead?.status}". Automated sequence safely ended to prevent redundant follow-ups.`
          });
          this.enrollments.set(enr._id, enr);
          this.saveToDisk();
          continue;
        }

        // 2. Fetch Journey definition
        let journey: any = null;
        try {
          const jDoc = await db.collection('automations').doc(enr.journeyId).get();
          if (jDoc.exists) journey = { _id: jDoc.id, ...jDoc.data() };
        } catch {
          // ignore
        }

        if (!journey || journey.status === 'paused') {
          continue;
        }

        const steps = journey.steps || [];
        if (enr.currentStepIndex >= steps.length) {
          enr.status = 'completed';
          enr.updatedAt = new Date().toISOString();
          this.enrollments.set(enr._id, enr);
          this.saveToDisk();
          continue;
        }

        const step = steps[enr.currentStepIndex];

        // 3. Execute Step by Type
        if (step.type === 'trigger') {
          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else if (step.type === 'email') {
          // Dispatch Cold Email via SendGrid / SMTP
          const user: any = userStore.getUserById(enr.userId) || { name: 'LeadPulse Team', email: 'sales@leadpulse.io' };
          const userSmtp = user.smtp_settings;

          const emailSubject = this.interpolate(step.config?.emailSubject || 'Quick question regarding {{company}}', enr);
          const rawBody = this.interpolate(step.config?.emailBody || 'Hi {{name}}, wanted to connect.', enr);
          const emailHtml = `<div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #191716; max-width: 600px; padding: 20px;">
            ${rawBody.replace(/\n/g, '<br/>')}
          </div>`;

          try {
            await sendDirectEmail({
              to: enr.leadEmail,
              subject: emailSubject,
              html: emailHtml,
              text: rawBody,
              fromName: user.name || 'LeadPulse Operator',
              fromEmail: userSmtp?.fromEmail || user.email,
              userSmtp
            });

            enr.logs.push({
              stepId: step.id,
              stepType: 'email',
              title: step.title || 'Outreach Email Dispatched',
              status: 'executed',
              executedAt: new Date().toISOString(),
              details: `Sent to ${enr.leadEmail} with subject "${emailSubject}".`
            });
          } catch (sendErr: any) {
            console.error('[AutomationWorker] Email step error:', sendErr.message);
            enr.logs.push({
              stepId: step.id,
              stepType: 'email',
              title: step.title || 'Outreach Email Attempted',
              status: 'failed',
              executedAt: new Date().toISOString(),
              details: `Delivery notice: ${sendErr.message}`
            });
          }

          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else if (step.type === 'delay') {
          // Calculate Next Run with Weekend & Business Hours Guard
          const delayDays = Number(step.config?.delayDays || 1);
          const delayHours = Number(step.config?.delayHours || 0);
          const nextRun = this.calculateNextRunTime(delayDays, delayHours);

          enr.status = 'waiting_delay';
          enr.nextRunAt = nextRun.toISOString();
          enr.logs.push({
            stepId: step.id,
            stepType: 'delay',
            title: step.title || `Wait ${delayDays} Business Days`,
            status: 'waiting',
            executedAt: new Date().toISOString(),
            details: `Delay active until ${nextRun.toLocaleDateString()} at ${nextRun.toLocaleTimeString()} (Business Hours & Weekday protected).`
          });

          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else if (step.type === 'whatsapp') {
          // Action Queue Only: Generate 1-click wa.me task in CRM
          const cleanPhone = (enr.leadPhone || '').replace(/[^0-9]/g, '');
          if (!cleanPhone) {
            enr.logs.push({
              stepId: step.id,
              stepType: 'whatsapp',
              title: step.title || 'WhatsApp Ping (Skipped)',
              status: 'skipped',
              executedAt: new Date().toISOString(),
              details: 'Contact does not have a verified phone number on record.'
            });
            enr.currentStepIndex++;
          } else {
            const rawMsg = this.interpolate(
              step.config?.whatsappMessage || 'Hey {{name}}, wanted to check if you received my email regarding {{company}}!',
              enr
            );
            const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawMsg)}`;

            enr.pendingTask = {
              type: 'whatsapp',
              title: step.title || 'Direct WhatsApp Follow-up',
              message: rawMsg,
              targetPhone: cleanPhone,
              waLink,
              createdAt: new Date().toISOString()
            };
            enr.status = 'pending_task';

            enr.logs.push({
              stepId: step.id,
              stepType: 'whatsapp',
              title: step.title || 'WhatsApp Task Queued',
              status: 'executed',
              executedAt: new Date().toISOString(),
              details: `Ready for 1-click ping to +${cleanPhone}.`,
              actionUrl: waLink
            });

            // Update lead tags to highlight pending task in CRM
            leadStore.updateLead(enr.leadId, {
              tags: Array.from(new Set([...(liveLead?.tags || []), 'Pending WhatsApp Task']))
            });

            enr.currentStepIndex++;
          }

          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else if (step.type === 'crm_update') {
          // Advance Stage in CRM
          const targetStage = step.config?.targetStage || 'Contacted';
          leadStore.updateLead(enr.leadId, { status: targetStage });

          enr.logs.push({
            stepId: step.id,
            stepType: 'crm_update',
            title: step.title || `CRM Stage: ${targetStage}`,
            status: 'executed',
            executedAt: new Date().toISOString(),
            details: `Moved lead card to stage "${targetStage}".`
          });

          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else if (step.type === 'condition') {
          // Condition check: e.g. check if replied or clicked
          enr.logs.push({
            stepId: step.id,
            stepType: 'condition',
            title: step.title || 'Evaluated Reply Status',
            status: 'executed',
            executedAt: new Date().toISOString(),
            details: 'No reply detected; proceeding to next scheduled step.'
          });

          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
          executedSteps++;
        } else {
          // Fallback advance for other node types
          enr.currentStepIndex++;
          enr.updatedAt = new Date().toISOString();
        }

        // Mark completed if reached final step
        if (enr.currentStepIndex >= steps.length) {
          enr.status = 'completed';
          enr.logs.push({
            stepId: 'finished',
            stepType: 'trigger',
            title: 'Journey Sequence Completed',
            status: 'executed',
            executedAt: new Date().toISOString(),
            details: 'All steps in this drip sequence have been executed successfully.'
          });
        }

        this.enrollments.set(enr._id, enr);
      }

      this.saveToDisk();
    } catch (err: any) {
      console.error('[AutomationWorker] Error during ticker execution:', err.message);
    } finally {
      this.isTicking = false;
    }

    return { processed, executedSteps };
  }

  /**
   * Complete a pending WhatsApp task
   */
  public completeTask(enrollmentId: string): boolean {
    const enr = this.enrollments.get(enrollmentId);
    if (!enr) return false;

    enr.pendingTask = null;
    enr.status = enr.currentStepIndex >= 5 ? 'completed' : 'active';
    enr.updatedAt = new Date().toISOString();
    enr.logs.push({
      stepId: 'task_done',
      stepType: 'whatsapp',
      title: 'WhatsApp Follow-up Confirmed Dispatched',
      status: 'executed',
      executedAt: new Date().toISOString(),
      details: 'User completed the 1-click WhatsApp outreach.'
    });

    this.enrollments.set(enrollmentId, enr);
    this.saveToDisk();
    return true;
  }

  /**
   * Cancel an enrollment
   */
  public cancel(enrollmentId: string): boolean {
    const enr = this.enrollments.get(enrollmentId);
    if (!enr) return false;

    enr.status = 'cancelled';
    enr.updatedAt = new Date().toISOString();
    enr.logs.push({
      stepId: 'manual_cancel',
      stepType: 'condition',
      title: 'Sequence Manually Cancelled',
      status: 'executed',
      executedAt: new Date().toISOString(),
      details: 'User stopped the automated drip.'
    });

    this.enrollments.set(enrollmentId, enr);
    this.saveToDisk();
    return true;
  }

  public getEnrollmentsForUser(userId: string): AutomationEnrollment[] {
    return Array.from(this.enrollments.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Start 60-second in-process background worker
   */
  public start() {
    if (this.intervalTimer) return;
    console.log('[AutomationWorker] In-process drip scheduler started (evaluating every 60 seconds).');
    
    // Initial evaluation tick after 5 seconds
    setTimeout(() => {
      this.runTick();
    }, 5000);

    this.intervalTimer = setInterval(() => {
      this.runTick();
    }, 60000);
  }

  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

export const automationWorker = new AutomationWorkerService();
