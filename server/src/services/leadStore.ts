import fs from 'fs';
import path from 'path';

export interface LeadRecord {
  _id: string;
  userId: string;
  userEmail?: string;
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
  city?: string;
  scope?: string;
  status?: string;
  tags?: string[];
  saved?: boolean;
  source?: string;
  harvestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

class LeadStore {
  private dataDir: string;
  private filePath: string;
  private leads: Map<string, LeadRecord> = new Map();
  private isLoaded = false;

  constructor() {
    this.dataDir = process.env.STROVR_DATA_DIR || path.resolve(__dirname, '../../data');
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

      // Also generate categorized views and Excel-compatible CSVs for user visibility
      this.exportCategoryViews(allLeads);
    } catch (err: any) {
      console.warn('[LeadStore] Failed to write leads to disk:', err.message);
    }
  }

  private exportCategoryViews(allLeads: LeadRecord[]) {
    try {
      // 1. Saved Leads (saved !== false)
      const savedLeads = allLeads.filter(l => l.saved !== false);
      fs.writeFileSync(path.join(this.dataDir, 'saved_leads.json'), JSON.stringify(savedLeads, null, 2), 'utf8');

      // 2. Harvested Leads (from Scraper / Harvest Pipeline)
      const harvestedLeads = allLeads.filter(l => l.source && (l.source.includes('Harvest') || l.source.includes('Scraper') || l.source.includes('Google Places')));
      fs.writeFileSync(path.join(this.dataDir, 'harvested_leads.json'), JSON.stringify(harvestedLeads, null, 2), 'utf8');

      // 3. User-friendly CSV files (can be opened in Excel directly)
      this.writeCsvFile(path.join(this.dataDir, 'all_leads.csv'), allLeads);
      this.writeCsvFile(path.join(this.dataDir, 'saved_leads.csv'), savedLeads);
      this.writeCsvFile(path.join(this.dataDir, 'harvested_leads.csv'), harvestedLeads);
    } catch (err: any) {
      console.warn('[LeadStore] Category views export note:', err.message);
    }
  }

  private writeCsvFile(targetPath: string, leads: LeadRecord[]) {
    const headers = ['Business Name', 'Category', 'Phone', 'Email', 'Email Status', 'Website', 'Rating', 'Location', 'City', 'Status', 'Tags', 'Source', 'Harvested At'];
    const rows = leads.map(l => [
      `"${(l.businessName || '').replace(/"/g, '""')}"`,
      `"${(l.category || '').replace(/"/g, '""')}"`,
      `"${(l.phone || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.emailStatus || '').replace(/"/g, '""')}"`,
      `"${(l.website || '').replace(/"/g, '""')}"`,
      `"${l.rating || ''}"`,
      `"${(l.location || '').replace(/"/g, '""')}"`,
      `"${(l.city || '').replace(/"/g, '""')}"`,
      `"${(l.status || 'New').replace(/"/g, '""')}"`,
      `"${(Array.isArray(l.tags) ? l.tags.join('; ') : '').replace(/"/g, '""')}"`,
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${(l.harvestedAt || l.createdAt || '').replace(/"/g, '""')}"`
    ].join(','));
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    fs.writeFileSync(targetPath, csvContent, 'utf8');
  }

  getLeads(userId?: string, userEmail?: string): LeadRecord[] {
    const all = Array.from(this.leads.values());
    const cleanUserId = userId?.toLowerCase().trim();
    const cleanEmail = userEmail?.toLowerCase().trim();

    if (!cleanUserId && !cleanEmail) {
      return all.sort((a, b) => {
        const timeB = new Date(b.harvestedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.harvestedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }

    const filtered = all.filter(l => {
      const lUid = (l.userId || '').toLowerCase().trim();
      const lEmail = (l.userEmail || '').toLowerCase().trim();

      // Direct match on userId or userEmail
      if (cleanUserId && (lUid === cleanUserId || lEmail === cleanUserId)) return true;
      if (cleanEmail && (lEmail === cleanEmail || lUid === cleanEmail)) return true;

      // Ashley Super Admin cross-session aliases
      if (cleanUserId?.includes('ashleyghose64') || cleanEmail?.includes('ashleyghose64')) {
        if (lUid.includes('ashleyghose64') || lEmail.includes('ashleyghose64')) return true;
      }
      if (cleanUserId?.includes('ashleyghose28') || cleanEmail?.includes('ashleyghose28')) {
        if (lUid.includes('ashleyghose28') || lEmail.includes('ashleyghose28')) return true;
      }

      return false;
    });

    return filtered.sort((a, b) => {
      const timeB = new Date(b.harvestedAt || b.createdAt || 0).getTime();
      const timeA = new Date(a.harvestedAt || a.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }

  getLeadById(id: string): LeadRecord | null {
    return this.leads.get(id) || null;
  }

  addLead(lead: Partial<LeadRecord> & { userId: string; businessName: string }): LeadRecord {
    const id = lead._id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();
    const city = lead.city || (lead.location ? lead.location.split(',')[0].trim() : '');
    const harvestedAt = lead.harvestedAt || lead.createdAt || nowIso;

    const record: LeadRecord = {
      _id: id,
      userId: lead.userId,
      userEmail: lead.userEmail,
      businessName: lead.businessName,
      category: lead.category || 'General B2B',
      fieldOfWork: lead.fieldOfWork || lead.category || 'General B2B',
      firstName: lead.firstName || '',
      phone: lead.phone || '',
      email: lead.email || '',
      emailStatus: lead.emailStatus || (lead.email ? 'Verified Email' : 'Phone Only / No Email Found'),
      website: lead.website || '',
      rating: lead.rating || 0,
      location: lead.location || city || '',
      city: city,
      scope: lead.scope || 'quick',
      status: lead.status || 'New',
      tags: Array.isArray(lead.tags) ? lead.tags : [],
      saved: lead.saved ?? true,
      source: lead.source || 'Scraper Engine',
      harvestedAt: harvestedAt,
      createdAt: lead.createdAt || harvestedAt,
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
      const city = l.city || (l.location ? l.location.split(',')[0].trim() : '');
      const harvestedAt = l.harvestedAt || l.createdAt || new Date(Date.now() - i * 1000).toISOString();

      const record: LeadRecord = {
        _id: id,
        userId: l.userId,
        userEmail: l.userEmail,
        businessName: l.businessName,
        category: l.category || 'General B2B',
        fieldOfWork: l.fieldOfWork || l.category || 'General B2B',
        firstName: l.firstName || '',
        phone: l.phone || '',
        email: l.email || '',
        emailStatus: l.emailStatus || (l.email ? 'Verified Email' : 'Phone Only / No Email Found'),
        website: l.website || '',
        rating: l.rating || 0,
        location: l.location || city || '',
        city: city,
        scope: l.scope || 'quick',
        status: l.status || 'New',
        tags: Array.isArray(l.tags) ? l.tags : [],
        saved: l.saved ?? true,
        source: l.source || 'Harvest Pipeline',
        harvestedAt: harvestedAt,
        createdAt: l.createdAt || harvestedAt,
        updatedAt: nowIso
      };

      this.leads.set(id, record);
      saved.push(record);
    }

    this.saveToDisk();
    return saved;
  }

  upsertSyncVault(
    vaultLeads: Array<Partial<LeadRecord> & { businessName: string }>,
    defaultUserId?: string,
    defaultUserEmail?: string
  ): LeadRecord[] {
    const nowIso = new Date().toISOString();
    const cleanUserEmail = defaultUserEmail?.toLowerCase().trim();
    const cleanUserId = defaultUserId?.trim();

    // Map existing records for smart deduplication
    const existingById = new Map<string, LeadRecord>();
    const existingByKey = new Map<string, LeadRecord>();

    for (const item of this.leads.values()) {
      if (item._id) existingById.set(item._id, item);
      const nameKey = (item.businessName || '').toLowerCase().trim();
      if (nameKey && item.email) existingByKey.set(`${nameKey}__${item.email.toLowerCase().trim()}`, item);
      if (nameKey && item.phone) existingByKey.set(`${nameKey}__${item.phone.replace(/[^0-9]/g, '')}`, item);
    }

    for (const l of vaultLeads) {
      if (!l || !l.businessName) continue;
      const nameNorm = l.businessName.toLowerCase().trim();
      const emailNorm = (l.email || '').toLowerCase().trim();
      const phoneNorm = (l.phone || '').replace(/[^0-9]/g, '');

      let existing: LeadRecord | undefined;
      if (l._id && existingById.has(l._id)) {
        existing = existingById.get(l._id);
      } else if (emailNorm && existingByKey.has(`${nameNorm}__${emailNorm}`)) {
        existing = existingByKey.get(`${nameNorm}__${emailNorm}`);
      } else if (phoneNorm && existingByKey.has(`${nameNorm}__${phoneNorm}`)) {
        existing = existingByKey.get(`${nameNorm}__${phoneNorm}`);
      }

      const assignedUserId = l.userId || existing?.userId || cleanUserId || 'anonymous';
      const assignedUserEmail = l.userEmail || existing?.userEmail || cleanUserEmail || undefined;
      const assignedCity = l.city || existing?.city || (l.location ? l.location.split(',')[0].trim() : '');
      const assignedHarvestedAt = l.harvestedAt || existing?.harvestedAt || l.createdAt || existing?.createdAt || nowIso;

      if (existing) {
        existing.businessName = l.businessName || existing.businessName;
        if (l.email && !existing.email) existing.email = l.email;
        if (l.phone && !existing.phone) existing.phone = l.phone;
        if (l.website && !existing.website) existing.website = l.website;
        if (l.rating && !existing.rating) existing.rating = l.rating;
        if (l.category && (!existing.category || existing.category === 'General B2B')) existing.category = l.category;
        if (assignedCity && !existing.city) existing.city = assignedCity;
        if (l.location && !existing.location) existing.location = l.location;
        if (l.status) existing.status = l.status;
        if (Array.isArray(l.tags) && l.tags.length > 0) {
          existing.tags = Array.from(new Set([...(existing.tags || []), ...l.tags]));
        }
        if (assignedUserEmail && !existing.userEmail) existing.userEmail = assignedUserEmail;
        existing.updatedAt = nowIso;
        this.leads.set(existing._id, existing);
      } else {
        const id = l._id || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const record: LeadRecord = {
          _id: id,
          userId: assignedUserId,
          userEmail: assignedUserEmail,
          businessName: l.businessName,
          category: l.category || 'General B2B',
          fieldOfWork: l.fieldOfWork || l.category || 'General B2B',
          firstName: l.firstName || '',
          phone: l.phone || '',
          email: l.email || '',
          emailStatus: l.emailStatus || (l.email ? 'Verified Email' : 'Phone Only / No Email Found'),
          website: l.website || '',
          rating: l.rating || 0,
          location: l.location || assignedCity || '',
          city: assignedCity,
          scope: l.scope || 'quick',
          status: l.status || 'New',
          tags: Array.isArray(l.tags) ? l.tags : [],
          saved: l.saved ?? true,
          source: l.source || 'Vault Rehydration',
          harvestedAt: assignedHarvestedAt,
          createdAt: l.createdAt || assignedHarvestedAt,
          updatedAt: nowIso
        };
        this.leads.set(id, record);
        existingById.set(id, record);
        if (emailNorm) existingByKey.set(`${nameNorm}__${emailNorm}`, record);
        if (phoneNorm) existingByKey.set(`${nameNorm}__${phoneNorm}`, record);
      }
    }

    this.saveToDisk();
    return this.getLeads(cleanUserId, cleanUserEmail);
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

  deleteAll(userId: string, userEmail?: string): number {
    let count = 0;
    const cleanUserId = userId?.toLowerCase().trim();
    const cleanEmail = userEmail?.toLowerCase().trim();
    for (const [id, lead] of this.leads.entries()) {
      const lUid = (lead.userId || '').toLowerCase().trim();
      const lEmail = (lead.userEmail || '').toLowerCase().trim();
      if ((cleanUserId && (lUid === cleanUserId || lEmail === cleanUserId)) ||
          (cleanEmail && (lEmail === cleanEmail || lUid === cleanEmail))) {
        this.leads.delete(id);
        count++;
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }

  batchSaveStatus(ids: string[], saved: boolean, userId: string, userEmail?: string): number {
    let count = 0;
    const nowIso = new Date().toISOString();
    const cleanUserId = userId?.toLowerCase().trim();
    const cleanEmail = userEmail?.toLowerCase().trim();
    for (const id of ids) {
      const existing = this.leads.get(id);
      if (existing) {
        const lUid = (existing.userId || '').toLowerCase().trim();
        const lEmail = (existing.userEmail || '').toLowerCase().trim();
        if (!cleanUserId || lUid === cleanUserId || lEmail === cleanUserId ||
            (cleanEmail && (lEmail === cleanEmail || lUid === cleanEmail))) {
          existing.saved = saved;
          existing.updatedAt = nowIso;
          count++;
        }
      }
    }
    if (count > 0) {
      this.saveToDisk();
    }
    return count;
  }
}

export const leadStore = new LeadStore();
