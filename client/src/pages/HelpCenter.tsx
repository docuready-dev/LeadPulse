import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useStore } from '../store/useStore';
import {
  Search, BookOpen, Compass, Kanban, Send, GitMerge, Users,
  Puzzle, ShieldCheck, CreditCard, Terminal, CheckCircle2,
  Copy, Check, ArrowRight, Sparkles, HelpCircle, FileText,
  ChevronRight, ChevronDown, ThumbsUp, ThumbsDown, Printer,
  Share2, ExternalLink, Layers, Clock, Sliders, AlertCircle,
  PlayCircle, MessageSquare, LifeBuoy, Zap
} from 'lucide-react';

type GuideTab = 'admin-guide' | 'operator-guide' | 'integrations-guide' | 'faq-portal';

interface SubArticle {
  id: string;
  title: string;
  readingTime: string;
  lastUpdated: string;
  route: string;
  routeLabel: string;
  summary: string;
  keyTakeaways: string[];
  steps: {
    title: string;
    detail: string;
    tip?: string;
  }[];
  proTip: string;
  codeTitle?: string;
  codeBlock?: string;
  faqs?: { q: string; a: string }[];
}

interface TopicCategory {
  id: string;
  title: string;
  tab: GuideTab;
  icon: any;
  description: string;
  articles: SubArticle[];
}

const HELP_CATEGORIES: TopicCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    tab: 'admin-guide',
    icon: BookOpen,
    description: 'Workspace onboarding, architecture overview & first campaign checklist',
    articles: [
      {
        id: 'welcome-strovr',
        title: 'Welcome to Strovr by DocuReady',
        readingTime: '3 min read',
        lastUpdated: 'Updated Today',
        route: '/dashboard',
        routeLabel: 'Open Dashboard',
        summary:
          'Strovr (Derived from "Strove" - striving for growth) is an enterprise B2B spatial lead harvesting, multi-channel outreach (Email + WhatsApp), and customizable Kanban CRM platform engineered by DocuReady. Unlike bloated legacy CRMs that charge $150+/seat, Strovr unifies real-time local business discovery and direct outreach into one high-velocity workspace.',
        keyTakeaways: [
          'Unified workflow: Scrape B2B prospects -> Enrich Email/WhatsApp -> Manage in Resizable Kanban -> Automate follow-ups.',
          'Transparent contact accounting: 1 Token = 1 Scraped Contact across all tiers.',
          'Customizable workspace: Rearrange Dashboard widgets with 6 prebuilt layouts and resize Kanban stage boards with your mouse.'
        ],
        steps: [
          {
            title: 'Authenticate & Verify Workspace Profile',
            detail:
              'Sign in via Google OAuth or Workspace Credentials. Your operator profile, active plan tier (Free, Basic, or Pro), and live token pool are immediately synchronized via Firestore.',
            tip: 'Check the bottom-left sidebar card anytime to view your live token balance or trigger a 1-click plan upgrade / token top-up.'
          },
          {
            title: 'Choose Your Prebuilt Dashboard Layout',
            detail:
              'Navigate to the Dashboard and select from 6 prebuilt layouts (Executive Command, Time & Schedule Focus, Sales Velocity, Compact Bento Grid, Outbound SDR Cockpit, or Minimalist Focus), or click "Edit Layout" to drag and resize widgets.',
            tip: 'Use the built-in World Clock & 25-minute Outreach Sprint timer to structure high-conversion calling blocks.'
          },
          {
            title: 'Run Your First Spatial Harvest & Launch Outreach',
            detail:
              'Open Lead Finder, enter a niche (e.g., "Dental Clinics" or "Solar Installers") and target city, and click Harvest. Verified leads flow directly into your CRM Pipeline.',
            tip: 'Leads with phone-only coordinates automatically unlock the 1-Click WhatsApp Email Capture Bridge.'
          }
        ],
        proTip:
          'Bookmark the Help Center or press "/" anywhere on this page to instantly search across all setup guides, token rules, and webhook schemas.',
        codeTitle: 'Strovr End-to-End Pipeline Architecture',
        codeBlock: `[1. Lead Finder] ──(1 Token = 1 Contact)──> [2. Resizable Kanban CRM]
                                                    │
         ┌──────────────────────────────────────────┴──────────────────────────────────────────┐
         ▼                                                                                     ▼
[3A. Verified Email Found]                                                     [3B. Phone / WhatsApp Only]
Dispatch AI Cold Email Sequence                                                1-Click WhatsApp Capture Bridge
         │                                                                                     │
         └──────────────────────────────────────────┬──────────────────────────────────────────┘
                                                    ▼
                                    [4. Connected OAuth Integrations]
                            (HubSpot / Salesforce / Google Sheets / Slack Alerts)`
      },
      {
        id: 'quickstart-checklist',
        title: '15-Minute Operator Quickstart',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/finder',
        routeLabel: 'Start Harvesting',
        summary:
          'Follow this structured 15-minute deployment sequence to go from a fresh workspace to a live multi-channel B2B outreach campaign with automated CRM stage alerts.',
        keyTakeaways: [
          'Configure your sender identity in Settings before launching bulk email sequences.',
          'Connect Slack, Microsoft Teams, or Google Sheets in the Integrations hub for real-time deal telemetry.',
          'Use small targeted batches (10-15 contacts) to test message resonance before scaling.'
        ],
        steps: [
          {
            title: 'Step 1: Configure Sender Identity (Minutes 0-3)',
            detail:
              'Open Settings -> Outreach & SMTP to verify your sender display name, reply-to address, and default signature variables.'
          },
          {
            title: 'Step 2: Harvest Your First 10 Niche Leads (Minutes 3-8)',
            detail:
              'In Lead Finder, set your target business category, city, and desired batch size. Each returned business contact consumes 1 token from your pool.'
          },
          {
            title: 'Step 3: Organize Your Kanban Pipeline (Minutes 8-12)',
            detail:
              'Open CRM Pipeline. Drag stage headers to match your sales process, resize high-volume stage columns with your mouse, and inspect lead cards.'
          },
          {
            title: 'Step 4: Dispatch Multi-Channel Outreach (Minutes 12-15)',
            detail:
              'Launch Outreach Studio to send personalized cold emails or trigger WhatsApp Web deep-links with dynamic {{businessName}} and {{location}} merge tags.'
          }
        ],
        proTip:
          'You can check off each step above directly in this article reader-your progress is interactive!'
      }
    ]
  },
  {
    id: 'my-plan-tokens',
    title: 'My Plan & Token Pool',
    tab: 'admin-guide',
    icon: CreditCard,
    description: '1 Token = 1 Contact accounting, 15-token Free tier, upgrades & instant top-ups',
    articles: [
      {
        id: 'token-accounting-rules',
        title: 'How Token Pool Calculation Works (1 Token = 1 Contact)',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/settings',
        routeLabel: 'Manage Billing & Tokens',
        summary:
          'Strovr enforces a transparent, contact-based credit ledger: 1 Token = 1 Scraped Contact. You never lose tokens for empty searches, and your pool is strictly deducted by the exact number of business contacts harvested.',
        keyTakeaways: [
          'Strict 1:1 Accounting: If a search scrapes 10 contacts, exactly 10 tokens are deducted from your available pool.',
          'Free Tier Allocation: Includes 15 verified contact tokens (replenished every 4 days up to the 15-token cap).',
          'Basic ($15/mo) & Pro ($29/mo) Allocations: Provide 400 and 1,000 tokens per 4-day cycle respectively.',
          'Sidebar Upgrade / Top-Up: Click "Upgrade Plan" in the sidebar (or "Top-Up Tokens" when on the Pro tier) for instant quota expansion.'
        ],
        steps: [
          {
            title: 'Pre-Flight Token Check Before Scraping',
            detail:
              'When you initiate a harvest in Lead Finder, the server verifies your live Firestore token balance. If you have fewer tokens than the requested batch size, Strovr automatically caps the scrape to your remaining tokens so your job still succeeds.'
          },
          {
            title: 'Exact Per-Contact Deduction',
            detail:
              'Once the scraper extracts and deduplicates the business listings, it calculates `tokensUsed = finalResults.length` (1 token per contact) and atomically updates `lead_credits` in Firestore.'
          },
          {
            title: '4-Day Rolling Replenishment Engine',
            detail:
              'Every 96 hours (4 days), your workspace pool automatically refreshes to your tier allocation (15 on Free, 400 on Basic, 1,000 on Pro). Any purchased Top-Up tokens are preserved above baseline limits via the `has_topup` flag.'
          }
        ],
        proTip:
          'Already on the Pro tier and running a massive national campaign? The sidebar button automatically switches from "Upgrade Plan" to "Top-Up Tokens" so you can inject +50, +100, or +500 instant tokens without changing plans.',
        codeTitle: 'Server-Side Contact Token Ledger Formula',
        codeBlock: `// Strict 1 Token = 1 Scraped Contact Accounting
const PLAN_CREDITS = { free: 15, basic: 400, pro: 1000 };

const maxAllowedLeads = Math.min(Number(maxResults) || 15, availableCredits);
const finalResults = uniqueResults.slice(0, maxAllowedLeads);

// 1 Token = 1 Contact
const tokensUsed = finalResults.length;
const newCredits = Math.max(0, availableCredits - tokensUsed);`
      },
      {
        id: 'tier-comparison-topups',
        title: 'Comparing Free, Basic & Pro Tiers + Instant Top-Ups',
        readingTime: '3 min read',
        lastUpdated: 'Updated Today',
        route: '/dashboard',
        routeLabel: 'View Quota Meter',
        summary:
          'DocuReady engineered Strovr pricing to deliver 80% lower TCO than legacy data brokers while providing enterprise-grade spatial scraping, multi-seat governance, and OAuth integrations.',
        keyTakeaways: [
          'Free Tier (₹0): 15 Contact Tokens / 4 days, 2 Operator Seats, Core Lead Finder & Kanban CRM.',
          'Basic Tier (₹999/mo): 600 Bonus Tokens, 5 Team Seats, Email & WhatsApp Outreach Studio, CSV Export.',
          'Pro Tier (₹1,999/mo): 1,500 Bonus Tokens, 10 Team Seats, Full Workflow Automations, Developer API & Inbound Webhooks.',
          'On-Demand Token Packs: Add +250 (₹199) or +1,000 (₹499) tokens anytime via PhonePe.'
        ],
        steps: [
          {
            title: 'Upgrading from Free or Basic Tier',
            detail:
              'Click the "Upgrade Plan" / "Upgrade to Pro" button in the bottom-left sidebar or the Dashboard Token Pool widget to open the Razorpay checkout modal.'
          },
          {
            title: 'Topping Up Tokens on Any Tier',
            detail:
              'Switch to the "Instant Token Top-Up" tab inside the modal (or click "Top-Up Tokens" directly in the sidebar if you are on the Pro tier) to immediately add credits to your account.'
          }
        ],
        proTip:
          'All plan upgrades and token top-ups take effect immediately without restarting your browser session.'
      }
    ]
  },
  {
    id: 'dashboard-widgets',
    title: 'Custom Dashboard & Widgets',
    tab: 'admin-guide',
    icon: Layers,
    description: 'Live World Clock, Follow-Up Calendar, Edit Layout drag-and-drop & 6 prebuilt layouts',
    articles: [
      {
        id: 'interactive-widgets-guide',
        title: 'Using World Clock, Sprint Timer & Follow-Up Calendar Widgets',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/dashboard',
        routeLabel: 'Open Dashboard Widgets',
        summary:
          'Your Strovr Dashboard is a modular command center equipped with 8 interactive widgets designed for high-tempo B2B sales operators.',
        keyTakeaways: [
          'World Clock & Sprint Timer: Live analog/digital clock, B2B calling window statuses (IST, GMT, EST), and a 25-minute Pomodoro outreach sprint timer.',
          'Follow-Up & Campaign Calendar: Monthly interactive calendar where clicking any date lets you schedule time-stamped call reminders.',
          'Operator Scratchpad & Checklist: Auto-saving call notes and daily task checklist persisted in your browser.'
        ],
        steps: [
          {
            title: 'Check Global Calling Windows Before Dialing',
            detail:
              'Look at the World Clock widget to see live local times across India (IST), UK (GMT), and US East (EST). Green "OPEN" badges indicate active 9 AM - 6 PM business hours.'
          },
          {
            title: 'Run a 25-Minute Outreach Sprint',
            detail:
              'Click "Start" on the Outreach Sprint Timer inside the World Clock widget to begin a focused 25-minute outbound prospecting block.'
          },
          {
            title: 'Schedule Date-Specific Follow-Ups on the Calendar',
            detail:
              'Click any date in the Follow-Up Calendar widget, choose a time (e.g., 14:30), type your reminder (e.g., "Call Apex Dental Decision Maker"), and click Add. Dates with reminders display an indicator dot.'
          }
        ],
        proTip:
          'All calendar events, checklist tasks, and scratchpad call notes are automatically persisted in local storage so they remain intact across page reloads.'
      },
      {
        id: 'dashboard-edit-layouts',
        title: 'Rearranging the Dashboard & Using the 6 Prebuilt Layouts',
        readingTime: '3 min read',
        lastUpdated: 'Updated Today',
        route: '/dashboard',
        routeLabel: 'Customize Dashboard Layout',
        summary:
          'Every operator works differently. Strovr lets you switch between 6 curated prebuilt layouts in 1 click or enter "Edit Layout" mode to drag, reorder, resize, and hide/show any widget.',
        keyTakeaways: [
          '6 Prebuilt Layouts: Executive Command, Time & Schedule Focus, Sales Velocity & Funnel, Compact Bento Grid, Outbound SDR Cockpit, and Minimalist Focus.',
          'Drag-and-Drop Reordering: Click "Edit Layout" and drag any widget header to reposition it.',
          'Column Span Resizing: Set any widget width to 1/3 (4 cols), 1/2 (6 cols), 2/3 (8 cols), or Full Width (12 cols).'
        ],
        steps: [
          {
            title: 'Switch Prebuilt Layouts in 1 Click',
            detail:
              'Use the "Prebuilt Layouts" bar at the top of the Dashboard to instantly apply any of the 6 architectural presets.'
          },
          {
            title: 'Enter Edit Layout Mode to Drag & Resize',
            detail:
              'Click the "Edit Layout" button on the top-right of the Dashboard command bar. Drag widgets by their grip handle to reorder them, click 1/3, 1/2, 2/3, or Full to change their width, or toggle widget visibility pills.'
          },
          {
            title: 'Reset to Default Anytime',
            detail:
              'Click the Reset icon next to Edit Layout to restore the default Executive Command layout.'
          }
        ],
        proTip:
          'Try the "Outbound SDR Cockpit" layout during live calling hours-it places the Sprint Clock, Scratchpad, and Direct Actions side-by-side on the top row!'
      }
    ]
  },
  {
    id: 'lead-finder-scraping',
    title: 'Lead Finder & Spatial Scraping',
    tab: 'operator-guide',
    icon: Compass,
    description: 'Geo-targeted B2B scraping, deep website email crawling & deduplication',
    articles: [
      {
        id: 'spatial-harvesting-engine',
        title: 'Harvesting Verified B2B Leads by Niche & City',
        readingTime: '5 min read',
        lastUpdated: 'Updated Today',
        route: '/finder',
        routeLabel: 'Launch Lead Finder',
        summary:
          'The Lead Finder engine combines spatial directory discovery with an asynchronous website crawler that inspects `/contact`, `/about`, and homepage DOM nodes to extract verified business emails and direct phone/WhatsApp coordinates.',
        keyTakeaways: [
          'High-precision targeting by business niche + city/region.',
          'Automatic classification into "Verified Email" vs "Phone-Only / WhatsApp Ready".',
          'Zero duplicate billing: Duplicate phones/websites within a batch are filtered before token deduction.'
        ],
        steps: [
          {
            title: 'Enter Target Niche & Location Coordinates',
            detail:
              'Provide a specific industry keyword (e.g., "Orthodontist", "Commercial HVAC", "B2B Logistics") and a city/state.'
          },
          {
            title: 'Select Harvest Batch Size',
            detail:
              'Choose how many contacts to scrape. Remember that 1 Token = 1 Contact, so a 10-contact harvest uses 10 tokens.'
          },
          {
            title: 'Review & Sync to CRM Pipeline',
            detail:
              'Inspect ratings, websites, phone numbers, and email verification badges in the live results table, or open CRM Pipeline where all harvested leads are automatically saved.'
          }
        ],
        proTip:
          'Combine specific sub-niches with neighborhood or suburb names (e.g., "Cosmetic Dentist in Indiranagar Bengaluru") to uncover high-margin businesses with less inbox competition.'
      }
    ]
  },
  {
    id: 'kanban-crm-pipeline',
    title: 'Resizable Kanban CRM Pipeline',
    tab: 'operator-guide',
    icon: Kanban,
    description: 'Mouse-resizable Kanban boards, drag-to-reposition columns & WhatsApp email capture',
    articles: [
      {
        id: 'resizable-draggable-kanban',
        title: 'Resizing & Repositioning Kanban Stage Boards with Your Mouse',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/crm',
        routeLabel: 'Open Kanban Pipeline',
        summary:
          'Strovr features an interactive, developer-grade Kanban board where every stage column can be resized horizontally, vertically, or diagonally using your mouse, and reordered by dragging the column header.',
        keyTakeaways: [
          'Mouse-Resizable Width & Height: Drag the right edge, bottom edge, or bottom-right corner handle of any Kanban column to resize it between 210px-640px wide and 260px-920px tall.',
          'Live Dimension Readout: A live `W × H` pixel badge appears in the column header while resizing.',
          'Drag-to-Reposition Columns: Grab any stage header (`GripVertical`) and drag it left or right to reorder your pipeline stages.',
          'Persistent Layout + 1-Click Reset: Board dimensions and stage order save automatically to your browser, with a "Reset Boards" button in the toolbar.'
        ],
        steps: [
          {
            title: 'Resize Any Kanban Board Using Your Mouse',
            detail:
              'Hover over the right border, bottom border, or bottom-right diagonal corner of any Kanban stage column. Click and drag with your mouse to expand or compact that board to fit your lead volume.'
          },
          {
            title: 'Drag Column Headers to Reposition Stages',
            detail:
              'Click and drag the top header bar of any Kanban column (e.g., move "Email Verified & Captured" to the first position) and drop it onto another column to reorder the board.'
          },
          {
            title: 'Drag Lead Cards Between Stages',
            detail:
              'Drag individual prospect cards from one stage column to another. If you have Slack or Microsoft Teams connected, moving a deal automatically dispatches a live stage transition alert.'
          },
          {
            title: 'Reset Board Layout Anytime',
            detail:
              'Once you customize board sizes or column order, a "Reset Boards" button appears in the top toolbar to restore default dimensions in one click.'
          }
        ],
        proTip:
          'Make your active working stage (such as "WhatsApp Contacted" or "Proposal Sent") wider (e.g., 420px) while keeping archived stages compact (220px)!'
      },
      {
        id: 'whatsapp-email-capture-bridge',
        title: '1-Click WhatsApp Email Capture Bridge for Phone-Only Leads',
        readingTime: '3 min read',
        lastUpdated: 'Updated Today',
        route: '/crm',
        routeLabel: 'Open CRM Pipeline',
        summary:
          'Many local businesses list a mobile/WhatsApp number on Google Maps without publishing an email on their website. Strovr turns those phone-only records into verified email leads using a 1-click WhatsApp bridge script.',
        keyTakeaways: [
          'Automatically identifies "Phone Only / No Email Found" prospects.',
          'Launches WhatsApp with a pre-filled, high-conversion script requesting the decision maker’s best email for a custom proposal.',
          '1-click inline upgrade converts the record to "Email Verified & Captured" once they reply.'
        ],
        steps: [
          {
            title: 'Click a Phone-Only Lead Card in Kanban',
            detail:
              'Open any lead card badged with the amber "WA" indicator to view its detailed slide-over drawer.'
          },
          {
            title: 'Trigger the WhatsApp Capture Script',
            detail:
              'Click "Request Email via WhatsApp". Strovr opens WhatsApp with a tailored message addressed to the business.'
          },
          {
            title: 'Save the Captured Email Inline',
            detail:
              'Paste the prospect’s replied email into the inline capture box and click Save. The lead automatically advances to "Email Verified & Captured" and unlocks cold email sequences.'
          }
        ],
        proTip:
          'Prospects who reply with their email on WhatsApp have an 82%+ open rate on subsequent proposal emails.'
      }
    ]
  },
  {
    id: 'outreach-studio-automations',
    title: 'Outreach Studio & Automations',
    tab: 'operator-guide',
    icon: Send,
    description: 'AI email sequences, WhatsApp templates, Audience forms & trigger workflows',
    articles: [
      {
        id: 'multi-channel-outreach-studio',
        title: 'Launching Personalized Email & WhatsApp Campaigns',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/outreach',
        routeLabel: 'Open Outreach Studio',
        summary:
          'Outreach Studio lets you craft dynamic, variable-injected campaigns across Email and WhatsApp with live recipient previewing-always grounded in your real harvested CRM leads.',
        keyTakeaways: [
          'Dynamic merge variables: `{{businessName}}`, `{{category}}`, `{{location}}`, `{{rating}}`, and `{{website}}`.',
          'Live Recipient Preview: Preview exact rendered copy for each real prospect in your CRM before sending.',
          'Built-in library of proven B2B cold outreach and follow-up templates.'
        ],
        steps: [
          {
            title: 'Select Channel (Email or WhatsApp) & Template',
            detail:
              'Open Outreach Studio and pick a battle-tested B2B script or compose your own message with dynamic merge tags.'
          },
          {
            title: 'Filter Target Recipients from Your CRM',
            detail:
              'Filter by pipeline stage or niche cohort and preview how the message renders for each selected lead.'
          },
          {
            title: 'Dispatch Campaign & Track Status',
            detail:
              'Send your batch via your configured SMTP relay or step through 1-click WhatsApp dispatches with automatic CRM stage updates.'
          }
        ],
        proTip:
          'Always include the prospect’s exact city (`{{location}}`) and rating (`{{rating}}`) in the first sentence to prove your message is locally researched.'
      },
      {
        id: 'workflow-automations-audience',
        title: 'Workflow Automations & Audience Capture Forms',
        readingTime: '4 min read',
        lastUpdated: 'Updated Today',
        route: '/automations',
        routeLabel: 'Open Automations',
        summary:
          'Automate repetitive follow-ups and inbound lead ingestion using Trigger -> Condition -> Action workflows and embeddable Audience capture forms.',
        keyTakeaways: [
          'Trigger rules on new lead harvest, stage transition, or inbound form submission.',
          'Audience & Forms module provides hosted lead capture forms that feed directly into your CRM.'
        ],
        steps: [
          {
            title: 'Create or Toggle an Automation Rule',
            detail:
              'Navigate to Automations to enable prebuilt recipes (e.g., Auto-Bridge Phone-Only Leads or Closed-Won Slack Broadcast) or build a custom rule.'
          },
          {
            title: 'Configure Inbound Capture Forms in Audience',
            detail:
              'Open Audience & Forms to manage segmented contact lists and shareable lead capture forms.'
          }
        ],
        proTip:
          'Pair a Stage Transition automation with a Slack or Webhook integration so your entire revenue team celebrates every Closed Won deal in real time.'
      }
    ]
  },
  {
    id: 'integrations-webhooks',
    title: 'Integrations & OAuth Portals',
    tab: 'integrations-guide',
    icon: Puzzle,
    description: 'Vendor OAuth authorization, active integration filter & live webhook payloads',
    articles: [
      {
        id: 'oauth-vendor-authorization',
        title: 'Connecting Integrations via Vendor OAuth Portals & Active Filter',
        readingTime: '5 min read',
        lastUpdated: 'Updated Today',
        route: '/integrations',
        routeLabel: 'Open Integrations Hub',
        summary:
          'Strovr connects to HubSpot, Salesforce, Google Sheets, Slack, Microsoft Teams, Zapier, Make, Notion, Airtable, and Custom Webhooks through official vendor authorization portals and live HTTP webhook handshakes.',
        keyTakeaways: [
          'Vendor Authorization Flow: Clicking Connect opens the provider’s authorization portal window (e.g., HubSpot, Slack, Google OAuth) to complete workspace linking and scope verification.',
          'Active / Connected Filter Toggle: Use the top filter bar in Integrations to toggle between "All Integrations", "Connected / Active", and "Not Connected".',
          'Live HTTP Verification: Test any connected app to receive a verified `[200 OK]` round-trip telemetry receipt.'
        ],
        steps: [
          {
            title: 'Open Integrations & Filter by Active Status',
            detail:
              'Navigate to the Integrations page. Use the status toggle pills ("All", "Connected", "Available") at the top to immediately inspect your active integrations.'
          },
          {
            title: 'Authorize on the Provider Portal',
            detail:
              'Click "Connect" on any integration card, click "Authorize on [Vendor] Portal" to launch the vendor authorization window and grant workspace scopes, or paste your destination Webhook / API endpoint.'
          },
          {
            title: 'Mirror CRM Leads & Receive Stage Alerts',
            detail:
              'Once connected, click "Mirror to [CRM]" inside CRM Pipeline or Lead Finder to push leads, or move cards on the Kanban board to trigger instant Slack/Teams notifications.'
          }
        ],
        proTip:
          'Use the "Connected" filter toggle in the Integrations header anytime to audit which external systems currently have live sync access to your workspace.',
        codeTitle: 'Sample Outbound Webhook JSON Payload (POST)',
        codeBlock: `{
  "event": "strovr.crm.stage_changed",
  "timestamp": "2026-10-12T08:00:00.000Z",
  "workspace": "DocuReady Enterprise",
  "operator": "operator@strovr.space",
  "data": {
    "leadId": "lp_994821a",
    "businessName": "Apex Industrial Systems",
    "category": "B2B Manufacturing",
    "location": "Bengaluru, KA",
    "previousStage": "WhatsApp Contacted",
    "newStage": "Proposal Sent"
  }
}`
      }
    ]
  },
  {
    id: 'team-security-faq',
    title: 'Team, Security & FAQs',
    tab: 'faq-portal',
    icon: ShieldCheck,
    description: 'Seat limits, role permissions, data privacy & frequently asked questions',
    articles: [
      {
        id: 'team-seats-and-faqs',
        title: 'Team Seat Governance, Security & Frequently Asked Questions',
        readingTime: '5 min read',
        lastUpdated: 'Updated Today',
        route: '/team',
        routeLabel: 'Open Team & Seats',
        summary:
          'Manage multi-operator seats across Free (2 seats), Basic (5 seats), and Pro (10 seats) workspaces, and get answers to the most common questions about Strovr.',
        keyTakeaways: [
          'Role-based access control: Super Admin, Campaign Manager, and SDR Operator roles.',
          'Isolated tenant data in Firestore with encrypted credential storage.',
          'Instant answers to token deduction, Kanban customization, and OAuth linking below.'
        ],
        steps: [
          {
            title: 'Invite Team Operators Within Your Tier Cap',
            detail:
              'Open Team in the sidebar to view active seats and invite colleagues. If you reach your tier seat ceiling, upgrade your plan in 1 click.'
          },
          {
            title: 'Audit Workspace Settings & API Keys',
            detail:
              'Visit Settings to configure workspace branding, SMTP credentials, and security preferences.'
          }
        ],
        proTip:
          'Have a question not covered below? Use the "Talk to a Solutions Architect" card at the bottom of the right sidebar.',
        faqs: [
          {
            q: 'How are tokens calculated when I scrape leads in Lead Finder?',
            a: 'Quick Scan uses 1 Token = 1 Contact. Deep Harvest uses 2 Tokens = 1 Contact and strictly guarantees phone/mobile numbers (listings without contact numbers are excluded). If fewer contacts are returned, unused tokens are refunded to your pool. Empty searches deduct 0 tokens.'
          },
          {
            q: 'How many tokens are included in the Free tier?',
            a: 'The Free tier includes 15 contact tokens, replenished every 4 days up to the 15-token ceiling. You can upgrade to Basic (400 tokens), Pro (1,000 tokens), or purchase an instant Top-Up pack anytime.'
          },
          {
            q: 'How do I resize or reorder the Kanban boards in CRM Pipeline?',
            a: 'In CRM Pipeline (Kanban view), drag the right edge, bottom edge, or bottom-right corner of any stage column with your mouse to resize its width and height. Drag any column header by its grip icon to reposition the column order. Click "Reset Boards" in the toolbar to restore defaults.'
          },
          {
            q: 'How do I customize the Dashboard or use prebuilt layouts?',
            a: 'On the Dashboard top bar, click any of the 6 Prebuilt Layouts (Executive Command, Time & Schedule Focus, Sales Velocity, Compact Bento Grid, Outbound SDR Cockpit, Minimalist Focus), or click "Edit Layout" to drag-and-drop widgets, change column widths (1/3, 1/2, 2/3, Full), or hide/show widgets.'
          },
          {
            q: 'Where is the Upgrade or Top-Up button located?',
            a: 'In the bottom-left Sidebar card! When you are on the Free or Basic tier, it displays "Upgrade Plan" / "Upgrade to Pro" (plus a quick Top-Up icon). When you are on the topmost Pro tier, the primary button automatically becomes "Top-Up Tokens".'
          },
          {
            q: 'How do I see only my active/connected integrations?',
            a: 'Go to the Integrations page and click the "Connected" filter toggle pill at the top of the catalog to display only active, linked integrations.'
          }
        ]
      }
    ]
  }
];

const HelpCenter = () => {
  const navigate = useNavigate();
  const { user, setTopUpOpen, setUpgradeTab } = useStore();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<GuideTab>('admin-guide');
  const [searchQuery, setSearchQuery] = useState('');
  const [treeFilter, setTreeFilter] = useState('');
  const [expandedCatIds, setExpandedCatIds] = useState<string[]>(
    HELP_CATEGORIES.map(c => c.id)
  );
  const [activeArticleId, setActiveArticleId] = useState<string>('welcome-strovr');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [helpfulVote, setHelpfulVote] = useState<'yes' | 'no' | null>(null);
  const [resourcesOpen, setResourcesOpen] = useState(false);

  // Interactive Token Simulator State (shown on Token Pool article)
  const [simContacts, setSimContacts] = useState<number>(10);

  // Keyboard "/" shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Flatten all articles for easy lookup & prev/next navigation
  const allArticles = useMemo(() => {
    const list: { category: TopicCategory; article: SubArticle }[] = [];
    HELP_CATEGORIES.forEach(cat => {
      cat.articles.forEach(art => {
        list.push({ category: cat, article: art });
      });
    });
    return list;
  }, []);

  // Filtered categories for left tree
  const filteredCategories = useMemo(() => {
    const q = (searchQuery || treeFilter).trim().toLowerCase();
    if (!q) return HELP_CATEGORIES;
    return HELP_CATEGORIES.map(cat => {
      const matchingArticles = cat.articles.filter(
        a =>
          a.title.toLowerCase().includes(q) ||
          a.summary.toLowerCase().includes(q) ||
          a.steps.some(s => s.title.toLowerCase().includes(q) || s.detail.toLowerCase().includes(q)) ||
          (a.faqs && a.faqs.some(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)))
      );
      if (cat.title.toLowerCase().includes(q)) {
        return cat;
      }
      return { ...cat, articles: matchingArticles };
    }).filter(cat => cat.articles.length > 0);
  }, [searchQuery, treeFilter]);

  const currentEntry = useMemo(() => {
    return (
      allArticles.find(item => item.article.id === activeArticleId) ||
      allArticles[0]
    );
  }, [allArticles, activeArticleId]);

  const currentIndex = useMemo(() => {
    return allArticles.findIndex(item => item.article.id === currentEntry.article.id);
  }, [allArticles, currentEntry]);

  const prevEntry = currentIndex > 0 ? allArticles[currentIndex - 1] : null;
  const nextEntry = currentIndex < allArticles.length - 1 ? allArticles[currentIndex + 1] : null;

  const handleSelectArticle = (cat: TopicCategory, art: SubArticle) => {
    setActiveArticleId(art.id);
    setActiveTab(cat.tab);
    setHelpfulVote(null);
    if (!expandedCatIds.includes(cat.id)) {
      setExpandedCatIds(prev => [...prev, cat.id]);
    }
  };

  const handleSelectTab = (tab: GuideTab) => {
    setActiveTab(tab);
    const firstCatInTab = HELP_CATEGORIES.find(c => c.tab === tab);
    if (firstCatInTab && firstCatInTab.articles.length > 0) {
      setActiveArticleId(firstCatInTab.articles[0].id);
      if (!expandedCatIds.includes(firstCatInTab.id)) {
        setExpandedCatIds(prev => [...prev, firstCatInTab.id]);
      }
    }
  };

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCatIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPermalink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/help#${currentEntry.article.id}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const { category: activeCat, article: activeArt } = currentEntry;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FAF8F5]">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />

        {/* ZOHO COMMERCE STYLE TOP DOCUMENTATION SUB-NAVBAR */}
        <div className="bg-white border-b border-[#E5E0D5] px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
          {/* Left: Portal Identity + Mode Tabs */}
          <div className="flex items-center gap-6 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-[#E5E0D5]">
              <div className="w-6 h-6 rounded bg-[#191716] text-white flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-[#C85A32]" />
              </div>
              <div>
                <div className="text-xs font-bold font-delight text-[#191716] leading-none">
                  Help Center
                </div>
                <div className="text-[9px] font-mono text-[#6E675F] mt-0.5">
                  DocuReady Docs v3.4
                </div>
              </div>
            </div>

            {/* Zoho-Style Mode Tabs */}
            <nav className="flex items-center gap-1 shrink-0">
              {([
                { id: 'admin-guide' as GuideTab, label: 'Admin & Setup Guide' },
                { id: 'operator-guide' as GuideTab, label: 'Operator & Outreach Guide' },
                { id: 'integrations-guide' as GuideTab, label: 'Integrations & Webhooks' },
                { id: 'faq-portal' as GuideTab, label: 'FAQs & Troubleshooting' }
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => handleSelectTab(t.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-delight font-semibold transition-all cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-[#191716] text-white'
                      : 'text-[#57514B] hover:bg-[#F5F2EB] hover:text-[#191716]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right: Global Doc Search + Resources Dropdown */}
          <div className="flex items-center gap-2.5">
            <div className="relative w-64 sm:w-72">
              <Search className="w-3.5 h-3.5 text-[#9C9488] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search user guide, tokens, kanban..."
                className="w-full pl-8 pr-8 py-1.5 bg-[#FAF8F5] border border-[#E5E0D5] rounded-md text-xs font-delight text-[#191716] placeholder:text-[#9C9488] focus:outline-none focus:bg-white focus:border-[#C85A32]"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#6E675F] hover:text-[#191716] cursor-pointer"
                >
                  ESC
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.2 bg-white border border-[#E5E0D5] rounded text-[#9C9488]">
                  /
                </kbd>
              )}
            </div>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => setResourcesOpen(!resourcesOpen)}
                className="px-3 py-1.5 rounded-md bg-[#FAF8F5] hover:bg-[#F5F2EB] border border-[#E5E0D5] text-xs font-delight font-semibold text-[#191716] flex items-center gap-1.5 cursor-pointer"
              >
                <span>Resources</span>
                <ChevronDown className="w-3.5 h-3.5 text-[#6E675F]" />
              </button>

              {resourcesOpen && (
                <div
                  onMouseLeave={() => setResourcesOpen(false)}
                  className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E5E0D5] rounded-lg shadow-xl py-1.5 z-50 text-xs font-delight"
                >
                  <button
                    onClick={() => {
                      setActiveArticleId('quickstart-checklist');
                      setResourcesOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF8F5] flex items-center justify-between text-[#191716] cursor-pointer"
                  >
                    <span>15-Min Operator Quickstart</span>
                    <ArrowRight className="w-3 h-3 text-[#C85A32]" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveArticleId('token-accounting-rules');
                      setResourcesOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF8F5] flex items-center justify-between text-[#191716] cursor-pointer"
                  >
                    <span>Token Pool Calculator (1:1)</span>
                    <CreditCard className="w-3 h-3 text-[#C85A32]" />
                  </button>
                  <button
                    onClick={() => {
                      setActiveArticleId('resizable-draggable-kanban');
                      setResourcesOpen(false);
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-[#FAF8F5] flex items-center justify-between text-[#191716] cursor-pointer"
                  >
                    <span>Resizable Kanban Guide</span>
                    <Kanban className="w-3 h-3 text-[#C85A32]" />
                  </button>
                  <div className="my-1 border-t border-[#E5E0D5]" />
                  <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] text-[#6E675F]">
                    <span>Scraper Cluster Status</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      99.98% Up
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3-PANE ZOHO COMMERCE DOCUMENTATION WORKSPACE */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT PANE: Collapsible Nested Topic Tree (`sidebar-lhs-wrap`) */}
          <aside className="w-72 bg-white border-r border-[#E5E0D5] flex flex-col h-full shrink-0">
            <div className="p-3.5 border-b border-[#E5E0D5] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#191716]">
                  Topics ({allArticles.length} Articles)
                </span>
                <button
                  onClick={() =>
                    setExpandedCatIds(
                      expandedCatIds.length === HELP_CATEGORIES.length
                        ? []
                        : HELP_CATEGORIES.map(c => c.id)
                    )
                  }
                  className="text-[10px] font-delight font-semibold text-[#C85A32] hover:underline cursor-pointer"
                >
                  {expandedCatIds.length === HELP_CATEGORIES.length ? 'Collapse All' : 'Expand All'}
                </button>
              </div>

              <input
                type="text"
                value={treeFilter}
                onChange={e => setTreeFilter(e.target.value)}
                placeholder="Filter topic tree..."
                className="w-full px-2.5 py-1 text-xs font-delight bg-[#FAF8F5] border border-[#E5E0D5] rounded text-[#191716] placeholder:text-[#9C9488] focus:outline-none focus:border-[#C85A32]"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
              {filteredCategories.map(cat => {
                const Icon = cat.icon;
                const isExpanded = expandedCatIds.includes(cat.id) || Boolean(searchQuery || treeFilter);
                const hasActiveChild = cat.articles.some(a => a.id === activeArt.id);

                return (
                  <div key={cat.id} className="rounded-md overflow-hidden">
                    {/* Parent Topic Row */}
                    <button
                      onClick={() => toggleCategoryExpand(cat.id)}
                      className={`w-full px-2.5 py-2 rounded-md text-left flex items-center justify-between transition-colors cursor-pointer ${
                        hasActiveChild
                          ? 'bg-[#F5F2EB] text-[#191716] font-bold'
                          : 'hover:bg-[#FAF8F5] text-[#57514B] font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 ${
                            hasActiveChild ? 'text-[#C85A32]' : 'text-[#9C9488]'
                          }`}
                        />
                        <span className="text-xs font-delight truncate">{cat.title}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-[#9C9488] shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-[#9C9488] shrink-0" />
                      )}
                    </button>

                    {/* Nested Sub-Articles */}
                    {isExpanded && (
                      <div className="mt-1 ml-3.5 pl-2.5 border-l border-[#E5E0D5] space-y-0.5">
                        {cat.articles.map(art => {
                          const isSelected = art.id === activeArt.id;
                          return (
                            <button
                              key={art.id}
                              onClick={() => handleSelectArticle(cat, art)}
                              className={`w-full px-2.5 py-1.5 rounded text-left text-[11px] font-delight transition-colors flex items-center justify-between gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-[#191716] text-white font-semibold'
                                  : 'text-[#6E675F] hover:bg-[#FAF8F5] hover:text-[#191716]'
                              }`}
                            >
                              <span className="truncate">{art.title}</span>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32] shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Quick Upgrade / Support Banner in Left Tree */}
            <div className="p-3.5 border-t border-[#E5E0D5] bg-[#FAF8F5]">
              <div className="text-[10px] font-delight uppercase font-bold text-[#6E675F]">
                Workspace Plan: <span className="text-[#C85A32]">{user?.plan || 'Free'}</span>
              </div>
              <p className="text-[11px] font-delight text-[#57514B] mt-0.5">
                Rule: <b>1 Token = 1 Contact</b> (Free Tier: 15 tokens).
              </p>
              <button
                onClick={() => {
                  const isPro = (user?.plan || 'free').toLowerCase() === 'pro';
                  setUpgradeTab(isPro ? 'topup' : 'plans');
                  setTopUpOpen(true);
                }}
                className="mt-2 w-full py-1.5 px-2.5 rounded bg-[#191716] hover:bg-[#C85A32] text-white text-[11px] font-delight font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-[#C85A32]" />
                <span>
                  {(user?.plan || 'free').toLowerCase() === 'pro'
                    ? 'Top-Up Instant Tokens'
                    : 'Upgrade Plan / Top-Up'}
                </span>
              </button>
            </div>
          </aside>

          {/* CENTER + RIGHT SCROLLABLE DOCUMENTATION AREA */}
          <main className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-[1160px] mx-auto px-6 py-7">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
                {/* CENTER ARTICLE READER (8 Cols) */}
                <div className="xl:col-span-8 space-y-6">
                  {/* Article Card */}
                  <div className="bg-white border border-[#E5E0D5] rounded-lg overflow-hidden shadow-2xs">
                    {/* Top Breadcrumb & Action Bar */}
                    <div className="px-6 py-3.5 bg-[#F5F2EB] border-b border-[#E5E0D5] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-delight text-[#6E675F]">
                        <span>Help Center</span>
                        <ChevronRight className="w-3 h-3 text-[#9C9488]" />
                        <span className="font-semibold text-[#191716]">{activeCat.title}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-delight text-[#6E675F] flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#C85A32]" />
                          {activeArt.readingTime}
                        </span>
                        <button
                          onClick={handleCopyPermalink}
                          className="px-2 py-1 rounded bg-white border border-[#E5E0D5] text-[11px] font-delight font-medium text-[#191716] hover:border-[#191716] flex items-center gap-1 cursor-pointer"
                          title="Copy article link"
                        >
                          {copiedLink ? <Check className="w-3 h-3 text-emerald-600" /> : <Share2 className="w-3 h-3" />}
                          <span>{copiedLink ? 'Copied' : 'Share'}</span>
                        </button>
                        <button
                          onClick={() => window.print()}
                          className="p-1 rounded bg-white border border-[#E5E0D5] text-[#6E675F] hover:text-[#191716] cursor-pointer"
                          title="Print guide"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Article Body */}
                    <div className="p-6 sm:p-8 space-y-7">
                      {/* Title + Deep Link CTA */}
                      <div id="doc-overview" className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#E5E0D5] pb-5">
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#E5E0D5] text-[10px] font-mono text-[#C85A32] mb-2">
                            <span>{activeArt.lastUpdated}</span>
                          </div>
                          <h1 className="text-xl sm:text-2xl font-bold font-delight text-[#191716] tracking-tight">
                            {activeArt.title}
                          </h1>
                        </div>

                        <button
                          onClick={() => navigate(activeArt.route)}
                          className="px-3.5 py-2 bg-[#191716] hover:bg-[#C85A32] text-white rounded-md text-xs font-delight font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <span>{activeArt.routeLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Executive Summary & Key Takeaways */}
                      <div className="space-y-4">
                        <p className="text-sm font-delight text-[#57514B] leading-relaxed">
                          {activeArt.summary}
                        </p>

                        <div className="bg-[#FAF8F5] border border-[#E5E0D5] rounded-lg p-4 space-y-2">
                          <div className="text-[11px] font-delight font-bold uppercase tracking-wider text-[#191716] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#C85A32]" />
                            <span>Key Capabilities Covered in This Guide</span>
                          </div>
                          <ul className="space-y-1.5">
                            {activeArt.keyTakeaways.map((point, idx) => (
                              <li key={idx} className="text-xs font-delight text-[#57514B] flex items-start gap-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Interactive Token Pool Calculator (Shown on Token Articles) */}
                      {activeCat.id === 'my-plan-tokens' && (
                        <div className="bg-[#F5F2EB] border border-[#E5E0D5] rounded-lg p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716]">
                                Interactive Token Deduction Simulator (1 Token = 1 Contact)
                              </h3>
                              <p className="text-[11px] font-delight text-[#6E675F]">
                                Drag the slider to see how scraped contacts map to your 4-day token pool
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded bg-[#191716] text-white font-mono text-xs font-bold">
                              {simContacts} Contacts = {simContacts} Tokens
                            </span>
                          </div>

                          <input
                            type="range"
                            min={1}
                            max={250}
                            value={simContacts}
                            onChange={e => setSimContacts(Number(e.target.value))}
                            className="w-full accent-[#C85A32] cursor-pointer"
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-delight">
                            <div className="p-3 rounded bg-white border border-[#E5E0D5]">
                              <div className="text-[10px] font-bold uppercase text-[#6E675F]">Free Tier (15 Cap)</div>
                              <div className="font-bold text-[#191716] mt-1">
                                {simContacts <= 15
                                  ? `${15 - simContacts} tokens remaining`
                                  : `Requires Basic or +${simContacts - 15} Top-Up`}
                              </div>
                            </div>
                            <div className="p-3 rounded bg-white border border-[#E5E0D5]">
                              <div className="text-[10px] font-bold uppercase text-[#6E675F]">Basic Tier (400 Cap)</div>
                              <div className="font-bold text-emerald-700 mt-1">
                                {400 - simContacts} tokens remaining
                              </div>
                            </div>
                            <div className="p-3 rounded bg-white border border-[#E5E0D5]">
                              <div className="text-[10px] font-bold uppercase text-[#6E675F]">Pro Tier (1,000 Cap)</div>
                              <div className="font-bold text-[#C85A32] mt-1">
                                {1000 - simContacts} tokens remaining
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Step-by-Step Procedure */}
                      <div id="doc-steps" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h2 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716]">
                            Step-by-Step Implementation Procedure
                          </h2>
                          <span className="text-[11px] font-delight text-[#6E675F]">
                            Click any step to mark complete
                          </span>
                        </div>

                        <div className="space-y-3">
                          {activeArt.steps.map((step, idx) => {
                            const stepKey = `${activeArt.id}-step-${idx}`;
                            const isDone = Boolean(completedSteps[stepKey]);

                            return (
                              <div
                                key={stepKey}
                                onClick={() =>
                                  setCompletedSteps(prev => ({ ...prev, [stepKey]: !prev[stepKey] }))
                                }
                                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                                  isDone
                                    ? 'bg-emerald-50/40 border-emerald-300'
                                    : 'bg-[#FAF8F5] hover:bg-white border-[#E5E0D5]'
                                }`}
                              >
                                <div className="flex items-start gap-3.5">
                                  <div
                                    className={`w-6 h-6 rounded-md text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                      isDone
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-[#191716] text-white'
                                    }`}
                                  >
                                    {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                  </div>
                                  <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <h3 className="text-xs font-bold font-delight text-[#191716]">
                                        {step.title}
                                      </h3>
                                      <span className="text-[10px] font-mono text-[#6E675F]">
                                        {isDone ? 'Completed' : `Step 0${idx + 1}`}
                                      </span>
                                    </div>
                                    <p className="text-xs font-delight text-[#57514B] leading-relaxed">
                                      {step.detail}
                                    </p>
                                    {step.tip && (
                                      <div className="mt-2 px-3 py-1.5 rounded bg-white border border-[#E5E0D5] text-[11px] font-delight text-[#6E675F] flex items-center gap-1.5">
                                        <Zap className="w-3 h-3 text-[#C85A32] shrink-0" />
                                        <span>{step.tip}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Optional Architecture / Code Reference */}
                      {activeArt.codeBlock && (
                        <div id="doc-config" className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716] flex items-center gap-1.5">
                              <Terminal className="w-3.5 h-3.5 text-[#C85A32]" />
                              <span>{activeArt.codeTitle || 'Technical Reference'}</span>
                            </span>
                            <button
                              onClick={() => handleCopyCode(activeArt.codeBlock!)}
                              className="px-2.5 py-1 rounded bg-[#FAF8F5] hover:bg-[#F5F2EB] border border-[#E5E0D5] text-[11px] font-delight font-semibold text-[#191716] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedCode ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Snippet</span>
                                </>
                              )}
                            </button>
                          </div>
                          <pre className="p-4 rounded-lg bg-[#191716] text-[#FAF8F5] font-mono text-xs overflow-x-auto leading-relaxed border border-[#2C2825]">
                            <code>{activeArt.codeBlock}</code>
                          </pre>
                        </div>
                      )}

                      {/* Optional FAQ Accordion inside Article */}
                      {activeArt.faqs && activeArt.faqs.length > 0 && (
                        <div id="doc-faqs" className="space-y-3">
                          <h2 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716]">
                            Frequently Asked Questions
                          </h2>
                          <div className="space-y-2.5">
                            {activeArt.faqs.map((f, i) => (
                              <div key={i} className="p-4 rounded-lg bg-[#FAF8F5] border border-[#E5E0D5] space-y-1.5">
                                <div className="text-xs font-bold font-delight text-[#191716] flex items-start gap-2">
                                  <HelpCircle className="w-3.5 h-3.5 text-[#C85A32] shrink-0 mt-0.5" />
                                  <span>{f.q}</span>
                                </div>
                                <p className="text-xs font-delight text-[#57514B] leading-relaxed pl-5.5">
                                  {f.a}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Operator Pro-Tip Callout */}
                      <div id="doc-best-practices" className="p-4 rounded-lg bg-[#C85A32]/10 border border-[#C85A32]/30 flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                        <div className="text-xs font-delight text-[#191716] leading-relaxed">
                          <span className="font-bold uppercase tracking-wider text-[#C85A32] mr-1.5">
                            DocuReady Operator Note:
                          </span>
                          {activeArt.proTip}
                        </div>
                      </div>

                      {/* Zoho-Style "Was this article helpful?" Feedback Bar */}
                      <div className="pt-4 border-t border-[#E5E0D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-xs font-delight font-semibold text-[#191716]">
                          Was this documentation article helpful?
                        </div>
                        {helpfulVote ? (
                          <div className="text-xs font-delight font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-md">
                            ✓ Thank you! Your feedback helps DocuReady improve the Strovr guide.
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setHelpfulVote('yes')}
                              className="px-3 py-1.5 rounded-md bg-[#FAF8F5] hover:bg-[#191716] hover:text-white border border-[#E5E0D5] text-xs font-delight font-semibold text-[#191716] flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>Yes, helpful</span>
                            </button>
                            <button
                              onClick={() => setHelpfulVote('no')}
                              className="px-3 py-1.5 rounded-md bg-[#FAF8F5] hover:bg-[#191716] hover:text-white border border-[#E5E0D5] text-xs font-delight font-semibold text-[#191716] flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                              <span>Needs more detail</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Previous / Next Article Navigation Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {prevEntry ? (
                      <button
                        onClick={() => handleSelectArticle(prevEntry.category, prevEntry.article)}
                        className="p-4 rounded-lg bg-white border border-[#E5E0D5] hover:border-[#C85A32] text-left transition-all cursor-pointer group"
                      >
                        <div className="text-[10px] font-delight uppercase font-bold text-[#6E675F]">
                          ← Previous Topic ({prevEntry.category.title})
                        </div>
                        <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] mt-1 truncate">
                          {prevEntry.article.title}
                        </div>
                      </button>
                    ) : (
                      <div />
                    )}

                    {nextEntry && (
                      <button
                        onClick={() => handleSelectArticle(nextEntry.category, nextEntry.article)}
                        className="p-4 rounded-lg bg-white border border-[#E5E0D5] hover:border-[#C85A32] text-right transition-all cursor-pointer group"
                      >
                        <div className="text-[10px] font-delight uppercase font-bold text-[#6E675F]">
                          Next Topic ({nextEntry.category.title}) →
                        </div>
                        <div className="text-xs font-bold font-delight text-[#191716] group-hover:text-[#C85A32] mt-1 truncate">
                          {nextEntry.article.title}
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* RIGHT PANE: Sticky "On This Page" TOC & Zoho-Style Resource Cards (4 Cols) */}
                <div className="xl:col-span-4 space-y-5 xl:sticky xl:top-6">
                  {/* On This Page TOC */}
                  <div className="bg-white border border-[#E5E0D5] rounded-lg overflow-hidden">
                    <div className="px-4 py-3 bg-[#F5F2EB] border-b border-[#E5E0D5]">
                      <h3 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716]">
                        On This Page
                      </h3>
                    </div>
                    <div className="p-3.5 space-y-1.5 text-xs font-delight">
                      <button
                        onClick={() => scrollToSection('doc-overview')}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#FAF8F5] text-[#57514B] hover:text-[#C85A32] font-medium cursor-pointer flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C85A32]" />
                        <span>Overview &amp; Key Takeaways</span>
                      </button>
                      <button
                        onClick={() => scrollToSection('doc-steps')}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#FAF8F5] text-[#57514B] hover:text-[#C85A32] font-medium cursor-pointer flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#191716]" />
                        <span>Step-by-Step Procedure ({activeArt.steps.length})</span>
                      </button>
                      {activeArt.codeBlock && (
                        <button
                          onClick={() => scrollToSection('doc-config')}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#FAF8F5] text-[#57514B] hover:text-[#C85A32] font-medium cursor-pointer flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#191716]" />
                          <span>Technical / Schema Reference</span>
                        </button>
                      )}
                      {activeArt.faqs && (
                        <button
                          onClick={() => scrollToSection('doc-faqs')}
                          className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#FAF8F5] text-[#57514B] hover:text-[#C85A32] font-medium cursor-pointer flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#191716]" />
                          <span>Frequently Asked Questions</span>
                        </button>
                      )}
                      <button
                        onClick={() => scrollToSection('doc-best-practices')}
                        className="w-full text-left px-2.5 py-1.5 rounded hover:bg-[#FAF8F5] text-[#57514B] hover:text-[#C85A32] font-medium cursor-pointer flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#191716]" />
                        <span>DocuReady Operator Note</span>
                      </button>
                    </div>
                  </div>

                  {/* Zoho Commerce-Style 4 Support & Resource Cards */}
                  <div className="bg-white border border-[#E5E0D5] rounded-lg overflow-hidden divide-y divide-[#E5E0D5]">
                    <div className="px-4 py-3 bg-[#F5F2EB]">
                      <h3 className="text-xs font-bold uppercase tracking-wider font-delight text-[#191716]">
                        Help &amp; Support Channels
                      </h3>
                    </div>

                    <div
                      onClick={() => navigate('/finder')}
                      className="p-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex items-start gap-3"
                    >
                      <PlayCircle className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold font-delight text-[#191716]">
                          Interactive Module Walkthroughs
                        </div>
                        <p className="text-[11px] font-delight text-[#6E675F] mt-0.5">
                          Jump straight into Lead Finder, Resizable Kanban, or Outreach Studio.
                        </p>
                      </div>
                    </div>

                    <div
                      onClick={() => navigate('/integrations')}
                      className="p-3.5 hover:bg-[#FAF8F5] transition-colors cursor-pointer flex items-start gap-3"
                    >
                      <Puzzle className="w-4 h-4 text-[#C85A32] shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold font-delight text-[#191716]">
                          OAuth &amp; Webhook Reference
                        </div>
                        <p className="text-[11px] font-delight text-[#6E675F] mt-0.5">
                          Connect HubSpot, Salesforce, Google Sheets, or Slack stage alerts.
                        </p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-[#FAF8F5] space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold font-delight text-[#191716]">
                        <LifeBuoy className="w-4 h-4 text-[#C85A32]" />
                        <span>Talk to a DocuReady Specialist</span>
                      </div>
                      <p className="text-[11px] font-delight text-[#6E675F] leading-relaxed">
                        Need custom scraper concurrency, enterprise SSO, or dedicated webhook onboarding?
                      </p>
                      <a
                        href="mailto:support@strovr.space?subject=Strovr%20Enterprise%20Support"
                        className="inline-flex items-center gap-1.5 text-xs font-delight font-bold text-[#C85A32] hover:underline"
                      >
                        <span>Contact DocuReady Engineering →</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default HelpCenter;
