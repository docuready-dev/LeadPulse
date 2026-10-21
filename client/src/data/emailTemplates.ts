export type TemplateId = 
  | 'text_only' 
  | 'one_column' 
  | 'interactive_calendar' 
  | 'hybrid' 
  | 'inverted_pyramid' 
  | 'interactive_roi' 
  | 'f_pattern' 
  | 'dynamic_product_feed'
  | 'two_column' 
  | 'zig_zag';

export interface EmailTemplateConfig {
  id: TemplateId;
  name: string;
  tagline: string;
  bestFor: string;
  purpose: string;
  category: 'direct' | 'promotional' | 'newsletter' | 'ecommerce';
  defaultData: {
    subject: string;
    preheader?: string;
    headline: string;
    subheadline?: string;
    body: string;
    ctaText?: string;
    ctaUrl?: string;
    secondaryCtaText?: string;
    secondaryCtaUrl?: string;

    // Interactive Calendar
    hostName?: string;
    hostTitle?: string;
    hostAvatar?: string;
    duration?: string;
    timeSlots?: Array<{
      label: string;
      time: string;
      date: string;
      url?: string;
    }>;
    meetingAgenda?: string[];

    // Interactive ROI
    comparisonCurrent?: {
      title: string;
      monthlyCost: string;
      timeSpent: string;
      replyRate: string;
      badge: string;
    };
    comparisonPulse?: {
      title: string;
      monthlyCost: string;
      timeSpent: string;
      replyRate: string;
      badge: string;
    };
    roiMetrics?: Array<{
      metric: string;
      label: string;
      highlight?: boolean;
    }>;
    benefitsList?: string[];

    // Two Column & Hybrid (Legacy support)
    col1Title?: string;
    col1Body?: string;
    col1Cta?: string;
    col1CtaUrl?: string;
    col2Title?: string;
    col2Body?: string;
    col2Cta?: string;
    col2CtaUrl?: string;

    // Zig Zag (Legacy support)
    zig1Title?: string;
    zig1Text?: string;
    zig1Cta?: string;
    zig1CtaUrl?: string;
    zig2Title?: string;
    zig2Text?: string;
    zig2Cta?: string;
    zig2CtaUrl?: string;

    // F-Pattern
    fBullet1?: string;
    fBullet2?: string;
    fBullet3?: string;
    fBottomNote?: string;

    // Dynamic Product Feed
    products?: Array<{
      name: string;
      category?: string;
      price: string;
      badge?: string;
      imageUrl?: string;
      description?: string;
      ctaText?: string;
      ctaUrl?: string;
    }>;
  };
}

export const EMAIL_TEMPLATES: Record<TemplateId, EmailTemplateConfig> = {
  text_only: {
    id: 'text_only',
    name: '1. Text Only Email',
    tagline: 'Personal & Transactional Outreach',
    bestFor: 'High-touch B2B introductions, CEO-to-CEO notes, password resets, account notices',
    purpose: 'Creates a personal, authentic 1-on-1 feel with maximum email deliverability and zero spam filter triggers.',
    category: 'direct',
    defaultData: {
      subject: 'Quick question regarding {{business_name}}',
      preheader: 'Direct Executive Inquiry',
      headline: 'Hi {{first_name}}, quick inquiry regarding {{business_name}}',
      body: `I came across {{business_name}} while reviewing top-rated operators in the {{field_of_work}} sector across {{location}}.

We've been helping businesses in your niche automate local lead generation and customer acquisition without relying on expensive ad spend.

A few quick points that might interest your team:
• Automated discovery of verified local decision-maker contacts
• Zero cold call manual labor through high-deliverability sequences
• Proven 28% higher response rates for {{field_of_work}} specialists

Would you have 5 minutes this Thursday for a quick chat?

Best regards,
{{sender_name}}
{{company_name}}`,
      ctaText: 'Book an Appointment ',
      ctaUrl: 'http://localhost:8088'
    }
  },

  one_column: {
    id: 'one_column',
    name: '2. One Column Email',
    tagline: 'Linear Mobile-First Announcement',
    bestFor: 'Welcome emails, product launches, single value proposition campaigns',
    purpose: 'Keeps focus on one clear vertical narrative with a single, frictionless path to the primary Call-To-Action.',
    category: 'promotional',
    defaultData: {
      subject: 'Special Partnership Proposal for {{business_name}}',
      preheader: 'Accelerate your pipeline in {{location}}',
      headline: 'Grow {{business_name}} with Automated Local Leads',
      subheadline: 'A custom growth package tailored specifically for {{field_of_work}}',
      body: `Traditional marketing methods in {{location}} are becoming increasingly noisy and expensive.

With Strovr, {{business_name}} gains direct access to an autonomous local pipeline engine that scrapes, enriches, and initiates conversations with verified buyers every day.`,
      ctaText: 'Explore Partner Program',
      ctaUrl: 'https://www.strovr.space/partner-program'
    }
  },

  interactive_calendar: {
    id: 'interactive_calendar',
    name: '3. Interactive Calendar Booking Card',
    tagline: 'Live 1-Click Meeting & Time Slot Scheduling',
    bestFor: 'Executive discovery calls, product demos, consult bookings, agency sales intros',
    purpose: 'Embeds an interactive booking widget with clickable time-slot chips, host avatar, live status, and direct sync to Google Calendar or custom booking URLs.',
    category: 'direct',
    defaultData: {
      subject: '15-Min Strategy Session for {{business_name}} | Quick Intro',
      preheader: 'Pick a slot on our live calendar',
      headline: 'Schedule a 15-Minute Strategy Chat with Alex',
      subheadline: 'Instant calendar reservation • Direct Google Meet invitation',
      body: `Hi {{first_name}},

I came across {{business_name}} while reviewing leading companies in the {{field_of_work}} sector across {{location}}.

We have engineered an autonomous outreach engine that helps local operators acquire verified B2B clients without manual prospecting or agency retainers.

Select an available time slot below to lock in a quick 15-minute introductory chat:`,
      hostName: 'Alex Roberts',
      hostTitle: 'Growth Director, Strovr',
      hostAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      duration: '15 mins',
      timeSlots: [
        { label: 'Tomorrow 10:30 AM', time: '10:30 AM', date: 'Tomorrow', url: 'http://localhost:8088' },
        { label: 'Tomorrow 2:00 PM', time: '2:00 PM', date: 'Tomorrow', url: 'http://localhost:8088' },
        { label: 'Friday 4:30 PM', time: '4:30 PM', date: 'Friday', url: 'http://localhost:8088' },
        { label: 'View All Available Slots →', time: 'All Slots', date: 'Next 7 Days', url: 'http://localhost:8088' }
      ],
      meetingAgenda: [
        'Review {{business_name}}’s current lead acquisition cost in {{location}}',
        'Live demonstration of autonomous Google Maps scraper and enrichment',
        '30-day projected pipeline estimate with zero manual cold calls'
      ],
      ctaText: 'Book an Appointment ',
      ctaUrl: 'http://localhost:8088'
    }
  },

  hybrid: {
    id: 'hybrid',
    name: '4. Hybrid Email',
    tagline: 'Hero Headline + Multi-Block Sections',
    bestFor: 'Monthly partner newsletters, quarterly industry digests, conference invitations',
    purpose: 'Combines a powerful wide header announcement with flexible multi-column secondary stories for high engagement.',
    category: 'newsletter',
    defaultData: {
      subject: '{{location}} B2B Market Digest for {{business_name}}',
      preheader: 'Monthly Partner Brief',
      headline: 'The 2026 {{field_of_work}} Benchmark Report',
      subheadline: 'Key trends affecting local enterprises in {{location}}',
      body: `We surveyed over 500 business owners across {{location}} to uncover how high-performing companies in {{field_of_work}} are acquiring clients this quarter.`,
      ctaText: 'Download Full Benchmark Report',
      ctaUrl: 'https://www.strovr.space/reports',
      col1Title: 'Local Scraper Trends',
      col1Body: 'Why multi-channel outreach is outpacing standalone email marketing by 3.4x.',
      col1Cta: 'Read Article',
      col1CtaUrl: 'https://www.strovr.space/trends',
      col2Title: 'Conversion Playbook',
      col2Body: 'How {{business_name}} can improve reply rates with automated merge tags.',
      col2Cta: 'View Playbook',
      col2CtaUrl: 'https://www.strovr.space/playbook'
    }
  },

  inverted_pyramid: {
    id: 'inverted_pyramid',
    name: '5. Inverted Pyramid Email',
    tagline: 'High-Conversion Funnel to Single CTA',
    bestFor: 'Time-sensitive discounts, flash offers, exclusive webinars, single product launches',
    purpose: 'Guides the eye from a broad visual headline, narrowing down through persuasive copy, straight to a high-contrast CTA.',
    category: 'promotional',
    defaultData: {
      subject: 'Exclusive Invitation for {{business_name}}',
      preheader: 'Exclusive 500-Lead Reserve',
      headline: 'Ready to 10x Client Acquisition for {{business_name}}?',
      subheadline: 'A limited compute allocation has been reserved for your team in {{location}}.',
      body: `We’re offering {{business_name}} 500 complimentary verified leads and zero platform setup fees this month. Claim your dedicated compute node before local slots in {{location}} close.`,
      ctaText: 'Claim Your 500 Leads Now',
      ctaUrl: 'https://www.strovr.space/claim-leads'
    }
  },

  interactive_roi: {
    id: 'interactive_roi',
    name: '6. Interactive ROI & Benchmark Card',
    tagline: 'Visual Cost & Revenue Multiplier Comparison',
    bestFor: 'Competitive displacement, ROI proposals, value audits, enterprise pitches',
    purpose: 'Drives conversions through an interactive side-by-side benchmark card contrasting legacy manual costs with Strovr autonomous efficiency.',
    category: 'promotional',
    defaultData: {
      subject: 'ROI Analysis & Cost Benchmark for {{business_name}}',
      preheader: 'See how {{business_name}} compares to {{field_of_work}} standards',
      headline: 'Calculate {{business_name}}’s Projected Outreach ROI',
      subheadline: 'Compare legacy manual agency fees vs Strovr autonomous engine',
      body: `We analyzed lead generation economics for over 500 businesses in {{location}}. Operators in {{field_of_work}} frequently overpay for manual prospecting and outdated agency retainers.

Review the live cost-efficiency comparison below to see what your team could save:`,
      comparisonCurrent: {
        title: 'Traditional Agency & Manual Scraper',
        monthlyCost: '₹45,000 / mo',
        timeSpent: '14 hours / week',
        replyRate: '1.8% Response Rate',
        badge: 'Legacy Method'
      },
      comparisonPulse: {
        title: 'Strovr Autonomous Engine',
        monthlyCost: '₹999 / mo',
        timeSpent: '15 mins / week',
        replyRate: '28.4% Response Rate',
        badge: '8.4x Lower CAC'
      },
      roiMetrics: [
        { metric: '₹44,301', label: 'Monthly Cost Savings', highlight: true },
        { metric: '99.4%', label: 'Inbox Deliverability', highlight: false },
        { metric: '300+', label: 'Verified Leads / Month', highlight: false }
      ],
      benefitsList: [
        'Autonomous Google Maps geo-radius crawler with zero rate-limit blocks',
        'Direct-to-inbox verified mail transport with Link Mobility templates',
        'Two-way CRM pipeline synchronization with HubSpot, Google Sheets & Slack'
      ],
      ctaText: 'Claim {{business_name}}’s Growth Tier →',
      ctaUrl: 'https://www.strovr.space/pricing'
    }
  },

  f_pattern: {
    id: 'f_pattern',
    name: '7. F Pattern Email',
    tagline: 'Content-Dense Editorial Scan Layout',
    bestFor: 'Detailed industry newsletters, technical digests, policy updates, SaaS product release notes',
    purpose: 'Structured along natural screen reading behavior (top-line scan + vertical left-side scan) for effortless information absorption.',
    category: 'newsletter',
    defaultData: {
      subject: 'Executive Briefing: Growth in {{field_of_work}} ({{location}})',
      preheader: 'Executive Briefing',
      headline: 'The Executive Briefing for {{business_name}}',
      subheadline: 'Key updates tailored to operators in {{location}}',
      body: `Here are the top three strategic insights for leaders in the {{field_of_work}} category this month:`,
      fBullet1: 'Automated Lead Validation: Why phone validation before outreach cuts bounce rates by 92%.',
      fBullet2: 'Local Geo-Fencing: How micro-targeting specific neighborhoods in {{location}} outperforms broad county campaigns.',
      fBullet3: 'Compliance Evolution: Updated CAN-SPAM and GDPR guidelines for outbound B2B messaging.',
      fBottomNote: 'Summary: Proactive outreach that incorporates local context continues to yield the highest ROI for {{business_name}}.',
      ctaText: 'Access Executive Dashboard',
      ctaUrl: 'https://www.strovr.space/dashboard'
    }
  },

  dynamic_product_feed: {
    id: 'dynamic_product_feed',
    name: '8. Dynamic Product Feed Email',
    tagline: 'Catalog Grid & Dynamic Pricing Matrix',
    bestFor: 'eCommerce recommendations, service tier menus, promotional package offerings',
    purpose: 'Dynamically presents modular service or product cards with real-time pricing and direct ordering action pathways.',
    category: 'ecommerce',
    defaultData: {
      subject: 'Curated Service Solutions for {{business_name}}',
      preheader: 'Dynamic Service Feed',
      headline: 'Specialized Service Menu for {{field_of_work}}',
      subheadline: 'Popular packages designed for businesses in {{location}}',
      body: `Based on your profile as a leading operator in {{location}}, we have prepared three targeted growth packages for {{business_name}}:`,
      products: [
        {
          name: 'Local Maps Accelerator',
          category: 'Lead Discovery',
          price: '₹999 / mo',
          badge: 'Starter',
          imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
          description: 'Extract 300+ geo-targeted leads every month with live ratings & phone contacts.',
          ctaText: 'Select Plan',
          ctaUrl: 'https://www.strovr.space/checkout?plan=starter'
        },
        {
          name: 'Multi-Channel Pro Suite',
          category: 'Email + WhatsApp',
          price: '₹1,999 / mo',
          badge: 'Most Popular',
          imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
          description: 'Autonomous direct-to-inbox dispatch with 10 structured WhatsApp scripts & zero rate limits.',
          ctaText: 'Select Plan',
          ctaUrl: 'https://www.strovr.space/checkout?plan=pro'
        },
        {
          name: 'Dedicated Headless Cluster',
          category: 'High Volume Enterprise',
          price: '₹4,999 / mo',
          badge: 'Enterprise',
          imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format&fit=crop&q=80',
          description: 'Dedicated Chromium crawler nodes with custom webhooks & CRM two-way sync.',
          ctaText: 'Select Plan',
          ctaUrl: 'https://www.strovr.space/checkout?plan=enterprise'
        }
      ],
      ctaText: 'Customize Your Package',
      ctaUrl: 'https://www.strovr.space/pricing'
    }
  },

  // Aliases for seamless backward compatibility with any legacy saved drafts
  two_column: {
    id: 'two_column',
    name: '3. Interactive Calendar Booking Card',
    tagline: 'Live 1-Click Meeting & Time Slot Scheduling',
    bestFor: 'Executive discovery calls, product demos, consult bookings, agency sales intros',
    purpose: 'Embeds an interactive booking widget with clickable time-slot chips, host avatar, live status, and direct sync to Calendly or custom booking URLs.',
    category: 'direct',
    defaultData: {
      subject: '15-Min Strategy Session for {{business_name}} | Quick Intro',
      preheader: 'Pick a slot on our live calendar',
      headline: 'Schedule a 15-Minute Strategy Chat with Alex',
      subheadline: 'Instant calendar reservation • Direct Google Meet invitation',
      body: `Hi {{first_name}},

I came across {{business_name}} while reviewing leading companies in the {{field_of_work}} sector across {{location}}.

We have engineered an autonomous outreach engine that helps local operators acquire verified B2B clients without manual prospecting or agency retainers.

Select an available time slot below to lock in a quick 15-minute introductory chat:`,
      hostName: 'Alex Roberts',
      hostTitle: 'Growth Director, Strovr',
      hostAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      duration: '15 mins',
      timeSlots: [
        { label: 'Tomorrow 10:30 AM', time: '10:30 AM', date: 'Tomorrow', url: 'http://localhost:8088' },
        { label: 'Tomorrow 2:00 PM', time: '2:00 PM', date: 'Tomorrow', url: 'http://localhost:8088' },
        { label: 'Friday 4:30 PM', time: '4:30 PM', date: 'Friday', url: 'http://localhost:8088' },
        { label: 'View All Available Slots →', time: 'All Slots', date: 'Next 7 Days', url: 'http://localhost:8088' }
      ],
      meetingAgenda: [
        'Review {{business_name}}’s current lead acquisition cost in {{location}}',
        'Live demonstration of autonomous Google Maps scraper and enrichment',
        '30-day projected pipeline estimate with zero manual cold calls'
      ],
      ctaText: 'Book an Appointment ',
      ctaUrl: 'http://localhost:8088'
    }
  },

  zig_zag: {
    id: 'zig_zag',
    name: '6. Interactive ROI & Benchmark Card',
    tagline: 'Visual Cost & Revenue Multiplier Comparison',
    bestFor: 'Competitive displacement, ROI proposals, value audits, enterprise pitches',
    purpose: 'Drives conversions through an interactive side-by-side benchmark card contrasting legacy manual costs with Strovr autonomous efficiency.',
    category: 'promotional',
    defaultData: {
      subject: 'ROI Analysis & Cost Benchmark for {{business_name}}',
      preheader: 'See how {{business_name}} compares to {{field_of_work}} standards',
      headline: 'Calculate {{business_name}}’s Projected Outreach ROI',
      subheadline: 'Compare legacy manual agency fees vs Strovr autonomous engine',
      body: `We analyzed lead generation economics for over 500 businesses in {{location}}. Operators in {{field_of_work}} frequently overpay for manual prospecting and outdated agency retainers.

Review the live cost-efficiency comparison below to see what your team could save:`,
      comparisonCurrent: {
        title: 'Traditional Agency & Manual Scraper',
        monthlyCost: '₹45,000 / mo',
        timeSpent: '14 hours / week',
        replyRate: '1.8% Response Rate',
        badge: 'Legacy Method'
      },
      comparisonPulse: {
        title: 'Strovr Autonomous Engine',
        monthlyCost: '₹999 / mo',
        timeSpent: '15 mins / week',
        replyRate: '28.4% Response Rate',
        badge: '8.4x Lower CAC'
      },
      roiMetrics: [
        { metric: '₹44,301', label: 'Monthly Cost Savings', highlight: true },
        { metric: '99.4%', label: 'Inbox Deliverability', highlight: false },
        { metric: '300+', label: 'Verified Leads / Month', highlight: false }
      ],
      benefitsList: [
        'Autonomous Google Maps geo-radius crawler with zero rate-limit blocks',
        'Direct-to-inbox verified mail transport with Link Mobility templates',
        'Two-way CRM pipeline synchronization with HubSpot, Google Sheets & Slack'
      ],
      ctaText: 'Claim {{business_name}}’s Growth Tier →',
      ctaUrl: 'https://www.strovr.space/pricing'
    }
  }
};
