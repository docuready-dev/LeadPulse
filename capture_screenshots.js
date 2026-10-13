const puppeteer = require('./server/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const OUTPUT_DIR = path.join(__dirname, 'screenshots');

const USER_SESSION = {
  state: {
    user: {
      _id: 'usr_ashley_leadpulse',
      name: 'Ashley Developer',
      email: 'ashley@leadpulse.io',
      role: 'Growth Lead',
      lead_credits: 350,
      onboarding_complete: true,
      company_name: 'LeadPulse Growth Inc',
      field_of_work: 'B2B Revenue Acceleration',
      plan: 'pro',
      daily_leads_limit: 250,
      daily_leads_used: 18,
      emails_limit: 5000,
      emails_sent: 84,
      ai_pitches_limit: -1,
      ai_pitches_used: 12
    },
    token: 'mock-jwt-leadpulse-token-operator',
    activeFilter: 'All'
  },
  version: 0
};

// Seed sample leads into localStorage if empty so CRM and tables are vibrant with data
const SEED_LEADS = [
  {
    _id: 'lead-sample-1',
    businessName: 'Apex Digital Systems',
    category: 'SaaS & Cloud Infrastructure',
    location: 'Bangalore, India',
    phone: '+91 98234 56789',
    email: 'contact@apexdigital.in',
    emailStatus: 'Verified Email',
    website: 'https://apexdigital.in',
    rating: 4.9,
    status: 'Demo',
    dealName: 'Apex Digital - Cloud Migration Growth',
    dealOwner: 'Ashley Developer',
    source: 'Google Maps Scraper',
    estimatedValue: 125000,
    probability: 60,
    priority: 'High',
    syncedTo: ['HubSpot'],
    activities: [
      {
        id: 'act-verified-1',
        type: 'Email',
        channel: 'email',
        title: 'Delivered: Cloud Infrastructure Modernization Deck',
        text: 'Dispatched via Brevo HTTPS REST API. Server Response: 200 OK (Message ID: <brevo-apex-981273@smtp-relay.brevo.com>)',
        date: new Date(Date.now() - 3600000 * 2).toISOString(),
        deliveredAt: new Date(Date.now() - 3600000 * 2).toISOString(),
        method: 'Brevo API',
        recipient: 'contact@apexdigital.in',
        subject: 'Cloud Infrastructure Modernization Deck',
        messageId: 'msg-brevo-20261014-apex98127',
        status: 'Delivered',
        author: 'Ashley Developer'
      }
    ]
  },
  {
    _id: 'lead-sample-2',
    businessName: 'Zenith Logistics Hub',
    category: 'Supply Chain & Freight',
    location: 'Mumbai, India',
    phone: '+91 98765 43210',
    email: 'ops@zenithlogistics.com',
    emailStatus: 'Verified Email',
    website: 'https://zenithlogistics.com',
    rating: 4.8,
    status: 'Proposal',
    dealName: 'Zenith Logistics - Fleet Automation Pipeline',
    dealOwner: 'Ashley Developer',
    source: 'Google Maps Scraper',
    estimatedValue: 95000,
    probability: 75,
    priority: 'High',
    syncedTo: ['Salesforce'],
    activities: [
      {
        id: 'act-verified-2',
        type: 'Email',
        channel: 'email',
        title: 'Delivered: Custom Proposal & ROI Breakdown',
        text: 'Dispatched via Google Cloud SMTP Gateway (TLS 587). Server Response: 250 2.0.0 OK queued as d73921b',
        date: new Date(Date.now() - 3600000 * 5).toISOString(),
        deliveredAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        method: 'Google SMTP',
        recipient: 'ops@zenithlogistics.com',
        subject: 'Custom Proposal & ROI Breakdown',
        messageId: 'msg-smtp-20261014-zenith-002',
        status: 'Delivered',
        author: 'Ashley Developer'
      }
    ]
  },
  {
    _id: 'lead-sample-3',
    businessName: 'Nova FinTech Advisory',
    category: 'Financial Services',
    location: 'Delhi, India',
    phone: '+91 91234 56780',
    email: 'partnerships@novafintech.co',
    emailStatus: 'Verified Email',
    website: 'https://novafintech.co',
    rating: 4.7,
    status: 'Qualified',
    dealName: 'Nova FinTech - Compliance Integration',
    dealOwner: 'Ashley Developer',
    source: 'Google Maps Scraper',
    estimatedValue: 70000,
    probability: 40,
    priority: 'Medium',
    syncedTo: ['Google Sheets'],
    activities: []
  },
  {
    _id: 'lead-sample-4',
    businessName: 'Vanguard Healthcare Tech',
    category: 'HealthTech & MedTech',
    location: 'Hyderabad, India',
    phone: '+91 98111 22334',
    email: 'hello@vanguardhealth.io',
    emailStatus: 'Verified Email',
    website: 'https://vanguardhealth.io',
    rating: 4.9,
    status: 'Closed',
    dealName: 'Vanguard Health - Annual Enterprise SLA',
    dealOwner: 'Ashley Developer',
    source: 'Google Maps Scraper',
    estimatedValue: 180000,
    probability: 100,
    priority: 'High',
    syncedTo: ['HubSpot'],
    activities: [
      {
        id: 'act-verified-4',
        type: 'Calendar Booking',
        channel: 'calendar',
        title: 'Delivered: Discovery Strategy Session Confirmed',
        text: 'Confirmed via Google Calendar API v3 with Google Meet link https://meet.google.com/abc-lead-pulse',
        date: new Date(Date.now() - 3600000 * 12).toISOString(),
        deliveredAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        method: 'Google Calendar API',
        recipient: 'hello@vanguardhealth.io',
        subject: 'Discovery Strategy Session Confirmed',
        messageId: 'gcal-vanguard-meeting-2026',
        status: 'Delivered',
        author: 'Google Calendar Sync'
      }
    ]
  },
  {
    _id: 'lead-sample-5',
    businessName: 'Starlight Retail Partners',
    category: 'Omnichannel eCommerce',
    location: 'Pune, India',
    phone: '+91 97654 32190',
    email: '',
    emailStatus: 'Phone Only / No Email Found',
    website: 'https://starlightretail.in',
    rating: 4.6,
    status: 'Lead',
    dealName: 'Starlight Retail - WhatsApp Outreach Hook',
    dealOwner: 'Ashley Developer',
    source: 'Google Maps Scraper',
    estimatedValue: 45000,
    probability: 20,
    priority: 'Low',
    syncedTo: [],
    activities: []
  }
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function capture() {
  console.log('[Screenshot Engine] Launching Chromium browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1.5 });

  ensureDir(OUTPUT_DIR);

  // Helper function to inject session & seed leads
  const setupSession = async () => {
    await page.evaluate((session, sampleLeads) => {
      localStorage.setItem('leadpulse-storage', JSON.stringify(session));
      // Seed fallback leads in sessionStorage/localStorage if needed
      try {
        localStorage.setItem('leadpulse-kanban-order-v1', JSON.stringify(['Lead', 'Qualified', 'Demo', 'Proposal', 'Closed']));
      } catch (e) {}
    }, USER_SESSION, SEED_LEADS);
  };

  // -------------------------------------------------------------
  // 1. LANDING PAGE
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Landing Page...');
  const landingDir = path.join(OUTPUT_DIR, '01-landing');
  ensureDir(landingDir);

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // Clear session on landing so it shows landing view
  await page.evaluate(() => {
    localStorage.removeItem('leadpulse-storage');
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(1500);

  await page.screenshot({ path: path.join(landingDir, '01-landing-full.png'), fullPage: true });

  // Hero Section
  const heroEl = await page.$('section, header, .hero-section');
  if (heroEl) {
    await heroEl.screenshot({ path: path.join(landingDir, '02-landing-hero.png') }).catch(() => {});
  }

  // Set session for all dashboard and platform views
  await setupSession();

  // -------------------------------------------------------------
  // 2. DASHBOARD
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Dashboard...');
  const dashDir = path.join(OUTPUT_DIR, '02-dashboard');
  ensureDir(dashDir);

  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(dashDir, '01-dashboard-full.png'), fullPage: true });

  // Dashboard top KPI Metric Cards
  const kpiEl = await page.$('.grid');
  if (kpiEl) {
    await kpiEl.screenshot({ path: path.join(dashDir, '02-dashboard-metrics-cards.png') }).catch(() => {});
  }

  // -------------------------------------------------------------
  // 3. LEAD FINDER
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Lead Finder...');
  const leadsDir = path.join(OUTPUT_DIR, '03-lead-finder');
  ensureDir(leadsDir);

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(leadsDir, '01-lead-finder-full.png'), fullPage: true });

  // Search input & configuration controls
  const searchPanel = await page.$('form, .bg-white.rounded-xl, .p-6.bg-white');
  if (searchPanel) {
    await searchPanel.screenshot({ path: path.join(leadsDir, '02-lead-finder-search-panel.png') }).catch(() => {});
  }

  // -------------------------------------------------------------
  // 4. CRM PIPELINE
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing CRM Pipeline & Interaction System...');
  const crmDir = path.join(OUTPUT_DIR, '04-crm-pipeline');
  ensureDir(crmDir);

  await page.goto(`${BASE_URL}/crm`, { waitUntil: 'networkidle2' });
  await sleep(2500);

  // Tab 1: Opportunities (Table View) with Interactions column
  await page.screenshot({ path: path.join(crmDir, '01-crm-opportunities-sheet.png'), fullPage: true });

  // Switch to Contacts tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const contactBtn = btns.find(b => b.textContent && b.textContent.includes('Contacts'));
    if (contactBtn) contactBtn.click();
  });
  await sleep(1000);
  await page.screenshot({ path: path.join(crmDir, '02-crm-contacts-sheet.png') });

  // Switch to Organizations tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const orgBtn = btns.find(b => b.textContent && b.textContent.includes('Organizations'));
    if (orgBtn) orgBtn.click();
  });
  await sleep(1000);
  await page.screenshot({ path: path.join(crmDir, '03-crm-organizations-sheet.png') });

  // Switch to Interactions tab (Verified Dispatches Audit Sheet)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const intBtn = btns.find(b => b.textContent && b.textContent.includes('Interactions'));
    if (intBtn) intBtn.click();
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(crmDir, '04-crm-interactions-sheet.png') });

  // Switch to Dashboard Sheet tab
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const dBtn = btns.find(b => b.textContent && b.textContent.includes('Dashboard'));
    if (dBtn) dBtn.click();
  });
  await sleep(1000);
  await page.screenshot({ path: path.join(crmDir, '05-crm-dashboard-sheet.png') });

  // Switch back to Opportunities
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const oppBtn = btns.find(b => b.textContent && b.textContent.includes('Opportunities'));
    if (oppBtn) oppBtn.click();
  });
  await sleep(1000);

  // Switch to Kanban Board View
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const kanbanBtn = btns.find(b => b.textContent && (b.textContent.includes('Kanban') || b.querySelector('svg.lucide-kanban')));
    if (kanbanBtn) kanbanBtn.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(crmDir, '06-crm-kanban-board.png'), fullPage: true });

  // Open Flowlu Enterprise Detail Modal by clicking a Kanban lead card or button
  const leadCard = await page.$('.group.cursor-pointer, [title="Open Flowlu CRM Workspace"]');
  if (leadCard) {
    await leadCard.click();
    await sleep(1500);
    await page.screenshot({ path: path.join(crmDir, '07-crm-flowlu-detail-modal.png') });
    // Close modal
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // Switch back to Table view to trigger Interaction Popout Card Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const tableBtn = btns.find(b => b.textContent && (b.textContent.includes('Table') || b.querySelector('svg.lucide-table-2')));
    if (tableBtn) tableBtn.click();
  });
  await sleep(1000);

  // Switch to Interactions Tab and click an interaction row to open Popout Card Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const intBtn = btns.find(b => b.textContent && b.textContent.includes('Interactions'));
    if (intBtn) intBtn.click();
  });
  await sleep(1000);

  // Click row or dispatch badge to pop out Verified Delivery Card
  const interactionRow = await page.$('tbody tr');
  if (interactionRow) {
    await interactionRow.click();
    await sleep(1200);
    await page.screenshot({ path: path.join(crmDir, '08-crm-interaction-popout-card.png') });
    // Close modal
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // -------------------------------------------------------------
  // 5. OUTREACH CENTER / STUDIO
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Outreach Studio...');
  const outDir = path.join(OUTPUT_DIR, '05-outreach-center');
  ensureDir(outDir);

  await page.goto(`${BASE_URL}/outreach`, { waitUntil: 'networkidle2' });
  await sleep(2200);

  // Email Outreach Studio Tab
  await page.screenshot({ path: path.join(outDir, '01-outreach-email-studio.png'), fullPage: true });

  // Switch to WhatsApp Outreach Studio Tab (with PDF & Image Layout)
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const waBtn = btns.find(b => b.textContent && b.textContent.includes('WhatsApp'));
    if (waBtn) waBtn.click();
  });
  await sleep(1500);
  await page.screenshot({ path: path.join(outDir, '02-outreach-whatsapp-studio.png'), fullPage: true });

  // -------------------------------------------------------------
  // 6. GOOGLE CALENDAR APPOINTMENTS
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Appointments (Google Calendar Hub)...');
  const apptDir = path.join(OUTPUT_DIR, '06-appointments');
  ensureDir(apptDir);

  await page.goto(`${BASE_URL}/appointments`, { waitUntil: 'networkidle2' });
  await sleep(2200);
  await page.screenshot({ path: path.join(apptDir, '01-appointments-hub-full.png'), fullPage: true });

  // Capture Live Google Calendar Booking Scheduler Widget
  const schedulerWidget = await page.$('.bg-white.rounded-xl.border, .space-y-6');
  if (schedulerWidget) {
    await schedulerWidget.screenshot({ path: path.join(apptDir, '02-google-calendar-scheduler-widget.png') }).catch(() => {});
  }

  // Open Google Calendar Settings Modal
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const setBtn = btns.find(b => b.textContent && b.textContent.includes('API Credentials') || b.textContent.includes('Settings'));
    if (setBtn) setBtn.click();
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(apptDir, '03-google-calendar-settings-modal.png') });
  await page.keyboard.press('Escape');
  await sleep(800);

  // -------------------------------------------------------------
  // 7. INTEGRATIONS HUB
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Integrations Hub...');
  const intDir = path.join(OUTPUT_DIR, '07-integrations');
  ensureDir(intDir);

  await page.goto(`${BASE_URL}/integrations`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(intDir, '01-integrations-hub-full.png'), fullPage: true });

  // Open Brevo or Slack Configuration Drawer
  const configBtn = await page.$('button[title*="Configure"], button.border.border-slate-200');
  if (configBtn) {
    await configBtn.click();
    await sleep(1200);
    await page.screenshot({ path: path.join(intDir, '02-integrations-config-modal.png') });
    await page.keyboard.press('Escape');
    await sleep(800);
  }

  // -------------------------------------------------------------
  // 8. ANALYTICS & CONVERSION FUNNEL
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Analytics...');
  const anaDir = path.join(OUTPUT_DIR, '08-analytics');
  ensureDir(anaDir);

  await page.goto(`${BASE_URL}/analytics`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(anaDir, '01-analytics-overview.png'), fullPage: true });

  // -------------------------------------------------------------
  // 9. AUTOMATIONS
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Automations...');
  const autoDir = path.join(OUTPUT_DIR, '09-automations');
  ensureDir(autoDir);

  await page.goto(`${BASE_URL}/automations`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(autoDir, '01-automations-workflows.png'), fullPage: true });

  // -------------------------------------------------------------
  // 10. TEAM MANAGEMENT
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Team Management...');
  const teamDir = path.join(OUTPUT_DIR, '10-team');
  ensureDir(teamDir);

  await page.goto(`${BASE_URL}/team`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(teamDir, '01-team-management.png'), fullPage: true });

  // -------------------------------------------------------------
  // 11. HELP CENTER
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Help Center...');
  const helpDir = path.join(OUTPUT_DIR, '11-help-center');
  ensureDir(helpDir);

  await page.goto(`${BASE_URL}/help`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(helpDir, '01-help-center-full.png'), fullPage: true });

  // -------------------------------------------------------------
  // 12. SETTINGS / PROFILE
  // -------------------------------------------------------------
  console.log('[Screenshot Engine] Capturing Settings & Profile...');
  const setDir = path.join(OUTPUT_DIR, '12-settings');
  ensureDir(setDir);

  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
  await sleep(2000);
  await page.screenshot({ path: path.join(setDir, '01-settings-profile.png'), fullPage: true });

  await browser.close();
  console.log('[Screenshot Engine] All screenshots captured successfully in /screenshots!');
}

capture().catch(err => {
  console.error('[Screenshot Engine] Error running screenshot capture:', err);
  process.exit(1);
});
