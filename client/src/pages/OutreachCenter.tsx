import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Mail, MessageCircle, MessageSquare, Send, CheckCircle2, 
  ChevronDown, Phone, Layout, Monitor, 
  Smartphone, Sparkles, Sliders, Edit3, ArrowRight,
  ShieldCheck, Tag, Search, Check, Loader2, ExternalLink, Key,
  Plus, Trash2, Upload, Wand2, Calendar,
  Image, FileText, Paperclip, Download, X, File, Eye, Copy
} from 'lucide-react';
import TemplateGalleryModal from '../components/TemplateGalleryModal';
import DispatchTrackerModal from '../components/DispatchTrackerModal';
import EmailProviderModal from '../components/EmailProviderModal';
import { EMAIL_TEMPLATES } from '../data/emailTemplates';
import type { TemplateId } from '../data/emailTemplates';
import { WHATSAPP_TEMPLATES, EMAIL_CAPTURE_BRIDGE_SCRIPT, WHATSAPP_MEDIA_PRESETS } from '../data/whatsappTemplates';
import type { WhatsAppTemplate, WhatsAppImageAttachment, WhatsAppPdfAttachment, WhatsAppMediaPreset } from '../data/whatsappTemplates';
import { useStore } from '../store/useStore';
import { alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';
import API_URL from '../config/api';

const OutreachCenter = () => {
  const { user, token, integrations, setUpgradeModalOpen, recordEmailDispatch, recordAiGeneration } = useStore();
  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');

  const defaultBookingHost = localStorage.getItem('strovr_booking_host') || localStorage.getItem('leadpulse_booking_host') || (typeof window !== 'undefined' ? `${window.location.origin}/appointments` : '/appointments');
  const calendarIntegration = integrations.find(i => (i.id === 'google-calendar' || i.id === 'calendly') && i.connected);
  const [bookingHostUrl, setBookingHostUrl] = useState<string>(
    calendarIntegration?.config?.appointmentScheduleUrl || calendarIntegration?.config?.bookingUrl || defaultBookingHost
  );
  const [bookingOnline, setBookingOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBookingStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/booking/status`, { 
          headers: { userid: user?._id },
          timeout: 3500 
        });
        if (res.data) {
          setBookingOnline(Boolean(res.data.isConnected !== false));
          if (res.data.publicUrl && !calendarIntegration?.config?.appointmentScheduleUrl) {
            setBookingHostUrl(res.data.publicUrl);
          }
        }
      } catch {
        setBookingOnline(true);
      }
    };
    checkBookingStatus();
  }, [user?._id, calendarIntegration]);

  const resolvedBookingUrl = bookingHostUrl;
  const resolvedCalendlyUrl = resolvedBookingUrl;
  const activeMailTransport = integrations.find(i => (i.id === 'gmail-workspace' || i.id === 'google_workspace' || i.id === 'resend' || i.id === 'resend_mailgun') && i.connected);
  const activeSmsTransport = integrations.find(i => i.id === 'twilio' && i.connected);
  
  // Template Studio State
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('one_column');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isProviderModalOpen, setIsProviderModalOpen] = useState(false);
  const [isSendingSingle, setIsSendingSingle] = useState(false);
  const [dispatchNotification, setDispatchNotification] = useState<{ message: string; previewUrl?: string } | null>(null);
  const [editorLayer, setEditorLayer] = useState<'content' | 'template'>('content');
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');

  // Connected Sending Mailbox State (Mail-App Architecture)
  const [connectedMailbox, setConnectedMailbox] = useState<any>(null);
  const [isLoadingMailbox, setIsLoadingMailbox] = useState(false);

  const fetchMailboxStatus = async () => {
    if (!user?._id) return;
    setIsLoadingMailbox(true);
    try {
      const headers: Record<string, string> = { userid: user._id };
      if (user.email) headers.useremail = user.email;
      const activeToken = token || useStore.getState().token;
      if (activeToken) headers.authorization = `Bearer ${activeToken}`;

      const res = await axios.get(`${API_URL}/api/outreach/mailbox`, {
        headers
      });
      if (res.data?.isConnected && res.data.mailbox) {
        setConnectedMailbox(res.data.mailbox);
      } else {
        setConnectedMailbox(null);
      }
    } catch (err) {
      console.error('Failed to fetch mailbox status:', err);
      setConnectedMailbox(null);
    } finally {
      setIsLoadingMailbox(false);
    }
  };

  useEffect(() => {
    fetchMailboxStatus();
  }, [user?._id]);

  // Active Template Data State (Variant A & Variant B)
  const [templateDataA, setTemplateDataA] = useState(EMAIL_TEMPLATES.one_column.defaultData);
  const [templateDataB, setTemplateDataB] = useState({
    ...EMAIL_TEMPLATES.one_column.defaultData,
    subject: 'Challenger Pitch: Quick growth proposal for {{business_name}}',
    preheader: 'Tailored strategy note for {{business_name}}',
    headline: 'High-Converting Variant B Proposition',
    ctaText: 'Claim Growth Slot'
  });
  const [isAbTesting, setIsAbTesting] = useState(false);
  const [activeVariant, setActiveVariant] = useState<'A' | 'B'>('A');

  // Dynamic templateData and setTemplateData accessor/mutators
  const templateData = (isAbTesting && activeVariant === 'B') ? templateDataB : templateDataA;
  const setTemplateData = (updater: any) => {
    if (isAbTesting && activeVariant === 'B') {
      setTemplateDataB(updater);
    } else {
      setTemplateDataA(updater);
    }
  };

  // WhatsApp Studio State (Variant A & Variant B)
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState<string>('local_compliment');
  const [whatsAppMessageA, setWhatsAppMessageA] = useState<string>(WHATSAPP_TEMPLATES[0].defaultMessage);
  const [whatsAppMessageB, setWhatsAppMessageB] = useState<string>(
    WHATSAPP_TEMPLATES[1]?.defaultMessage || WHATSAPP_TEMPLATES[0].defaultMessage
  );
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const whatsAppMessage = (isAbTesting && activeVariant === 'B') ? whatsAppMessageB : whatsAppMessageA;
  const setWhatsAppMessage = (updater: any) => {
    if (isAbTesting && activeVariant === 'B') {
      setWhatsAppMessageB(updater);
    } else {
      setWhatsAppMessageA(updater);
    }
  };

  // WhatsApp Rich Media & Document Attachments State (Picture + PDF)
  const [whatsAppImage, setWhatsAppImage] = useState<WhatsAppImageAttachment>({
    enabled: true,
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80',
    caption: 'Strovr Growth Analytics & Live Performance Overview',
    fileName: 'Executive_Analytics_Dashboard.jpg'
  });

  const [whatsAppPdf, setWhatsAppPdf] = useState<WhatsAppPdfAttachment>({
    enabled: true,
    url: 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf',
    fileName: '{{business_name}}_Growth_Blueprint.pdf',
    fileSize: '2.4 MB',
    pageCount: '6 pages'
  });

  // Universal Email Attachments State (Supported across all 10 Email Frameworks)
  const [emailAttachments, setEmailAttachments] = useState<Array<{
    id: string;
    fileName: string;
    fileSize: string;
    fileType: 'pdf' | 'image' | 'doc' | 'sheet';
    url: string;
    base64?: string;
    enabled: boolean;
  }>>([
    {
      id: 'email-att-1',
      fileName: '{{business_name}}_Growth_Blueprint.pdf',
      fileSize: '2.4 MB',
      fileType: 'pdf',
      url: 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf',
      enabled: true
    }
  ]);
  const emailFileInputRef = useRef<HTMLInputElement>(null);

  const [activeMediaPresetId, setActiveMediaPresetId] = useState<string>('executive_deck');
  const [copiedMediaLinks, setCopiedMediaLinks] = useState(false);

  // Template Styling Layer Settings
  const [templateStyling, setTemplateStyling] = useState({
    containerWidth: '600px',
    spacingPadding: '24px',
    accentColor: '#191716', // Dark Indigo
    borderRadius: '6px',
    showComplianceFooter: true
  });

  // Dynamic workspace profile fallback when the user hasn't harvested leads yet
  const workspaceProfileLead = {
    _id: 'workspace-profile',
    businessName: user?.company_name || (user?.name ? `${user.name} Workspace` : 'Your Target Prospect'),
    location: user?.target_audience || 'Target Market',
    category: user?.field_of_work || user?.niche || 'B2B Services',
    fieldOfWork: user?.field_of_work || user?.niche || 'B2B Services',
    firstName: user?.name ? user.name.split(' ')[0] : 'Partner',
    phone: '+1 (555) 019-2831',
    rating: '5.0',
    email: user?.email || 'contact@yourcompany.com'
  };

  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [selectedPreviewLead, setSelectedPreviewLead] = useState<any | null>(null);
  const previewLead = selectedPreviewLead || leadsList[0] || workspaceProfileLead;
  const setPreviewLead = (lead: any) => setSelectedPreviewLead(lead);
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [dropdownAlign, setDropdownAlign] = useState<'left' | 'right'>('right');
  const leadDropdownRef = useRef<HTMLDivElement>(null);
  const previewCardRef = useRef<HTMLDivElement>(null);

  // Toggle and dynamically calculate whether dropdown should anchor left or right
  const handleToggleLeadDropdown = () => {
    if (!isLeadDropdownOpen && leadDropdownRef.current && previewCardRef.current) {
      const btnRect = leadDropdownRef.current.getBoundingClientRect();
      const cardRect = previewCardRef.current.getBoundingClientRect();
      if (btnRect.right - 320 < cardRect.left + 8) {
        setDropdownAlign('left');
      } else {
        setDropdownAlign('right');
      }
    }
    setIsLeadDropdownOpen(prev => !prev);
  };

  // Re-check dropdown alignment on window resize or scroll when open
  useEffect(() => {
    const updateDropdownPosition = () => {
      if (leadDropdownRef.current && previewCardRef.current) {
        const btnRect = leadDropdownRef.current.getBoundingClientRect();
        const cardRect = previewCardRef.current.getBoundingClientRect();
        if (btnRect.right - 320 < cardRect.left + 8) {
          setDropdownAlign('left');
        } else {
          setDropdownAlign('right');
        }
      }
    };

    if (isLeadDropdownOpen) {
      updateDropdownPosition();
      window.addEventListener('resize', updateDropdownPosition);
      window.addEventListener('scroll', updateDropdownPosition, true);
      return () => {
        window.removeEventListener('resize', updateDropdownPosition);
        window.removeEventListener('scroll', updateDropdownPosition, true);
      };
    }
  }, [isLeadDropdownOpen]);

  const [selectedCalendarSlot, setSelectedCalendarSlot] = useState(0);

  // Fetch real leads from DB
  useEffect(() => {
    const fetchUserLeads = async () => {
      if (!user?._id && !user?.email) return;
      try {
        const res = await axios.get(`${API_URL}/api/leads`, {
          headers: { 
            userid: user?._id || '',
            useremail: user?.email || ''
          }
        });
        let rawLeads = Array.isArray(res.data) ? res.data : [];
        if (rawLeads.length === 0) {
          try {
            const raw = (user?.email && localStorage.getItem(`strovr_leads_cache_${user.email}`)) ||
                        (user?._id && localStorage.getItem(`strovr_leads_cache_${user._id}`));
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) rawLeads = parsed;
            }
          } catch {}
        }

        if (rawLeads.length > 0) {
          const mapped = rawLeads.map((l: any) => ({
            _id: l._id,
            businessName: l.businessName || 'Unnamed Business',
            location: l.location || user?.target_audience || 'Local Market',
            category: l.category || 'Local Business',
            fieldOfWork: l.category || 'Professional Services',
            firstName: l.businessName ? l.businessName.split(' ')[0] : 'Partner',
            phone: l.phone || '',
            rating: l.rating || '4.8',
            email: l.email || `contact@${(l.businessName || 'company').toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
          }));
          setLeadsList(mapped);
          setSelectedPreviewLead(mapped[0]);
        } else {
          setLeadsList([]);
          setSelectedPreviewLead(null);
        }
      } catch (err) {
        console.error('Failed to load leads for preview', err);
      }
    };
    fetchUserLeads();
  }, [user?._id]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leadDropdownRef.current && !leadDropdownRef.current.contains(e.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableLeads = leadsList;
  const filteredAvailableLeads = availableLeads.filter(l => 
    l.businessName.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
    l.location.toLowerCase().includes(leadSearchQuery.toLowerCase()) ||
    (l.category && l.category.toLowerCase().includes(leadSearchQuery.toLowerCase()))
  );

  const activeTemplateConfig = EMAIL_TEMPLATES[selectedTemplateId];

  // Select a new template from gallery
  const handleSelectTemplate = (id: TemplateId) => {
    setSelectedTemplateId(id);
    const def = EMAIL_TEMPLATES[id].defaultData;
    setTemplateDataA(def);
    setTemplateDataB({
      ...def,
      subject: `Alternative: ${def.subject || 'Growth inquiry for {{business_name}}'}`,
      preheader: `Exclusive proposition for {{business_name}}`,
      ctaText: 'Claim Growth Slot'
    });
  };

  const mergeTags = [
    '{{business_name}}', 
    '{{location}}', 
    '{{field_of_work}}', 
    '{{first_name}}',
    '{{phone}}',
    '{{tag}}',
    '{{rating}}',
    '{{booking_link}}'
  ];

  // AI Copilot State
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<'persuasive' | 'direct' | 'executive' | 'urgent'>('persuasive');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // File Upload Helper for Dynamic Catalog Products
  const handleProductImageUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      await alertDialog({
        title: 'File Too Large',
        message: 'Please select an image file smaller than 5MB.',
        variant: 'warning'
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const next = [...(templateData.products || [])];
      if (next[idx]) {
        next[idx].imageUrl = base64;
        setTemplateData({ ...templateData, products: next });
      }
    };
    reader.readAsDataURL(file);
  };

  // AI Auto-Compose Handler for Any Template
  const handleAiGenerate = async (customPrompt?: string) => {
    const promptToUse = customPrompt || aiPrompt;
    if (!promptToUse.trim()) return;

    // Monthly AI Copilot Quota Check
    const plan = (user?.plan || 'free').toLowerCase();
    const aiLimit = user?.ai_pitches_limit !== undefined ? user.ai_pitches_limit : (plan === 'pro' ? -1 : plan === 'basic' ? 250 : 5);
    const aiUsed = user?.ai_pitches_used || 0;
    if (aiLimit !== -1 && aiUsed >= aiLimit) {
      await alertDialog({
        title: 'Monthly AI Pitch Limit Reached',
        message: `You have used all ${aiLimit} AI pitch generations for your ${plan.toUpperCase()} tier this month. Upgrade to Basic (250/mo) or Pro (Unlimited) to continue composing pitches.`,
        variant: 'warning'
      });
      setUpgradeModalOpen(true);
      return;
    }

    setIsAiGenerating(true);
    setAiSuccessMessage(null);

    try {
      const headers: Record<string, string> = { userid: user?._id || '' };
      if (user?.email) headers.useremail = user.email;
      const activeToken = token || useStore.getState().token;
      if (activeToken) headers.authorization = `Bearer ${activeToken}`;

      const res = await axios.post(`${API_URL}/api/outreach/ai-generate`, {
        templateId: selectedTemplateId,
        prompt: promptToUse,
        tone: aiTone,
        niche: previewLead?.fieldOfWork || previewLead?.category,
        userBusinessName: user?.name || 'Strovr'
      }, {
        headers
      });

      if (res.data?.generatedData) {
        setTemplateData(prev => ({
          ...prev,
          ...res.data.generatedData
        }));
        recordAiGeneration();
        setAiSuccessMessage('✨ All template segments auto-composed with merge tags!');
        setTimeout(() => setAiSuccessMessage(null), 6000);
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        await alertDialog({
          title: 'Monthly AI Pitch Limit Reached',
          message: err.response.data?.error || `Monthly AI generation quota reached. Upgrade your plan to compose more pitches.`,
          variant: 'warning'
        });
        setUpgradeModalOpen(true);
        return;
      }
      console.warn('Backend AI endpoint failed, falling back to instant client AI synthesis:', err);
      // High-converting executive client-side synthesis
      const p = promptToUse.trim().toLowerCase();

      const isIntroOrCall = p.includes('call') || p.includes('15-minute') || p.includes('15 min') || 
                            p.includes('introductory') || p.includes('growth call') || p.includes('decision maker') ||
                            p.includes('meeting') || p.includes('discovery') || p.includes('chat') ||
                            p.includes('appointment') || p.includes('calendar') || p.includes('schedule') ||
                            p.includes('pipeline') || p.includes('book');

      const isAudit = p.includes('audit') || p.includes('review') || p.includes('analysis') || 
                      p.includes('benchmark') || p.includes('competitor') || p.includes('teardown') || p.includes('gap');

      const isDiscount = p.includes('discount') || p.includes('offer') || p.includes('deal') || 
                         p.includes('pilot') || p.includes('special') || p.includes('pricing') || p.includes('trial');

      const isDemo = p.includes('demo') || p.includes('software') || p.includes('platform') || 
                     p.includes('walkthrough') || p.includes('tool');

      let subject = `Quick 15-minute growth conversation for {{business_name}}`;
      let preheader = `Scaling pipeline and driving predictable revenue growth`;
      let headline = `Predictable Pipeline & Growth for {{business_name}}`;
      let subheadline = `Streamlining sales operations and connecting with high-value prospects.`;
      let body = '';
      let ctaText = 'Book 15-Min Growth Call';

      if (isIntroOrCall) {
        subject = `Quick 15-minute growth conversation for {{business_name}}`;
        preheader = `Scaling pipeline and driving predictable revenue growth`;
        headline = `Predictable Pipeline & Growth for {{business_name}}`;
        subheadline = `Streamlining sales operations and connecting with high-value prospects.`;
        body = `Are you looking to scale your pipeline and drive predictable revenue growth without the guesswork?\n\nWe help businesses streamline their sales operations and connect directly with high-value prospects. I would love to invite you to a quick 15-minute introductory growth call to share how we can tailor this for your team.\n\nFeel free to grab a quick slot that works best for you here: {{booking_link}}\n\nLooking forward to connecting!`;
        ctaText = 'Book 15-Min Growth Call';
      } else if (isAudit) {
        subject = `Complimentary Growth Audit & Benchmarks for {{business_name}}`;
        preheader = `Uncovering high-impact revenue leverage points`;
        headline = `Unlocking Hidden Revenue for {{business_name}}`;
        subheadline = `Data-backed acquisition and conversion benchmarks across {{location}}.`;
        body = `Are you getting the maximum return from your client acquisition channels in {{location}}?\n\nWe conducted a preliminary analysis on the local footprint of {{business_name}} and identified three actionable opportunities to accelerate qualified pipeline.\n\nI have compiled the full benchmarks and recommendations into a brief executive breakdown.\n\nFeel free to review your complimentary audit here: {{booking_link}}\n\nExcited to hear your thoughts!`;
        ctaText = 'View Free Growth Audit';
      } else if (isDiscount) {
        subject = `Exclusive Preferred Partner Terms for {{business_name}}`;
        preheader = `Reserved acquisition infrastructure for your team`;
        headline = `Accelerate Growth with Preferred Partner Access`;
        subheadline = `Dedicated pipeline acceleration for industry leaders in {{location}}.`;
        body = `Looking for an unfair advantage to scale customer acquisition this quarter without adding overhead?\n\nWe are rolling out an exclusive growth initiative for select leaders in {{location}}, delivering automated prospecting and verified decision-maker introductions on preferred terms.\n\nWe have reserved a dedicated pilot slot for {{business_name}}.\n\nReview the reserved terms and pick a convenient slot here: {{booking_link}}\n\nLooking forward to collaborating!`;
        ctaText = 'Claim Preferred Terms';
      } else if (isDemo) {
        subject = `Interactive Pipeline Walkthrough for {{business_name}}`;
        preheader = `Zero manual prospecting and verified inbox deliverability`;
        headline = `Automate Your Acquisition Pipeline`;
        subheadline = `Autonomous discovery and personalized multi-channel outreach.`;
        body = `How much time is your team spending every week on manual prospecting and lead research?\n\nOur autonomous platform discovers verified decision makers, validates real-time email deliverability, and orchestrates personalized outreach in minutes.\n\nI would love to walk you through a brief 10-minute live demonstration tailored to {{business_name}}.\n\nGrab a quick walkthrough slot that works best for you here: {{booking_link}}\n\nLooking forward to connecting!`;
        ctaText = 'Book Live Demo';
      } else {
        subject = `Strategic Growth Initiative for {{business_name}}`;
        preheader = `Predictable revenue growth and pipeline acceleration`;
        headline = `Scale Acquisition for {{business_name}} in {{location}}`;
        subheadline = `Connecting directly with verified high-value decision makers.`;
        body = `Are you looking to scale your pipeline and drive predictable revenue growth without the guesswork?\n\nWe help businesses streamline their sales operations and connect directly with high-value prospects across {{location}}. I would love to invite you to a quick 15-minute introductory growth call to share how we can tailor this for your team.\n\nFeel free to grab a quick slot that works best for you here: {{booking_link}}\n\nLooking forward to connecting!`;
        ctaText = 'Book 15-Min Growth Call';
      }

      const generated: any = {
        subject,
        preheader,
        headline,
        subheadline,
        body,
        ctaText,
        ctaUrl: resolvedBookingUrl,
        secondaryCtaText: 'View Growth Deck',
        secondaryCtaUrl: 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf'
      };

      if (selectedTemplateId === 'two_column' || selectedTemplateId === 'hybrid') {
        generated.col1Title = '15-Min Strategy Session';
        generated.col1Body = `Walk through tailored pipeline bottlenecks and revenue opportunities for {{business_name}}.`;
        generated.col1Cta = 'Reserve Strategy Slot';
        generated.col1CtaUrl = resolvedBookingUrl;
        generated.col2Title = 'Executive Briefing Deck';
        generated.col2Body = `Review our high-ticket conversion metrics and verified client case studies on your own schedule.`;
        generated.col2Cta = 'Download Executive Deck';
        generated.col2CtaUrl = 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf';
      } else if (selectedTemplateId === 'zig_zag') {
        generated.zig1Title = '1. Pipeline Scalability';
        generated.zig1Text = `Identify and connect with high-intent decision makers across {{location}} with zero scraping friction.`;
        generated.zig1Cta = 'Explore Discovery';
        generated.zig1CtaUrl = resolvedBookingUrl;
        generated.zig2Title = '2. Predictable Execution';
        generated.zig2Text = `Turn cold prospects into booked discovery calls with proven executive outreach frameworks.`;
        generated.zig2Cta = 'Book 15-Min Call';
        generated.zig2CtaUrl = resolvedBookingUrl;
      } else if (selectedTemplateId === 'f_pattern') {
        generated.fBullet1 = `Predictable Pipeline: Reach verified commercial decision makers across {{location}}.`;
        generated.fBullet2 = `Zero Guesswork: Streamline sales operations with automated, high-deliverability dispatch.`;
        generated.fBullet3 = `Tailored Growth: 15-minute introductory session focused entirely on {{business_name}}'s revenue goals.`;
        generated.fBottomNote = `Direct calendar booking link: {{booking_link}}`;
      } else if (selectedTemplateId === 'dynamic_product_feed') {
        generated.products = [
          {
            name: 'Starter Pipeline',
            category: 'Lead Discovery',
            price: '₹699 / mo',
            badge: 'Starter',
            imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
            description: `Get started with verified local prospects in {{location}}.`,
            ctaText: 'Select Starter',
            ctaUrl: resolvedBookingUrl
          },
          {
            name: 'Pro Multi-Channel Suite',
            category: 'Full Automation',
            price: '₹1,999 / mo',
            badge: 'Most Popular',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
            description: `Engage decision makers directly across Email and WhatsApp.`,
            ctaText: 'Select Pro',
            ctaUrl: resolvedBookingUrl
          },
          {
            name: 'Executive Partnership',
            category: 'Dedicated Scale',
            price: '₹4,999 / mo',
            badge: 'Enterprise',
            imageUrl: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format&fit=crop&q=80',
            description: `Full done-for-you pipeline scaling for {{business_name}}.`,
            ctaText: 'Select Enterprise',
            ctaUrl: resolvedBookingUrl
          }
        ];
      }

      setTemplateData(prev => ({ ...prev, ...generated }));
      recordAiGeneration();
      setAiSuccessMessage('✨ All template segments auto-composed with merge tags!');
      setTimeout(() => setAiSuccessMessage(null), 6000);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const insertTag = (tag: string) => {
    if (activeChannel === 'whatsapp') {
      setWhatsAppMessage(prev => prev + ' ' + tag);
    } else {
      setTemplateData(prev => ({
        ...prev,
        body: prev.body + ' ' + tag
      }));
    }
  };

  // Highlighting Renderer for text preview with merge tag styling
  const renderPreviewHtml = (text?: string) => {
    if (!text) return '';
    let rendered = text;
    const targetLead = previewLead || workspaceProfileLead || {
      businessName: 'Target Business',
      location: 'Local Market',
      fieldOfWork: 'B2B Services',
      category: 'B2B Services',
      firstName: 'Partner',
      phone: '+91 98765 43210',
      rating: '4.8'
    };
    const bName = targetLead.businessName || 'Target Business';
    const loc = targetLead.location || 'Local Market';
    const fow = targetLead.fieldOfWork || targetLead.category || 'B2B Services';
    const tag = targetLead.category || targetLead.fieldOfWork || 'B2B Services';
    const fName = targetLead.firstName || (targetLead.businessName ? targetLead.businessName.split(' ')[0] : 'Partner');
    const phone = targetLead.phone || '+91 98765 43210';
    const rating = targetLead.rating || '4.8';

    const senderName = user?.name || 'Workspace Operator';
    const senderEmail = user?.email || 'outreach@strovr.space';
    const senderCompany = user?.company_name || 'Strovr';

    rendered = rendered.replace(/{{business_name}}/g, `<span class="bg-amber-100 text-amber-900 font-bold px-1 rounded">${bName}</span>`);
    rendered = rendered.replace(/{{location}}/g, `<span class="bg-gray-100 text-accent font-bold px-1 rounded">${loc}</span>`);
    rendered = rendered.replace(/{{field_of_work}}/g, `<span class="bg-purple-100 text-accent font-bold px-1 rounded">${fow}</span>`);
    rendered = rendered.replace(/{{tag}}/g, `<span class="bg-purple-100 text-accent font-bold px-1 rounded">${tag}</span>`);
    rendered = rendered.replace(/{{first_name}}/g, `<span class="bg-gray-100 text-accent font-bold px-1 rounded">${fName}</span>`);
    rendered = rendered.replace(/{{phone}}/g, `<span class="bg-gray-200 text-gray-900 font-bold px-1 rounded">${phone}</span>`);
    rendered = rendered.replace(/{{rating}}/g, `<span class="bg-amber-100 text-amber-900 font-bold px-1 rounded">${rating}</span>`);
    rendered = rendered.replace(/{{(booking_link|calendly_link|appointment_link)}}/g, `<a href="${resolvedBookingUrl}" target="_blank" rel="noreferrer" class="bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-200 font-delight font-bold px-2 py-0.5 rounded underline inline-flex items-center gap-1 shadow-2xs"><span>Book an Appointment </span>↗</a>`);
    rendered = rendered.replace(/\[Link\]/g, `<a href="${resolvedBookingUrl}" target="_blank" rel="noreferrer" class="bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-200 font-delight font-bold px-2 py-0.5 rounded underline inline-flex items-center gap-1 shadow-2xs"><span>[Select 15-Min Slot]</span>↗</a>`);
    rendered = rendered.replace(/{{sender_name}}/g, `<span class="bg-blue-100 text-blue-900 font-bold px-1 rounded">${senderName}</span>`);
    rendered = rendered.replace(/{{user_name}}/g, `<span class="bg-blue-100 text-blue-900 font-bold px-1 rounded">${senderName}</span>`);
    rendered = rendered.replace(/{{sender_email}}/g, `<span class="bg-blue-100 text-blue-900 font-bold px-1 rounded">${senderEmail}</span>`);
    rendered = rendered.replace(/{{user_email}}/g, `<span class="bg-blue-100 text-blue-900 font-bold px-1 rounded">${senderEmail}</span>`);
    rendered = rendered.replace(/{{company_name}}/g, `<span class="bg-blue-100 text-blue-900 font-bold px-1 rounded">${senderCompany}</span>`);
    return rendered;
  };

  // WhatsApp Hook Selection Handler
  const handleSelectWhatsAppTemplate = (tpl: WhatsAppTemplate) => {
    setSelectedWhatsAppId(tpl.id);
    setWhatsAppMessage(tpl.defaultMessage);
    if (tpl.suggestedImage) {
      setWhatsAppImage(prev => ({
        ...prev,
        ...tpl.suggestedImage,
        enabled: true
      }));
    }
    if (tpl.suggestedPdf) {
      setWhatsAppPdf(prev => ({
        ...prev,
        ...tpl.suggestedPdf,
        enabled: true
      }));
    }
  };

  // Insert Email Capture Bridge Script
  const handleInsertBridgeScript = () => {
    setWhatsAppMessage(prev => prev + '\n\n' + EMAIL_CAPTURE_BRIDGE_SCRIPT);
  };

  // Apply Media Preset
  const handleApplyMediaPreset = (preset: WhatsAppMediaPreset) => {
    setActiveMediaPresetId(preset.id);
    setWhatsAppImage({
      enabled: true,
      url: preset.image.url,
      caption: preset.image.caption,
      fileName: preset.image.fileName
    });
    setWhatsAppPdf({
      enabled: true,
      url: preset.pdf.url,
      fileName: preset.pdf.fileName,
      fileSize: preset.pdf.fileSize,
      pageCount: preset.pdf.pageCount
    });
  };

  // Handle Image File Upload
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setWhatsAppImage({
            enabled: true,
            url: result,
            fileName: file.name,
            caption: whatsAppImage.caption || `Attached visual: ${file.name}`
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle PDF File Upload
  const handlePdfFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeStr = parseFloat(sizeMb) > 0.1 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`;
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        setWhatsAppPdf({
          enabled: true,
          url: result || `https://www.strovr.space/assets/${encodeURIComponent(file.name)}`,
          fileName: file.name,
          fileSize: sizeStr,
          pageCount: 'Doc'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // Copy Media Links Only
  const handleCopyMediaLinks = () => {
    const lines: string[] = [];
    if (whatsAppPdf.enabled && whatsAppPdf.url) {
      lines.push(`PDF Document (${whatsAppPdf.fileName}): ${whatsAppPdf.url}`);
    }
    if (whatsAppImage.enabled && whatsAppImage.url) {
      lines.push(`Image (${whatsAppImage.fileName || 'Visual'}): ${whatsAppImage.url}`);
    }
    if (lines.length > 0) {
      navigator.clipboard.writeText(lines.join('\n'));
      setCopiedMediaLinks(true);
      setTimeout(() => setCopiedMediaLinks(false), 2400);
    }
  };

  // Format Text for External Copy / Dispatch
  const getCompiledWhatsAppMessage = (lead: any) => {
    const targetLead = lead || previewLead || workspaceProfileLead || {};
    let msg = whatsAppMessage || '';
    const bName = targetLead.businessName || 'Business';
    const loc = targetLead.location || 'Local Area';
    const fow = targetLead.fieldOfWork || targetLead.category || 'Services';
    const tag = targetLead.category || targetLead.fieldOfWork || 'Services';
    const fName = targetLead.firstName || (targetLead.businessName ? targetLead.businessName.split(' ')[0] : 'Partner');
    const phone = targetLead.phone || '';
    const rating = targetLead.rating || '4.8';

    msg = msg.replace(/{{business_name}}/g, bName);
    msg = msg.replace(/{{location}}/g, loc);
    msg = msg.replace(/{{field_of_work}}/g, fow);
    msg = msg.replace(/{{tag}}/g, tag);
    msg = msg.replace(/{{first_name}}/g, fName);
    msg = msg.replace(/{{phone}}/g, phone);
    msg = msg.replace(/{{rating}}/g, rating);
    msg = msg.replace(/{{(booking_link|calendly_link|appointment_link)}}/g, `Book an Appointment : ${resolvedBookingUrl}`);

    // Append Media Attachments neatly (Safeguard: never embed giant data: base64 URLs in text or wa.me URLs)
    const mediaItems: string[] = [];
    if (whatsAppPdf?.enabled) {
      const cleanPdfName = String(whatsAppPdf.fileName || 'Overview.pdf').replace(/{{business_name}}/g, bName);
      if (whatsAppPdf.url && (whatsAppPdf.url.startsWith('http://') || whatsAppPdf.url.startsWith('https://'))) {
        mediaItems.push(`📄 *Document Attached:* ${cleanPdfName} (${whatsAppPdf.fileSize || 'PDF'})\n🔗 Access Link: ${whatsAppPdf.url}`);
      } else {
        mediaItems.push(`📄 *Document Attached:* ${cleanPdfName} (${whatsAppPdf.fileSize || 'PDF'}) [📎 File Attached in Strovr]`);
      }
    }
    if (whatsAppImage?.enabled) {
      const captionStr = whatsAppImage.caption ? ` (${whatsAppImage.caption})` : '';
      const cleanImgName = whatsAppImage.fileName || 'Visual Preview';
      if (whatsAppImage.url && (whatsAppImage.url.startsWith('http://') || whatsAppImage.url.startsWith('https://'))) {
        mediaItems.push(`🖼️ *Visual Preview:* ${cleanImgName}${captionStr}\n🔗 Access Link: ${whatsAppImage.url}`);
      } else {
        mediaItems.push(`🖼️ *Visual Preview:* ${cleanImgName}${captionStr} [📎 Visual Attached in Strovr]`);
      }
    }

    if (mediaItems.length > 0) {
      msg += `\n\n────────────────\n📎 *Attached Media & Deliverables:*\n\n` + mediaItems.join('\n\n');
    }

    return msg;
  };

  // Open Direct in WhatsApp Web
  const handleOpenWhatsAppWeb = async (lead: any) => {
    const targetLead = lead || previewLead || workspaceProfileLead;
    const cleanPhone = (targetLead?.phone || '').replace(/[^0-9]/g, '');
    
    if (!cleanPhone || cleanPhone.length < 7) {
      await alertDialog({
        title: 'Missing Phone Number',
        message: `No valid WhatsApp phone number was found for "${targetLead?.businessName || 'this prospect'}". Please set a valid contact number in the CRM or select a lead with a phone listing before launching WhatsApp Web.`,
        variant: 'warning'
      });
      return;
    }

    const rawText = getCompiledWhatsAppMessage(targetLead);
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(rawText)}`;
    window.open(url, '_blank');
  };

  // Copy WhatsApp Script
  const handleCopyWhatsApp = () => {
    const rawText = getCompiledWhatsAppMessage(previewLead);
    navigator.clipboard.writeText(rawText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2500);
  };

  // Email Attachment Presets
  const EMAIL_ATTACHMENT_PRESETS = [
    {
      id: 'deck',
      name: 'Executive Pitch Deck',
      fileName: '{{business_name}}_Executive_Deck.pdf',
      fileSize: '2.4 MB',
      fileType: 'pdf' as const,
      url: 'https://www.strovr.space/assets/Strovr_Executive_Deck.pdf'
    },
    {
      id: 'audit',
      name: 'Strategic Growth Audit',
      fileName: '{{business_name}}_Growth_Audit.pdf',
      fileSize: '1.8 MB',
      fileType: 'pdf' as const,
      url: 'https://www.strovr.space/assets/Strovr_Growth_Audit.pdf'
    },
    {
      id: 'casestudy',
      name: 'B2B Client ROI Case Study',
      fileName: 'B2B_Client_ROI_CaseStudy.pdf',
      fileSize: '3.1 MB',
      fileType: 'pdf' as const,
      url: 'https://www.strovr.space/assets/Strovr_Case_Study.pdf'
    },
    {
      id: 'pricing',
      name: 'Commercial Pricing & Scope',
      fileName: 'Commercial_Pricing_Sheet.pdf',
      fileSize: '950 KB',
      fileType: 'sheet' as const,
      url: 'https://www.strovr.space/assets/Strovr_Pricing_Sheet.pdf'
    }
  ];

  const handleEmailFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const sizeStr = parseFloat(sizeMb) > 0.1 ? `${sizeMb} MB` : `${Math.round(file.size / 1024)} KB`;

      let fileType: 'pdf' | 'image' | 'doc' | 'sheet' = 'pdf';
      const name = file.name.toLowerCase();
      if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')) {
        fileType = 'image';
      } else if (name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) {
        fileType = 'sheet';
      } else if (name.endsWith('.doc') || name.endsWith('.docx') || name.endsWith('.txt')) {
        fileType = 'doc';
      }

      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const base64Data = uploadEvent.target?.result as string;
        const newAttachment = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          fileName: file.name,
          fileSize: sizeStr,
          fileType,
          url: base64Data,
          base64: base64Data,
          enabled: true
        };
        setEmailAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleAddPresetAttachment = (preset: typeof EMAIL_ATTACHMENT_PRESETS[0]) => {
    const exists = emailAttachments.some(a => a.fileName === preset.fileName);
    if (exists) {
      setEmailAttachments(prev => prev.map(a => a.fileName === preset.fileName ? { ...a, enabled: true } : a));
      return;
    }
    const newAtt = {
      id: `preset-${preset.id}-${Date.now()}`,
      fileName: preset.fileName,
      fileSize: preset.fileSize,
      fileType: preset.fileType,
      url: preset.url,
      enabled: true
    };
    setEmailAttachments(prev => [...prev, newAtt]);
  };

  const handleRemoveAttachment = (id: string) => {
    setEmailAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleToggleAttachment = (id: string) => {
    setEmailAttachments(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  // Open in Webmail / External Email Client fallback
  const handleOpenWebmail = (lead: any) => {
    const to = lead.email || '';
    const subject = renderPreviewHtml(templateData.subject || 'Strategic Partnership Inquiry');
    const activeAtts = emailAttachments.filter(a => a.enabled);
    const attachmentNote = activeAtts.length > 0 
      ? `\n\n[Attached Collateral]\n${activeAtts.map(a => `• ${renderPreviewHtml(a.fileName)}: ${a.url}`).join('\n')}`
      : '';
    const body = `${renderPreviewHtml(templateData.headline || '')}\n\n${renderPreviewHtml(templateData.body || templateData.content || '')}${attachmentNote}\n\nBest regards,\n${user?.name || 'Growth Specialist'}\n${user?.company_name || ''}`;
    
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
  };

  // Direct Single Email Test Dispatcher
  const handleSendSingleTest = async () => {
    // Mailbox Connection Check
    if (!connectedMailbox) {
      await alertDialog({
        title: 'No Sending Mailbox Connected',
        message: 'To deliver real emails straight to prospect inboxes, connect your standard SMTP server credentials in Outbox settings, or click "Open Webmail" to compose directly.',
        variant: 'warning'
      });
      setIsProviderModalOpen(true);
      return;
    }

    // Email Quota Check
    const plan = (user?.plan || 'free').toLowerCase();
    const emailLimit = user?.emails_limit || (plan === 'pro' ? 5000 : plan === 'basic' ? 1500 : 50);
    const emailsSent = user?.emails_sent || 0;
    if (emailsSent + 1 > emailLimit) {
      await alertDialog({
        title: 'Monthly Email Quota Reached',
        message: `You have reached your monthly email dispatch cap (${emailsSent}/${emailLimit} sent). Upgrade to Basic (1,500/mo) or Pro (5,000+/mo) to continue dispatching.`,
        variant: 'warning'
      });
      setUpgradeModalOpen(true);
      return;
    }

    setIsSendingSingle(true);
    setDispatchNotification(null);
    try {
      const headers: Record<string, string> = { userid: user?._id || 'demo-user' };
      if (user?.email) headers.useremail = user.email;
      const activeToken = token || useStore.getState().token;
      if (activeToken) headers.authorization = `Bearer ${activeToken}`;

      const res = await axios.post(`${API_URL}/api/outreach/dispatch-single`, {
        templateId: selectedTemplateId,
        templateData,
        templateStyling,
        targetLead: previewLead,
        customRecipientEmail: previewLead.email,
        fromName: connectedMailbox?.fromName || user?.name || 'Workspace Operator',
        fromEmail: connectedMailbox?.fromEmail || connectedMailbox?.user || user?.email || 'outreach@strovr.space',
        attachments: emailAttachments.filter(a => a.enabled)
      }, {
        headers
      });

      if (res.data.success) {
        recordEmailDispatch(1);
        setDispatchNotification({
          message: `Direct test email dispatched to ${previewLead.businessName} via ${connectedMailbox.fromEmail || connectedMailbox.user}!`,
          previewUrl: res.data.result?.previewUrl
        });
      }
    } catch (err: any) {
      if (err?.response?.status === 403) {
        await alertDialog({
          title: 'Dispatch Limit Reached',
          message: err.response.data?.error || 'Monthly dispatch limit reached. Upgrade your plan to send more outreach.',
          variant: 'warning'
        });
        setUpgradeModalOpen(true);
        return;
      }
      console.error('Failed to send single test:', err);
      setDispatchNotification({
        message: `Failed to dispatch test: ${err?.response?.data?.error || err.message}`
      });
    } finally {
      setIsSendingSingle(false);
    }
  };

  return (
    <div className="flex w-full min-h-screen bg-[#FBFBFA] font-sans text-slate-900">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 bg-[#FBFBFA] relative">
        {/* Subtle ambient light gradient at the top */}
        <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-50/50 via-amber-50/20 to-transparent pointer-events-none" />

        <Header title="Multi-Channel Outreach & Email Template Studio" />

        <div className="p-6 sm:p-8 flex flex-col gap-6 min-h-0 relative z-10">
          
          {/* Dispatch Live Notification Banner */}
          {dispatchNotification && (
            <div className="p-4 rounded-xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-white shadow-sm flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-delight text-xs font-bold text-emerald-950">Direct Dispatch Status</div>
                  <div className="text-xs text-emerald-800/90 font-medium">{dispatchNotification.message}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dispatchNotification.previewUrl && (
                  <a 
                    href={dispatchNotification.previewUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-delight font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Inspect Delivered Inbox</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button 
                  onClick={() => setDispatchNotification(null)}
                  className="text-slate-500 hover:text-slate-800 text-xs font-delight font-medium px-2.5 py-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Architectural Transport & Scheduling Bar */}
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-4 text-xs font-delight">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Outbox:</span>
                {connectedMailbox ? (
                  <button
                    type="button"
                    onClick={() => setIsProviderModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-colors cursor-pointer"
                    title="Click to view SendGrid outbox settings"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{connectedMailbox.fromEmail || connectedMailbox.user}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">(SendGrid Web API)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsProviderModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/90 transition-colors cursor-pointer"
                    title="No SendGrid outbox connected. Click to configure."
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span>Outbox: Disconnected (SendGrid Setup Required)</span>
                    <span className="underline font-bold ml-0.5">+ Connect</span>
                  </button>
                )}
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2 text-slate-700">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{activeSmsTransport ? activeSmsTransport.name : 'Direct Web Bridge'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-6 min-h-0">
          
          {/* ======================================================== */}
          {/* LEFT: ARCHITECTURAL STUDIO COMPOSER                      */}
          {/* ======================================================== */}
          <div className="w-full xl:w-[50%] flex flex-col bg-white border border-slate-200/90 rounded-2xl overflow-hidden min-h-[750px] shadow-sm">
            
            {/* Channel Tabs & A/B Testing */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 gap-2">
              <div className="flex gap-1.5 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                <button 
                  onClick={() => setActiveChannel('email')}
                  className={`px-3.5 py-1.5 text-xs font-delight flex items-center gap-2 rounded-lg transition-all cursor-pointer ${
                    activeChannel === 'email' 
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-semibold shadow-xs shadow-indigo-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> 
                  <span>Email Studio</span>
                </button>
                <button 
                  onClick={() => setActiveChannel('whatsapp')}
                  className={`px-3.5 py-1.5 text-xs font-delight flex items-center gap-2 rounded-lg transition-all cursor-pointer ${
                    activeChannel === 'whatsapp' 
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold shadow-xs shadow-emerald-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> 
                  <span>WhatsApp API</span>
                </button>
                <button 
                  onClick={() => setActiveChannel('sms')}
                  className={`px-3.5 py-1.5 text-xs font-delight flex items-center gap-2 rounded-lg transition-all cursor-pointer ${
                    activeChannel === 'sms' 
                      ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold shadow-xs shadow-purple-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> 
                  <span>SMS Pathways</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const plan = (user?.plan || 'free').toLowerCase();
                    if (plan === 'free') {
                      await alertDialog({
                        title: 'A/B Split Testing Locked',
                        message: '50/50 A/B Split Testing is available on Basic (₹699/mo) and Pro (₹1,999/mo) tiers. Upgrade to test subject lines and email variants side-by-side.',
                        variant: 'info'
                      });
                      setUpgradeModalOpen(true);
                      return;
                    }
                    const next = !isAbTesting;
                    setIsAbTesting(next);
                    if (next) {
                      setActiveVariant('A');
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer font-delight text-xs ${
                    isAbTesting 
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold shadow-2xs' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                  }`}
                  title="Enable A/B split testing to compare Variant A and Variant B"
                >
                  <div className={`w-7 h-4 rounded-full relative transition-colors ${isAbTesting ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                    <div className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all ${isAbTesting ? 'left-3.5' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[11px] font-semibold">A/B Split</span>
                </button>
              </div>
            </div>

            {/* A/B Testing Variant Ribbon */}
            {isAbTesting && (
              <div className="px-4 py-2 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white border-b border-indigo-800/50 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-delight uppercase tracking-wider text-indigo-200 font-bold">Variant:</span>
                  <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-lg border border-white/15">
                    <button
                      type="button"
                      onClick={() => setActiveVariant('A')}
                      className={`px-3 py-1 rounded-md text-xs font-delight transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeVariant === 'A' 
                          ? 'bg-white text-indigo-950 font-bold shadow-xs' 
                          : 'text-indigo-200 hover:text-white'
                      }`}
                    >
                      <span>Variant A (50%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVariant('B')}
                      className={`px-3 py-1 rounded-md text-xs font-delight transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeVariant === 'B' 
                          ? 'bg-white text-indigo-950 font-bold shadow-xs' 
                          : 'text-indigo-200 hover:text-white'
                      }`}
                    >
                      <span>Variant B (50%)</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (activeChannel === 'email') {
                      setTemplateDataB({
                        ...templateDataA,
                        subject: `Alternative: ${templateDataA.subject || 'Growth inquiry for {{business_name}}'}`,
                        preheader: `Exclusive proposal for {{business_name}}`,
                        ctaText: 'Claim Priority Offer &rarr;'
                      });
                    } else {
                      setWhatsAppMessageB(whatsAppMessageA + "\n\nPS: Also wanted to share this alternative proposal.");
                    }
                    setActiveVariant('B');
                  }}
                  className="text-[11px] font-delight bg-white/15 hover:bg-white/25 text-white border border-white/20 px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 font-semibold"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>Clone A &rarr; B</span>
                </button>
              </div>
            )}

            {/* Email Template Selector Bar */}
            {activeChannel === 'email' && (
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="bg-gradient-to-r from-indigo-50/60 to-purple-50/40 hover:from-indigo-100/80 hover:to-purple-100/60 border border-indigo-200/80 text-indigo-950 px-3 py-1.5 rounded-lg text-xs font-delight font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs group"
                  >
                    <Layout className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-105 transition-transform" />
                    <span>{activeTemplateConfig.name}</span>
                    <span className="text-[10px] font-delight font-medium text-indigo-500 bg-white px-1.5 py-0.2 rounded-md border border-indigo-200/60">Change (8)</span>
                  </button>

                  <button
                    onClick={() => setIsProviderModalOpen(true)}
                    className={`border px-2.5 py-1.5 rounded-lg text-xs font-delight font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      connectedMailbox 
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100/70' 
                        : 'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                    }`}
                    title={connectedMailbox ? `Outbox: ${connectedMailbox.fromEmail || connectedMailbox.user} (SendGrid Web API)` : "No SendGrid Outbox Connected - Click to configure"}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${connectedMailbox ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span>Outbox: {connectedMailbox ? `${connectedMailbox.fromEmail || connectedMailbox.user}` : 'Disconnected (SendGrid Setup Required)'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Click-to-Use AI Email Copilot Trigger Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorLayer('content');
                      setIsCopilotOpen(prev => !prev);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-delight font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isCopilotOpen
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white border-transparent shadow-xs'
                        : 'bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-900 border-amber-200/80 shadow-2xs'
                    }`}
                  >
                    <Wand2 className={`w-3.5 h-3.5 ${isCopilotOpen ? 'text-white' : 'text-amber-600'}`} />
                    <span>AI Copilot</span>
                  </button>

                  {/* Two-Layer Architecture Switcher */}
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 text-xs font-delight">
                    <button
                      onClick={() => setEditorLayer('content')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        editorLayer === 'content' ? 'bg-white text-indigo-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setEditorLayer('template')}
                      className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                        editorLayer === 'template' ? 'bg-white text-indigo-900 font-bold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Style</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp Template Selector Bar */}
            {activeChannel === 'whatsapp' && (
              <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-delight">
                  <span className="text-slate-400 font-medium">Active Script:</span>
                  <span className="font-bold text-slate-900 bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {WHATSAPP_TEMPLATES.find(t => t.id === selectedWhatsAppId)?.name || '1. The Local Compliment Hook'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyWhatsApp}
                    className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-delight font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedWhatsApp ? 'Copied' : 'Copy Script'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenWhatsAppWeb(previewLead)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-delight font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs shadow-emerald-200"
                  >
                    <Send className="w-3 h-3" />
                    <span>WhatsApp Web</span>
                  </button>
                </div>
              </div>
            )}

            {/* Editor Body */}
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar flex flex-col space-y-4 bg-white">
              
              {/* WHATSAPP TAB VIEW */}
              {activeChannel === 'whatsapp' && (
                <div className="space-y-4">
                  {/* 10 Structured WhatsApp Hook Selector Pills */}
                  <div className="border border-slate-200/90 rounded-xl p-4 bg-gradient-to-b from-slate-50/50 to-white shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-delight font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Conversational Hook Frameworks</span>
                      </label>
                      <span className="text-[10px] font-delight font-medium text-slate-400">
                        {WHATSAPP_TEMPLATES.length} Proven Angles
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {WHATSAPP_TEMPLATES.map((tpl) => {
                        const isSelected = selectedWhatsAppId === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleSelectWhatsAppTemplate(tpl)}
                            className={`text-left p-3 rounded-xl border text-xs transition-all flex flex-col justify-between cursor-pointer ${
                              isSelected 
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-xs shadow-emerald-200' 
                                : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-slate-800 shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-delight font-bold truncate">{tpl.name}</span>
                              <span className={`text-[9px] font-delight font-bold px-1.5 py-0.2 rounded-full shrink-0 ml-1.5 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}>
                                {tpl.badge}
                              </span>
                            </div>
                            <span className={`text-[11px] font-medium line-clamp-1 ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                              {tpl.hookType}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Merge Tags & Message Body */}
                  <div className="border border-slate-200/90 rounded-xl overflow-hidden shadow-2xs bg-white">
                    <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                      <label className="text-xs font-delight font-bold text-slate-700">Message Script</label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {mergeTags.map((tag) => {
                          const isBooking = tag.includes('booking');
                          const isName = tag.includes('name');
                          const isLoc = tag.includes('location');
                          const colorClass = isBooking 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                            : isName
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                            : isLoc
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:border-slate-300';
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => insertTag(tag)}
                              className={`text-[10px] font-delight font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer shadow-2xs ${colorClass}`}
                            >
                              + {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <textarea 
                      rows={6}
                      value={whatsAppMessage}
                      onChange={(e) => setWhatsAppMessage(e.target.value)}
                      className="w-full p-4 text-xs font-sans outline-none leading-relaxed bg-white border-0 text-slate-800 placeholder:text-slate-400"
                    />
                  </div>

                  {/* Rich Media & Document Attachments (Picture + PDF Files) */}
                  <div className="border border-slate-200/90 rounded-xl p-4 bg-gradient-to-b from-slate-50/40 via-white to-slate-50/20 shadow-2xs space-y-4">
                    
                    {/* Header Strip */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                            <Paperclip className="w-3.5 h-3.5" />
                          </div>
                          <label className="text-xs font-delight font-bold text-slate-900">
                            Rich Media & Document Attachments
                          </label>
                          <span className="text-[10px] font-delight font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Picture + PDF
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Attach promotional pictures and PDF pitch decks or brochures to make your WhatsApp message look exceptionally neat and professional.
                        </p>
                      </div>

                      {/* Quick Presets & Actions */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleApplyMediaPreset(WHATSAPP_MEDIA_PRESETS[0])}
                          className="text-[10px] font-delight font-bold px-2.5 py-1 rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                          title="Load Executive Presentation & Analytics Deck"
                        >
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Load Pro Media Pack</span>
                        </button>

                        {(whatsAppImage.enabled || whatsAppPdf.enabled) && (
                          <button
                            type="button"
                            onClick={handleCopyMediaLinks}
                            className="text-[10px] font-delight font-semibold px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1"
                            title="Copy file links to clipboard"
                          >
                            {copiedMediaLinks ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
                            <span>{copiedMediaLinks ? 'Links Copied' : 'Copy Links'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Presets Quick-Select Chips */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                      <span className="text-[10px] font-delight font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                        Presets:
                      </span>
                      {WHATSAPP_MEDIA_PRESETS.map((preset) => {
                        const isCurrent = activeMediaPresetId === preset.id && whatsAppImage.enabled && whatsAppPdf.enabled;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleApplyMediaPreset(preset)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-delight font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                              isCurrent
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span>{preset.title}</span>
                            <span className="text-[9px] opacity-70 px-1 py-0.2 rounded bg-slate-100">
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Two Column Cards: Picture Asset (Left) + PDF Document (Right) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      
                      {/* CARD 1: PICTURE / IMAGE ATTACHMENT */}
                      <div className={`p-3.5 rounded-xl border transition-all ${
                        whatsAppImage.enabled 
                          ? 'bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-200/50' 
                          : 'bg-slate-50/70 border-slate-200 opacity-90'
                      }`}>
                        {/* Header & Toggle */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              whatsAppImage.enabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-200 text-slate-500'
                            }`}>
                              <Image className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-delight font-bold text-slate-900">Picture Attachment</div>
                              <div className="text-[10px] text-slate-400 font-medium">Image preview banner in chat</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setWhatsAppImage(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-delight font-bold transition-all cursor-pointer ${
                              whatsAppImage.enabled
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {whatsAppImage.enabled ? 'Attached' : '+ Attach'}
                          </button>
                        </div>

                        {/* When Image Enabled */}
                        {whatsAppImage.enabled ? (
                          <div className="space-y-2.5 text-xs">
                            {/* Preview Thumbnail */}
                            <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-900/5 flex items-center gap-3 p-2">
                              <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-200 shrink-0 border border-slate-300/80">
                                <img 
                                  src={whatsAppImage.url} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as any).src = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80';
                                  }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-delight font-bold text-slate-800 text-[11px] truncate">
                                  {whatsAppImage.fileName || 'Attached_Image.jpg'}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                  {whatsAppImage.caption || 'High-res image asset'}
                                </div>
                                <span className="inline-block text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-1 border border-emerald-100">
                                  Visual Ready
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setWhatsAppImage(prev => ({ ...prev, enabled: false }))}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove Picture"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Image Source Input */}
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">
                                Image URL / Source
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input 
                                  type="url"
                                  value={whatsAppImage.url}
                                  onChange={(e) => setWhatsAppImage({ ...whatsAppImage, url: e.target.value })}
                                  placeholder="https://example.com/image.jpg"
                                  className="flex-1 bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono outline-none focus:border-emerald-500"
                                />
                                <label className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md text-[11px] font-delight font-semibold text-slate-700 cursor-pointer transition-colors flex items-center gap-1 shrink-0">
                                  <Upload className="w-3 h-3" />
                                  <span>Upload</span>
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleImageFileUpload}
                                    className="hidden" 
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Caption Input */}
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">
                                Caption / Overlay Title
                              </label>
                              <input 
                                type="text"
                                value={whatsAppImage.caption || ''}
                                onChange={(e) => setWhatsAppImage({ ...whatsAppImage, caption: e.target.value })}
                                placeholder="e.g. Growth Analytics & Deliverability Metrics"
                                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-delight outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-center text-[11px] text-slate-400 font-delight">
                            Picture attachment disabled. Click "+ Attach" to include a visual graphic.
                          </div>
                        )}
                      </div>

                      {/* CARD 2: PDF DOCUMENT ATTACHMENT */}
                      <div className={`p-3.5 rounded-xl border transition-all ${
                        whatsAppPdf.enabled 
                          ? 'bg-white border-rose-300 shadow-xs ring-1 ring-rose-200/50' 
                          : 'bg-slate-50/70 border-slate-200 opacity-90'
                      }`}>
                        {/* Header & Toggle */}
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                              whatsAppPdf.enabled ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-200 text-slate-500'
                            }`}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-delight font-bold text-slate-900">PDF Document</div>
                              <div className="text-[10px] text-slate-400 font-medium">Native document card in chat</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setWhatsAppPdf(prev => ({ ...prev, enabled: !prev.enabled }))}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-delight font-bold transition-all cursor-pointer ${
                              whatsAppPdf.enabled
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {whatsAppPdf.enabled ? 'Attached' : '+ Attach'}
                          </button>
                        </div>

                        {/* When PDF Enabled */}
                        {whatsAppPdf.enabled ? (
                          <div className="space-y-2.5 text-xs">
                            {/* Document Preview Badge */}
                            <div className="relative rounded-lg border border-rose-200 bg-rose-50/40 p-2.5 flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-rose-500 text-white flex flex-col items-center justify-center shrink-0 shadow-2xs">
                                <FileText className="w-5 h-5" />
                                <span className="text-[7px] font-black uppercase leading-none mt-0.5">PDF</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-delight font-bold text-slate-900 text-[11px] truncate">
                                  {whatsAppPdf.fileName.replace(/{{business_name}}/g, previewLead.businessName) || 'Document.pdf'}
                                </div>
                                <div className="text-[10px] text-slate-500 font-medium mt-0.5 flex items-center gap-1.5">
                                  <span>{whatsAppPdf.pageCount || '6 pages'}</span>
                                  <span>•</span>
                                  <span className="font-semibold text-slate-700">{whatsAppPdf.fileSize || '2.4 MB'}</span>
                                  <span>•</span>
                                  <span className="text-rose-700 font-bold">Document</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setWhatsAppPdf(prev => ({ ...prev, enabled: false }))}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove PDF"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Document File Name Input */}
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">
                                File Name (Supports merge tags)
                              </label>
                              <input 
                                type="text"
                                value={whatsAppPdf.fileName}
                                onChange={(e) => setWhatsAppPdf({ ...whatsAppPdf, fileName: e.target.value })}
                                placeholder="e.g. {{business_name}}_Growth_Blueprint.pdf"
                                className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono outline-none focus:border-rose-500"
                              />
                            </div>

                            {/* PDF URL & Upload Button */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                              <div className="sm:col-span-8">
                                <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">
                                  Document Hosted URL
                                </label>
                                <input 
                                  type="url"
                                  value={whatsAppPdf.url}
                                  onChange={(e) => setWhatsAppPdf({ ...whatsAppPdf, url: e.target.value })}
                                  placeholder="https://www.strovr.space/deck.pdf"
                                  className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs font-mono outline-none focus:border-rose-500"
                                />
                              </div>

                              <div className="sm:col-span-4 flex flex-col justify-end">
                                <label className="w-full px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md text-[11px] font-delight font-semibold text-slate-700 cursor-pointer transition-colors flex items-center justify-center gap-1">
                                  <Upload className="w-3 h-3 text-slate-500" />
                                  <span>Upload PDF</span>
                                  <input 
                                    type="file" 
                                    accept=".pdf,application/pdf" 
                                    onChange={handlePdfFileUpload}
                                    className="hidden" 
                                  />
                                </label>
                              </div>
                            </div>

                            {/* Size & Pages */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">File Size</label>
                                <input 
                                  type="text"
                                  value={whatsAppPdf.fileSize}
                                  onChange={(e) => setWhatsAppPdf({ ...whatsAppPdf, fileSize: e.target.value })}
                                  placeholder="e.g. 2.4 MB"
                                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-rose-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">Page Count</label>
                                <input 
                                  type="text"
                                  value={whatsAppPdf.pageCount || ''}
                                  onChange={(e) => setWhatsAppPdf({ ...whatsAppPdf, pageCount: e.target.value })}
                                  placeholder="e.g. 6 pages"
                                  className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-rose-500"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-4 text-center text-[11px] text-slate-400 font-delight">
                            PDF attachment disabled. Click "+ Attach" to include a presentation or brochure.
                          </div>
                        )}
                      </div>

                    </div>

                  </div>

                  {/* Organic Email-Capture Bridge Feature */}
                  <div className="border border-emerald-200/80 rounded-xl p-4 bg-gradient-to-r from-emerald-50/40 via-teal-50/20 to-white flex items-center justify-between gap-3 shadow-2xs">
                    <div className="min-w-0">
                      <div className="text-xs font-delight font-bold text-emerald-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Organic Email-Capture Bridge</span>
                      </div>
                      <p className="text-[11px] text-emerald-800/80 truncate mt-0.5 font-medium">
                        "{EMAIL_CAPTURE_BRIDGE_SCRIPT}"
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertBridgeScript}
                      className="bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-delight font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                      + Append Bridge
                    </button>
                  </div>
                </div>
              )}

              {/* SMS TAB VIEW */}
              {activeChannel === 'sms' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs text-slate-600 flex items-center gap-2 font-delight">
                    <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>DLT registered SMS gateway enabled (160 chars / segment).</span>
                  </div>

                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200">
                      <label className="text-xs font-delight font-semibold text-[#191716]">SMS Dispatch Copy</label>
                    </div>
                    <textarea 
                      rows={6}
                      value={templateData.body}
                      onChange={(e) => setTemplateData({ ...templateData, body: e.target.value })}
                      className="w-full p-3.5 text-xs font-sans outline-none border-0"
                    />
                  </div>
                </div>
              )}

              {/* EMAIL CHANNEL VIEW */}
              {activeChannel === 'email' && (
                <>
                  {/* ======================================================== */}
                  {/* LAYER 1: CONTENT LAYER (Architectural Studio Sheet)      */}
                  {/* ======================================================== */}
                  {editorLayer === 'content' && (
                    <div className="space-y-4">
                      
                      {/* CLICK-TO-USE AI EMAIL COPILOT (Collapsed Trigger vs. Dedicated Card View) */}
                      {!isCopilotOpen ? (
                        <div
                          onClick={() => setIsCopilotOpen(true)}
                          className="group border border-indigo-200/80 hover:border-indigo-400 bg-gradient-to-r from-indigo-50/50 via-purple-50/20 to-white hover:from-indigo-50/70 hover:to-white rounded-2xl px-4 py-3.5 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-2xs shrink-0">
                              <Sparkles className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-delight font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                  AI Email Copilot
                                </span>
                                <span className="text-[9px] font-delight font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                  Auto-Fill Engine
                                </span>
                                <span className="text-[9px] font-delight font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                  {user?.ai_pitches_limit === -1 ? 'Unlimited' : `${Math.max(0, (user?.ai_pitches_limit ?? 5) - (user?.ai_pitches_used || 0))} Pitches Left`}
                                </span>
                                {aiSuccessMessage && (
                                  <span className="text-[10px] font-delight font-semibold text-emerald-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Populated
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-delight text-slate-500 truncate mt-0.5">
                                Click to launch autonomous copy synthesis for <span className="font-semibold text-slate-700">{previewLead.businessName}</span>
                              </p>
                            </div>
                          </div>

                          <span className="px-3.5 py-1.5 rounded-xl bg-white group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white border border-indigo-200 group-hover:border-indigo-600 text-xs font-delight font-bold transition-all shrink-0 shadow-2xs">
                            Open Studio &rarr;
                          </span>
                        </div>
                      ) : (
                        /* DEDICATED AI EMAIL COPILOT CARD VIEW (Bright Luminous Gradient + Delight Font) */
                        <div className="border border-indigo-200/90 rounded-2xl bg-white shadow-md overflow-hidden animate-in fade-in duration-150 font-delight">
                          {/* Card View Top Header */}
                          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white px-5 py-4 flex items-center justify-between gap-3 shadow-2xs">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
                                <Sparkles className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-white font-delight tracking-tight">
                                    AI Email Copilot
                                  </h4>
                                  <span className="text-[9px] font-delight uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold backdrop-blur-xs">
                                    Auto-Fill Engine
                                  </span>
                                  <span className="text-[9px] font-delight uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-100 font-semibold border border-emerald-400/30">
                                    {user?.ai_pitches_limit === -1 ? 'Unlimited Pitches' : `${Math.max(0, (user?.ai_pitches_limit ?? 5) - (user?.ai_pitches_used || 0))} / ${user?.ai_pitches_limit ?? 5} Left`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-indigo-100 font-delight mt-0.5">
                                  Synthesizing multi-block layout for <span className="text-white font-semibold">{previewLead.businessName}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsCopilotOpen(false)}
                              className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-delight font-semibold text-white transition-colors cursor-pointer"
                            >
                              Close &times;
                            </button>
                          </div>

                          {/* Card View Body - Architectural 3-Stage Matrix */}
                          <div className="p-4 space-y-4 bg-white">
                            {/* Stage 1: Voice & Tone Matrix (4 Selectable Cards) */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-slate-400">
                                  01 / Select Voice &amp; Tone Profile
                                </span>
                                <span className="text-[10px] font-delight text-slate-500">
                                  Active: <strong className="text-indigo-600 capitalize font-bold">{aiTone}</strong>
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[
                                  { id: 'persuasive', title: 'High-Converting', desc: 'ROI & value hook' },
                                  { id: 'direct', title: 'Direct & Concise', desc: 'Zero-fluff 3-line ask' },
                                  { id: 'executive', title: 'Executive B2B', desc: 'Boardroom authority' },
                                  { id: 'urgent', title: 'Time-Sensitive', desc: 'Priority slot offer' }
                                ].map((toneItem) => {
                                  const active = aiTone === toneItem.id;
                                  return (
                                    <button
                                      key={toneItem.id}
                                      type="button"
                                      onClick={() => setAiTone(toneItem.id as any)}
                                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer font-delight ${
                                        active
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                          : 'bg-slate-50/70 hover:bg-indigo-50/40 text-slate-800 border-slate-200 hover:border-indigo-200'
                                      }`}
                                    >
                                      <div className="text-xs font-bold font-delight truncate">{toneItem.title}</div>
                                      <div className={`text-[10px] font-delight mt-0.5 truncate ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                                        {toneItem.desc}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Stage 2: 1-Click Scenario Blueprints (Bento Tiles) */}
                            <div>
                              <span className="block text-[10px] font-delight font-bold uppercase tracking-wider text-slate-400 mb-2">
                                02 / Instant Campaign Blueprints (1-Click Auto-Fill)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {[
                                  { label: 'Cold B2B Intro', sub: 'Agency intro + free consult', prompt: 'Introduce our agency services to local business owners with a free consultation.' },
                                  { label: '15-Min Discovery', sub: 'Quick calendar booking ask', prompt: 'Book a 15-minute introductory growth call with decision makers.' },
                                  { label: '20% Partner Offer', sub: 'Limited weekly incentive', prompt: 'Offer an exclusive 20% discount on packages reserved this week.' },
                                  { label: 'Free Local Audit', sub: 'Competitor gap breakdown', prompt: 'Offer a complimentary local visibility audit and competitor gap analysis.' },
                                  { label: 'Service Catalog', sub: 'Tiered package showcase', prompt: 'Showcase our dynamic tiered service packages and pricing options.' }
                                ].map((chip, cIdx) => (
                                  <button
                                    key={cIdx}
                                    type="button"
                                    onClick={() => {
                                      setAiPrompt(chip.prompt);
                                      handleAiGenerate(chip.prompt);
                                    }}
                                    className="p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/20 text-left transition-all cursor-pointer group font-delight flex flex-col justify-between shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors font-delight">{chip.label}</span>
                                      <span className="text-[10px] text-slate-400 group-hover:text-indigo-600 font-delight">&rarr;</span>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-delight mt-0.5 truncate">{chip.sub}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Stage 3: Custom Directive Prompt & Action */}
                            <div className="pt-2 border-t border-slate-100 space-y-2.5">
                              <span className="block text-[10px] font-delight font-bold uppercase tracking-wider text-slate-400">
                                03 / Custom Campaign Objective
                              </span>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                  type="text"
                                  value={aiPrompt}
                                  onChange={(e) => setAiPrompt(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAiGenerate();
                                    }
                                  }}
                                  placeholder="Describe your offer or pitch angle in plain English..."
                                  className="flex-1 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none font-delight transition-all"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAiGenerate()}
                                  disabled={isAiGenerating || !aiPrompt.trim()}
                                  className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white text-xs font-delight font-bold px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                                >
                                  {isAiGenerating ? (
                                    <>
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      <span>Synthesizing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="w-3.5 h-3.5" />
                                      <span>Auto-Fill Template</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-delight text-slate-400">
                                  <span>Target Blocks:</span>
                                  {['Subject', 'Preheader', 'Headline', 'Body Copy', 'Primary CTA'].map(b => (
                                    <span key={b} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-delight font-medium">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                                {aiSuccessMessage && (
                                  <span className="text-[11px] font-delight font-semibold text-emerald-600 flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> {aiSuccessMessage}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* UNIFIED ARCHITECTURAL ENVELOPE SHEET (Subject, Preheader, Headline, Subheadline) */}
                      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
                        {/* Subject Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-1 sm:gap-3 bg-white hover:bg-slate-50/50 transition-colors">
                          <label className="w-28 shrink-0 text-xs font-delight font-bold text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>Subject Line</span>
                          </label>
                          <input 
                            type="text" 
                            value={templateData.subject}
                            onChange={(e) => setTemplateData({ ...templateData, subject: e.target.value })}
                            className="flex-1 text-xs font-sans font-medium text-slate-900 bg-transparent border-0 outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                            placeholder="e.g. Proposal for {{business_name}}"
                          />
                        </div>

                        {/* Preheader Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-1 sm:gap-3 bg-white hover:bg-slate-50/50 transition-colors">
                          <label className="w-28 shrink-0 text-xs font-delight font-bold text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                            <span>Preheader</span>
                          </label>
                          <input 
                            type="text" 
                            value={templateData.preheader || ''}
                            onChange={(e) => setTemplateData({ ...templateData, preheader: e.target.value })}
                            className="flex-1 text-xs font-sans text-slate-700 bg-transparent border-0 outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                            placeholder="e.g. Exclusive Partner Brief..."
                          />
                        </div>

                        {/* Primary Headline Row */}
                        {selectedTemplateId !== 'text_only' && (
                          <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-1 sm:gap-3 bg-white hover:bg-slate-50/50 transition-colors">
                            <label className="w-28 shrink-0 text-xs font-delight font-bold text-slate-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              <span>Headline</span>
                            </label>
                            <input 
                              type="text" 
                              value={templateData.headline}
                              onChange={(e) => setTemplateData({ ...templateData, headline: e.target.value })}
                              className="flex-1 text-xs font-sans font-medium text-slate-900 bg-transparent border-0 outline-none focus:ring-0 p-0"
                            />
                          </div>
                        )}

                        {/* Subheadline Row */}
                        {templateData.subheadline !== undefined && (
                          <div className="flex flex-col sm:flex-row sm:items-center px-4 py-3 gap-1 sm:gap-3 bg-white hover:bg-slate-50/50 transition-colors">
                            <label className="w-28 shrink-0 text-xs font-delight font-bold text-slate-600 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <span>Subheadline</span>
                            </label>
                            <input 
                              type="text" 
                              value={templateData.subheadline}
                              onChange={(e) => setTemplateData({ ...templateData, subheadline: e.target.value })}
                              className="flex-1 text-xs font-sans text-slate-700 bg-transparent border-0 outline-none focus:ring-0 p-0"
                            />
                          </div>
                        )}
                      </div>

                      {/* PITCH BODY & MERGE VARIABLES SHEET */}
                      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-delight font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                            <span>Message Body</span>
                          </span>
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {mergeTags.map(tag => {
                              const isBooking = tag.includes('booking');
                              const isName = tag.includes('name');
                              const isLoc = tag.includes('location');
                              const colorClass = isBooking 
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
                                : isName
                                ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300'
                                : isLoc
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:border-slate-300';
                              return (
                                <button 
                                  key={tag}
                                  type="button"
                                  onClick={() => insertTag(tag)}
                                  className={`text-[10px] font-delight font-semibold px-2 py-0.5 rounded-md border transition-all cursor-pointer shadow-2xs ${colorClass}`}
                                >
                                  + {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <textarea 
                          rows={7}
                          value={templateData.body}
                          onChange={(e) => setTemplateData({ ...templateData, body: e.target.value })}
                          className="w-full p-4 text-xs font-sans text-slate-800 border-0 outline-none focus:ring-0 leading-relaxed bg-white resize-y placeholder:text-slate-400"
                          placeholder="Compose your structured message copy..."
                        />
                      </div>

                      {/* PRIMARY CALL TO ACTION SHEET */}
                      {templateData.ctaText !== undefined && (
                        <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
                          <div className="px-4 py-2.5 bg-slate-50/80 flex items-center justify-between">
                            <span className="text-xs font-delight font-bold text-slate-800 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                              <span>Call to Action</span>
                            </span>
                            <span className="text-[10px] font-delight font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200/60">
                              Primary Button
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            <div className="flex items-center px-4 py-3 gap-2">
                              <label className="w-20 shrink-0 text-xs font-delight font-bold text-slate-500">Label</label>
                              <input 
                                type="text" 
                                value={templateData.ctaText}
                                onChange={(e) => setTemplateData({ ...templateData, ctaText: e.target.value })}
                                placeholder="Get in Touch / Claim Offer"
                                className="flex-1 text-xs font-sans font-semibold text-slate-900 bg-transparent border-0 outline-none p-0"
                              />
                            </div>
                            <div className="flex items-center px-4 py-3 gap-2">
                              <label className="w-14 shrink-0 text-xs font-delight font-bold text-slate-500">URL</label>
                              <input 
                                type="text" 
                                value={templateData.ctaUrl || ''}
                                onChange={(e) => setTemplateData({ ...templateData, ctaUrl: e.target.value })}
                                 placeholder="https://..."
                                className="flex-1 text-xs font-delight font-medium text-indigo-600 bg-transparent border-0 outline-none p-0"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Calendar Booking Card Editor */}
                      {(selectedTemplateId === 'interactive_calendar' || (selectedTemplateId === 'two_column' && templateData.timeSlots)) && (
                        <div className="space-y-4 p-4 bg-gradient-to-br from-indigo-50/40 via-white to-slate-50/60 border border-indigo-200/80 rounded-2xl shadow-xs">
                          <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
                            <h5 className="font-delight text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Interactive Booking Card Settings</span>
                            </h5>
                            <span className="text-[10px] font-delight font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                              <span>Google Calendar</span>
                            </span>
                          </div>

                          {/* Host Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-delight font-bold text-slate-600 mb-1">Host Name</label>
                              <input 
                                type="text"
                                placeholder="Host Name"
                                value={templateData.hostName || ''}
                                onChange={(e) => setTemplateData({ ...templateData, hostName: e.target.value })}
                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl p-2.5 text-xs font-delight font-medium outline-none transition-all shadow-2xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-delight font-bold text-slate-600 mb-1">Host Title</label>
                              <input 
                                type="text"
                                placeholder="Growth Director"
                                value={templateData.hostTitle || ''}
                                onChange={(e) => setTemplateData({ ...templateData, hostTitle: e.target.value })}
                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl p-2.5 text-xs font-delight font-medium outline-none transition-all shadow-2xs"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-delight font-bold text-slate-600 mb-1">Call Duration</label>
                              <input 
                                type="text"
                                placeholder="15 mins"
                                value={templateData.duration || ''}
                                onChange={(e) => setTemplateData({ ...templateData, duration: e.target.value })}
                                className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl p-2.5 text-xs font-delight font-medium outline-none transition-all shadow-2xs"
                              />
                            </div>
                          </div>

                          {/* Host Avatar URL */}
                          <div>
                            <label className="block text-[10px] font-delight font-bold text-slate-600 mb-1">Host Avatar Image URL</label>
                            <input 
                              type="text"
                              placeholder="https://images.unsplash.com/..."
                              value={templateData.hostAvatar || ''}
                              onChange={(e) => setTemplateData({ ...templateData, hostAvatar: e.target.value })}
                              className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl p-2.5 text-xs font-sans outline-none transition-all shadow-2xs"
                            />
                          </div>

                          {/* Interactive Time Slots */}
                          <div>
                            <label className="block text-[10px] font-delight font-bold text-slate-700 mb-1.5">Interactive Time Slots (Clickable Chips)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(templateData.timeSlots || []).map((slot: any, idx: number) => (
                                <div key={idx} className="p-2.5 bg-white border border-indigo-100 hover:border-indigo-200 rounded-xl flex items-center gap-2 shadow-2xs transition-all">
                                  <span className="text-[10px] font-bold text-indigo-500 w-5">#{idx + 1}</span>
                                  <input 
                                    type="text"
                                    value={slot.label}
                                    onChange={(e) => {
                                      const nextSlots = [...(templateData.timeSlots || [])];
                                      nextSlots[idx] = { ...nextSlots[idx], label: e.target.value };
                                      setTemplateData({ ...templateData, timeSlots: nextSlots });
                                    }}
                                    className="flex-1 text-xs font-delight font-medium text-slate-800 border-0 outline-none p-0 bg-transparent"
                                    placeholder="Slot Label"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Legacy Two Column Section Editors (Side-by-Side Dual Blocks) */}
                      {(selectedTemplateId === 'two_column' && !templateData.timeSlots) || selectedTemplateId === 'hybrid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="font-delight text-xs font-semibold text-slate-800">Column 1 Content & Action</h5>
                              <span className="text-[10px] font-delight font-medium text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded-xs">Option A</span>
                            </div>
                            <input 
                              type="text"
                              placeholder="Column 1 Title"
                              value={templateData.col1Title || ''}
                              onChange={(e) => setTemplateData({ ...templateData, col1Title: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            />
                            <textarea 
                              rows={2}
                              placeholder="Column 1 Copy"
                              value={templateData.col1Body || ''}
                              onChange={(e) => setTemplateData({ ...templateData, col1Body: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-sans outline-none focus:border-slate-400"
                            />
                            <div className="space-y-1.5 pt-1">
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600">Button 1 Label</label>
                                <input 
                                  type="text"
                                  placeholder="Col 1 Button Label"
                                  value={templateData.col1Cta || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, col1Cta: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600">Button 1 Destination URL</label>
                                <input 
                                  type="text"
                                  placeholder="https://yoursite.com/inbound"
                                  value={templateData.col1CtaUrl || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, col1CtaUrl: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="font-delight text-xs font-semibold text-slate-800">Column 2 Content & Action</h5>
                              <span className="text-[10px] font-delight font-medium text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded-xs">Option B</span>
                            </div>
                            <input 
                              type="text"
                              placeholder="Column 2 Title"
                              value={templateData.col2Title || ''}
                              onChange={(e) => setTemplateData({ ...templateData, col2Title: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            />
                            <textarea 
                              rows={2}
                              placeholder="Column 2 Copy"
                              value={templateData.col2Body || ''}
                              onChange={(e) => setTemplateData({ ...templateData, col2Body: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-sans outline-none focus:border-slate-400"
                            />
                            <div className="space-y-1.5 pt-1">
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600">Button 2 Label</label>
                                <input 
                                  type="text"
                                  placeholder="Col 2 Button Label"
                                  value={templateData.col2Cta || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, col2Cta: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-delight font-semibold text-slate-600">Button 2 Destination URL</label>
                                <input 
                                  type="text"
                                  placeholder="https://yoursite.com/outbound"
                                  value={templateData.col2CtaUrl || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, col2CtaUrl: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {/* Interactive ROI & Benchmark Editor */}
                      {(selectedTemplateId === 'interactive_roi' || (selectedTemplateId === 'zig_zag' && templateData.comparisonPulse)) && (
                        <div className="space-y-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h5 className="font-delight text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>Interactive Cost Benchmark & ROI Comparison</span>
                            </h5>
                            <span className="text-[10px] font-delight font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                              Value Audit
                            </span>
                          </div>

                          {/* Side-by-side Benchmark Inputs */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Legacy Side */}
                            <div className="p-3 bg-white border border-rose-200 rounded-md space-y-2">
                              <span className="text-[10px] font-delight font-bold text-rose-700 uppercase">Legacy Method / Competitor</span>
                              <input 
                                type="text"
                                placeholder="Method Title (e.g. Traditional Agency)"
                                value={templateData.comparisonCurrent?.title || ''}
                                onChange={(e) => setTemplateData({ 
                                  ...templateData, 
                                  comparisonCurrent: { ...(templateData.comparisonCurrent || {}), title: e.target.value } 
                                })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input 
                                  type="text"
                                  placeholder="Cost (e.g. ₹45,000 / mo)"
                                  value={templateData.comparisonCurrent?.monthlyCost || ''}
                                  onChange={(e) => setTemplateData({ 
                                    ...templateData, 
                                    comparisonCurrent: { ...(templateData.comparisonCurrent || {}), monthlyCost: e.target.value } 
                                  })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                                <input 
                                  type="text"
                                  placeholder="Time (e.g. 14 hrs/week)"
                                  value={templateData.comparisonCurrent?.timeSpent || ''}
                                  onChange={(e) => setTemplateData({ 
                                    ...templateData, 
                                    comparisonCurrent: { ...(templateData.comparisonCurrent || {}), timeSpent: e.target.value } 
                                  })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>

                            {/* Strovr Side */}
                            <div className="p-3 bg-white border border-emerald-300 rounded-md space-y-2">
                              <span className="text-[10px] font-delight font-bold text-emerald-700 uppercase">Strovr Autonomous Engine</span>
                              <input 
                                type="text"
                                placeholder="Pulse Title (e.g. Strovr Autonomous Engine)"
                                value={templateData.comparisonPulse?.title || ''}
                                onChange={(e) => setTemplateData({ 
                                  ...templateData, 
                                  comparisonPulse: { ...(templateData.comparisonPulse || {}), title: e.target.value } 
                                })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input 
                                  type="text"
                                  placeholder="Cost (e.g. ₹699 / mo)"
                                  value={templateData.comparisonPulse?.monthlyCost || ''}
                                  onChange={(e) => setTemplateData({ 
                                    ...templateData, 
                                    comparisonPulse: { ...(templateData.comparisonPulse || {}), monthlyCost: e.target.value } 
                                  })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                                <input 
                                  type="text"
                                  placeholder="Badge (e.g. 8.4x Lower CAC)"
                                  value={templateData.comparisonPulse?.badge || ''}
                                  onChange={(e) => setTemplateData({ 
                                    ...templateData, 
                                    comparisonPulse: { ...(templateData.comparisonPulse || {}), badge: e.target.value } 
                                  })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>
                          </div>

                          {/* 3 Metric Pills */}
                          <div>
                            <label className="block text-[10px] font-delight font-semibold text-slate-700 mb-1">Key ROI Highlight Counters</label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              {(templateData.roiMetrics || []).map((m: any, idx: number) => (
                                <div key={idx} className="p-2 bg-white border border-slate-200 rounded-md space-y-1">
                                  <input 
                                    type="text"
                                    value={m.metric}
                                    onChange={(e) => {
                                      const next = [...(templateData.roiMetrics || [])];
                                      next[idx] = { ...next[idx], metric: e.target.value };
                                      setTemplateData({ ...templateData, roiMetrics: next });
                                    }}
                                    className="w-full font-bold text-xs font-delight border-0 outline-none p-0 text-slate-900"
                                    placeholder="Metric (e.g. ₹44,301)"
                                  />
                                  <input 
                                    type="text"
                                    value={m.label}
                                    onChange={(e) => {
                                      const next = [...(templateData.roiMetrics || [])];
                                      next[idx] = { ...next[idx], label: e.target.value };
                                      setTemplateData({ ...templateData, roiMetrics: next });
                                    }}
                                    className="w-full text-[10px] text-slate-500 border-0 outline-none p-0"
                                    placeholder="Label"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Legacy Zig-Zag Section Editors */}
                      {selectedTemplateId === 'zig_zag' && !templateData.comparisonPulse && (
                        <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <h5 className="font-delight text-xs font-semibold text-slate-800">Alternating Story Blocks (Z-Pattern)</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 bg-white border border-slate-200 rounded-md space-y-2">
                              <span className="text-[10px] font-delight font-medium text-slate-500 uppercase">Step 01 Story Block</span>
                              <input 
                                type="text"
                                placeholder="Step 1 Title"
                                value={templateData.zig1Title || ''}
                                onChange={(e) => setTemplateData({ ...templateData, zig1Title: e.target.value })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                              <textarea 
                                rows={2}
                                placeholder="Step 1 Narrative"
                                value={templateData.zig1Text || ''}
                                onChange={(e) => setTemplateData({ ...templateData, zig1Text: e.target.value })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-sans outline-none focus:border-slate-400"
                              />
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <input 
                                  type="text"
                                  placeholder="Button Label"
                                  value={templateData.zig1Cta || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, zig1Cta: e.target.value })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                                <input 
                                  type="text"
                                  placeholder="https://yoursite.com/step1"
                                  value={templateData.zig1CtaUrl || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, zig1CtaUrl: e.target.value })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>

                            <div className="p-3 bg-white border border-slate-200 rounded-md space-y-2">
                              <span className="text-[10px] font-delight font-medium text-slate-500 uppercase">Step 02 Story Block</span>
                              <input 
                                type="text"
                                placeholder="Step 2 Title"
                                value={templateData.zig2Title || ''}
                                onChange={(e) => setTemplateData({ ...templateData, zig2Title: e.target.value })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                              <textarea 
                                rows={2}
                                placeholder="Step 2 Narrative"
                                value={templateData.zig2Text || ''}
                                onChange={(e) => setTemplateData({ ...templateData, zig2Text: e.target.value })}
                                className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-sans outline-none focus:border-slate-400"
                              />
                              <div className="grid grid-cols-2 gap-1.5 pt-1">
                                <input 
                                  type="text"
                                  placeholder="Button Label"
                                  value={templateData.zig2Cta || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, zig2Cta: e.target.value })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                                <input 
                                  type="text"
                                  placeholder="https://yoursite.com/step2"
                                  value={templateData.zig2CtaUrl || ''}
                                  onChange={(e) => setTemplateData({ ...templateData, zig2CtaUrl: e.target.value })}
                                  className="w-full border border-slate-200 rounded-md p-1.5 text-xs font-delight font-medium outline-none focus:border-slate-400"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* F-Pattern Editorial Points */}
                      {selectedTemplateId === 'f_pattern' && (
                        <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <h5 className="font-delight text-xs font-semibold text-slate-800">F-Pattern Editorial Scan Bullet Points</h5>
                          <input 
                            type="text" 
                            value={templateData.fBullet1 || ''}
                            onChange={(e) => setTemplateData({ ...templateData, fBullet1: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            placeholder="Bullet 1"
                          />
                          <input 
                            type="text" 
                            value={templateData.fBullet2 || ''}
                            onChange={(e) => setTemplateData({ ...templateData, fBullet2: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            placeholder="Bullet 2"
                          />
                          <input 
                            type="text" 
                            value={templateData.fBullet3 || ''}
                            onChange={(e) => setTemplateData({ ...templateData, fBullet3: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            placeholder="Bullet 3"
                          />
                          <input 
                            type="text" 
                            value={templateData.fBottomNote || ''}
                            onChange={(e) => setTemplateData({ ...templateData, fBottomNote: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                            placeholder="Bottom Summary Callout Note"
                          />
                        </div>
                      )}

                      {/* Dynamic Product Feed Grid Editor */}
                      {selectedTemplateId === 'dynamic_product_feed' && templateData.products && (
                        <div className="space-y-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                            <div>
                              <h5 className="font-delight text-xs font-semibold text-slate-900 flex items-center gap-2">
                                <span>Dynamic Product & Catalog Grid</span>
                                <span className="text-[10px] font-delight font-medium bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-xs">
                                  {templateData.products.length} {templateData.products.length === 1 ? 'Item' : 'Catalog Items'}
                                </span>
                              </h5>
                              <p className="text-[11px] text-slate-500 mt-0.5">Attach custom pictures, badges, descriptions, and catalog offerings.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextIndex = (templateData.products?.length || 0) + 1;
                                const sampleImages = [
                                  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
                                  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
                                  'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=600&auto=format&fit=crop&q=80'
                                ];
                                const randomImg = sampleImages[(nextIndex - 1) % sampleImages.length];
                                const newProduct = {
                                  name: `Catalog Item ${nextIndex}`,
                                  category: 'Service Package',
                                  price: '₹1,299 / mo',
                                  badge: 'New',
                                  imageUrl: randomImg,
                                  description: 'Targeted client acquisition with automated outreach.',
                                  ctaText: 'Select Plan',
                                  ctaUrl: 'https://www.strovr.space/order'
                                };
                                setTemplateData({
                                  ...templateData,
                                  products: [...templateData.products!, newProduct]
                                });
                              }}
                              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-delight font-medium px-2.5 py-1.5 rounded-md shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-900"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Item</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {templateData.products.map((p, idx) => (
                              <div key={idx} className="p-3 bg-white border border-slate-200 rounded-md space-y-2 text-xs shadow-xs relative">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                  <span className="font-delight text-[11px] font-semibold text-slate-700">
                                    Item #{idx + 1}
                                  </span>
                                  {templateData.products!.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = templateData.products!.filter((_, i) => i !== idx);
                                        setTemplateData({ ...templateData, products: next });
                                      }}
                                      className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                      title="Remove item"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>

                                {/* Upload Picture */}
                                <div>
                                  <label className="block text-[10px] font-delight font-semibold text-slate-500 mb-1 flex items-center justify-between">
                                    <span className="flex items-center gap-1">
                                      <Upload className="w-3 h-3 text-slate-600" />
                                      <span>Upload Picture</span>
                                    </span>
                                    {p.imageUrl && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = [...templateData.products!];
                                          next[idx].imageUrl = '';
                                          setTemplateData({ ...templateData, products: next });
                                        }}
                                        className="text-[10px] text-rose-600 hover:underline font-delight font-medium cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </label>
                                  
                                  {p.imageUrl ? (
                                    <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-md">
                                      <div className="w-10 h-10 rounded-sm border border-slate-200 overflow-hidden shrink-0 bg-white shadow-xs">
                                        <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <label className="inline-flex items-center gap-1 text-[10px] font-delight font-semibold text-slate-700 hover:text-slate-900 underline cursor-pointer">
                                          <Upload className="w-3 h-3" />
                                          <span>Change</span>
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden" 
                                            onChange={(e) => handleProductImageUpload(idx, e)} 
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  ) : (
                                    <label className="border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-md p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors text-center">
                                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                                      <span className="text-[10px] font-delight font-semibold text-slate-700">Click to Upload (Max 5MB)</span>
                                      <input 
                                        type="file" 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handleProductImageUpload(idx, e)} 
                                      />
                                    </label>
                                  )}
                                </div>

                                {/* Product Name */}
                                <div>
                                  <label className="block text-[10px] font-delight font-semibold text-slate-500">Name</label>
                                  <input 
                                    type="text" 
                                    value={p.name}
                                    onChange={(e) => {
                                      const next = [...templateData.products!];
                                      next[idx].name = e.target.value;
                                      setTemplateData({ ...templateData, products: next });
                                    }}
                                    className="w-full font-delight font-medium border border-slate-200 rounded-md p-1 text-xs outline-none focus:border-slate-400"
                                    placeholder="e.g. Starter Package"
                                  />
                                </div>

                                {/* Category & Badge */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-delight font-semibold text-slate-500">Tag</label>
                                    <input 
                                      type="text" 
                                      value={p.category || ''}
                                      onChange={(e) => {
                                        const next = [...templateData.products!];
                                        next[idx].category = e.target.value;
                                        setTemplateData({ ...templateData, products: next });
                                      }}
                                      placeholder="Category"
                                      className="w-full border border-slate-200 rounded-md p-1 text-[11px] font-delight font-medium outline-none focus:border-slate-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-delight font-semibold text-slate-500">Badge</label>
                                    <input 
                                      type="text" 
                                      value={p.badge || ''}
                                      onChange={(e) => {
                                        const next = [...templateData.products!];
                                        next[idx].badge = e.target.value;
                                        setTemplateData({ ...templateData, products: next });
                                      }}
                                      placeholder="Badge"
                                      className="w-full border border-slate-200 rounded-md p-1 text-[11px] font-delight font-medium outline-none focus:border-slate-400"
                                    />
                                  </div>
                                </div>

                                {/* Price & Button Text */}
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-delight font-semibold text-slate-500">Price</label>
                                    <input 
                                      type="text" 
                                      value={p.price}
                                      onChange={(e) => {
                                        const next = [...templateData.products!];
                                        next[idx].price = e.target.value;
                                        setTemplateData({ ...templateData, products: next });
                                      }}
                                      className="w-full font-delight font-medium text-slate-900 border border-slate-200 rounded-md p-1 text-[11px] outline-none focus:border-slate-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-delight font-semibold text-slate-500">Button</label>
                                    <input 
                                      type="text" 
                                      value={p.ctaText || 'Select'}
                                      onChange={(e) => {
                                        const next = [...templateData.products!];
                                        next[idx].ctaText = e.target.value;
                                        setTemplateData({ ...templateData, products: next });
                                      }}
                                      className="w-full border border-slate-200 rounded-md p-1 text-[11px] font-delight font-medium outline-none focus:border-slate-400"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-[10px] font-delight font-semibold text-slate-500">Action URL</label>
                                  <input 
                                    type="text" 
                                    value={p.ctaUrl || 'https://'}
                                    onChange={(e) => {
                                      const next = [...templateData.products!];
                                      next[idx].ctaUrl = e.target.value;
                                      setTemplateData({ ...templateData, products: next });
                                    }}
                                    className="w-full border border-slate-200 rounded-md p-1 text-[11px] font-delight font-medium outline-none focus:border-slate-400"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* UNIVERSAL EMAIL ATTACHMENTS & DECKS (ALL 10 LAYOUTS)      */}
                      {/* ======================================================== */}
                      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-50 border border-indigo-200/70 flex items-center justify-center text-indigo-700">
                              <Paperclip className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <span className="text-xs font-delight font-bold text-slate-800 flex items-center gap-1.5">
                                <span>Email Attachments &amp; Decks</span>
                                <span className="text-[10px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.2 rounded border border-indigo-200/60">
                                  All Layouts
                                </span>
                              </span>
                              <p className="text-[10px] text-slate-500 font-sans">
                                Attach collateral (PDF decks, audits, case studies, pricing) dispatched with every outbound email.
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <input 
                              type="file" 
                              ref={emailFileInputRef}
                              onChange={handleEmailFileUpload}
                              multiple
                              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv"
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => emailFileInputRef.current?.click()}
                              className="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-delight font-semibold px-2.5 py-1.5 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-900"
                              title="Upload custom attachment from your computer"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Upload File</span>
                            </button>
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Quick B2B Presets */}
                          <div>
                            <span className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                              Quick B2B Presets:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {EMAIL_ATTACHMENT_PRESETS.map((preset) => {
                                const isAdded = emailAttachments.some(a => a.fileName === preset.fileName && a.enabled);
                                return (
                                  <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleAddPresetAttachment(preset)}
                                    className={`text-[10px] font-delight font-semibold px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                                      isAdded 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                  >
                                    {isAdded ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Plus className="w-2.5 h-2.5 text-slate-500" />}
                                    <span>{preset.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* List of Attachments */}
                          {emailAttachments.length === 0 ? (
                            <div className="text-center py-5 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                              <Paperclip className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
                              <p className="text-xs font-delight font-medium text-slate-600">No collateral attached yet</p>
                              <p className="text-[10px] text-slate-400">Upload a file or choose a quick B2B preset above.</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {emailAttachments.map((att) => {
                                const badgeColor = att.fileType === 'pdf' 
                                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                  : att.fileType === 'image'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : att.fileType === 'sheet'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200';

                                return (
                                  <div 
                                    key={att.id} 
                                    className={`p-3 rounded-xl border transition-all ${
                                      att.enabled 
                                        ? 'bg-white border-slate-200/90 shadow-2xs' 
                                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleAttachment(att.id)}
                                          className={`w-4 h-4 rounded flex items-center justify-center transition-colors cursor-pointer border ${
                                            att.enabled 
                                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                                              : 'bg-white border-slate-300 text-transparent'
                                          }`}
                                          title={att.enabled ? 'Click to disable' : 'Click to enable'}
                                        >
                                          <Check className="w-3 h-3 stroke-[3]" />
                                        </button>
                                        <span className={`text-[9px] font-delight font-extrabold uppercase px-1.5 py-0.2 rounded border ${badgeColor}`}>
                                          {att.fileType.toUpperCase()}
                                        </span>
                                        <span className="text-[11px] font-sans text-slate-500 font-medium">
                                          {att.fileSize}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {att.url && (
                                          <a
                                            href={att.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
                                            title="View attachment"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveAttachment(att.id)}
                                          className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                          title="Remove attachment"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[10px] font-delight font-semibold text-slate-500 mb-1">
                                        File Name (Merge tags supported: <span className="font-mono text-indigo-600">&#123;&#123;business_name&#125;&#125;</span>)
                                      </label>
                                      <input 
                                        type="text" 
                                        value={att.fileName}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setEmailAttachments(prev => prev.map(a => a.id === att.id ? { ...a, fileName: val } : a));
                                        }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-delight font-medium text-slate-900 outline-none focus:border-slate-400 focus:bg-white transition-all"
                                        placeholder="e.g. {{business_name}}_Growth_Blueprint.pdf"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* LAYER 2: TEMPLATE LAYER (Spacing, Width, Colors, Footer) */}
                  {/* ======================================================== */}
                  {editorLayer === 'template' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div>
                        <h4 className="text-xs font-delight font-semibold text-slate-900 mb-0.5">Layout & Responsive Geometry</h4>
                        <p className="text-[11px] text-slate-500">Configure global container parameters for all screen viewports.</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-delight font-semibold text-slate-700 mb-1">Container Width</label>
                          <select 
                            value={templateStyling.containerWidth}
                            onChange={(e) => setTemplateStyling({ ...templateStyling, containerWidth: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs font-delight font-normal outline-none"
                          >
                            <option value="540px">Compact (540px)</option>
                            <option value="600px">Standard Industry (600px)</option>
                            <option value="660px">Wide Editorial (660px)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-delight font-semibold text-slate-700 mb-1">Inner Padding</label>
                          <select 
                            value={templateStyling.spacingPadding}
                            onChange={(e) => setTemplateStyling({ ...templateStyling, spacingPadding: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-md p-2 text-xs font-delight font-normal outline-none"
                          >
                            <option value="16px">Compact Padding (16px)</option>
                            <option value="24px">Balanced Padding (24px)</option>
                            <option value="32px">Spacious Padding (32px)</option>
                          </select>
                        </div>
                      </div>

                      {/* Brand Accent Color */}
                      <div>
                        <label className="block text-xs font-delight font-bold text-slate-700 mb-2">Brand Accent Tone</label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { name: 'Dark Indigo', val: '#191716' },
                            { name: 'Electric Indigo', val: '#4F46E5' },
                            { name: 'Warm Indigo', val: '#C85A32' },
                            { name: 'Ice Blue', val: '#C7D2FE' },
                            { name: 'Pure White', val: '#FFFFFF' },
                            { name: 'Emerald', val: '#10B981' }
                          ].map((col) => (
                            <button
                              key={col.val}
                              type="button"
                              onClick={() => setTemplateStyling({ ...templateStyling, accentColor: col.val })}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-delight font-semibold border transition-all cursor-pointer ${
                                templateStyling.accentColor === col.val 
                                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs' 
                                  : 'border-slate-200 bg-white hover:border-indigo-300 text-slate-700'
                              }`}
                            >
                              <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs" style={{ backgroundColor: col.val }} />
                              <span>{col.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CAN-SPAM Deliverability Footer Guard */}
                      <div className="p-4 bg-gradient-to-r from-emerald-50/50 via-teal-50/20 to-white border border-emerald-200/80 rounded-2xl flex items-center justify-between shadow-2xs">
                        <div>
                          <div className="flex items-center gap-2 text-emerald-950 font-delight font-bold text-xs mb-0.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Mandatory Unsubscribe Compliance Footer</span>
                          </div>
                          <p className="text-[11px] text-emerald-800/80 font-medium">
                            Enforces CAN-SPAM and GDPR legal opt-out links on every outbound email automatically.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={templateStyling.showComplianceFooter}
                          onChange={(e) => setTemplateStyling({ ...templateStyling, showComplianceFooter: e.target.checked })}
                          className="w-4 h-4 accent-emerald-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-white/90 backdrop-blur-xs flex flex-col sm:flex-row items-center justify-between gap-3 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px] font-delight font-medium text-slate-600">
                  {activeChannel === 'whatsapp' ? 'WhatsApp wa.me API Bridge Active' : 'Direct SMTP Socket Transport Ready'}
                </span>
              </div>
              
              {activeChannel === 'whatsapp' ? (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                  {(whatsAppImage.enabled || whatsAppPdf.enabled) && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-delight font-bold">
                      <Paperclip className="w-3 h-3 text-emerald-600" />
                      <span>{whatsAppImage.enabled && whatsAppPdf.enabled ? 'Picture + PDF Ready' : whatsAppImage.enabled ? 'Picture Ready' : 'PDF Ready'}</span>
                    </span>
                  )}
                  {(whatsAppImage.enabled || whatsAppPdf.enabled) && (
                    <button 
                      onClick={handleCopyMediaLinks}
                      className="bg-white border border-slate-200 hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-delight font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Copy asset file URLs to clipboard"
                    >
                      {copiedMediaLinks ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                      <span>{copiedMediaLinks ? 'Links Copied' : 'Copy Links'}</span>
                    </button>
                  )}
                  <button 
                    onClick={handleCopyWhatsApp}
                    className="bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-1.5 rounded-xl text-xs font-delight font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedWhatsApp ? 'Copied' : 'Copy Script'}</span>
                  </button>
                  <button 
                    onClick={() => handleOpenWhatsAppWeb(previewLead)}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-4 py-1.5 rounded-xl text-xs font-delight font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp Web</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {emailAttachments.some(a => a.enabled) && (
                    <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-delight font-bold">
                      <Paperclip className="w-3 h-3 text-indigo-600" />
                      <span>{emailAttachments.filter(a => a.enabled).length} Deck{emailAttachments.filter(a => a.enabled).length > 1 ? 's' : ''} Attached</span>
                    </span>
                  )}
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-[11px] font-delight text-indigo-700">
                    <span className="font-bold text-indigo-900">{user?.emails_sent || 0}</span>
                    <span className="text-indigo-400">/</span>
                    <span className="font-semibold">{user?.emails_limit || 50} Emails</span>
                  </div>
                  <button 
                    onClick={() => handleOpenWebmail(previewLead)}
                    className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-delight font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Open prefilled outreach email for ${previewLead.businessName} directly in Gmail / Webmail`}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open Webmail</span>
                  </button>
                  <button 
                    onClick={handleSendSingleTest}
                    disabled={isSendingSingle}
                    className="bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 px-3.5 py-1.5 rounded-xl text-xs font-delight font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    title={`Dispatches an individualized test email directly to ${previewLead.businessName}`}
                  >
                    {isSendingSingle ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-slate-400" />
                        <span>Send Test</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => {
                      setIsDispatchModalOpen(true);
                    }}
                    className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-5 py-1.5 rounded-xl text-xs font-delight font-bold shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Launch Batch</span>
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* ======================================================== */}
          {/* RIGHT: LIVE VIEWPORT PREVIEW (DESKTOP / MOBILE)          */}
          {/* ======================================================== */}
          <div 
            ref={previewCardRef}
            className="w-full xl:flex-1 flex flex-col bg-slate-50/70 border border-slate-200/90 rounded-2xl min-h-[750px] xl:sticky xl:top-6 self-start z-10 overflow-hidden shadow-xs"
          >
            
            {/* Viewport & Lead Controls */}
            <div className="px-5 py-3 border-b border-slate-200/80 bg-white/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 relative z-30">
              <div className="flex items-center gap-3">
                {/* Traffic-light chrome dots */}
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400/90 shadow-2xs"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/90 shadow-2xs"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/90 shadow-2xs"></span>
                </div>
                <div className="h-4 w-px bg-slate-200" />
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-delight font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Live Render</span>
                </div>

                {/* Viewport Switcher */}
                <div className="flex bg-slate-100/90 p-0.5 rounded-lg border border-slate-200 text-xs font-delight">
                  <button 
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewViewport === 'desktop' ? 'bg-white text-indigo-950 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>
                  <button 
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-3 py-1 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                      previewViewport === 'mobile' ? 'bg-white text-indigo-950 font-bold shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                {/* A/B Variant Preview Indicator */}
                {isAbTesting && (
                  <div className="flex items-center bg-slate-100/90 p-0.5 rounded-lg border border-slate-200 text-xs font-delight">
                    <button 
                      type="button"
                      onClick={() => setActiveVariant('A')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        activeVariant === 'A' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-indigo-600'
                      }`}
                    >
                      <span>Variant A</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveVariant('B')}
                      className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        activeVariant === 'B' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-slate-600 hover:text-indigo-600'
                      }`}
                    >
                      <span>Variant B</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Lead Hydration Switcher */}
              <div className="relative" ref={leadDropdownRef}>
                <button
                  type="button"
                  onClick={handleToggleLeadDropdown}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-delight text-slate-700 shadow-2xs transition-all cursor-pointer hover:border-indigo-300"
                  title="Click to select target lead for live hydration"
                >
                  <span className="text-slate-400">Preview as:</span>
                  <span className="font-bold text-slate-900 max-w-[160px] truncate">{previewLead.businessName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLeadDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isLeadDropdownOpen && (
                  <div className={`absolute ${dropdownAlign === 'left' ? 'left-0' : 'right-0'} mt-1.5 w-[280px] sm:w-80 max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-in fade-in duration-150 font-delight font-medium`}>
                    <div className="p-3 border-b border-slate-100 bg-slate-50/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Target Lead</span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
                          {availableLeads.length} Harvested
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={leadSearchQuery}
                          onChange={(e) => setLeadSearchQuery(e.target.value)}
                          placeholder="Search your workspace leads..."
                          className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none font-delight font-medium transition-all"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 divide-y divide-slate-50">
                      {filteredAvailableLeads.map((lead) => {
                        const isSelected = previewLead.businessName === lead.businessName;
                        return (
                          <button
                            key={lead._id || lead.businessName}
                            type="button"
                            onClick={() => {
                              setPreviewLead(lead);
                              setIsLeadDropdownOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between group cursor-pointer ${
                              isSelected ? 'bg-indigo-50/80 text-indigo-950 font-bold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-semibold text-slate-900 line-clamp-2 break-words">
                                {lead.businessName}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span>{lead.category || lead.fieldOfWork}</span>
                                <span>•</span>
                                <span>{lead.location}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {availableLeads.length === 0 ? (
                        <div className="p-4 text-center space-y-1.5">
                          <div className="text-xs font-bold text-slate-800">
                            No harvested leads in workspace yet
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal leading-relaxed">
                            Previewing with your workspace profile ({workspaceProfileLead.businessName}). Harvest prospects in Lead Finder to preview real leads here.
                          </p>
                        </div>
                      ) : filteredAvailableLeads.length === 0 ? (
                        <div className="p-3 text-center text-xs text-slate-400 font-delight font-normal">
                          No matching leads found
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Viewport Canvas */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex items-start justify-center rounded-b-2xl">
              
              {/* ======================================================== */}
              {/* EMAIL CLIENT CONTAINER                                   */}
              {/* ======================================================== */}
              {activeChannel === 'email' && (
                <div 
                  className={`bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden transition-all duration-150 ${
                    previewViewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-[620px]'
                  }`}
                  style={{ borderRadius: templateStyling.borderRadius }}
                >
                  
                  {/* Email Chrome Header */}
                  <div className="border-b border-slate-100 p-4 bg-gradient-to-r from-slate-50/90 via-indigo-50/20 to-white text-xs font-delight">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10px] shadow-2xs">
                          ST
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">
                          <span className="font-bold text-slate-900">{user?.name || 'Workspace Operator'}</span> &lt;{user?.email || 'outreach@strovr.space'}&gt;
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-full">
                        Primary Inbox
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mb-2 pl-8">
                      To: <span className="text-slate-800 font-semibold">{previewLead.email || `contact@${previewLead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'biz'}.com`}</span>
                    </div>
                    <div 
                      className="font-bold text-sm text-slate-900 tracking-tight font-sans pl-8"
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.subject) }}
                    />
                  </div>

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 1: TEXT ONLY                      */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'text_only' && (
                    <div className="p-6 sm:p-8 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs">
                          LP
                        </div>
                        {templateData.preheader && (
                          <span 
                            className="text-[10px] font-delight font-medium text-slate-600 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader) }}
                          />
                        )}
                      </div>
                      <h2 
                        className="text-base font-bold text-slate-900 tracking-tight leading-snug"
                        dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                      />
                      <div 
                        className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans"
                        dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                      />
                      {templateData.ctaText && (
                        <div className="pt-2">
                          <a 
                            href={templateData.ctaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-4 py-2 rounded-md text-xs font-delight font-semibold text-white shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ backgroundColor: templateStyling.accentColor }}
                          >
                            {templateData.ctaText}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 2: ONE COLUMN                     */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'one_column' && (
                    <div className="p-6 sm:p-8 space-y-4 text-center">
                      <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs mx-auto shadow-xs">
                        LP
                      </div>
                      <div className="space-y-1">
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        {templateData.subheadline && (
                          <p 
                            className="text-xs text-slate-500 font-sans"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.subheadline) }}
                          />
                        )}
                      </div>

                      {/* Hero Image Banner */}
                      <div className="w-full h-40 bg-slate-900 rounded-md flex items-center justify-center text-white p-6 shadow-xs relative overflow-hidden border border-slate-800">
                        <div className="relative z-10 text-center space-y-1">
                          <span 
                            className="text-[10px] font-delight font-semibold uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded-sm inline-block border border-white/20"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader || `${previewLead.location} Growth Focus`) }}
                          />
                          <h3 className="font-bold text-sm tracking-tight">{previewLead.fieldOfWork} Suite</h3>
                        </div>
                      </div>

                      <div 
                        className="text-xs text-slate-700 leading-relaxed text-left whitespace-pre-wrap font-sans"
                        dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                      />

                      {templateData.ctaText && (
                        <div className="pt-2">
                          <a 
                            href={templateData.ctaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-6 py-2.5 rounded-md text-xs font-delight font-semibold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer"
                            style={{ backgroundColor: templateStyling.accentColor }}
                          >
                            {templateData.ctaText}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 3: INTERACTIVE CALENDAR BOOKING CARD */}
                  {/* ---------------------------------------------------- */}
                  {(selectedTemplateId === 'interactive_calendar' || (selectedTemplateId === 'two_column' && templateData.timeSlots)) && (
                    <div className="p-6 sm:p-8 space-y-4">
                      {/* Top live scheduling pill */}
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-delight font-bold">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                          <span>Google Calendar Engine &bull; Instant Confirmation</span>
                        </span>
                      </div>

                      {/* Host Profile Header */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img 
                            src={templateData.hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'} 
                            alt={templateData.hostName || 'Alex Roberts'} 
                            className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-2xs shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-900 font-delight truncate">
                              {templateData.hostName || 'Alex Roberts'}
                            </h4>
                            <p className="text-[11px] text-slate-500 truncate">
                              {templateData.hostTitle || 'Growth Director, Strovr'}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 px-2.5 py-1 rounded bg-white border border-slate-200 text-[11px] font-delight font-semibold text-slate-700">
                          ⏱️ {templateData.duration || '15 mins'}
                        </div>
                      </div>

                      {/* Headline & Narrative */}
                      <div className="text-center space-y-1.5">
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        {templateData.subheadline && (
                          <p 
                            className="text-xs text-slate-500 font-sans"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.subheadline) }}
                          />
                        )}
                        <div 
                          className="text-xs text-slate-700 leading-relaxed text-left whitespace-pre-wrap font-sans pt-1"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Interactive Time Slots Grid */}
                      <div className="space-y-2 pt-1">
                        <div className="text-center">
                          <span className="text-[11px] font-delight font-bold uppercase tracking-wider text-slate-600">
                            Select a Preferred Time Slot (Google Meet)
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(templateData.timeSlots || [
                            { label: 'Tomorrow 10:30 AM', time: '10:30 AM' },
                            { label: 'Tomorrow 2:00 PM', time: '2:00 PM' },
                            { label: 'Friday 4:30 PM', time: '4:30 PM' },
                            { label: 'View All Available Slots →', time: 'All Slots' }
                          ]).map((slot: any, idx: number) => {
                            const isSelected = selectedCalendarSlot === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedCalendarSlot(idx)}
                                className={`p-2.5 rounded-md border text-xs font-delight font-semibold text-center transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  isSelected 
                                    ? 'border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-xs ring-1 ring-indigo-600' 
                                    : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'bg-indigo-600' : 'bg-emerald-500'}`} />
                                <span className="truncate">{slot.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Meeting Agenda Bullets */}
                      {templateData.meetingAgenda && templateData.meetingAgenda.length > 0 && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Session Agenda:
                          </span>
                          {templateData.meetingAgenda.map((item: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span dangerouslySetInnerHTML={{ __html: renderPreviewHtml(item) }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Primary CTA */}
                      <div className="text-center pt-2">
                        <a 
                          href={templateData.ctaUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-6 py-2.5 rounded-md text-xs font-delight font-semibold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer"
                          style={{ backgroundColor: templateStyling.accentColor }}
                        >
                          {templateData.ctaText || 'Get in Touch'}
                        </a>
                        <p className="text-[11px] text-slate-400 font-sans mt-2">
                          Direct Google Meet invite &bull; Instant calendar sync
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Legacy Fallback: Two Column */}
                  {selectedTemplateId === 'two_column' && !templateData.timeSlots && (
                    <div className="p-6 sm:p-8 space-y-4">
                      <div className="text-center space-y-2">
                        <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs mx-auto">
                          LP
                        </div>
                        {templateData.preheader && (
                          <span 
                            className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200 inline-block"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader) }}
                          />
                        )}
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        <p 
                          className="text-xs text-slate-600 leading-relaxed font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Side-by-Side Dual Blocks */}
                      <div className={`grid gap-3 ${previewViewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between space-y-2.5">
                          <div className="w-full h-20 bg-slate-100 rounded-sm flex items-center justify-center text-slate-700 font-delight font-medium text-xs border border-slate-200">
                            Option A
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs text-slate-900 font-delight mb-1">{templateData.col1Title}</h4>
                            <p className="text-[11px] text-slate-500 leading-snug font-sans">{templateData.col1Body}</p>
                          </div>
                          <a 
                            href={templateData.col1CtaUrl || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-delight font-medium text-center block transition-colors shadow-xs cursor-pointer"
                          >
                            {templateData.col1Cta || 'Learn More'}
                          </a>
                        </div>

                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between space-y-2.5">
                          <div className="w-full h-20 bg-slate-100 rounded-sm flex items-center justify-center text-slate-700 font-delight font-medium text-xs border border-slate-200">
                            Option B
                          </div>
                          <div>
                            <h4 className="font-semibold text-xs text-slate-900 font-delight mb-1">{templateData.col2Title}</h4>
                            <p className="text-[11px] text-slate-500 leading-snug font-sans">{templateData.col2Body}</p>
                          </div>
                          <a 
                            href={templateData.col2CtaUrl || '#'} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-delight font-medium text-center block transition-colors shadow-xs cursor-pointer"
                          >
                            {templateData.col2Cta || 'Learn More'}
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 4: HYBRID                         */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'hybrid' && (
                    <div className="p-6 sm:p-8 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs">
                          LP
                        </div>
                        <span 
                          className="text-[10px] font-delight font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader || 'Monthly Partner Brief') }}
                        />
                      </div>

                      {/* Wide Hero Banner */}
                      <div className="p-5 bg-slate-900 text-white rounded-md space-y-2.5 border border-slate-800">
                        <h2 
                          className="text-base font-bold tracking-tight leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        <p 
                          className="text-xs text-slate-300 leading-relaxed font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.subheadline) }}
                        />
                        {templateData.ctaText && (
                          <a 
                            href={templateData.ctaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-3.5 py-1.5 rounded-md text-xs font-delight font-semibold text-white shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ backgroundColor: templateStyling.accentColor }}
                          >
                            {templateData.ctaText}
                          </a>
                        )}
                      </div>

                      {/* Secondary Multi-Column Block */}
                      <div className={`grid gap-2.5 pt-1 ${previewViewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-xs bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-delight font-medium text-xs">
                              01
                            </div>
                            <div>
                              <h4 className="font-semibold text-xs text-slate-900 font-delight">{templateData.col1Title}</h4>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5 font-sans">{templateData.col1Body}</p>
                            </div>
                          </div>
                          {templateData.col1Cta && (
                            <a 
                              href={templateData.col1CtaUrl || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[11px] font-delight font-medium text-slate-900 hover:underline inline-block pt-1"
                            >
                              {templateData.col1Cta} →
                            </a>
                          )}
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col justify-between space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="w-6 h-6 rounded-xs bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 font-delight font-medium text-xs">
                              02
                            </div>
                            <div>
                              <h4 className="font-semibold text-xs text-slate-900 font-delight">{templateData.col2Title}</h4>
                              <p className="text-[11px] text-slate-500 leading-snug mt-0.5 font-sans">{templateData.col2Body}</p>
                            </div>
                          </div>
                          {templateData.col2Cta && (
                            <a 
                              href={templateData.col2CtaUrl || '#'} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[11px] font-delight font-medium text-slate-900 hover:underline inline-block pt-1"
                            >
                              {templateData.col2Cta} →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 5: INVERTED PYRAMID               */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'inverted_pyramid' && (
                    <div className="p-6 sm:p-8 space-y-4 text-center">
                      <div className="w-7 h-7 rounded-sm bg-slate-900 text-white flex items-center justify-center font-delight font-bold text-xs mx-auto">
                        LP
                      </div>

                      {/* Wide Top Visual (Pyramid Base) */}
                      <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-5 flex flex-col items-center justify-center text-center space-y-1">
                        <span 
                          className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-600 bg-slate-200 px-2 py-0.5 rounded-xs"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader || 'Exclusive 500-Lead Reserve') }}
                        />
                        <h3 className="font-bold text-sm text-slate-900 tracking-tight">
                          High-Impact Compute Funnel
                        </h3>
                      </div>

                      {/* Tapering Copy (Pyramid Middle) */}
                      <div className="max-w-md mx-auto space-y-1.5">
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        <p 
                          className="text-xs text-slate-600 leading-relaxed font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Focused Call-to-Action Vertex (Pyramid Point) */}
                      <div className="pt-2 flex flex-col items-center">
                        <div className="text-slate-300 mb-1 text-xs font-delight font-medium">▼</div>
                        <a 
                          href={templateData.ctaUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-6 py-2 rounded-md text-xs font-delight font-medium text-white shadow-xs inline-flex items-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800"
                        >
                          <span>{templateData.ctaText}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 6: INTERACTIVE ROI & COST BENCHMARK */}
                  {/* ---------------------------------------------------- */}
                  {(selectedTemplateId === 'interactive_roi' || (selectedTemplateId === 'zig_zag' && templateData.comparisonPulse)) && (
                    <div className="p-6 sm:p-8 space-y-4">
                      {/* Top benchmark pill */}
                      <div className="text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-delight font-bold">
                          <span>Cost Benchmark &bull; Projected ROI Analysis</span>
                        </span>
                      </div>

                      {/* Headline & Subhead */}
                      <div className="text-center space-y-1">
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight leading-snug"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        {templateData.subheadline && (
                          <p 
                            className="text-xs text-slate-500 font-sans"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.subheadline) }}
                          />
                        )}
                        <div 
                          className="text-xs text-slate-700 leading-relaxed text-left whitespace-pre-wrap font-sans pt-1"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Comparative Side-by-Side Cards */}
                      <div className={`grid gap-3 pt-1 ${previewViewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        {/* Current Legacy */}
                        <div className="p-4 bg-rose-50/60 border border-rose-200 rounded-lg space-y-2">
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            {templateData.comparisonCurrent?.badge || 'Legacy Method'}
                          </span>
                          <h4 className="font-bold text-xs text-rose-950 font-delight">
                            {templateData.comparisonCurrent?.title || 'Traditional Agency'}
                          </h4>
                          <div className="text-lg font-extrabold text-rose-800 line-through">
                            {templateData.comparisonCurrent?.monthlyCost || '₹45,000 / mo'}
                          </div>
                          <div className="text-[11px] text-rose-800 space-y-0.5 font-sans">
                            <div>&bull; Time: <strong>{templateData.comparisonCurrent?.timeSpent || '14 hrs/week'}</strong></div>
                            <div>&bull; Success: <strong>{templateData.comparisonCurrent?.replyRate || '1.8% Response'}</strong></div>
                          </div>
                        </div>

                        {/* Strovr Solution */}
                        <div className="p-4 bg-emerald-50/70 border-2 border-emerald-400 rounded-lg space-y-2 shadow-xs">
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded">
                            {templateData.comparisonPulse?.badge || '8.4x Lower CAC'}
                          </span>
                          <h4 className="font-bold text-xs text-emerald-950 font-delight">
                            {templateData.comparisonPulse?.title || 'Strovr Autonomous Engine'}
                          </h4>
                          <div className="text-xl font-extrabold text-emerald-900">
                            {templateData.comparisonPulse?.monthlyCost || '₹699 / mo'}
                          </div>
                          <div className="text-[11px] text-emerald-800 space-y-0.5 font-sans">
                            <div>&bull; Time: <strong>{templateData.comparisonPulse?.timeSpent || '15 mins/week'}</strong></div>
                            <div>&bull; Success: <strong>{templateData.comparisonPulse?.replyRate || '28.4% Response'}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* 3 Metric Pills */}
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {(templateData.roiMetrics || [
                          { metric: '₹44,301', label: 'Monthly Cost Savings', highlight: true },
                          { metric: '99.4%', label: 'Inbox Deliverability', highlight: false },
                          { metric: '300+', label: 'Verified Leads / Month', highlight: false }
                        ]).map((m: any, idx: number) => (
                          <div 
                            key={idx} 
                            className={`p-2.5 rounded-lg border text-center ${
                              m.highlight 
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-950' 
                                : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="text-sm font-extrabold font-delight">{m.metric}</div>
                            <div className="text-[10px] text-slate-500 font-medium leading-tight mt-0.5">{m.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Checklist Features */}
                      {templateData.benefitsList && templateData.benefitsList.length > 0 && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-1.5">
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Included in Package:
                          </span>
                          {templateData.benefitsList.map((b: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span dangerouslySetInnerHTML={{ __html: renderPreviewHtml(b) }} />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Primary CTA */}
                      <div className="text-center pt-2">
                        <a 
                          href={templateData.ctaUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block px-6 py-2.5 rounded-md text-xs font-delight font-semibold text-white shadow-xs hover:opacity-95 transition-all cursor-pointer"
                          style={{ backgroundColor: templateStyling.accentColor }}
                        >
                          {templateData.ctaText || 'Claim Growth Tier →'}
                        </a>
                        <p className="text-[11px] text-slate-400 font-sans mt-2">
                          Instant deployment &bull; 30-day money-back satisfaction guarantee
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Legacy Fallback: Zig Zag */}
                  {selectedTemplateId === 'zig_zag' && !templateData.comparisonPulse && (
                    <div className="p-6 sm:p-8 space-y-4">
                      <div className="text-center space-y-1">
                        {templateData.preheader && (
                          <span 
                            className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200 inline-block mb-1"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader) }}
                          />
                        )}
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        <p 
                          className="text-xs text-slate-500 font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Zig-Zag Row 1: Left Image, Right Text */}
                      <div className={`p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-3.5 ${previewViewport === 'mobile' ? 'flex-col' : ''}`}>
                        <div className="w-20 h-20 bg-slate-200 rounded-sm flex items-center justify-center text-slate-700 font-delight font-medium text-xs shrink-0">
                          Step 01
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-semibold text-xs text-slate-900 font-delight">{templateData.zig1Title}</h4>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{templateData.zig1Text}</p>
                          <a 
                            href={templateData.zig1CtaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-900 font-delight font-medium text-[11px] hover:underline pt-0.5 inline-block cursor-pointer"
                          >
                            {templateData.zig1Cta || 'Learn More →'}
                          </a>
                        </div>
                      </div>

                      {/* Zig-Zag Row 2: Left Text, Right Image */}
                      <div className={`p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-3.5 ${previewViewport === 'mobile' ? 'flex-col-reverse' : ''}`}>
                        <div className="space-y-1 flex-1">
                          <h4 className="font-semibold text-xs text-slate-900 font-delight">{templateData.zig2Title}</h4>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{templateData.zig2Text}</p>
                          <a 
                            href={templateData.zig2CtaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-slate-900 font-delight font-medium text-[11px] hover:underline pt-0.5 inline-block cursor-pointer"
                          >
                            {templateData.zig2Cta || 'Learn More →'}
                          </a>
                        </div>
                        <div className="w-20 h-20 bg-slate-200 rounded-sm flex items-center justify-center text-slate-700 font-delight font-medium text-xs shrink-0">
                          Step 02
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 7: F PATTERN                      */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'f_pattern' && (
                    <div className="p-6 sm:p-8 space-y-4">
                      {/* Top Bar of F */}
                      <div className="border-b border-slate-200 pb-2.5">
                        <span 
                          className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-400"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader || 'Executive Briefing') }}
                        />
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight leading-snug mt-0.5"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                      </div>

                      {/* Left-Side Scan Spine of F */}
                      <div className="space-y-2.5 pl-3 border-l-2 border-slate-900">
                        <p 
                          className="text-xs text-slate-700 font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />

                        <ul className="space-y-1.5 text-xs text-slate-800 font-sans">
                          <li className="flex items-start gap-2">
                            <span className="font-delight font-medium text-slate-900 shrink-0">•</span>
                            <span>{templateData.fBullet1}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-delight font-medium text-slate-900 shrink-0">•</span>
                            <span>{templateData.fBullet2}</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-delight font-medium text-slate-900 shrink-0">•</span>
                            <span>{templateData.fBullet3}</span>
                          </li>
                        </ul>
                      </div>

                      {/* Bottom Anchor Visual */}
                      <div className="w-full h-20 bg-slate-50 rounded-md flex items-center justify-center text-slate-500 text-xs font-delight font-normal border border-slate-200">
                        {templateData.fBottomNote || 'Executive Summary Stream'}
                      </div>

                      {templateData.ctaText && (
                        <div>
                          <a 
                            href={templateData.ctaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-5 py-2 rounded-md text-xs font-delight font-medium text-white shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ backgroundColor: templateStyling.accentColor }}
                          >
                            {templateData.ctaText}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---------------------------------------------------- */}
                  {/* TEMPLATE STRUCTURE 8: DYNAMIC PRODUCT FEED           */}
                  {/* ---------------------------------------------------- */}
                  {selectedTemplateId === 'dynamic_product_feed' && (
                    <div className="p-6 sm:p-8 space-y-4 text-center">
                      <div>
                        <span 
                          className="text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded-xs border border-slate-200 inline-block"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.preheader || 'Dynamic Service Feed') }}
                        />
                        <h2 
                          className="text-base font-bold text-slate-900 tracking-tight mt-1 mb-0.5"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.headline) }}
                        />
                        <p 
                          className="text-xs text-slate-500 font-sans"
                          dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                        />
                      </div>

                      {/* Dynamic Product Feed Grid */}
                      <div className={`grid gap-3 my-3 ${
                        previewViewport === 'mobile' 
                          ? 'grid-cols-1' 
                          : (templateData.products || []).length <= 2 
                            ? 'grid-cols-2' 
                            : (templateData.products || []).length === 4
                              ? 'grid-cols-2'
                              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      }`}>
                        {(templateData.products || []).map((prod, idx) => (
                          <div key={idx} className="p-3 bg-white border border-slate-200 rounded-md flex flex-col justify-between shadow-xs text-left hover:border-slate-300 transition-colors">
                            <div>
                              {prod.imageUrl ? (
                                <div className="w-full h-24 bg-slate-100 rounded-sm overflow-hidden mb-2 relative border border-slate-200">
                                  <img 
                                    src={prod.imageUrl} 
                                    alt={prod.name} 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-full h-14 bg-slate-100 rounded-sm flex items-center justify-center text-[10px] font-delight font-medium text-slate-700 mb-2 border border-slate-200">
                                  {prod.category || 'Catalog Item'}
                                </div>
                              )}

                              <div className="space-y-1 mb-2">
                                {prod.badge && (
                                  <span className="text-[9px] font-delight font-semibold uppercase text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded-xs border border-slate-200 inline-block">
                                    {prod.badge}
                                  </span>
                                )}
                                <h4 className="font-semibold text-xs text-slate-900 tracking-tight leading-snug">{prod.name}</h4>
                                {prod.category && (
                                  <p className="text-[10px] font-delight font-semibold uppercase text-slate-400">{prod.category}</p>
                                )}
                                {prod.description && (
                                  <p className="text-[11px] text-slate-500 leading-tight pt-0.5 font-sans">{prod.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 mt-1">
                              <p className="font-delight font-bold text-xs text-slate-900 mb-1.5">{prod.price}</p>
                              <a 
                                href={prod.ctaUrl || '#'} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[10px] font-delight font-medium text-center block transition-colors cursor-pointer shadow-xs border border-slate-900"
                              >
                                {prod.ctaText || 'Select Plan'}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>

                      {templateData.ctaText && (
                        <div>
                          <a 
                            href={templateData.ctaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block px-5 py-2 rounded-md text-xs font-delight font-medium text-white shadow-xs hover:opacity-90 transition-opacity cursor-pointer"
                            style={{ backgroundColor: templateStyling.accentColor }}
                          >
                            {templateData.ctaText}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* ATTACHED DOCUMENTS & DECKS PREVIEW CONTAINER         */}
                  {/* ==================================================== */}
                  {emailAttachments.some(a => a.enabled) && (
                    <div className="mx-6 my-4 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 font-sans">
                      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200/80">
                        <div className="flex items-center gap-1.5 text-xs font-delight font-bold text-slate-700">
                          <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Attached Documents ({emailAttachments.filter(a => a.enabled).length})</span>
                        </div>
                        <span className="text-[10px] font-delight font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" />
                          <span>Verified Collateral</span>
                        </span>
                      </div>
                      <div className="space-y-2">
                        {emailAttachments.filter(a => a.enabled).map((att) => {
                          const resolvedName = att.fileName.replace(/{{business_name}}/g, previewLead?.businessName || 'Business');
                          const badgeColor = att.fileType === 'pdf' 
                            ? 'bg-rose-50 text-rose-700 border-rose-200' 
                            : att.fileType === 'image'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : att.fileType === 'sheet'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200';

                          return (
                            <div key={att.id} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs hover:border-slate-300 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-[10px] border shrink-0 ${badgeColor}`}>
                                  {att.fileType.toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {resolvedName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    {att.fileSize} • Attached with outreach
                                  </div>
                                </div>
                              </div>
                              <a 
                                href={att.url || '#'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold rounded-md flex items-center gap-1 shrink-0 ml-2 shadow-xs transition-colors"
                              >
                                <Download className="w-3 h-3" />
                                <span>View</span>
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* COMPLIANCE & DELIVERABILITY FOOTER (MANDATORY)       */}
                  {/* ==================================================== */}
                  {templateStyling.showComplianceFooter && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1 font-delight font-normal">
                      <div className="font-medium text-slate-700 text-[11px]">
                        Strovr Platform • BKC Financial Hub, Mumbai, India • www.strovr.space
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug font-sans">
                        You received this communication because <strong>{previewLead.businessName}</strong> is listed in public directories for {previewLead.fieldOfWork} in {previewLead.location}.
                      </p>
                      <div className="text-[10px] text-slate-400 pt-0.5 font-delight font-normal">
                        <a href="#unsubscribe" className="text-slate-700 underline font-semibold">Unsubscribe instantly</a> • <a href="#privacy" className="text-slate-500 underline">Compliance Policy</a>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* WHATSAPP PHONE MOCKUP PREVIEW */}
              {activeChannel === 'whatsapp' && (
                <div className="w-[340px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col font-sans ring-4 ring-slate-100/80">
                  {/* WhatsApp Top Chat Header */}
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3.5 flex items-center justify-between shrink-0 shadow-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs backdrop-blur-xs text-white shrink-0">
                        {previewLead?.businessName?.charAt(0) || 'L'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs truncate max-w-[170px] text-white">
                          {previewLead?.businessName || 'Target Business'}
                        </div>
                        <div className="text-[10px] text-emerald-100 font-delight font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse"></span>
                          <span>Official Business Account</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-white/80">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Chat Message Scroll Window */}
                  <div className="flex-1 bg-[#ECE5DD] p-3 overflow-y-auto flex flex-col gap-2 min-h-[380px] max-h-[500px]">
                    
                    {/* Date Divider Pill */}
                    <div className="self-center my-1 bg-white/80 backdrop-blur-xs px-2.5 py-0.5 rounded-full text-[9px] font-delight font-bold text-slate-500 shadow-2xs">
                      Today
                    </div>

                    {/* Chat Bubble Group */}
                    <div className="self-end max-w-[92%] flex flex-col gap-1.5">
                      
                      {/* 1. PDF Document Bubble Card (if enabled) */}
                      {whatsAppPdf.enabled && (
                        <div className="bg-[#E7FFDB] border border-emerald-200/70 rounded-2xl rounded-tr-xs p-2.5 shadow-2xs">
                          <div className="bg-white rounded-xl p-2.5 border border-emerald-100 flex items-center gap-2.5 shadow-2xs">
                            {/* Red PDF Icon Box */}
                            <div className="w-9 h-10 rounded-lg bg-rose-500 flex flex-col items-center justify-center text-white shrink-0 shadow-2xs relative">
                              <FileText className="w-4 h-4" />
                              <span className="text-[7px] font-black uppercase tracking-tighter leading-none mt-0.5">PDF</span>
                            </div>

                            {/* File Metadata */}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-bold text-slate-900 truncate leading-snug">
                                {String(whatsAppPdf?.fileName || 'Document_Attachment.pdf').replace(/{{business_name}}/g, previewLead?.businessName || 'Prospect')}
                              </div>
                              <div className="text-[9px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                <span>{whatsAppPdf.pageCount || '6 pages'}</span>
                                <span>•</span>
                                <span>{whatsAppPdf.fileSize || '2.4 MB'}</span>
                                <span>•</span>
                                <span className="text-rose-600 font-bold">PDF</span>
                              </div>
                            </div>

                            {/* Circular Download Action */}
                            <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                              <Download className="w-3 h-3" />
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-400 text-right mt-1 mr-1 flex items-center justify-end gap-1 font-delight">
                            <span>10:41 AM</span>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          </div>
                        </div>
                      )}

                      {/* 2. Picture Attachment + Accompanying Text Bubble */}
                      {whatsAppImage.enabled ? (
                        <div className="bg-[#E7FFDB] border border-emerald-200/70 rounded-2xl rounded-tr-xs overflow-hidden shadow-2xs">
                          {/* Image Thumbnail Frame */}
                          <div className="relative w-full max-h-48 bg-slate-900/10 overflow-hidden flex items-center justify-center">
                            {whatsAppImage.url ? (
                              <img 
                                src={whatsAppImage.url} 
                                alt="WhatsApp Attachment" 
                                className="w-full h-auto max-h-48 object-cover"
                                onError={(e) => {
                                  (e.target as any).src = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80';
                                }}
                              />
                            ) : (
                              <div className="p-6 flex flex-col items-center justify-center text-slate-400">
                                <Image className="w-6 h-6 mb-1 opacity-60" />
                                <span className="text-[9px]">No visual URL</span>
                              </div>
                            )}

                            {whatsAppImage.caption && (
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 text-[9px] text-white font-medium truncate">
                                {whatsAppImage.caption}
                              </div>
                            )}
                          </div>

                          {/* Text Message Content */}
                          <div className="p-3">
                            <div 
                              className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: renderPreviewHtml(whatsAppMessage) }}
                            />
                            <div className="text-[9px] text-slate-500 flex items-center justify-end gap-1 mt-1 font-delight font-medium">
                              <span>10:42 AM</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Text-Only Bubble */
                        <div className="bg-[#E7FFDB] border border-emerald-200/60 p-3 rounded-2xl rounded-tr-xs shadow-2xs">
                          <div 
                            className="text-xs text-slate-900 whitespace-pre-wrap leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderPreviewHtml(whatsAppMessage) }}
                          />
                          <div className="text-[9px] text-slate-500 flex items-center justify-end gap-1 mt-1 font-delight font-medium">
                            <span>10:42 AM</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Phone Mockup Footer Strip */}
                  <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-delight">
                      <Paperclip className="w-3 h-3 text-slate-400" />
                      <span>{whatsAppImage.enabled && whatsAppPdf.enabled ? '2 Media Files Attached' : whatsAppImage.enabled ? '1 Picture Attached' : whatsAppPdf.enabled ? '1 PDF Attached' : 'Standard Text Message'}</span>
                    </span>
                    <span className="text-emerald-700 font-bold font-delight">Verified Layout</span>
                  </div>
                </div>
              )}

              {/* SMS PHONE MOCKUP PREVIEW */}
              {activeChannel === 'sms' && (
                <div className="w-[320px] bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col font-sans ring-4 ring-slate-100/80">
                  <div className="bg-gradient-to-r from-slate-50 to-indigo-50/40 p-3.5 flex flex-col items-center justify-center border-b border-slate-200/80 shrink-0 font-delight font-medium">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-1 shadow-2xs">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-bold text-slate-900">{previewLead.phone}</div>
                    <div className="text-[10px] text-slate-400 font-delight">Direct Carrier Gateway</div>
                  </div>
                  <div className="flex-1 bg-white p-3.5 overflow-y-auto flex flex-col min-h-[300px]">
                    <div 
                      className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-3 rounded-2xl rounded-br-xs self-end max-w-[88%] text-xs shadow-2xs whitespace-pre-wrap mb-1 font-sans leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                    />
                    <div className="text-[9px] text-slate-400 self-end mr-1 font-delight font-medium">Delivered</div>
                  </div>
                </div>
              )}

            </div>
          </div>

          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* TEMPLATE GALLERY MODAL (8 INDUSTRY LAYOUTS)                  */}
      {/* ============================================================ */}
      <TemplateGalleryModal 
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={handleSelectTemplate}
      />

      {/* ============================================================ */}
      {/* DIRECT-TO-INBOX EMAIL DISPATCH CONSOLE MODAL                 */}
      {/* ============================================================ */}
      <DispatchTrackerModal
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        templateId={selectedTemplateId}
        templateName={activeTemplateConfig.name}
        templateData={templateDataA}
        templateDataB={templateDataB}
        isAbTesting={isAbTesting}
        templateStyling={templateStyling}
        availableLeads={availableLeads}
        currentPreviewLead={previewLead}
        user={user}
        connectedMailbox={connectedMailbox}
        attachments={emailAttachments.filter(a => a.enabled)}
        onCampaignDispatched={() => {
          fetchMailboxStatus();
          setDispatchNotification({
            message: `Outreach campaign successfully dispatched to active lead recipients! Status updated to 'Contacted'.`
          });
        }}
      />

      {/* ============================================================ */}
      {/* STANDARD SMTP OUTBOX CONFIGURATION MODAL                     */}
      {/* ============================================================ */}
      <EmailProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        user={user}
        onSaved={() => {
          fetchMailboxStatus();
          setDispatchNotification({
            message: 'Email dispatch gateway credentials successfully updated and active!'
          });
        }}
      />
    </div>
  );
};

export default OutreachCenter;
