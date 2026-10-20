import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config/api';
import { 
  X, Search, Mail, Eye, Trash2, RefreshCw, 
  Clock, CheckCircle2, AlertCircle, Copy, Check,
  ExternalLink, Smartphone, Monitor, Shield, Paperclip, Send, ArrowLeft
} from 'lucide-react';
import { confirmDialog } from './AppConfirmModal';

interface SentEmailRecord {
  id: string;
  userId: string;
  recipient: string;
  businessName?: string;
  leadId?: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  fromEmail?: string;
  templateId?: string;
  status: string;
  error?: string | null;
  provider?: string;
  messageId?: string | null;
  previewUrl?: string | null;
  attachments?: Array<{ filename: string; contentType?: string }>;
  sentAt: string;
}

interface SentEmailHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

const SentEmailHistoryModal: React.FC<SentEmailHistoryModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const [historyList, setHistoryList] = useState<SentEmailRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<SentEmailRecord | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'text' | 'html'>('preview');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [copiedHtml, setCopiedHtml] = useState(false);

  const fetchHistory = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/outreach/history`, {
        headers: { userid: user._id }
      });
      setHistoryList(res.data?.history || []);
    } catch (err) {
      console.error('Failed to load sent email history:', err);
      setHistoryList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setSelectedEmail(null);
    }
  }, [isOpen, user?._id]);

  if (!isOpen) return null;

  const handleDeleteRecord = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = await confirmDialog({
      title: 'Delete Sent Email Record?',
      message: 'Are you sure you want to remove this sent email record from your history logs?',
      confirmText: 'Delete Record',
      cancelText: 'Keep Record',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      await axios.delete(`${API_URL}/api/outreach/history/${id}`, {
        headers: { userid: user?._id }
      });
      setHistoryList(prev => prev.filter(item => item.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
      }
    } catch (err) {
      console.error('Failed to delete sent email history:', err);
    }
  };

  const handleCopyHtml = () => {
    if (!selectedEmail?.html) return;
    navigator.clipboard.writeText(selectedEmail.html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2400);
  };

  const filteredHistory = historyList.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (item.recipient || '').toLowerCase().includes(q) ||
      (item.businessName || '').toLowerCase().includes(q) ||
      (item.subject || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[850px]">
        
        {/* ================= MODAL HEADER ================= */}
        <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            {selectedEmail ? (
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Back to sent list"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {selectedEmail ? selectedEmail.subject : 'Outreach Sent Email History'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  {historyList.length} Dispatched
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {selectedEmail
                  ? `To: ${selectedEmail.recipient} • Sent ${new Date(selectedEmail.sentAt).toLocaleString()}`
                  : 'Inspect individual email envelopes, rendered HTML designs, and live delivery receipts.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!selectedEmail && (
              <button
                type="button"
                onClick={fetchHistory}
                disabled={loading}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh history"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ================= MODAL CONTENT ================= */}
        {selectedEmail ? (
          /* ================= DETAIL VIEW: SELECTED EMAIL ================= */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50 overflow-hidden">
            
            {/* Metadata Bar */}
            <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex flex-wrap items-center gap-4 text-slate-600 font-delight">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Recipient</span>
                  <span className="font-bold text-slate-900">{selectedEmail.recipient}</span>
                  {selectedEmail.businessName && (
                    <span className="text-slate-500 text-[11px] ml-1">({selectedEmail.businessName})</span>
                  )}
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Sender Mailbox</span>
                  <span className="font-medium text-slate-800 font-mono text-[11px]">
                    {selectedEmail.fromName || 'Strovr'} &lt;{selectedEmail.fromEmail || 'outreach'}&gt;
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivered At</span>
                  <span className="font-medium text-slate-800">
                    {new Date(selectedEmail.sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Transport Protocol</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>{selectedEmail.provider || 'SendGrid Web API (Port 443)'}</span>
                  </span>
                </div>
              </div>

              {/* View Switcher & Action Controls */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Visual Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('text')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === 'text' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Plain Text
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('html')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === 'html' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    HTML Code
                  </button>
                </div>

                {viewMode === 'preview' && (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('desktop')}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        previewDevice === 'desktop' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                      title="Desktop view"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDevice('mobile')}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        previewDevice === 'mobile' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                      }`}
                      title="Mobile view"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCopyHtml}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Copy full HTML source"
                >
                  {copiedHtml ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedHtml ? 'Copied' : 'Copy HTML'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteRecord(selectedEmail.id)}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  title="Delete this history record"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Email Subject Header */}
            <div className="px-6 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase text-slate-400">Subject:</span>
                <span className="font-bold text-slate-900 truncate">{selectedEmail.subject}</span>
              </div>
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 shrink-0">
                  <Paperclip className="w-3 h-3 text-indigo-600" />
                  <span>{selectedEmail.attachments.length} Attachment(s)</span>
                </div>
              )}
            </div>

            {/* Main Email Preview Screen */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex items-center justify-center custom-scrollbar">
              {viewMode === 'preview' ? (
                <div 
                  className={`bg-white rounded-xl shadow-lg border border-slate-300 overflow-hidden transition-all duration-300 flex flex-col h-full ${
                    previewDevice === 'mobile' ? 'w-[380px] max-w-full' : 'w-full max-w-3xl'
                  }`}
                >
                  <iframe
                    title="Rendered Email Preview"
                    srcDoc={selectedEmail.html}
                    sandbox="allow-same-origin"
                    className="w-full flex-1 border-0 min-h-[480px] bg-white"
                  />
                </div>
              ) : viewMode === 'text' ? (
                <div className="w-full max-w-3xl bg-white rounded-xl p-6 border border-slate-200 shadow-sm font-sans text-xs text-slate-800 leading-relaxed whitespace-pre-wrap overflow-y-auto max-h-[500px]">
                  {selectedEmail.text || 'No plain text version recorded.'}
                </div>
              ) : (
                <div className="w-full max-w-3xl bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-xl overflow-x-auto text-[11px] font-mono text-slate-200 max-h-[500px]">
                  <pre>{selectedEmail.html}</pre>
                </div>
              )}
            </div>

          </div>
        ) : (
          /* ================= LIST VIEW: ALL SENT EMAILS ================= */
          <div className="flex-1 flex flex-col min-h-0 bg-slate-50/50">
            
            {/* Search Bar */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by recipient email, business, or subject..."
                  className="w-full h-8.5 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="text-xs text-slate-500 font-delight">
                Showing <strong className="text-slate-900">{filteredHistory.length}</strong> of {historyList.length} sent emails
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-16 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto" />
                  <p className="text-xs text-slate-500 font-medium">Loading sent email history...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                    <Mail className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No sent emails found</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    {searchQuery
                      ? 'No sent emails match your search query.'
                      : 'You have not dispatched any email campaigns yet. Connect your SendGrid outbox and launch a batch to view real delivery logs here.'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 bg-white">
                  {filteredHistory.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedEmail(item)}
                      className="p-4 sm:px-6 hover:bg-indigo-50/40 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {item.recipient}
                          </span>
                          {item.businessName && (
                            <span className="text-[11px] font-semibold text-slate-500">
                              • {item.businessName}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.status || 'Delivered'}
                          </span>
                          {item.attachments && item.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Paperclip className="w-2.5 h-2.5" />
                              <span>{item.attachments.length}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-700 font-medium truncate">
                          {item.subject}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-delight">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(item.sentAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}</span>
                          </span>
                          <span>&bull;</span>
                          <span>{item.provider || 'SendGrid Web API'}</span>
                        </div>
                      </div>

                      {/* Right Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedEmail(item)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs group-hover:scale-105"
                        >
                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                          <span>View Message</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecord(item.id, e)}
                          className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                          title="Delete from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
};

export default SentEmailHistoryModal;
