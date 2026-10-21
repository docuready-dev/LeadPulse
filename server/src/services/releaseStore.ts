import fs from 'fs';
import path from 'path';

export interface ReleaseRecord {
  id: string;
  version: string;
  title: string;
  changelog: string[];
  fileName: string;
  filePath?: string;
  fileSize?: number;
  downloadUrl: string;
  portableZipUrl?: string;
  isLatest: boolean;
  isMandatory: boolean;
  publishedAt: string;
  publishedBy: string;
  downloadCount: number;
}

export function compareSemanticVersions(v1: string, v2: string): number {
  const p1 = (v1 || '0').replace(/^v/, '').split('.').map(Number);
  const p2 = (v2 || '0').replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

class ReleaseStore {
  private dataDir: string;
  private releasesDir: string;
  private manifestPath: string;
  private releases: ReleaseRecord[] = [];

  constructor() {
    this.dataDir = process.env.STROVR_DATA_DIR || path.resolve(__dirname, '../../data');
    this.releasesDir = path.join(this.dataDir, 'releases');
    this.manifestPath = path.join(this.releasesDir, 'releases.json');
    this.loadFromDisk();
  }

  public getReleasesDirectory(): string {
    return this.releasesDir;
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.releasesDir)) {
        fs.mkdirSync(this.releasesDir, { recursive: true });
      }

      if (fs.existsSync(this.manifestPath)) {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.releases = parsed;
          return;
        }
      }

      // Seed initial base release (v3.0.0) if no releases exist
      this.releases = [
        {
          id: 'rel_base_300',
          version: '3.0.0',
          title: 'Strovr Desktop 3.0.0 Production Base',
          changelog: [
            'Initial portable desktop operating engine',
            'Documents\\Strovr classic windows local database storage',
            'Integrated revenue discovery and leads CRM',
            'Full local network and cloud synchronization'
          ],
          fileName: 'Strovr.exe',
          downloadUrl: '/api/desktop/download-latest',
          portableZipUrl: '/downloads/Strovr-Desktop-Portable.zip',
          fileSize: 89456000,
          isLatest: true,
          isMandatory: false,
          publishedAt: '2026-10-20T10:00:00.000Z',
          publishedBy: 'ashleyghose64@gmail.com',
          downloadCount: 42
        }
      ];
      this.saveToDisk();
    } catch (err: any) {
      console.warn('[ReleaseStore] Error loading releases from disk:', err.message);
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(this.releasesDir)) {
        fs.mkdirSync(this.releasesDir, { recursive: true });
      }
      fs.writeFileSync(this.manifestPath, JSON.stringify(this.releases, null, 2), 'utf8');
    } catch (err: any) {
      console.error('[ReleaseStore] Failed to save releases manifest to disk:', err.message);
    }
  }

  public getAllReleases(): ReleaseRecord[] {
    return [...this.releases].sort((a, b) => {
      return compareSemanticVersions(b.version, a.version);
    });
  }

  public getLatestRelease(): ReleaseRecord {
    const latest = this.releases.find((r) => r.isLatest);
    if (latest) return latest;
    if (this.releases.length > 0) {
      return this.getAllReleases()[0];
    }
    return {
      id: 'rel_fallback',
      version: '3.0.0',
      title: 'Strovr Desktop 3.0.0',
      changelog: ['Current production build'],
      fileName: 'Strovr.exe',
      downloadUrl: '/api/desktop/download-latest',
      isLatest: true,
      isMandatory: false,
      publishedAt: new Date().toISOString(),
      publishedBy: 'system',
      downloadCount: 0
    };
  }

  public getReleaseByVersion(version: string): ReleaseRecord | undefined {
    const cleanVer = (version || '').replace(/^v/, '').trim();
    return this.releases.find((r) => r.version.replace(/^v/, '').trim() === cleanVer);
  }

  public createRelease(data: {
    version: string;
    title: string;
    changelog: string[];
    fileName?: string;
    filePath?: string;
    fileSize?: number;
    downloadUrl?: string;
    portableZipUrl?: string;
    isMandatory?: boolean;
    publishedBy?: string;
  }): ReleaseRecord {
    const cleanVer = data.version.replace(/^v/, '').trim();
    const id = `rel_${cleanVer.replace(/\./g, '_')}_${Date.now()}`;

    // Mark previous releases as not latest
    this.releases.forEach((r) => {
      r.isLatest = false;
    });

    const newRecord: ReleaseRecord = {
      id,
      version: cleanVer,
      title: data.title || `Strovr Desktop ${cleanVer}`,
      changelog: Array.isArray(data.changelog) ? data.changelog : [data.changelog || 'Performance improvements and bug fixes'],
      fileName: data.fileName || `Strovr-${cleanVer}.exe`,
      filePath: data.filePath,
      fileSize: data.fileSize || 0,
      downloadUrl: data.downloadUrl || `/api/desktop/download-latest`,
      portableZipUrl: data.portableZipUrl || `/downloads/Strovr-Desktop-Portable.zip`,
      isLatest: true,
      isMandatory: Boolean(data.isMandatory),
      publishedAt: new Date().toISOString(),
      publishedBy: data.publishedBy || 'SUPER_ADMIN',
      downloadCount: 0
    };

    // If existing release with this version existed, replace it
    const existingIndex = this.releases.findIndex((r) => r.version.replace(/^v/, '').trim() === cleanVer);
    if (existingIndex >= 0) {
      this.releases[existingIndex] = newRecord;
    } else {
      this.releases.unshift(newRecord);
    }

    this.saveToDisk();
    return newRecord;
  }

  public setActiveRelease(idOrVersion: string): ReleaseRecord | null {
    const clean = idOrVersion.replace(/^v/, '').trim();
    const target = this.releases.find((r) => r.id === idOrVersion || r.version.replace(/^v/, '').trim() === clean);
    if (!target) return null;

    this.releases.forEach((r) => {
      r.isLatest = r.id === target.id;
    });

    this.saveToDisk();
    return target;
  }

  public deleteRelease(idOrVersion: string): boolean {
    const initialLen = this.releases.length;
    this.releases = this.releases.filter((r) => r.id !== idOrVersion && r.version !== idOrVersion);
    if (this.releases.length < initialLen) {
      // Ensure at least one is latest if releases remain
      if (!this.releases.some((r) => r.isLatest) && this.releases.length > 0) {
        this.releases[0].isLatest = true;
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  public incrementDownloadCount(idOrVersion: string): void {
    const target = this.releases.find((r) => r.id === idOrVersion || r.version === idOrVersion || r.isLatest);
    if (target) {
      target.downloadCount = (target.downloadCount || 0) + 1;
      this.saveToDisk();
    }
  }
}

export const releaseStore = new ReleaseStore();
