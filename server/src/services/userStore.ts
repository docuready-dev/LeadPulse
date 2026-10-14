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
  smtp_settings?: any;
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
  has_topup?: boolean;
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
    return this.users.get(id) || null;
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

  saveUser(user: Partial<UserRecord> & { _id: string; email: string }): UserRecord {
    const existing = this.users.get(user._id) || (user.email ? this.getUserByEmail(user.email) : null);
    const nowIso = new Date().toISOString();
    
    const record: UserRecord = {
      _id: user._id,
      email: (user.email || existing?.email || '').toLowerCase().trim(),
      password: user.password !== undefined ? user.password : existing?.password,
      googleId: user.googleId || existing?.googleId,
      name: user.name || existing?.name || 'LeadPulse User',
      role: user.role || existing?.role || (user.email === 'ashleyghose64@gmail.com' ? 'SUPER_ADMIN' : 'USER'),
      plan: user.plan || existing?.plan || 'free',
      lead_credits: user.lead_credits !== undefined ? user.lead_credits : (existing?.lead_credits ?? 15),
      pool_refreshed_at: user.pool_refreshed_at || existing?.pool_refreshed_at || nowIso,
      emails_limit: user.emails_limit !== undefined ? user.emails_limit : (existing?.emails_limit ?? 50),
      emails_sent: user.emails_sent !== undefined ? user.emails_sent : (existing?.emails_sent ?? 0),
      ai_pitches_limit: user.ai_pitches_limit !== undefined ? user.ai_pitches_limit : (existing?.ai_pitches_limit ?? 5),
      ai_pitches_used: user.ai_pitches_used !== undefined ? user.ai_pitches_used : (existing?.ai_pitches_used ?? 0),
      onboarding_complete: user.onboarding_complete !== undefined ? user.onboarding_complete : (existing?.onboarding_complete ?? true),
      company_name: user.company_name !== undefined ? user.company_name : existing?.company_name,
      field_of_work: user.field_of_work !== undefined ? user.field_of_work : existing?.field_of_work,
      phone: user.phone !== undefined ? user.phone : existing?.phone,
      niche: user.niche !== undefined ? user.niche : existing?.niche,
      target_audience: user.target_audience !== undefined ? user.target_audience : existing?.target_audience,
      goals: user.goals !== undefined ? user.goals : existing?.goals,
      profile_picture: user.profile_picture !== undefined ? user.profile_picture : existing?.profile_picture,
      smtp_settings: user.smtp_settings !== undefined ? user.smtp_settings : existing?.smtp_settings,
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
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: UserRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.users.set(id, updated);
    if (updated.email) {
      this.emailIndex.set(updated.email.toLowerCase().trim(), id);
    }
    this.saveToDisk();
    return updated;
  }

  getAllUsers(): UserRecord[] {
    return Array.from(this.users.values());
  }
}

export const userStore = new UserStore();
