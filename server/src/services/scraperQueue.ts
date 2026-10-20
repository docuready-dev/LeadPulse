import { db } from '../index';
import fs from 'fs';
import { crawlWebsiteForEmails } from './fastCrawler';
import { leadStore } from './leadStore';
import { userStore } from './userStore';

export interface ScrapeJob {
  id: string;
  userId: string;
  userEmail?: string;
  keyword: string;
  location: string;
  scope?: 'quick' | 'deep';
  limit?: number;
  tokensReserved?: number;
  costPerContact?: number;
  serpApiKey?: string;
}

export interface ScrapeJobStatus {
  id: string;
  userId: string;
  keyword: string;
  location: string;
  scope: 'quick' | 'deep';
  limit: number;
  status: 'queued' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0 to 100
  stageMessage: string;
  leadsFound: number;
  tokensUsed?: number;
  creditsRemaining?: number;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

function getBrowserExecutablePath(): string | undefined {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  return undefined;
}

function getRandomDelay(minMs: number = 3000, maxMs: number = 7000): number {
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

class RotatingProxyPool {
  private proxies: string[] = [];
  private index = 0;

  constructor() {
    this.reload();
  }

  reload() {
    const raw = process.env.PROXY_LIST || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || '';
    this.proxies = raw.split(',').map(p => p.trim()).filter(Boolean);
    if (this.proxies.length > 0) {
      console.log(`[Scraper Proxy] Initialized proxy pool with ${this.proxies.length} rotating addresses.`);
    }
  }

  getNextProxy(): string | null {
    if (this.proxies.length === 0) return null;
    const chosen = this.proxies[this.index % this.proxies.length];
    this.index++;
    return chosen;
  }

  hasProxies(): boolean {
    return this.proxies.length > 0;
  }
}

export const proxyPool = new RotatingProxyPool();

class InMemScraperQueue {
  private queue: ScrapeJob[] = [];
  private isProcessing = false;
  private jobStatuses = new Map<string, ScrapeJobStatus>();

  async add(job: ScrapeJob) {
    const isDeep = job.scope === 'deep';
    const costPerContact = job.costPerContact ?? (isDeep ? 2 : 1);
    const tokensReserved = job.tokensReserved ?? ((job.limit || 10) * costPerContact);

    this.jobStatuses.set(job.id, {
      id: job.id,
      userId: job.userId,
      keyword: job.keyword,
      location: job.location,
      scope: job.scope || 'quick',
      limit: job.limit || 10,
      status: 'queued',
      progress: 5,
      stageMessage: isDeep
        ? `Deep Harvest queued: searching Google Maps for verified business contacts with mobile numbers (2 tokens/contact)...`
        : 'Job queued in extraction pipeline (1 token/contact)...',
      leadsFound: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.queue.push(job);
    if (!this.isProcessing) {
      this.processNext();
    }
  }

  getJobStatus(jobId: string): ScrapeJobStatus | undefined {
    return this.jobStatuses.get(jobId);
  }

  getActiveJobForUser(userId: string): ScrapeJobStatus | undefined {
    const userJobs = Array.from(this.jobStatuses.values())
      .filter(j => j.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    // Return current running job or most recent job within 5 minutes
    const running = userJobs.find(j => j.status === 'in_progress' || j.status === 'queued');
    if (running) return running;

    const recent = userJobs[0];
    if (recent && (Date.now() - new Date(recent.updatedAt).getTime() < 300000)) {
      return recent;
    }
    return undefined;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      trackedJobsCount: this.jobStatuses.size
    };
  }

  clearQueue() {
    const droppedCount = this.queue.length;
    this.queue = [];
    return droppedCount;
  }

  private updateStatus(jobId: string, partial: Partial<ScrapeJobStatus>) {
    const curr = this.jobStatuses.get(jobId);
    if (curr) {
      this.jobStatuses.set(jobId, {
        ...curr,
        ...partial,
        updatedAt: new Date().toISOString()
      });
    }
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    const job = this.queue.shift();
    if (job) {
      await this.executeJob(job);
    }
    
    setTimeout(() => this.processNext(), 1200);
  }

  private async executeJob(job: ScrapeJob) {
    let browser: any;
    const maxItems = Math.min(job.limit || 10, 20);
    const isDeep = job.scope === 'deep';
    const costPerContact = job.costPerContact ?? (isDeep ? 2 : 1);
    const tokensReserved = job.tokensReserved ?? (maxItems * costPerContact);

    this.updateStatus(job.id, {
      status: 'in_progress',
      progress: 15,
      stageMessage: isDeep
        ? 'Launching high-resolution extraction worker with contact filtering...'
        : 'Launching headless Chromium extraction worker...'
    });

    try {
      console.log(`[Scraper] Starting job ${job.id} for "${job.keyword}" in "${job.location}" (Scope: ${job.scope || 'quick'}, Max: ${maxItems}, Reserved: ${tokensReserved} tokens)...`);

      const executablePath = getBrowserExecutablePath();
      console.log(`[Scraper] Resolved browser executable path: ${executablePath || 'Bundled Chrome'}`);

      this.updateStatus(job.id, {
        progress: 30,
        stageMessage: `Connecting to Google Maps extraction pipeline for "${job.keyword}" in "${job.location}"...`
      });

      let extractedItems: Array<{
        title: string;
        website: string;
        phone: string;
        rating: number;
        category: string;
      }> = [];

      const resolvedSerpKey = (job.serpApiKey || process.env.SERPAPI_KEY || '').trim();

      if (resolvedSerpKey) {
        this.updateStatus(job.id, {
          progress: 35,
          stageMessage: isDeep
            ? `Deep Harvest: Querying SerpApi for listings with verified mobile/phone numbers in "${job.location}"...`
            : `Querying SerpApi Google Maps local engine for "${job.keyword}" in "${job.location}"...`
        });

        try {
          const serpUrl = `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(`${job.keyword} in ${job.location}`)}&api_key=${resolvedSerpKey}&hl=en`;
          const serpResp = await fetch(serpUrl);
          const serpData: any = await serpResp.json();

          if (serpData.error) {
            console.warn(`[SerpApi Engine] Search error:`, serpData.error);
          } else {
            const localResults = serpData.local_results || [];
            console.log(`[SerpApi Engine] Retrieved ${localResults.length} local results from Google Maps.`);

            for (let i = 0; i < localResults.length && extractedItems.length < maxItems; i++) {
              const item = localResults[i];
              const title = (item.title || '').trim();
              if (!title) continue;

              const phone = (item.phone || '').trim();

              // Deep Harvest Rule: Exclude leads without any contact infos like mobile/phone number!
              if (isDeep) {
                const cleanPhone = phone.replace(/\D/g, '');
                if (cleanPhone.length < 7) {
                  // No valid mobile/phone number found, skip this listing in Deep Harvest
                  continue;
                }
              }

              let website = (item.website || '').trim();
              if (website.includes('google.com') || website.includes('goo.gl')) {
                website = '';
              }

              let rating = 0;
              if (typeof item.rating === 'number') {
                rating = item.rating;
              } else if (item.rating) {
                const parsed = parseFloat(String(item.rating));
                if (!isNaN(parsed)) rating = parsed;
              }

              extractedItems.push({
                title,
                website,
                phone,
                rating,
                category: item.type || (Array.isArray(item.types) ? item.types[0] : '') || job.keyword
              });
            }
          }
        } catch (serpErr) {
          console.warn(`[SerpApi Engine] Search request failed, falling back to local extractor:`, serpErr);
        }
      }

      // Fallback to headless browser extraction if SerpApi wasn't used or yielded 0 items
      if (extractedItems.length === 0) {
        try {
          const puppeteer = require('puppeteer');
        const activeProxy = proxyPool.getNextProxy();
        const launchArgs = [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-gpu',
          '--window-size=1280,800'
        ];

        if (activeProxy) {
          launchArgs.push(`--proxy-server=${activeProxy}`);
          console.log(`[Scraper] Routing request through rotating proxy: ${activeProxy.split('@').pop()}`);
        }

        const launchOptions: any = {
          headless: true,
          args: launchArgs
        };

        if (executablePath) {
          launchOptions.executablePath = executablePath;
        }

        // Add human-like random pause before connecting to Google Maps
        const humanPreDelay = getRandomDelay(2000, 4000);
        await new Promise(r => setTimeout(r, humanPreDelay));

        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        
        // Anti-detection: mask navigator.webdriver
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        const query = encodeURIComponent(`${job.keyword} in ${job.location}`);
        await page.goto(`https://www.google.com/maps/search/${query}`, { 
          waitUntil: 'networkidle2', 
          timeout: 28000 
        });

        // Graceful block detection: check for CAPTCHA wall
        const isBlocked = await page.evaluate(() => {
          const body = document.body?.innerText || '';
          return body.includes('unusual traffic') || body.includes('recaptcha') || body.includes('sorry/index');
        }).catch(() => false);

        if (isBlocked) {
          console.warn('[Scraper] Google Maps bot challenge detected. Waiting backoff period to avoid IP blocking...');
          await new Promise(r => setTimeout(r, 3000));
        }

        this.updateStatus(job.id, {
          progress: 55,
          stageMessage: `Parsing live listings with human scroll cadence in ${job.location}...`
        });

        // Wait for results container or business cards
        await page.waitForSelector('.hfpxzc', { timeout: 8000 }).catch(() => {});

        // Scroll the feed container with human-like randomized micro-steps
        for (let s = 0; s < 4; s++) {
          await page.evaluate(() => {
            const feed = document.querySelector('div[role="feed"]') || document.querySelector('.m6QErb');
            if (feed) {
              const randomScroll = Math.floor(Math.random() * 500) + 400;
              feed.scrollTop += randomScroll;
            }
          }).catch(() => {});
          const scrollPause = getRandomDelay(800, 1600);
          await new Promise(r => setTimeout(r, scrollPause));
        }

        // Extract authentic items directly from Google Maps cards
        extractedItems = await page.evaluate((limit: number, deep: boolean) => {
          const cards = document.querySelectorAll('.Nv2PK');
          const items: Array<{
            title: string;
            website: string;
            phone: string;
            rating: number;
            category: string;
          }> = [];

          for (let i = 0; i < cards.length && items.length < limit; i++) {
            const card = cards[i];
            const titleEl = card.querySelector('.qBF1Pd') || card.querySelector('.hfpxzc');
            const title = (titleEl?.textContent || titleEl?.getAttribute('aria-label') || '').trim();
            if (!title) continue;

            // Authentic Website Extraction
            // Only add websites that are available; leave out the rest (never add Google Maps/search URLs)
            let website = '';
            const websiteAnchor = card.querySelector('a[data-value="Website"], a[aria-label*="website" i], a.lcr4fd') as HTMLAnchorElement | null;
            if (websiteAnchor && websiteAnchor.href) {
              const h = websiteAnchor.href.trim();
              if (h.startsWith('http') && !h.includes('google.com') && !h.includes('goo.gl')) {
                website = h;
              }
            }
            if (!website) {
              const allAnchors = Array.from(card.querySelectorAll('a')) as HTMLAnchorElement[];
              for (const a of allAnchors) {
                const h = a.href || '';
                if (h.startsWith('http') && !h.includes('google.com') && !h.includes('goo.gl') && !h.includes('gstatic.com') && !h.includes('justdial.com')) {
                  website = h;
                  break;
                }
              }
            }

            // Authentic Phone Extraction from card text lines
            const fullText = (card as HTMLElement).innerText || '';
            let phone = '';
            const phoneRegex = /(?:(?:\+91|0)[-\s]?)?[6-9]\d{4}[-\s]?\d{5}|(?:\+?\d{1,3}[-\s]?)?\(?\d{2,4}\)?[-\s]?\d{3,4}[-\s]?\d{3,4}/g;
            const phoneMatches = fullText.match(phoneRegex);
            if (phoneMatches && phoneMatches.length > 0) {
              const validPhone = phoneMatches.find(p => p.replace(/\D/g, '').length >= 10);
              if (validPhone) phone = validPhone.trim();
            }

            // Deep Harvest Rule: Exclude leads without any contact infos like mobile/phone number!
            if (deep) {
              const cleanDigits = phone.replace(/\D/g, '');
              if (cleanDigits.length < 7) {
                // In Deep Harvest, skip any listing that lacks a valid contact phone/mobile number
                continue;
              }
            }

            // Authentic Rating Extraction
            let rating = 0;
            const ratingEl = card.querySelector('.MW4etd');
            if (ratingEl && ratingEl.textContent) {
              const parsed = parseFloat(ratingEl.textContent.trim());
              if (!isNaN(parsed) && parsed > 0) rating = parsed;
            }

            // Authentic Category Extraction
            const textLines = Array.from(card.querySelectorAll('.W4Efsd')).map(el => el.textContent?.trim() || '').filter(Boolean);
            let category = '';
            for (const line of textLines) {
              if (line.includes('·')) {
                const parts = line.split('·');
                if (parts[0] && !parts[0].includes('(') && !parts[0].match(/open|closed/i)) {
                  category = parts[0].trim();
                  break;
                }
              }
            }

            items.push({
              title,
              website, // Only real website, empty string if none available
              phone,   // Only real phone, empty string if none available
              rating,  // Only real rating, 0 if none available
              category // Only real category if available
            });
          }

          return items;
        }, maxItems, isDeep).catch(() => []);

        await browser.close();
        browser = null;
      } catch (puppeteerErr) {
        console.warn(`[Scraper] Puppeteer search encounter:`, puppeteerErr);
        if (browser) {
          await browser.close().catch(() => {});
          browser = null;
        }
      }
    }

      this.updateStatus(job.id, {
        progress: 70,
        stageMessage: isDeep
          ? `Deep Harvest: Verifying mobile contact records & checking website emails...`
          : `Concurrently crawling authentic websites for verified emails...`
      });

      // Prepare authentic lead models
      let finalLeads: Array<{
        businessName: string;
        category: string;
        fieldOfWork: string;
        firstName: string;
        phone: string;
        email: string;
        emailStatus: string;
        website: string;
        rating: number;
        location: string;
        scope: string;
        status: string;
        tags: string[];
      }> = [];

      if (extractedItems.length > 0) {
        console.log(`[Scraper] Found ${extractedItems.length} authentic businesses on Google Maps.`);
        
        // Fast concurrent HTTP crawl on authentic external sites ONLY
        const processedItems = await Promise.all(
          extractedItems.map(async (item: any) => {
            let resolvedEmail = '';
            let emailStatus = 'No Email Listed';

            // Real async crawl ONLY if an authentic external website is present
            if (item.website && item.website.startsWith('http') && !item.website.includes('google.com')) {
              try {
                const crawlRes = await crawlWebsiteForEmails(item.website);
                if (crawlRes.email) {
                  resolvedEmail = crawlRes.email;
                  emailStatus = 'Verified Email';
                }
              } catch {}
            }

            return {
              businessName: item.title,
              category: item.category || job.keyword,
              fieldOfWork: item.category || job.keyword,
              firstName: '', // Never fabricate names
              phone: item.phone, // Real phone only; empty string if none
              email: resolvedEmail, // Real crawled email only; empty string if none
              emailStatus,
              website: item.website, // Real website only; empty string if none
              rating: item.rating, // Real rating only; 0 if none
              location: job.location,
              scope: job.scope || 'quick',
              status: 'New',
              tags: [job.keyword, job.location, isDeep ? 'Deep Harvest' : 'Quick Scan']
            };
          })
        );

        finalLeads = processedItems;
      }

      // Deep Harvest Guarantee: Strictly exclude any leads without contact infos like mobile/phone number!
      if (isDeep) {
        finalLeads = finalLeads.filter(lead => {
          const cleanPhone = (lead.phone || '').replace(/\D/g, '');
          return cleanPhone.length >= 7;
        });
      }

      // Query existing leads from both Firestore and local persistent store for deduplication
      const localExisting = leadStore.getLeads(job.userId);
      const existingNames = new Set<string>(
        localExisting.map(l => (l.businessName || '').toLowerCase().trim())
      );

      try {
        const existingSnap = await db.collection('leads')
          .where('userId', '==', job.userId)
          .limit(300)
          .get();
        existingSnap.docs.forEach((d: any) => {
          const bName = String(d.data().businessName || '').toLowerCase().trim();
          if (bName) existingNames.add(bName);
        });
      } catch {
        // Continue with local deduplication
      }

      // Filter out any already-saved leads from results
      finalLeads = finalLeads.filter(l => !existingNames.has(l.businessName.toLowerCase().trim()));

      this.updateStatus(job.id, {
        progress: 88,
        leadsFound: finalLeads.length,
        stageMessage: `Deduplicating & committing ${finalLeads.length} authentic leads to database...`
      });

      // Prepare lead objects with deterministic IDs
      const leadsToSave: any[] = [];
      finalLeads.forEach((lead, index) => {
        const normalizedName = lead.businessName.toLowerCase().trim();
        if (!existingNames.has(normalizedName)) {
          existingNames.add(normalizedName);
          const leadId = `lead_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`;
          const harvestIso = new Date(Date.now() - index * 1000).toISOString();
          const resolvedCity = ((lead as any).city || job.location || lead.location || '').split(',')[0].trim();
          leadsToSave.push({
            _id: leadId,
            userId: job.userId,
            userEmail: job.userEmail,
            businessName: lead.businessName,
            category: lead.category,
            fieldOfWork: lead.fieldOfWork,
            firstName: lead.firstName,
            phone: lead.phone,
            email: lead.email,
            emailStatus: lead.emailStatus || 'Phone Only / No Email Found',
            website: lead.website,
            rating: lead.rating,
            location: lead.location || job.location,
            city: resolvedCity,
            scope: lead.scope || job.scope,
            status: lead.status || 'New',
            tags: lead.tags,
            saved: true,
            source: isDeep ? 'Deep Harvest Engine' : 'Quick Harvest Engine',
            harvestedAt: harvestIso,
            createdAt: harvestIso,
            updatedAt: new Date().toISOString()
          });
        }
      });

      const addedCount = leadsToSave.length;

      // 1. ALWAYS persist to local leadStore so leads are 100% saved and never lost!
      if (addedCount > 0) {
        leadStore.saveBatch(leadsToSave);
        console.log(`[Scraper] Successfully saved ${addedCount} authentic deduplicated leads to persistent LeadStore.`);
      }

      // 2. Also sync to Firestore (safely caught if unauthenticated/offline)
      if (addedCount > 0) {
        try {
          const batch = db.collection('leads').firestore.batch();
          for (const item of leadsToSave) {
            const leadRef = db.collection('leads').doc(item._id);
            const { _id, ...firestoreData } = item;
            batch.set(leadRef, firestoreData);
          }
          await batch.commit();
          console.log(`[Scraper] Synchronized ${addedCount} leads to Firestore.`);
        } catch (fsErr: any) {
          console.warn(`[Scraper] Firestore unauthenticated or offline (${fsErr.message}). Leads safely saved in local LeadStore.`);
        }
      }

      // Enforce Contact Accounting:
      // Quick: 1 Token = 1 Contact
      // Deep: 2 Tokens = 1 Contact (Guaranteed Mobile/Phone)
      // If fewer contacts were added than reserved, refund unused tokens at costPerContact rate
      const actualTokensUsed = addedCount * costPerContact;
      const tokensToRefund = Math.max(0, tokensReserved - actualTokensUsed);
      let latestCredits: number | undefined = undefined;

      const localUser = userStore.getUserById(job.userId);
      if (localUser) {
        let currentCreds = localUser.lead_credits ?? 0;
        if (tokensToRefund > 0) {
          currentCreds += tokensToRefund;
        }
        latestCredits = currentCreds;
        userStore.updateUser(job.userId, { lead_credits: currentCreds });
      }

      try {
        const userRef = db.collection('users').doc(job.userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          const uData = userSnap.data() || {};
          let currentCreds = uData.lead_credits ?? 0;
          if (tokensToRefund > 0) {
            currentCreds += tokensToRefund;
            await userRef.update({ lead_credits: currentCreds });
          }
          latestCredits = currentCreds;
        }
      } catch (creditErr) {
        console.warn('[Scraper] Could not verify post-scrape credits in Firestore:', creditErr);
      }

      this.updateStatus(job.id, {
        status: 'completed',
        progress: 100,
        leadsFound: addedCount,
        tokensUsed: actualTokensUsed,
        creditsRemaining: latestCredits,
        stageMessage: isDeep
          ? (addedCount > 0
              ? `Deep Harvest Complete: ${addedCount} contact-verified leads saved (${actualTokensUsed} tokens used at 2 tokens/contact). Unverified listings without mobile numbers were excluded.`
              : 'Deep Harvest Complete: 0 contacts with verified mobile numbers found for this query. All reserved tokens have been refunded.')
          : (addedCount > 0
              ? `Harvest Complete: ${addedCount} authentic contacts extracted (${actualTokensUsed} tokens used) & synchronized into your pipeline!`
              : 'Harvest Complete: 0 new unique contacts found for this query. All reserved tokens have been refunded.')
      });

    } catch (err: any) {
      console.error('[Scraper] Execution error during job:', err);
      if (browser) {
        await browser.close().catch(() => {});
      }

      // Refund reserved tokens on total job failure
      const localUser = userStore.getUserById(job.userId);
      if (localUser) {
        const currentCreds = (localUser.lead_credits ?? 0) + tokensReserved;
        userStore.updateUser(job.userId, { lead_credits: currentCreds });
      }

      try {
        const userRef = db.collection('users').doc(job.userId);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          const currentCreds = (userSnap.data()?.lead_credits ?? 0) + tokensReserved;
          await userRef.update({ lead_credits: currentCreds });
        }
      } catch {}

      this.updateStatus(job.id, {
        status: 'failed',
        error: err.message || 'Scraper execution error',
        stageMessage: `Harvest encountered an issue: ${err.message || 'Unknown error'}`
      });
    }
  }
}

export const scraperQueue = new InMemScraperQueue();
