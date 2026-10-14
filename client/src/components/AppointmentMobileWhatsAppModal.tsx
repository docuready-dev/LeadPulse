import { useState, useEffect } from 'react';
import { 
  X, Check, Copy, MessageCircle, 
  ExternalLink, Calendar, Clock, Video, 
  User, Building, Phone, Mail, Edit3, Sparkles, CheckCheck,
  RotateCcw, SlidersHorizontal, Plus
} from 'lucide-react';

interface AppointmentMobileWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  user?: any;
}

type MessagePreset = 'standard' | 'concise' | 'formal';

const generateCleanMessage = (
  preset: MessagePreset,
  clientName: string,
  serviceName: string,
  hostName: string,
  formattedDate: string,
  timeSlot: string,
  meetLink: string
): string => {
  if (preset === 'concise') {
    return `Hi ${clientName}, confirmation for our scheduled session:

Service: ${serviceName}
Date: ${formattedDate}
Time: ${timeSlot}
${meetLink ? `Meeting Link: ${meetLink}` : 'Mode: Direct Phone / Video Consultation'}

Looking forward to speaking with you!`;
  }

  if (preset === 'formal') {
    return `Dear ${clientName},

This is a confirmation of our scheduled consultation.

Subject: ${serviceName}
Host: ${hostName}
Date: ${formattedDate}
Time: ${timeSlot}
${meetLink ? `Meeting Link: ${meetLink}` : 'Mode: Direct Phone / Video Consultation'}

Please let us know if you need to reschedule or have any questions in advance.`;
  }

  // Standard (Default Clean Format - 100% icon-free)
  return `Hi ${clientName},

Your appointment for ${serviceName} with ${hostName} has been confirmed.

Date: ${formattedDate}
Time: ${timeSlot}
Topic: ${serviceName}
${meetLink ? `Meeting Link: ${meetLink}` : 'Mode: Direct Phone / Video Consultation'}

Looking forward to our conversation! If you need to make any changes, feel free to reply right here.`;
};

const AppointmentMobileWhatsAppModal = ({
  isOpen,
  onClose,
  appointment,
  user
}: AppointmentMobileWhatsAppModalProps) => {
  if (!isOpen || !appointment) return null;

  const clientName = appointment.customerName || appointment.leadName || appointment.businessName || 'Valued Client';
  const rawPhone = appointment.customerPhone || appointment.leadPhone || appointment.phone || '';
  const serviceName = appointment.serviceName || appointment.title || 'Strategy Consultation';
  const hostName = user?.company_name || user?.name || 'LeadPulse';
  const meetLink = appointment.meetLink || '';

  const formattedDate = appointment.appointmentDate 
    ? new Date(appointment.appointmentDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Upcoming Scheduled Date';

  const timeSlot = appointment.timeSlot || 'Scheduled Time';

  const [activePreset, setActivePreset] = useState<MessagePreset>('standard');
  const [phoneNumber, setPhoneNumber] = useState(rawPhone);
  const [customMessage, setCustomMessage] = useState('');
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (appointment) {
      setPhoneNumber(rawPhone);
      setCustomMessage(generateCleanMessage(activePreset, clientName, serviceName, hostName, formattedDate, timeSlot, meetLink));
    }
  }, [appointment, user, activePreset, clientName, serviceName, hostName, formattedDate, timeSlot, meetLink, rawPhone]);

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');

  const handleLaunchWhatsApp = () => {
    const textToSend = customMessage.trim() || generateCleanMessage(activePreset, clientName, serviceName, hostName, formattedDate, timeSlot, meetLink);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textToSend)}`
      : `https://wa.me/?text=${encodeURIComponent(textToSend)}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = () => {
    const textToCopy = customMessage.trim() || generateCleanMessage(activePreset, clientName, serviceName, hostName, formattedDate, timeSlot, meetLink);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  const handleResetToPreset = (preset: MessagePreset) => {
    setActivePreset(preset);
    setCustomMessage(generateCleanMessage(preset, clientName, serviceName, hostName, formattedDate, timeSlot, meetLink));
  };

  const handleInsertTag = (tagText: string) => {
    setCustomMessage(prev => prev + ' ' + tagText);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] my-auto">
        
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center border border-white/30 shadow-xs">
              <MessageCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight font-delight">
                  Appointment Details &amp; WhatsApp Client Dispatch
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white uppercase tracking-wider">
                  Mobile View
                </span>
              </div>
              <p className="text-xs text-emerald-100">
                Review appointment details, customize pre-typed message formatting, and dispatch cleanly to {clientName} via WhatsApp.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Two Columns (Left: Details & Format Editor, Right: Smartphone Mobile Screen) */}
        <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#FAF8F5]">
          
          {/* LEFT COLUMN: APPOINTMENT DETAILS & MESSAGE FORMAT EDITOR (Col 6) */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* Appointment Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 font-delight">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Appointment Summary
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>LeadPulse Confirmed</span>
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 tracking-tight">
                  {serviceName}
                </h4>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-slate-700">{appointment.businessName || clientName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Session Date</div>
                    <div className="font-bold text-slate-800">{formattedDate}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <Clock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Time Slot</div>
                    <div className="font-bold text-slate-800">{timeSlot}</div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 sm:col-span-2">
                  <User className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Client / Attendee</div>
                    <div className="font-bold text-slate-800 truncate">{clientName}</div>
                    {appointment.customerEmail && (
                      <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{appointment.customerEmail}</span>
                      </div>
                    )}
                  </div>
                </div>

                {meetLink && (
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200 sm:col-span-2">
                    <Video className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase font-bold text-indigo-600">Video Room Link</div>
                      <a
                        href={meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline truncate block"
                      >
                        {meetLink}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {appointment.notes && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Booking Notes</span>
                  <p className="text-slate-600 italic leading-relaxed text-[11px]">{appointment.notes}</p>
                </div>
              )}
            </div>

            {/* Recipient WhatsApp Phone Number */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 font-delight">
              <label className="block text-xs font-bold text-slate-800">
                Client WhatsApp Number <span className="text-emerald-600">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. +91 9876543210 or 9876543210"
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono font-medium rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Include country code for direct 1-click dispatch.
              </p>
            </div>

            {/* Message Format & Content Editor */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 font-delight">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">Edit Message Format</span>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Clean Format (No Icons)
                </span>
              </div>

              {/* Preset Format Selectors */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Format Style
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleResetToPreset('standard')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                      activePreset === 'standard'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetToPreset('concise')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                      activePreset === 'concise'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Short &amp; Direct
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetToPreset('formal')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold text-center transition-all cursor-pointer border ${
                      activePreset === 'formal'
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Executive
                  </button>
                </div>
              </div>

              {/* Message Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Message Body
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetToPreset(activePreset)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Reset message to selected format style"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>
                <textarea
                  rows={6}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Enter WhatsApp pre-typed message..."
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-sans text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed resize-y bg-slate-50/50 font-medium"
                />
              </div>

              {/* Quick Field Insertion Chips */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Quick Insert Field
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleInsertTag(`Date: ${formattedDate}`)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>Date</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag(`Time: ${timeSlot}`)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>Time</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTag(`Topic: ${serviceName}`)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3 text-slate-500" />
                    <span>Topic</span>
                  </button>
                  {meetLink && (
                    <button
                      type="button"
                      onClick={() => handleInsertTag(`Meeting Link: ${meetLink}`)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-medium border border-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-slate-500" />
                      <span>Link</span>
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: SMARTPHONE MOBILE-VIEW SCREEN (Col 6) */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            
            {/* The Smartphone Frame Container */}
            <div className="w-full max-w-[340px] bg-slate-900 p-3 rounded-[44px] shadow-2xl border-4 border-slate-800 relative">
              
              {/* Dynamic Island / Speaker Pill */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-4 bg-black rounded-full z-20 flex items-center justify-end pr-2">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
              </div>

              {/* Smartphone Inner Screen Canvas */}
              <div className="bg-[#ECE5DD] rounded-[34px] overflow-hidden flex flex-col h-[520px] border border-slate-700 relative text-slate-900 shadow-inner">
                
                {/* Mobile Top Status Bar */}
                <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[10px] font-bold text-slate-800 z-10 select-none bg-slate-900 text-white">
                  <span>9:41</span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-[9px]">5G</span>
                    <span>100%</span>
                  </div>
                </div>

                {/* WhatsApp Chat Top Header Bar */}
                <div className="bg-[#008069] text-white px-3 py-2.5 flex items-center justify-between shadow-xs select-none">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs text-white uppercase shrink-0 border border-white/30">
                      {clientName.charAt(0) || 'C'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs leading-tight truncate text-white">
                        {clientName}
                      </div>
                      <div className="text-[10px] text-emerald-100 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                        <span>online</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-white/90 text-xs">
                    <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded">WhatsApp</span>
                  </div>
                </div>

                {/* WhatsApp Chat Conversation Canvas */}
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar flex flex-col justify-end space-y-3 bg-[#EFEAE2]">
                  
                  {/* Today Date Badge */}
                  <div className="self-center bg-white/80 backdrop-blur-xs px-2.5 py-0.5 rounded-md text-[10px] font-bold text-slate-500 shadow-2xs uppercase tracking-wide">
                    Today
                  </div>

                  {/* Outgoing Message Bubble */}
                  <div className="self-end max-w-[92%] bg-[#DCF8C6] rounded-2xl rounded-tr-xs p-3 text-[11px] text-slate-900 shadow-xs space-y-2 border border-emerald-100">
                    
                    {isEditingMessage ? (
                      <textarea
                        rows={9}
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        className="w-full bg-white/90 p-2 rounded-lg border border-emerald-300 text-[11px] font-sans outline-none focus:ring-1 focus:ring-emerald-500 resize-none leading-relaxed"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap leading-relaxed font-sans text-slate-800">
                        {customMessage}
                      </div>
                    )}

                    {/* WhatsApp Timestamp & Double Checkmark */}
                    <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 font-sans pt-0.5 select-none">
                      <span>09:41 AM</span>
                      <CheckCheck className="w-3.5 h-3.5 text-blue-500 inline" />
                    </div>
                  </div>

                </div>

                {/* Smartphone Bottom WhatsApp Input Mimic */}
                <div className="bg-[#F0F2F5] px-3 py-2 border-t border-slate-200 flex items-center gap-2 select-none">
                  <div className="flex-1 bg-white rounded-full px-3 py-1 text-[11px] text-slate-400 border border-slate-200 truncate">
                    Type a message...
                  </div>
                  <button
                    type="button"
                    onClick={handleLaunchWhatsApp}
                    className="w-8 h-8 rounded-full bg-[#008069] text-white flex items-center justify-center shadow-xs hover:bg-[#006e59] cursor-pointer shrink-0 transition-transform hover:scale-105"
                    title="Send on WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </button>
                </div>

                {/* Smartphone Home Indicator Bar */}
                <div className="w-full pb-1 pt-0.5 flex justify-center bg-slate-900">
                  <div className="w-28 h-1 bg-white/40 rounded-full" />
                </div>

              </div>
            </div>

            {/* Controls Below Mobile Screen */}
            <div className="w-full max-w-[340px] mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleLaunchWhatsApp}
                className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shadow-emerald-200"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Send via WhatsApp Web / App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copied ? 'Copied Text' : 'Copy Message'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsEditingMessage(!isEditingMessage)}
                  className="py-2 px-3 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                >
                  <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isEditingMessage ? 'Preview in Phone' : 'Edit in Phone'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-delight">
          <div className="flex items-center gap-1.5 text-slate-500">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>LeadPulse Direct WhatsApp Dispatch with Clean, Icon-Free Pre-typed Message</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

export default AppointmentMobileWhatsAppModal;
