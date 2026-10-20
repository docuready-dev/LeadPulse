import fs from 'fs';
import path from 'path';

export interface LeadRecord {
  _id: string;
  userId: string;
  businessName: string;
  category?: string;
  fieldOfWork?: string;
  firstName?: string;
  phone?: string;
  email?: string;
  emailStatus?: string;
  website?: string;
  rating?: number;
  location?: string;
  scope?: string;
  status?: string;
  tags?: string[];
  saved?: boolean;
  source?: string;
  createdAt: string;
  updatedAt: string;
}

class LeadStore {
  private dataDir: string;
  private filePath: string;
  private leads: Map<string, LeadRecord> = new Map();
  private isLoaded = false;

  constructor() {
    this.dataDir = path.resolve(__dirname, '../../data');
    this.filePath = path.join(this.dataDir, 'leads.json');
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
          this.leads.clear();
          for (const item of parsed) {
            if (item && item._id) {
              this.leads.set(item._id, item);
            }
          }
          console.log(`[LeadStore] Loaded ${this.leads.size} leads from persistent local storage.`);
        }
      }
    } catch (err: any) {
      console.warn('[LeadStore] Failed to load leads from disk (starting fresh):', err.message);
    } finally {
      this.isLoaded = true;
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      const allLeads = Array.from(this.leads.values());
      fs.writeFileSync(this.filePath, JSON.stringify(allLeads, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[LeadStore] Failed to write leads to disk:', err.message);
    }
  }

  getLeads(userId?: string, altUserId?: string): LeadRecord[] {
    const all = Array.from(this.leads.values());
    const filtered = userId 
      ? all.filter(l => l.userId === userId || (altUserId && l.userId === altUserId)) 
      : all;
    return filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  getLeadById(id: string): LeadRecord | null {
    return this.leads.get(id) || null;
  }

  addLead(lead: Partial<LeadRecord> & { userId: string; businessName: string }): LeadRecord {
    const id = lead._id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const record: LeadRecord = {
      _id: id,
      userId: lead.userId,
      businessName: lead.businessName,
      category: lead.category || 'General B2B',
      fieldOfWork: lead.fieldOfWork || lead.category || 'General B2B',
      firstName: lead.firstName || '',
      phone: lead.phone || '',
      email: lead.email || '',
      emailStatus: lead.emailStatus || (lead.email ? 'Verified Email' : 'Phone Only / No Email Found'),
      website: lead.website || '',
      rating: lead.rating || 0,
      location: lead.location || '',
      scope: lead.scope || 'quick',
      status: lead.status || 'New',
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      saved: lead.saved ?? true,
      source: lead.source || 'Scraper Engine',
      createdAt: lead.createdAt || nowIso,
      updatedAt: lead.updatedAt || nowIso
    };

    this.leads.set(id, record);
    this.saveToDisk();
    return record;
  }

  saveBatch(newLeads: Array<Partial<LeadRecord> & { userId: string; businessName: string }>): LeadRecord[] {
    const saved: LeadRecord[] = [];
    const nowIso = new Date().toISOString();

    for (let i = 0; i < newLeads.length; i++) {
      const l = newLeads[i];
      const id = l._id || `lead_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;
      const record: LeadRecord = {
        _id: id,
        userId: l.userId,
        businessName: l.businessName,
        category: l.category || 'General B2B',
        fieldOfWork: l.fieldOfWork || l.category || 'General B2B',
        firstName: l.firstName || '',
        phone: l.phone || '',
        email: l.email || '',
        emailStatus: l.emailStatus || (l.email ? 'Verified Email' : 'Phone Only / No Email Found'),
        website: l.website || '',
        rating: l.rating || 0,
        location: l.location || '',
        scope: l.scope || 'quick',
        status: l.status || 'New',
        tags: Array.isArray(l.tags) ? l.tags : [],
        saved: l.saved ?? true,
        source: l.source || 'Harvest Pipeline',
        createdAt: l.createdAt || new Date(Date.now() - i * 1000).toISOString(),
        updatedAt: nowIso
      };

      this.leads.set(id, record);
      saved.push(record);
    }

    this.saveToDisk();
    return saved;
  }

  updateLead(id: string, updates: Partial<LeadRecord>): LeadRecord | null {
    const existing = this.leads.get(id);
    if (!existing) return null;

    const updated: LeadRecord = {
      ...existing,
      ...updates,
      _id: id, // Immutable ID
      userId: existing.userId, // Immutable owner
      updatedAt: new Date().toISOString()
    };

    this.leads.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  deleteLead(id: string): boolean {
    const existed = this.leads.delete(id);
    if (existed) {
      this.saveToDisk();
    }
    return existed;
  }

  batchDelete(ids: string[]): number {
    let count = 0;
    for (const id of ids) {
      if (this.leads.delete(id)) {
        count++;
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }

  deleteAll(userId: string): number {
    let count = 0;
    for (const [id, lead] of this.leads.entries()) {
      if (lead.userId === userId) {
        this.leads.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }

  batchSaveStatus(ids: string[], saved: boolean, userId: string): number {
    let count = 0;
    const nowIso = new Date().toISOString();
    for (const id of ids) {
      const existing = this.leads.get(id);
      if (existing && existing.userId === userId) {
        existing.saved = saved;
        existing.updatedAt = nowIso;
        count++;
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }
}

export const leadStore = new LeadStore();
