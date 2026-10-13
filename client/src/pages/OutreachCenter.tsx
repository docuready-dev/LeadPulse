import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { 
  Mail, MessageCircle, MessageSquare, Send, CheckCircle2, 
  ChevronDown, Phone, Layout, Monitor, 
  Smartphone, Sparkles, Sliders, Edit3, ArrowRight,
  ShieldCheck, Tag, Search, Check, Loader2, ExternalLink, Key,
  Plus, Trash2, Upload, Wand2, Calendar
} from 'lucide-react';
import TemplateGalleryModal from '../components/TemplateGalleryModal';
import DispatchTrackerModal from '../components/DispatchTrackerModal';
import EmailProviderModal from '../components/EmailProviderModal';
import { EMAIL_TEMPLATES } from '../data/emailTemplates';
import type { TemplateId } from '../data/emailTemplates';
import { WHATSAPP_TEMPLATES, EMAIL_CAPTURE_BRIDGE_SCRIPT } from '../data/whatsappTemplates';
import type { WhatsAppTemplate } from '../data/whatsappTemplates';
import { useStore } from '../store/useStore';
import { alertDialog } from '../components/AppConfirmModal';
import axios from 'axios';

const OutreachCenter = () => {
  const { user, integrations, setUpgradeModalOpen, recordEmailDispatch, recordAiGeneration } = useStore();
  const [activeChannel, setActiveChannel] = useState<'email' | 'whatsapp' | 'sms'>('email');

  const defaultBookingHost = (import.meta as any).env?.VITE_EASYAPPOINTMENTS_URL || localStorage.getItem('leadpulse_booking_host') || 'http://localhost:8080';
  const calendlyIntegration = integrations.find(i => (i.id === 'calendly' || i.id === 'easyappointments') && i.connected);
  const [bookingHostUrl, setBookingHostUrl] = useState<string>(
    calendlyIntegration?.config?.bookingUrl || defaultBookingHost
  );
  const [bookingOnline, setBookingOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkBookingStatus = async () => {
      try {
        const apiBase = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
        const res = await axios.get(`${apiBase}/api/booking/status`, { timeout: 3500 });
        if (res.data) {
          setBookingOnline(Boolean(res.data.online));
          if (res.data.config?.publicUrl && !calendlyIntegration?.config?.bookingUrl) {
            setBookingHostUrl(res.data.config.publicUrl);
          }
        }
      } catch {
        try {
          await fetch(bookingHostUrl, { mode: 'no-cors' });
          setBookingOnline(true);
        } catch {
          setBookingOnline(false);
        }
      }
    };
    checkBookingStatus();
  }, [bookingHostUrl]);

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
      if (!user?._id) return;
      try {
        const res = await axios.get('http://localhost:3001/api/leads', {
          headers: { userid: user._id }
        });
        if (Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((l: any) => ({
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
      const res = await axios.post('http://localhost:3001/api/outreach/ai-generate', {
        templateId: selectedTemplateId,
        prompt: promptToUse,
        tone: aiTone,
        niche: previewLead?.fieldOfWork || previewLead?.category,
        userBusinessName: user?.name || 'LeadPulse'
      }, {
        headers: { userid: user?._id }
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
      // Robust client-side fallback synthesizer
      const p = promptToUse.trim();
      const generated: any = {
        subject: `Strategic Growth Initiative for {{business_name}}`,
        preheader: `Custom Strategic Proposal`,
        headline: `Hi {{first_name}}, Scale {{business_name}} in {{location}}`,
        subheadline: `A tailored strategy designed for ${previewLead?.fieldOfWork || '{{field_of_work}}'}`,
        body: `Hi {{first_name}},\n\n${p}\n\nWe analyzed the local footprint of {{business_name}} across {{location}} and prepared an autonomous growth framework specifically designed to help your team achieve consistent high-ticket conversions.\n\nKey highlights for {{business_name}}:\n• Verified decision-maker connections across {{location}}\n• Zero manual outreach friction with high-deliverability transport\n• Measurable response improvements for {{field_of_work}} operators\n\nWould you have 5 minutes this week for a brief conversation?`,
        ctaText: 'Book an Appointment ',
        ctaUrl: resolvedBookingUrl
      };

      if (selectedTemplateId === 'two_column' || selectedTemplateId === 'hybrid') {
        generated.col1Title = 'Option A: Managed System';
        generated.col1Body = `Let our team execute campaigns for {{business_name}} across {{location}}.`;
        generated.col1Cta = 'View Managed Setup';
        generated.col1CtaUrl = 'https://leadpulse.io/managed';
        generated.col2Title = 'Option B: Self-Serve Suite';
        generated.col2Body = `Use our autonomous lead harvester with email and WhatsApp triggers.`;
        generated.col2Cta = 'Explore Software';
        generated.col2CtaUrl = 'https://leadpulse.io/software';
      } else if (selectedTemplateId === 'zig_zag') {
        generated.zig1Title = '1. Geographic Discovery';
        generated.zig1Text = `Extract verified contacts in {{location}} with zero scraping blocks.`;
        generated.zig1Cta = 'Learn More →';
        generated.zig1CtaUrl = 'https://leadpulse.io/harvester';
        generated.zig2Title = '2. Autonomous Outreach';
        generated.zig2Text = `Send personalized merge tag emails directly to recipient inboxes.`;
        generated.zig2Cta = 'View Live Demo →';
        generated.zig2CtaUrl = 'https://leadpulse.io/demo';
      } else if (selectedTemplateId === 'f_pattern') {
        generated.fBullet1 = `Local Geo-Targeting: Reach verified businesses in {{location}} instantly.`;
        generated.fBullet2 = `Inbox Deliverability: 99.4% deliverability with compliance footers.`;
        generated.fBullet3 = `Predictable Conversion: High response templates tailored to {{field_of_work}}.`;
        generated.fBottomNote = `Strategic Summary: ${p}`;
      } else if (selectedTemplateId === 'dynamic_product_feed') {
        generated.products = [
          {
            name: 'Local Market Starter',
            category: 'Lead Discovery',
            price: '₹699 / mo',
            badge: 'Starter',
            imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
            description: `Get started with verified local prospects in {{location}}.`,
            ctaText: 'Select Starter',
            ctaUrl: 'https://leadpulse.io/checkout?plan=starter'
          },
          {
            name: 'Pro Multi-Channel Suite',
            category: 'Email + WhatsApp',
            price: '₹1,999 / mo',
            badge: 'Most Popular',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
            description: `Full autonomous dispatch with dedicated worker node.`,
            ctaText: 'Select Pro',
            ctaUrl: 'https://leadpulse.io/checkout?plan=pro'
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
    const senderName = user?.name || 'Workspace Operator';
    const senderEmail = user?.email || 'outreach@leadpulse.io';
    const senderCompany = user?.company_name || 'LeadPulse';

    rendered = rendered.replace(/{{business_name}}/g, `<span class="bg-amber-100 text-amber-900 font-bold px-1 rounded">${previewLead.businessName}</span>`);
    rendered = rendered.replace(/{{location}}/g, `<span class="bg-gray-100 text-accent font-bold px-1 rounded">${previewLead.location}</span>`);
    rendered = rendered.replace(/{{field_of_work}}/g, `<span class="bg-purple-100 text-accent font-bold px-1 rounded">${previewLead.fieldOfWork}</span>`);
    rendered = rendered.replace(/{{tag}}/g, `<span class="bg-purple-100 text-accent font-bold px-1 rounded">${previewLead.category || previewLead.fieldOfWork}</span>`);
    rendered = rendered.replace(/{{first_name}}/g, `<span class="bg-gray-100 text-accent font-bold px-1 rounded">${previewLead.firstName}</span>`);
    rendered = rendered.replace(/{{phone}}/g, `<span class="bg-gray-200 text-gray-900 font-bold px-1 rounded">${previewLead.phone}</span>`);
    rendered = rendered.replace(/{{rating}}/g, `<span class="bg-amber-100 text-amber-900 font-bold px-1 rounded">${previewLead.rating}</span>`);
    rendered = rendered.replace(/{{(booking_link|calendly_link|appointment_link)}}/g, `<a href="${resolvedBookingUrl}" target="_blank" rel="noreferrer" class="bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-200 font-delight font-bold px-2 py-0.5 rounded underline inline-flex items-center gap-1 shadow-2xs"><span>Book an Appointment </span>↗</a>`);
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
  };

  // Insert Email Capture Bridge Script
  const handleInsertBridgeScript = () => {
    setWhatsAppMessage(prev => prev + '\n\n' + EMAIL_CAPTURE_BRIDGE_SCRIPT);
  };

  // Format Text for External Copy / Dispatch
  const getCompiledWhatsAppMessage = (lead: any) => {
    let msg = whatsAppMessage;
    msg = msg.replace(/{{business_name}}/g, lead.businessName);
    msg = msg.replace(/{{location}}/g, lead.location);
    msg = msg.replace(/{{field_of_work}}/g, lead.fieldOfWork || lead.category);
    msg = msg.replace(/{{tag}}/g, lead.category || lead.fieldOfWork);
    msg = msg.replace(/{{first_name}}/g, lead.firstName || lead.businessName);
    msg = msg.replace(/{{phone}}/g, lead.phone);
    msg = msg.replace(/{{rating}}/g, lead.rating || '4.8');
    msg = msg.replace(/{{(booking_link|calendly_link|appointment_link)}}/g, `Book an Appointment : ${resolvedBookingUrl}`);
    return msg;
  };

  // Open Direct in WhatsApp Web
  const handleOpenWhatsAppWeb = (lead: any) => {
    const rawText = getCompiledWhatsAppMessage(lead);
    const cleanPhone = (lead.phone || '').replace(/[^0-9]/g, '');
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

  // Direct Single Email Test Dispatcher
  const handleSendSingleTest = async () => {
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
      const res = await axios.post('http://localhost:3001/api/outreach/dispatch-single', {
        templateId: selectedTemplateId,
        templateData,
        templateStyling,
        targetLead: previewLead,
        customRecipientEmail: previewLead.email,
        fromName: user?.name || 'Workspace Operator',
        fromEmail: user?.email || 'outreach@leadpulse.io'
      }, {
        headers: { userid: user?._id || 'demo-user' }
      });

      if (res.data.success) {
        recordEmailDispatch(1);
        setDispatchNotification({
          message: `Direct test email dispatched to ${previewLead.businessName}!`,
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
    <div className="flex w-full min-h-screen bg-transparent font-sans text-[#191716]">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header title="Multi-Channel Outreach & Email Template Studio" />

        <div className="p-6 sm:p-8 flex flex-col gap-6 min-h-0">
          
          {/* Dispatch Live Notification Banner */}
          {dispatchNotification && (
            <div className="p-3.5 rounded-md border border-slate-200 bg-white shadow-xs flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2.5 text-slate-800">
                <div>
                  <div className="font-delight text-xs font-semibold text-slate-900">Direct Dispatch Status</div>
                  <div className="text-xs text-slate-600">{dispatchNotification.message}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dispatchNotification.previewUrl && (
                  <a 
                    href={dispatchNotification.previewUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-delight font-medium shadow-xs transition-colors cursor-pointer border border-slate-900"
                  >
                    <span>Inspect Delivered Inbox</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button 
                  onClick={() => setDispatchNotification(null)}
                  className="text-slate-500 hover:text-slate-900 text-xs font-delight font-medium px-2 py-1 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Architectural Transport & Scheduling Bar */}
          <div className="bg-white border border-slate-200 rounded-md px-4 py-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-delight">
              <div className="flex items-center gap-2 text-slate-600">
                <span className={`w-1.5 h-1.5 rounded-full ${activeMailTransport ? 'bg-emerald-500' : 'bg-[#191716]'}`}></span>
                <span className="text-slate-400">Relay:</span>
                <span className="text-[#191716] font-semibold">{activeMailTransport ? activeMailTransport.name : 'Direct Cloud SMTP'}</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 hidden sm:block" />
              <div className="flex items-center gap-2 text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-slate-400">WhatsApp:</span>
                <span className="text-[#191716] font-semibold">{activeSmsTransport ? activeSmsTransport.name : 'Direct Web Bridge'}</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 hidden md:block" />
              <div className="flex items-center gap-2 text-slate-600">
                <span className="text-slate-400">Booking:</span>
                <a 
                  href={resolvedBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-delight font-semibold text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 group underline"
                  title="Open Easy!Appointments Scheduler"
                >
                  <span>Book an Appointment </span>
                  <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </a>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-delight font-medium ${
                  bookingOnline 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${bookingOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  <span>Easy!Appointments</span>
                </span>
                <Link 
                  to="/appointments" 
                  className="text-[11px] font-delight font-medium text-slate-400 hover:text-slate-700 underline"
                  title="Open LeadPulse Appointments Hub"
                >
                  (Hub)
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => insertTag('{{booking_link}}')}
                className="px-2.5 py-1 bg-slate-100 hover:bg-[#191716] text-[#191716] hover:text-white border border-slate-200 rounded text-[11px] font-delight font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                title="Insert Easy!Appointments booking tag into template"
              >
                <Calendar className="w-3 h-3 text-indigo-600" />
                + Insert 'Book an Appointment '
              </button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row gap-6 min-h-0">
          
          {/* ======================================================== */}
          {/* LEFT: ARCHITECTURAL STUDIO COMPOSER                      */}
          {/* ======================================================== */}
          <div className="w-full xl:w-[50%] flex flex-col bg-white border border-slate-200 rounded-md overflow-hidden min-h-[750px]">
            
            {/* Channel Tabs & A/B Testing */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 gap-2">
              <div className="flex gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200/80">
                <button 
                  onClick={() => setActiveChannel('email')}
                  className={`px-3 py-1.5 text-xs font-delight flex items-center gap-1.5 rounded-sm transition-all cursor-pointer ${
                    activeChannel === 'email' 
                      ? 'bg-[#191716] text-white font-semibold' 
                      : 'text-slate-500 hover:text-[#191716] font-medium'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email Studio
                </button>
                <button 
                  onClick={() => setActiveChannel('whatsapp')}
                  className={`px-3 py-1.5 text-xs font-delight flex items-center gap-1.5 rounded-sm transition-all cursor-pointer ${
                    activeChannel === 'whatsapp' 
                      ? 'bg-[#191716] text-white font-semibold' 
                      : 'text-slate-500 hover:text-[#191716] font-medium'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp API
                </button>
                <button 
                  onClick={() => setActiveChannel('sms')}
                  className={`px-3 py-1.5 text-xs font-delight flex items-center gap-1.5 rounded-sm transition-all cursor-pointer ${
                    activeChannel === 'sms' 
                      ? 'bg-[#191716] text-white font-semibold' 
                      : 'text-slate-500 hover:text-[#191716] font-medium'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" /> SMS Pathways
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
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-all cursor-pointer font-delight text-xs ${
                    isAbTesting 
                      ? 'bg-[#191716] border-[#191716] text-white font-semibold' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-[#191716]'
                  }`}
                  title="Enable A/B split testing to compare Variant A and Variant B"
                >
                  <div className={`w-6 h-3.5 rounded-full relative transition-colors ${isAbTesting ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full bg-white absolute top-0.5 transition-all ${isAbTesting ? 'left-3' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[11px]">A/B Split</span>
                </button>
              </div>
            </div>

            {/* A/B Testing Variant Ribbon */}
            {isAbTesting && (
              <div className="px-4 py-2 bg-slate-900 text-white border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-delight uppercase tracking-wider text-slate-400">Variant:</span>
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setActiveVariant('A')}
                      className={`px-2.5 py-1 rounded-xs text-xs font-delight font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeVariant === 'A' 
                          ? 'bg-white text-[#191716] font-semibold' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Variant A (50%)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveVariant('B')}
                      className={`px-2.5 py-1 rounded-xs text-xs font-delight font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeVariant === 'B' 
                          ? 'bg-white text-[#191716] font-semibold' 
                          : 'text-slate-400 hover:text-white'
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
                  className="text-[11px] font-delight bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-slate-300" />
                  <span>Clone A &rarr; B</span>
                </button>
              </div>
            )}

            {/* Email Template Selector Bar */}
            {activeChannel === 'email' && (
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsGalleryOpen(true)}
                    className="bg-white hover:bg-slate-50 border border-slate-200 text-[#191716] px-2.5 py-1 rounded text-xs font-delight font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layout className="w-3.5 h-3.5 text-slate-500" />
                    <span>{activeTemplateConfig.name}</span>
                    <span className="text-[10px] font-delight font-normal text-slate-400 ml-1">Change (8)</span>
                  </button>

                  <button
                    onClick={() => setIsProviderModalOpen(true)}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-[#191716] px-2.5 py-1 rounded text-xs font-delight font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Configure Gmail, Resend, or Custom SMTP"
                  >
                    <Key className="w-3 h-3 text-slate-400" />
                    <span>SMTP</span>
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
                    className={`px-2.5 py-1 rounded text-xs font-delight font-semibold transition-all flex items-center gap-1.5 cursor-pointer border ${
                      isCopilotOpen
                        ? 'bg-[#191716] text-white border-[#191716]'
                        : 'bg-white hover:bg-slate-100 text-[#191716] border-slate-300'
                    }`}
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>AI Copilot</span>
                  </button>

                  {/* Two-Layer Architecture Switcher */}
                  <div className="flex bg-slate-200/70 p-0.5 rounded border border-slate-200 text-xs font-delight">
                    <button
                      onClick={() => setEditorLayer('content')}
                      className={`px-2.5 py-0.5 rounded-xs transition-all flex items-center gap-1 cursor-pointer ${
                        editorLayer === 'content' ? 'bg-white text-[#191716] font-semibold shadow-2xs' : 'text-slate-500 hover:text-[#191716]'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => setEditorLayer('template')}
                      className={`px-2.5 py-0.5 rounded-xs transition-all flex items-center gap-1 cursor-pointer ${
                        editorLayer === 'template' ? 'bg-white text-[#191716] font-semibold shadow-2xs' : 'text-slate-500 hover:text-[#191716]'
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
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-delight">
                  <span className="text-slate-400">Active Script:</span>
                  <span className="font-semibold text-[#191716]">
                    {WHATSAPP_TEMPLATES.find(t => t.id === selectedWhatsAppId)?.name || '1. The Local Compliment Hook'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyWhatsApp}
                    className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 py-1 rounded text-xs font-delight font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedWhatsApp ? 'Copied' : 'Copy Script'}</span>
                  </button>

                  <button
                    onClick={() => handleOpenWhatsAppWeb(previewLead)}
                    className="bg-[#191716] text-white px-3 py-1 rounded text-xs font-delight font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                  <div className="border border-slate-200 rounded-md p-3.5">
                    <label className="block text-xs font-delight font-semibold text-[#191716] mb-2.5">
                      Conversational Hook Frameworks
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {WHATSAPP_TEMPLATES.map((tpl) => (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleSelectWhatsAppTemplate(tpl)}
                          className={`text-left p-2.5 rounded border text-xs transition-all flex flex-col justify-between cursor-pointer ${
                            selectedWhatsAppId === tpl.id 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-0.5">
                            <span className="font-delight font-semibold truncate">{tpl.name}</span>
                            <span className={`text-[9px] font-delight font-medium px-1.5 py-0.2 rounded shrink-0 ml-1 ${
                              selectedWhatsAppId === tpl.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {tpl.badge}
                            </span>
                          </div>
                          <span className={`text-[11px] line-clamp-1 ${selectedWhatsAppId === tpl.id ? 'text-slate-300' : 'text-slate-400'}`}>
                            {tpl.hookType}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Merge Tags & Message Body */}
                  <div className="border border-slate-200 rounded-md overflow-hidden">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-1.5">
                      <label className="text-xs font-delight font-semibold text-[#191716]">Message Script</label>
                      <div className="flex items-center gap-1 flex-wrap">
                        {mergeTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => insertTag(tag)}
                            className="text-[10px] font-delight font-medium bg-white hover:bg-[#191716] text-slate-600 hover:text-white px-2 py-0.5 rounded border border-slate-200 transition-colors cursor-pointer"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea 
                      rows={6}
                      value={whatsAppMessage}
                      onChange={(e) => setWhatsAppMessage(e.target.value)}
                      className="w-full p-3.5 text-xs font-sans outline-none leading-relaxed bg-white border-0"
                    />
                  </div>

                  {/* Organic Email-Capture Bridge Feature */}
                  <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-delight font-semibold text-[#191716]">
                        Organic Email-Capture Bridge
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        "{EMAIL_CAPTURE_BRIDGE_SCRIPT}"
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertBridgeScript}
                      className="bg-white hover:bg-[#191716] text-[#191716] hover:text-white border border-slate-200 text-xs font-delight font-semibold px-3 py-1.5 rounded transition-colors cursor-pointer shrink-0"
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
                          className="group border border-slate-200 hover:border-[#191716] bg-slate-50/60 hover:bg-white rounded-md px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-all"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-delight font-bold text-[#191716]">
                                  AI Email Copilot
                                </span>
                                <span className="text-[9px] font-delight font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-slate-200/80 text-[#191716]">
                                  Auto-Fill Engine
                                </span>
                                <span className="text-[9px] font-delight font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                  {user?.ai_pitches_limit === -1 ? 'Unlimited' : `${Math.max(0, (user?.ai_pitches_limit ?? 5) - (user?.ai_pitches_used || 0))} Pitches Left`}
                                </span>
                                {aiSuccessMessage && (
                                  <span className="text-[10px] font-delight font-semibold text-emerald-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" /> Populated
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] font-delight text-slate-500 truncate mt-0.5">
                                Click to launch the autonomous copy synthesizer for {previewLead.businessName}
                              </p>
                            </div>
                          </div>

                          <span className="px-3 py-1.5 rounded bg-white group-hover:bg-[#191716] text-[#191716] group-hover:text-white border border-slate-200 text-xs font-delight font-semibold transition-colors shrink-0">
                            Open Studio &rarr;
                          </span>
                        </div>
                      ) : (
                        /* DEDICATED AI EMAIL COPILOT CARD VIEW (Altogether Different Layout + Delight Font) */
                        <div className="border-2 border-[#191716] rounded-lg bg-white shadow-lg overflow-hidden animate-in fade-in duration-150 font-delight">
                          {/* Card View Top Header */}
                          <div className="bg-[#191716] text-white px-4 py-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-white font-delight tracking-tight">
                                    AI Email Copilot
                                  </h4>
                                  <span className="text-[9px] font-delight uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-white font-semibold">
                                    Auto-Fill Engine
                                  </span>
                                  <span className="text-[9px] font-delight uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                                    {user?.ai_pitches_limit === -1 ? 'Unlimited Pitches' : `${Math.max(0, (user?.ai_pitches_limit ?? 5) - (user?.ai_pitches_used || 0))} / ${user?.ai_pitches_limit ?? 5} Left`}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-300 font-delight mt-0.5">
                                  Synthesizing multi-block layout for <span className="text-white font-semibold">{previewLead.businessName}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsCopilotOpen(false)}
                              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-delight text-white transition-colors cursor-pointer"
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
                                <span className="text-[10px] font-delight text-slate-400">
                                  Active: <strong className="text-[#191716] capitalize">{aiTone}</strong>
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
                                      className={`p-2.5 rounded-md border text-left transition-all cursor-pointer font-delight ${
                                        active
                                          ? 'bg-[#191716] text-white border-[#191716]'
                                          : 'bg-slate-50/70 hover:bg-slate-100 text-[#191716] border-slate-200'
                                      }`}
                                    >
                                      <div className="text-xs font-bold font-delight truncate">{toneItem.title}</div>
                                      <div className={`text-[10px] font-delight mt-0.5 truncate ${active ? 'text-slate-300' : 'text-slate-500'}`}>
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
                                    className="p-2.5 rounded-md border border-slate-200 hover:border-[#191716] bg-white hover:bg-slate-50 text-left transition-all cursor-pointer group font-delight flex flex-col justify-between"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-xs font-bold text-[#191716] font-delight">{chip.label}</span>
                                      <span className="text-[10px] text-slate-400 group-hover:text-[#191716] font-delight">&rarr;</span>
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
                                  className="flex-1 bg-slate-50 focus:bg-white border border-slate-200 rounded-md px-3 py-2 text-xs text-[#191716] placeholder-slate-400 outline-none font-delight"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAiGenerate()}
                                  disabled={isAiGenerating || !aiPrompt.trim()}
                                  className="bg-[#191716] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-delight font-semibold px-4 py-2 rounded-md transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
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
                                    <span key={b} className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-delight">
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
                      <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 overflow-hidden">
                        {/* Subject Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center px-3.5 py-2.5 gap-1 sm:gap-3">
                          <label className="w-28 shrink-0 text-xs font-delight font-semibold text-slate-400">
                            Subject Line
                          </label>
                          <input 
                            type="text" 
                            value={templateData.subject}
                            onChange={(e) => setTemplateData({ ...templateData, subject: e.target.value })}
                            className="flex-1 text-xs font-sans font-medium text-[#191716] bg-transparent border-0 outline-none focus:ring-0 p-0 placeholder:text-slate-300"
                            placeholder="e.g. Proposal for {{business_name}}"
                          />
                        </div>

                        {/* Preheader Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center px-3.5 py-2.5 gap-1 sm:gap-3">
                          <label className="w-28 shrink-0 text-xs font-delight font-semibold text-slate-400">
                            Preheader
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
                          <div className="flex flex-col sm:flex-row sm:items-center px-3.5 py-2.5 gap-1 sm:gap-3">
                            <label className="w-28 shrink-0 text-xs font-delight font-semibold text-slate-400">
                              Headline
                            </label>
                            <input 
                              type="text" 
                              value={templateData.headline}
                              onChange={(e) => setTemplateData({ ...templateData, headline: e.target.value })}
                              className="flex-1 text-xs font-sans font-medium text-[#191716] bg-transparent border-0 outline-none focus:ring-0 p-0"
                            />
                          </div>
                        )}

                        {/* Subheadline Row */}
                        {templateData.subheadline !== undefined && (
                          <div className="flex flex-col sm:flex-row sm:items-center px-3.5 py-2.5 gap-1 sm:gap-3">
                            <label className="w-28 shrink-0 text-xs font-delight font-semibold text-slate-400">
                              Subheadline
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
                      <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-delight font-semibold text-[#191716]">
                            Message Body
                          </span>
                          <div className="flex flex-wrap gap-1 items-center">
                            {mergeTags.map(tag => (
                              <button 
                                key={tag}
                                type="button"
                                onClick={() => insertTag(tag)}
                                className="text-[10px] font-delight font-medium px-2 py-0.5 rounded bg-white hover:bg-[#191716] text-slate-600 hover:text-white border border-slate-200 transition-colors cursor-pointer"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>

                        <textarea 
                          rows={7}
                          value={templateData.body}
                          onChange={(e) => setTemplateData({ ...templateData, body: e.target.value })}
                          className="w-full p-3.5 text-xs font-sans text-slate-800 border-0 outline-none focus:ring-0 leading-relaxed bg-white resize-y"
                          placeholder="Compose your structured message copy..."
                        />
                      </div>

                      {/* PRIMARY CALL TO ACTION SHEET */}
                      {templateData.ctaText !== undefined && (
                        <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 overflow-hidden">
                          <div className="px-3.5 py-2 bg-slate-50/70 flex items-center justify-between">
                            <span className="text-xs font-delight font-semibold text-[#191716]">
                              Call to Action
                            </span>
                            <span className="text-[10px] font-delight text-slate-400">Primary Button</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                            <div className="flex items-center px-3.5 py-2.5 gap-2">
                              <label className="w-20 shrink-0 text-xs font-delight font-semibold text-slate-400">Label</label>
                              <input 
                                type="text" 
                                value={templateData.ctaText}
                                onChange={(e) => setTemplateData({ ...templateData, ctaText: e.target.value })}
                                placeholder="Book an Appointment "
                                className="flex-1 text-xs font-sans text-[#191716] bg-transparent border-0 outline-none p-0"
                              />
                            </div>
                            <div className="flex items-center px-3.5 py-2.5 gap-2">
                              <label className="w-14 shrink-0 text-xs font-delight font-semibold text-slate-400">URL</label>
                              <input 
                                type="text" 
                                value={templateData.ctaUrl || ''}
                                onChange={(e) => setTemplateData({ ...templateData, ctaUrl: e.target.value })}
                                placeholder="http://localhost:8080 (Easy!Appointments)"
                                className="flex-1 text-xs font-delight font-medium text-slate-700 bg-transparent border-0 outline-none p-0"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Interactive Calendar Booking Card Editor */}
                      {(selectedTemplateId === 'interactive_calendar' || (selectedTemplateId === 'two_column' && templateData.timeSlots)) && (
                        <div className="space-y-3.5 p-3.5 bg-slate-50 border border-slate-200 rounded-md">
                          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h5 className="font-delight text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                              <span>Interactive Booking Card Settings</span>
                            </h5>
                            <span className="text-[10px] font-delight font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span>Easy!Appointments</span>
                            </span>
                          </div>

                          {/* Host Details */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">Host Name</label>
                              <input 
                                type="text"
                                placeholder="Host Name"
                                value={templateData.hostName || ''}
                                onChange={(e) => setTemplateData({ ...templateData, hostName: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">Host Title</label>
                              <input 
                                type="text"
                                placeholder="Growth Director"
                                value={templateData.hostTitle || ''}
                                onChange={(e) => setTemplateData({ ...templateData, hostTitle: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">Call Duration</label>
                              <input 
                                type="text"
                                placeholder="15 mins"
                                value={templateData.duration || ''}
                                onChange={(e) => setTemplateData({ ...templateData, duration: e.target.value })}
                                className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-delight font-medium outline-none focus:border-slate-400"
                              />
                            </div>
                          </div>

                          {/* Host Avatar URL */}
                          <div>
                            <label className="block text-[10px] font-delight font-semibold text-slate-600 mb-1">Host Avatar Image URL</label>
                            <input 
                              type="text"
                              placeholder="https://images.unsplash.com/..."
                              value={templateData.hostAvatar || ''}
                              onChange={(e) => setTemplateData({ ...templateData, hostAvatar: e.target.value })}
                              className="w-full bg-white border border-slate-200 rounded-md p-2 text-xs font-sans outline-none focus:border-slate-400"
                            />
                          </div>

                          {/* Interactive Time Slots */}
                          <div>
                            <label className="block text-[10px] font-delight font-semibold text-slate-700 mb-1">Interactive Time Slots (Clickable Chips)</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(templateData.timeSlots || []).map((slot: any, idx: number) => (
                                <div key={idx} className="p-2 bg-white border border-slate-200 rounded-md flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-slate-400 w-4">#{idx + 1}</span>
                                  <input 
                                    type="text"
                                    value={slot.label}
                                    onChange={(e) => {
                                      const nextSlots = [...(templateData.timeSlots || [])];
                                      nextSlots[idx] = { ...nextSlots[idx], label: e.target.value };
                                      setTemplateData({ ...templateData, timeSlots: nextSlots });
                                    }}
                                    className="flex-1 text-xs font-delight border-0 outline-none p-0"
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

                            {/* LeadPulse Side */}
                            <div className="p-3 bg-white border border-emerald-300 rounded-md space-y-2">
                              <span className="text-[10px] font-delight font-bold text-emerald-700 uppercase">LeadPulse Autonomous Engine</span>
                              <input 
                                type="text"
                                placeholder="Pulse Title (e.g. LeadPulse Autonomous Engine)"
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
                                  ctaUrl: 'https://leadpulse.io/order'
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
                        <label className="block text-xs font-delight font-semibold text-slate-700 mb-1.5">Brand Accent Tone</label>
                        <div className="flex gap-2">
                          {[
                            { name: 'Dark Indigo', val: '#191716' },
                            { name: 'Indigo Pop', val: '#C85A32' },
                            { name: 'Ice Blue', val: '#C7D2FE' },
                            { name: 'Pure White', val: '#FFFFFF' },
                            { name: 'Emerald', val: '#10B981' }
                          ].map((col) => (
                            <button
                              key={col.val}
                              type="button"
                              onClick={() => setTemplateStyling({ ...templateStyling, accentColor: col.val })}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-delight font-medium border transition-all cursor-pointer ${
                                templateStyling.accentColor === col.val 
                                  ? 'border-slate-900 bg-slate-100 font-semibold shadow-xs' 
                                  : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <span className="w-3 h-3 rounded-xs" style={{ backgroundColor: col.val }} />
                              <span>{col.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* CAN-SPAM Deliverability Footer Guard */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-slate-900 font-delight font-medium text-xs mb-0.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Mandatory Unsubscribe Compliance Footer</span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Enforces CAN-SPAM and GDPR legal opt-out links on every outbound email automatically.
                          </p>
                        </div>
                        <input 
                          type="checkbox"
                          checked={templateStyling.showComplianceFooter}
                          onChange={(e) => setTemplateStyling({ ...templateStyling, showComplianceFooter: e.target.checked })}
                          className="w-4 h-4 accent-slate-900 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-delight text-slate-500">
                  {activeChannel === 'whatsapp' ? 'WhatsApp wa.me API Ready' : 'Direct SMTP Socket Transport Ready'}
                </span>
              </div>
              
              {activeChannel === 'whatsapp' ? (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button 
                    onClick={handleCopyWhatsApp}
                    className="bg-white border border-slate-200 hover:bg-slate-100 px-3 py-1.5 rounded text-xs font-delight font-medium text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedWhatsApp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <ExternalLink className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedWhatsApp ? 'Copied' : 'Copy Script'}</span>
                  </button>
                  <button 
                    onClick={() => handleOpenWhatsAppWeb(previewLead)}
                    className="bg-[#191716] hover:bg-slate-800 text-white px-3.5 py-1.5 rounded text-xs font-delight font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>WhatsApp Web</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] font-delight text-slate-600">
                    <span className="font-bold text-[#191716]">{user?.emails_sent || 0}</span>
                    <span>/</span>
                    <span>{user?.emails_limit || 50} Emails</span>
                  </div>
                  <button 
                    onClick={handleSendSingleTest}
                    disabled={isSendingSingle}
                    className="bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 px-3 py-1.5 rounded text-xs font-delight font-medium text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
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
                    onClick={() => setIsDispatchModalOpen(true)}
                    className="bg-[#191716] hover:bg-slate-800 text-white px-4 py-1.5 rounded text-xs font-delight font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
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
            className="w-full xl:flex-1 flex flex-col bg-slate-50 border border-slate-200 rounded-md min-h-[750px] xl:sticky xl:top-6 self-start z-10 overflow-hidden"
          >
            
            {/* Viewport & Lead Controls */}
            <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 rounded-t-md relative z-30">
              <div className="flex items-center gap-2.5">
                <h3 className="font-delight text-xs font-semibold text-[#1E1B4B] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Live Render</span>
                </h3>

                {/* Viewport Switcher */}
                <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200 text-xs font-delight">
                  <button 
                    onClick={() => setPreviewViewport('desktop')}
                    className={`px-2.5 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      previewViewport === 'desktop' ? 'bg-white text-[#1E1B4B] font-semibold shadow-2xs' : 'text-slate-500 hover:text-[#1E1B4B]'
                    }`}
                  >
                    <Monitor className="w-3 h-3" />
                    <span>Desktop</span>
                  </button>
                  <button 
                    onClick={() => setPreviewViewport('mobile')}
                    className={`px-2.5 py-0.5 rounded-xs font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      previewViewport === 'mobile' ? 'bg-white text-[#1E1B4B] font-semibold shadow-2xs' : 'text-slate-500 hover:text-[#1E1B4B]'
                    }`}
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Mobile</span>
                  </button>
                </div>

                {/* A/B Variant Preview Indicator */}
                {isAbTesting && (
                  <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 text-xs font-delight">
                    <button 
                      type="button"
                      onClick={() => setActiveVariant('A')}
                      className={`px-2 py-0.5 rounded-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        activeVariant === 'A' ? 'bg-[#1E1B4B] text-white' : 'text-slate-600 hover:text-[#1E1B4B]'
                      }`}
                    >
                      <span>Variant A</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setActiveVariant('B')}
                      className={`px-2 py-0.5 rounded-xs font-medium transition-all cursor-pointer flex items-center gap-1 ${
                        activeVariant === 'B' ? 'bg-[#1E1B4B] text-white' : 'text-slate-600 hover:text-[#1E1B4B]'
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
                  className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-xs font-delight text-slate-700 transition-all cursor-pointer"
                  title="Click to select target lead for live hydration"
                >
                  <span className="text-slate-400">Preview as:</span>
                  <span className="font-semibold text-[#191716] max-w-[160px] truncate">{previewLead.businessName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isLeadDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isLeadDropdownOpen && (
                  <div className={`absolute ${dropdownAlign === 'left' ? 'left-0' : 'right-0'} mt-1.5 w-[280px] sm:w-80 max-w-[calc(100vw-32px)] bg-white border border-slate-200 rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in duration-150 font-delight font-medium`}>
                    <div className="p-2.5 border-b border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Select Target Lead</span>
                        <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded-xs">
                          {availableLeads.length} Harvested
                        </span>
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={leadSearchQuery}
                          onChange={(e) => setLeadSearchQuery(e.target.value)}
                          placeholder="Search your workspace leads..."
                          className="w-full bg-white border border-slate-200 rounded-sm pl-7 pr-2.5 py-1 text-xs outline-none focus:border-slate-400 font-delight font-medium"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto custom-scrollbar p-1 divide-y divide-slate-100">
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
                            className={`w-full text-left p-2 rounded-sm transition-colors flex items-center justify-between group cursor-pointer ${
                              isSelected ? 'bg-slate-100 text-slate-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-medium text-slate-900 line-clamp-2 break-words">
                                {lead.businessName}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span>{lead.category || lead.fieldOfWork}</span>
                                <span>•</span>
                                <span>{lead.location}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" />
                            )}
                          </button>
                        );
                      })}

                      {availableLeads.length === 0 ? (
                        <div className="p-3.5 text-center space-y-1.5">
                          <div className="text-xs font-semibold text-slate-700">
                            No harvested leads in workspace yet
                          </div>
                          <p className="text-[11px] text-slate-400 font-normal leading-relaxed">
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
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex items-start justify-center rounded-b-md">
              
              {/* ======================================================== */}
              {/* EMAIL CLIENT CONTAINER                                   */}
              {/* ======================================================== */}
              {activeChannel === 'email' && (
                <div 
                  className={`bg-white rounded-md shadow-xs border border-slate-200 overflow-hidden transition-all duration-150 ${
                    previewViewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-[620px]'
                  }`}
                  style={{ borderRadius: templateStyling.borderRadius }}
                >
                  
                  {/* Email Chrome Header */}
                  <div className="border-b border-slate-200 p-3.5 bg-slate-50 text-xs font-delight font-medium">
                    <div className="text-[11px] text-slate-500 font-medium mb-0.5">
                      From: {user?.name || 'Workspace Operator'} &lt;{user?.email || 'outreach@leadpulse.io'}&gt;
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium mb-1.5">
                      To: {previewLead.email || `contact@${previewLead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'biz'}.com`}
                    </div>
                    <div 
                      className="font-bold text-sm text-slate-900 tracking-tight font-sans"
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
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-delight font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Easy!Appointments Engine &bull; Instant Confirmation</span>
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
                              {templateData.hostTitle || 'Growth Director, LeadPulse'}
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
                          {templateData.ctaText || 'Book an Appointment '}
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

                        {/* LeadPulse Solution */}
                        <div className="p-4 bg-emerald-50/70 border-2 border-emerald-400 rounded-lg space-y-2 shadow-xs">
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded">
                            {templateData.comparisonPulse?.badge || '8.4x Lower CAC'}
                          </span>
                          <h4 className="font-bold text-xs text-emerald-950 font-delight">
                            {templateData.comparisonPulse?.title || 'LeadPulse Autonomous Engine'}
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
                  {/* COMPLIANCE & DELIVERABILITY FOOTER (MANDATORY)       */}
                  {/* ==================================================== */}
                  {templateStyling.showComplianceFooter && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 text-center text-xs text-slate-500 space-y-1 font-delight font-normal">
                      <div className="font-medium text-slate-700 text-[11px]">
                        LeadPulse Platform • BKC Financial Hub, Mumbai, India
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
                <div className="w-[340px] bg-white rounded-md shadow-md border border-slate-300 overflow-hidden flex flex-col font-sans">
                  <div className="bg-[#075E54] text-white p-3 flex items-center gap-2.5 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                      LP
                    </div>
                    <div>
                      <div className="font-bold text-xs truncate max-w-[220px]">{previewLead.businessName}</div>
                      <div className="text-[10px] text-emerald-200 font-delight font-medium">Official Business Account</div>
                    </div>
                  </div>
                  <div className="flex-1 bg-[#E5DDD5] p-3 overflow-y-auto flex flex-col">
                    <div 
                      className="bg-[#DCF8C6] p-2.5 rounded-md rounded-tr-none self-end max-w-[88%] text-xs text-slate-900 shadow-xs whitespace-pre-wrap mb-1"
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(whatsAppMessage) }}
                    />
                    <div className="text-[9px] text-slate-500 self-end mr-1 flex items-center gap-1 font-delight font-normal">
                      10:42 AM <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                    </div>
                  </div>
                </div>
              )}

              {/* SMS PHONE MOCKUP PREVIEW */}
              {activeChannel === 'sms' && (
                <div className="w-[320px] bg-white rounded-md shadow-md border border-slate-300 overflow-hidden flex flex-col font-sans">
                  <div className="bg-slate-100 p-2.5 flex flex-col items-center justify-center border-b border-slate-200 shrink-0 font-delight font-medium">
                    <div className="w-7 h-7 rounded-full bg-slate-300 flex items-center justify-center text-slate-700 font-bold mb-0.5">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-900">{previewLead.phone}</div>
                  </div>
                  <div className="flex-1 bg-white p-3 overflow-y-auto flex flex-col">
                    <div 
                      className="bg-slate-900 text-white p-2.5 rounded-md rounded-br-none self-end max-w-[88%] text-xs shadow-xs whitespace-pre-wrap mb-1 font-sans"
                      dangerouslySetInnerHTML={{ __html: renderPreviewHtml(templateData.body) }}
                    />
                    <div className="text-[9px] text-slate-400 self-end mr-1 font-delight font-normal">Delivered</div>
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
        onCampaignDispatched={() => {
          setDispatchNotification({
            message: `Outreach campaign successfully dispatched to active lead recipients! Status updated to 'Contacted'.`
          });
        }}
      />

      {/* ============================================================ */}
      {/* EMAIL PROVIDER CONFIGURATION MODAL (GMAIL / RESEND / SMTP)  */}
      {/* ============================================================ */}
      <EmailProviderModal
        isOpen={isProviderModalOpen}
        onClose={() => setIsProviderModalOpen(false)}
        user={user}
        onSaved={() => {
          setDispatchNotification({
            message: 'Email dispatch gateway credentials successfully updated and active!'
          });
        }}
      />
    </div>
  );
};

export default OutreachCenter;
