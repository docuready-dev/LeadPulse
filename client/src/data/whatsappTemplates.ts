export interface WhatsAppImageAttachment {
  enabled: boolean;
  url: string;
  caption?: string;
  fileName?: string;
}

export interface WhatsAppPdfAttachment {
  enabled: boolean;
  url: string;
  fileName: string;
  fileSize: string;
  pageCount?: string;
}

export interface WhatsAppMediaPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  image: {
    url: string;
    caption: string;
    fileName: string;
  };
  pdf: {
    url: string;
    fileName: string;
    fileSize: string;
    pageCount: string;
  };
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: 'icebreaker' | 'audit' | 'partnership' | 'footfall' | 'conversion' | 'seasonal' | 'reviews' | 'tech' | 'media' | 'referral' | 'bridge';
  hookType: string;
  description: string;
  badge: string;
  defaultMessage: string;
  followUpScript?: string;
  suggestedImage?: {
    url: string;
    caption: string;
    fileName: string;
  };
  suggestedPdf?: {
    url: string;
    fileName: string;
    fileSize: string;
    pageCount: string;
  };
}

export const WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'local_compliment',
    name: '1. The Local Compliment Hook',
    category: 'icebreaker',
    hookType: 'Praising Local Presence',
    description: 'Breaks the ice by acknowledging their strong reputation and local footprint in {{location}}.',
    badge: 'High Response Rate',
    defaultMessage: `Hey {{first_name}}, came across {{business_name}} while researching top-rated {{tag}} leaders in {{location}}. Really impressed by your customer reputation! 

Quick question: are you guys currently taking on new high-value client bookings this month, or is your schedule completely full?`,
    followUpScript: `Awesome to hear! Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop our partnership overview over to?`
  },
  {
    id: 'visibility_audit',
    name: '2. The Quick Visibility Audit Hook',
    category: 'audit',
    hookType: 'Bite-Sized Local Insight',
    description: 'Offers an immediate free value teardown comparing them to local competitors in {{location}}.',
    badge: 'Value First',
    defaultMessage: `Hi {{first_name}}, was looking at local search rankings for {{tag}} across {{location}} and noticed {{business_name}} has strong reviews, but is losing about 20-30 high-intent weekly searches to 2 competitors nearby.

Put together a 2-minute visual breakdown of the search gaps. Mind if I share it with you?`,
    followUpScript: `Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop this 2-min breakdown over to?`
  },
  {
    id: 'peer_partnership',
    name: '3. The Peer Partnership Hook',
    category: 'partnership',
    hookType: 'B2B Co-Marketing Opener',
    description: 'Professional collaborative outreach positioning mutual client synergies without hard selling.',
    badge: 'Executive Level',
    defaultMessage: `Hi team {{business_name}}, hope your week is off to a great start! We work with several premium business service clients in {{location}} and often get inquiries specifically looking for trusted {{tag}} recommendations.

Would love to connect briefly and see if there is potential synergy for cross-referring clients. Who is the best person on your team to chat with?`,
    followUpScript: `Great! What is your direct email so I can send our client referral guidelines over?`
  },
  {
    id: 'walkin_booster',
    name: '4. The Walk-In / Footfall Booster',
    category: 'footfall',
    hookType: 'Foot-Traffic Growth',
    description: 'Directly addresses footfall and local store/clinic appointment volume increases.',
    badge: 'Retail & Clinic Focus',
    defaultMessage: `Hey {{first_name}}! Noticed {{business_name}} is located in {{location}}. We recently helped a similar {{tag}} nearby generate an extra 35+ qualified walk-ins and phone bookings within 14 days without discounting prices.

Curious if you are looking to scale customer footfall this quarter?`,
    followUpScript: `Perfect! Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop the case study over to?`
  },
  {
    id: 'missed_inquiry_recovery',
    name: '5. The "Missed Inquiry Recovery" Hook',
    category: 'conversion',
    hookType: 'Response Speed Blind Spot',
    description: 'Highlights how slow weekend/after-hours response times leak qualified leads.',
    badge: 'High Conversion',
    defaultMessage: `Hi {{business_name}} team: quick observation: when potential customers message {{tag}} providers in {{location}} after 7 PM or on Sundays, 68% drop off if they don't get an immediate reply.

We built an automated 60-second booking bot for local businesses. Would you be open to a quick demo of how it works for {{business_name}}?`,
    followUpScript: `Sounds good! What is the best email address to send your interactive simulator link to?`
  },
  {
    id: 'seasonal_event',
    name: '6. The Special Event / Seasonal Hook',
    category: 'seasonal',
    hookType: 'Timely Holiday / Event Push',
    description: 'Capitalizes on upcoming seasonal surges, festivals, and month-end demand spikes.',
    badge: 'Time Sensitive',
    defaultMessage: `Hey {{first_name}}, with the upcoming festive season approaching in {{location}}, most {{tag}} brands are prepping their customer outreach campaigns right now.

We have a ready-to-deploy promotional outreach blueprint that generated 3x ROI for local businesses last season. Want me to send over the template?`,
    followUpScript: `Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop this blueprint over to?`
  },
  {
    id: 'review_growth',
    name: '7. The Direct Feedback / Review Growth Hook',
    category: 'reviews',
    hookType: 'Google Review Automation',
    description: 'Focuses on 5-star reputation building and automated customer feedback loops.',
    badge: 'Reputation & Trust',
    defaultMessage: `Hi {{first_name}}, love what you guys have built at {{business_name}}! You currently have a {{rating}} rating in {{location}}. 

We have an automated SMS/WhatsApp trigger that helps {{tag}} businesses safely cross 100+ five-star Google reviews from happy past clients in under 3 weeks. Would that be helpful for your team?`,
    followUpScript: `Super! What is the best email address to send the 1-click review trigger workflow to?`
  },
  {
    id: 'tech_stack_check',
    name: '8. The Quick Tech Stack Check',
    category: 'tech',
    hookType: 'Soft Qualification Question',
    description: 'A low-friction discovery question to qualify their current CRM or outreach software.',
    badge: 'Software Synergy',
    defaultMessage: `Hey {{business_name}} team! Quick tech question: are you currently using an automated CRM or pipeline tracker for managing inbound customer leads for {{business_name}}, or is everything handled manually on WhatsApp?

We just launched a streamlined system built specifically for {{tag}} in {{location}}.`,
    followUpScript: `Understood! What is your direct email so I can send over our 3-minute feature walkthrough?`
  },
  {
    id: 'audio_video_asset',
    name: '9. The Short Audio / Video Asset Hook',
    category: 'media',
    hookType: '60-Second Custom Teardown',
    description: 'Offers an ultra-customized 60-second video audit or voice asset created specifically for them.',
    badge: 'Hyper-Personalized',
    defaultMessage: `Hey {{first_name}}! Recorded a quick 60-second screen-share video showing 3 high-impact marketing tweaks for {{business_name}} in {{location}} that could immediately boost your inbound inquiries.

No pitch, just pure actionable ideas. Where should I send the video link?`,
    followUpScript: `Instead of cramming video files into messy WhatsApp chat history, what is the best email address to drop the private link over to?`
  },
  {
    id: 'direct_referral_network',
    name: '10. The Direct Referral / Local Network Hook',
    category: 'referral',
    hookType: 'Community Spotlight Networking',
    description: 'Invites them to be featured in an exclusive local business directory & referral network.',
    badge: 'Network Spotlight',
    defaultMessage: `Hello {{first_name}}, we are putting together an exclusive Spotlight Guide for top {{tag}} specialists serving the {{location}} area this quarter.

We would love to feature {{business_name}} as a recommended local partner. Is this the right number to coordinate with your marketing coordinator?`,
    followUpScript: `Awesome! What is the primary email address where we can send the publication preview and draft feature?`
  }
];

// Convenience-framing email capture bridge script
export const EMAIL_CAPTURE_BRIDGE_SCRIPT = `Instead of cramming files into messy WhatsApp chat history, what is the best email address to drop this over to?`;

// Curated Professional Media & Document Presets (Picture + PDF)
export const WHATSAPP_MEDIA_PRESETS: WhatsAppMediaPreset[] = [
  {
    id: 'executive_deck',
    title: 'Executive Pitch Deck & Credentials',
    badge: 'Enterprise',
    description: 'B2B company credentials, growth metrics infographic, and 6-page presentation deck.',
    image: {
      url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
      caption: 'LeadPulse Growth Analytics & Live Performance Overview',
      fileName: 'Executive_Analytics_Dashboard.jpg'
    },
    pdf: {
      url: 'https://leadpulse.io/assets/LeadPulse_Executive_Deck.pdf',
      fileName: 'LeadPulse_Executive_Deck.pdf',
      fileSize: '2.4 MB',
      pageCount: '6 pages'
    }
  },
  {
    id: 'growth_blueprint',
    title: 'Local Market Teardown & Case Study',
    badge: 'High Conversion',
    description: 'Geo-radius competition map, 14-day footfall case study, and personalized growth blueprint.',
    image: {
      url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80',
      caption: 'Local Search & Competitor Geo-Radius Mapping',
      fileName: 'Competitor_Gap_Analysis.png'
    },
    pdf: {
      url: 'https://leadpulse.io/assets/Local_Market_Growth_Blueprint.pdf',
      fileName: '{{business_name}}_Growth_Blueprint.pdf',
      fileSize: '1.8 MB',
      pageCount: '4 pages'
    }
  },
  {
    id: 'service_catalog',
    title: 'Service Catalog & ROI Rate Card',
    badge: 'Pricing & Menu',
    description: 'Full modular service portfolio, workflow diagram, and transparent ROI comparison.',
    image: {
      url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      caption: 'Automated Client Acquisition Workflow Architecture',
      fileName: 'Workflow_Architecture_Diagram.jpg'
    },
    pdf: {
      url: 'https://leadpulse.io/assets/LeadPulse_Service_Catalog.pdf',
      fileName: 'LeadPulse_Service_Catalog_2026.pdf',
      fileSize: '3.1 MB',
      pageCount: '8 pages'
    }
  }
];

