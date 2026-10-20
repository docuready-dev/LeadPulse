import fs from 'fs';
import path from 'path';

export interface UserRecord {
  _id: string;
  email: string;
  password?: string;
  googleId?: string;
  name: string;
  role: string;
  plan: string;
  lead_credits: number;
  pool_refreshed_at?: string;
  emails_limit: number;
  emails_sent: number;
  emails_sent_today?: number;
  daily_reset_date?: string;
  topup_credits?: number;
  base_daily_credits?: number;
  last_token_reset_date?: string;
  admin_credits_granted?: boolean;
  ai_pitches_limit: number;
  ai_pitches_used: number;
  onboarding_complete: boolean;
  company_name?: string;
  field_of_work?: string;
  phone?: string;
  niche?: string;
  target_audience?: string;
  goals?: string;
  profile_picture?: string;
  googleCalendarSettings?: any;
  smtp_settings?: any;
  smtpSettings?: any;
  outreach_defaults?: any;
  serpapi_key?: string;
  serpapi_connected?: boolean;
  serpapi_plan?: string;
  serpapi_plan_name?: string;
  serpapi_searches_left?: number;
  serpapi_searches_per_month?: number;
  serpapi_this_month_usage?: number;
  serpapi_updated_at?: string;
  reset_password_token?: string | null;
  reset_password_expires_at?: string | null;
  two_factor_enabled?: boolean;
  phone_verified?: boolean;
  has_topup?: boolean;
  integrations?: any;
  integrationLogs?: any;
  createdAt: string;
  updatedAt?: string;
}

class UserStore {
  private dataDir: string;
  private filePath: string;
  private users: Map<string, UserRecord> = new Map();
  private emailIndex: Map<string, string> = new Map();
  private isLoaded = false;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'users.json');
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
          this.users.clear();
          this.emailIndex.clear();
          for (const item of parsed) {
            if (item && item._id) {
              this.users.set(item._id, item);
              if (item.email) {
                this.emailIndex.set(item.email.toLowerCase().trim(), item._id);
              }
            }
          }
          console.log(`[UserStore] Loaded ${this.users.size} users from persistent local storage.`);
        }
      }
    } catch (err: any) {
      console.warn('[UserStore] Failed to load users from disk (starting fresh):', err.message);
    } finally {
      this.isLoaded = true;
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const allUsers = Array.from(this.users.values());
      fs.writeFileSync(this.filePath, JSON.stringify(allUsers, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[UserStore] Failed to write users to disk:', err.message);
    }
  }

  getUserById(id: string): UserRecord | null {
    if (!id) return null;
    // 1. Direct match by _id
    const user = this.users.get(id);
    if (user) return user;

    // 2. If id is an email, look up by email
    if (id.includes('@')) {
      const byEmail = this.getUserByEmail(id);
      if (byEmail) return byEmail;
    }

    // 3. Normalized alias check for Ashley Super Admin
    const clean = id.toLowerCase().trim();
    if (clean === 'user_ashleyghose64' || clean.includes('ashleyghose64')) {
      return this.getUserByEmail('ashleyghose64@gmail.com') || this.users.get('user_ashleyghose64') || null;
    }

    // 4. Normalized alias check for Bicon Ghose
    if (clean === 'user_ashleyghose28' || clean.includes('ashleyghose28')) {
      return this.getUserByEmail('ashleyghose28@gmail.com') || this.users.get('user_ashleyghose28') || null;
    }

    // 5. Fallback scan across all users for email or _id matching
    for (const u of this.users.values()) {
      if (u._id === id || (u.email && u.email.toLowerCase().trim() === clean)) {
        return u;
      }
    }

    return null;
  }

  getUserByEmail(email: string): UserRecord | null {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    const id = this.emailIndex.get(cleanEmail);
    if (id) {
      return this.users.get(id) || null;
    }
    // Fallback scan
    for (const u of this.users.values()) {
      if (u.email && u.email.toLowerCase().trim() === cleanEmail) {
        return u;
      }
    }
    return null;
  }

  getUserByPhone(phone: string): UserRecord | null {
    if (!phone) return null;
    const cleanInputDigits = phone.replace(/\D/g, '');
    if (!cleanInputDigits) return null;

    for (const u of this.users.values()) {
      if (u.phone) {
        const uDigits = u.phone.replace(/\D/g, '');
        if (uDigits === cleanInputDigits || (cleanInputDigits.length >= 10 && uDigits.endsWith(cleanInputDigits.slice(-10)))) {
          return u;
        }
      }
    }
    return null;
  }

  saveUser(user: Partial<UserRecord> & { _id: string; email: string }): UserRecord {
    const existing = this.users.get(user._id) || (user.email ? this.getUserByEmail(user.email) : null);
    const nowIso = new Date().toISOString();
    const cleanEmail = (user.email || existing?.email || '').toLowerCase().trim();
    const isSuperAdmin = cleanEmail === 'ashleyghose64@gmail.com' || user._id === 'user_ashleyghose64' || existing?._id === 'user_ashleyghose64';
    const isBiconEmail = cleanEmail === 'ashleyghose28@gmail.com' || user._id === 'user_ashleyghose28' || existing?._id === 'user_ashleyghose28';
    
    const record: UserRecord = {
      _id: isSuperAdmin ? 'user_ashleyghose64' : (isBiconEmail ? 'user_ashleyghose28' : user._id),
      email: cleanEmail,
      password: user.password !== undefined ? user.password : existing?.password,
      googleId: user.googleId || existing?.googleId,
      name: isSuperAdmin ? 'Ashley' : (user.name || (isBiconEmail ? 'Bicon Ghose' : existing?.name || 'Strovr User')),
      role: isSuperAdmin ? 'SUPER_ADMIN' : (user.role || existing?.role || 'USER'),
      plan: isSuperAdmin ? 'pro' : ((existing?.plan && existing.plan !== 'free' && (!user.plan || user.plan === 'free')) ? existing.plan : (user.plan || existing?.plan || 'free')),
      lead_credits: user.lead_credits !== undefined ? user.lead_credits : (existing?.lead_credits !== undefined ? existing.lead_credits : (isSuperAdmin ? 1500 : ((user.plan || existing?.plan) === 'basic' ? 600 : (user.plan || existing?.plan) === 'pro' ? 1500 : 15))),
      topup_credits: user.topup_credits !== undefined ? user.topup_credits : (existing?.topup_credits !== undefined ? existing.topup_credits : 0),
      base_daily_credits: user.base_daily_credits !== undefined ? user.base_daily_credits : (existing?.base_daily_credits !== undefined ? existing.base_daily_credits : (isSuperAdmin ? 1500 : ((user.plan || existing?.plan) === 'basic' ? 600 : (user.plan || existing?.plan) === 'pro' ? 1500 : 15))),
      last_token_reset_date: user.last_token_reset_date || existing?.last_token_reset_date || nowIso.split('T')[0],
      admin_credits_granted: user.admin_credits_granted !== undefined ? user.admin_credits_granted : (existing?.admin_credits_granted ?? false),
      pool_refreshed_at: user.pool_refreshed_at || existing?.pool_refreshed_at || nowIso,
      emails_limit: isSuperAdmin ? 5000 : ((user.plan === 'pro' || existing?.plan === 'pro') ? 5000 : ((user.plan === 'basic' || existing?.plan === 'basic') ? Math.max(1500, user.emails_limit ?? 0, existing?.emails_limit ?? 0) : (user.emails_limit ?? existing?.emails_limit ?? 50))),
      emails_sent: user.emails_sent !== undefined ? user.emails_sent : (existing?.emails_sent ?? 0),
      ai_pitches_limit: isSuperAdmin ? -1 : ((user.plan === 'pro' || existing?.plan === 'pro') ? -1 : ((user.plan === 'basic' || existing?.plan === 'basic') ? Math.max(250, user.ai_pitches_limit ?? 0, existing?.ai_pitches_limit ?? 0) : (user.ai_pitches_limit ?? existing?.ai_pitches_limit ?? 5))),
      ai_pitches_used: user.ai_pitches_used !== undefined ? user.ai_pitches_used : (existing?.ai_pitches_used ?? 0),
      two_factor_enabled: isSuperAdmin ? false : (user.two_factor_enabled !== undefined ? user.two_factor_enabled : (existing?.two_factor_enabled ?? false)),
      phone_verified: user.phone_verified !== undefined ? user.phone_verified : (existing?.phone_verified ?? true),
      onboarding_complete: user.onboarding_complete !== undefined ? user.onboarding_complete : (existing?.onboarding_complete ?? true),
      company_name: user.company_name !== undefined ? user.company_name : existing?.company_name,
      field_of_work: user.field_of_work !== undefined ? user.field_of_work : existing?.field_of_work,
      phone: user.phone !== undefined ? user.phone : existing?.phone,
      niche: user.niche !== undefined ? user.niche : existing?.niche,
      target_audience: user.target_audience !== undefined ? user.target_audience : existing?.target_audience,
      goals: user.goals !== undefined ? user.goals : existing?.goals,
      profile_picture: user.profile_picture !== undefined ? user.profile_picture : existing?.profile_picture,
      googleCalendarSettings: user.googleCalendarSettings !== undefined ? user.googleCalendarSettings : existing?.googleCalendarSettings,
      smtp_settings: user.smtp_settings !== undefined ? user.smtp_settings : existing?.smtp_settings,
      smtpSettings: user.smtpSettings !== undefined ? user.smtpSettings : existing?.smtpSettings,
      outreach_defaults: user.outreach_defaults !== undefined ? user.outreach_defaults : existing?.outreach_defaults,
      serpapi_key: user.serpapi_key !== undefined ? user.serpapi_key : existing?.serpapi_key,
      serpapi_connected: user.serpapi_connected !== undefined ? user.serpapi_connected : existing?.serpapi_connected,
      serpapi_plan: user.serpapi_plan !== undefined ? user.serpapi_plan : existing?.serpapi_plan,
      serpapi_plan_name: user.serpapi_plan_name !== undefined ? user.serpapi_plan_name : existing?.serpapi_plan_name,
      serpapi_searches_left: user.serpapi_searches_left !== undefined ? user.serpapi_searches_left : existing?.serpapi_searches_left,
      serpapi_searches_per_month: user.serpapi_searches_per_month !== undefined ? user.serpapi_searches_per_month : existing?.serpapi_searches_per_month,
      serpapi_this_month_usage: user.serpapi_this_month_usage !== undefined ? user.serpapi_this_month_usage : existing?.serpapi_this_month_usage,
      serpapi_updated_at: user.serpapi_updated_at !== undefined ? user.serpapi_updated_at : existing?.serpapi_updated_at,
      has_topup: user.has_topup !== undefined ? user.has_topup : existing?.has_topup,
      createdAt: user.createdAt || existing?.createdAt || nowIso,
      updatedAt: nowIso
    };

    this.users.set(record._id, record);
    if (record.email) {
      this.emailIndex.set(record.email.toLowerCase().trim(), record._id);
    }
    this.saveToDisk();
    return record;
  }

  updateUser(id: string, updates: Partial<UserRecord>): UserRecord | null {
    const existing = this.getUserById(id);
    if (!existing) return null;
    const targetId = existing._id;

    const isSuperAdmin = existing._id === 'user_ashleyghose64' || 
      (existing.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com') ||
      targetId === 'user_ashleyghose64';

    const updated: UserRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Strictly enforce immutable SUPER_ADMIN privilege for ashleyghose64@gmail.com
    if (isSuperAdmin) {
      updated.role = 'SUPER_ADMIN';
      updated.name = 'Ashley';
      updated.plan = 'pro';
      updated.two_factor_enabled = false;
      if (updated.lead_credits === undefined) {
        updated.lead_credits = 1000;
      }
      updated.emails_limit = 5000;
      updated.ai_pitches_limit = -1;
    }

    this.users.set(targetId, updated);
    if (targetId !== id) {
      this.users.delete(id);
    }
    if (updated.email) {
      this.emailIndex.set(updated.email.toLowerCase().trim(), targetId);
    }
    this.saveToDisk();
    return updated;
  }

  deleteUser(id: string): boolean {
    const existing = this.users.get(id);
    if (!existing) return false;
    if (existing._id === 'user_ashleyghose64' || (existing.email && existing.email.toLowerCase().trim() === 'ashleyghose64@gmail.com')) {
      console.warn('[UserStore] Blocked deletion attempt of Super Admin ashleyghose64@gmail.com');
      return false;
    }
    if (existing.email) {
      this.emailIndex.delete(existing.email.toLowerCase().trim());
    }
    const deleted = this.users.delete(id);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  getAllUsers(): UserRecord[] {
    return Array.from(this.users.values());
  }
}

export const userStore = new UserStore();
