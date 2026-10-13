import { useState } from 'react';
import { 
  X, Check, Layout, ArrowRight, Lock
} from 'lucide-react';
import { EMAIL_TEMPLATES } from '../data/emailTemplates';
import type { TemplateId } from '../data/emailTemplates';
import { useStore } from '../store/useStore';

interface GalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTemplateId: TemplateId;
  onSelectTemplate: (id: TemplateId) => void;
}

const TemplateGalleryModal = ({ 
  isOpen, 
  onClose, 
  selectedTemplateId, 
  onSelectTemplate 
}: GalleryModalProps) => {
  const { user, setUpgradeModalOpen } = useStore();
  const [filterCategory, setFilterCategory] = useState<'all' | 'direct' | 'promotional' | 'newsletter' | 'ecommerce'>('all');

  if (!isOpen) return null;

  const currentPlan = (user?.plan || 'free').toLowerCase();
  const isFreePlan = currentPlan === 'free';

  const templateList = Object.values(EMAIL_TEMPLATES);
  const filteredTemplates = filterCategory === 'all' 
    ? templateList 
    : templateList.filter(t => t.category === filterCategory);

  // Structural Wireframe Diagrams corresponding to Link Mobility specifications
  const renderWireframe = (id: TemplateId) => {
    switch (id) {
      case 'text_only':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col justify-between">
            <div className="w-12 h-2.5 bg-slate-300 rounded-xs mb-2" />
            <div className="w-3/4 h-3 bg-slate-800 rounded-xs mb-2" />
            <div className="space-y-1.5 mb-2">
              <div className="w-full h-1.5 bg-slate-300 rounded-xs" />
              <div className="w-5/6 h-1.5 bg-slate-300 rounded-xs" />
              <div className="w-4/6 h-1.5 bg-slate-300 rounded-xs" />
            </div>
            <div className="space-y-1 mb-2 pl-2 border-l-2 border-blue-600">
              <div className="w-3/4 h-1.5 bg-slate-400 rounded-xs" />
              <div className="w-2/3 h-1.5 bg-slate-400 rounded-xs" />
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-xs pt-0.5" />
          </div>
        );

      case 'one_column':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col items-center justify-between">
            <div className="w-12 h-2.5 bg-slate-300 rounded-xs" />
            <div className="w-4/5 h-3 bg-slate-800 rounded-xs" />
            <div className="w-full h-11 bg-blue-50 border border-blue-200 rounded-sm flex items-center justify-center text-[9px] font-delight font-bold text-blue-700">
              Hero Banner Image
            </div>
            <div className="w-24 h-4 bg-slate-900 text-white rounded-sm flex items-center justify-center text-[8px] font-delight font-bold">
              Primary CTA
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-xs" />
          </div>
        );

      case 'interactive_calendar':
      case 'two_column':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-2.5 flex flex-col justify-between">
            {/* Host header preview */}
            <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-sm">
              <div className="w-5 h-5 rounded-full bg-emerald-100 border border-emerald-400 flex items-center justify-center text-[7px] font-bold text-emerald-800">
                15m
              </div>
              <div className="flex-1 space-y-0.5">
                <div className="w-16 h-1.5 bg-slate-800 rounded-xs" />
                <div className="w-10 h-1 bg-slate-400 rounded-xs" />
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Time Slot Chips Grid */}
            <div className="grid grid-cols-2 gap-1.5 my-1">
              <div className="bg-white border border-slate-200 py-1 px-1.5 rounded-xs flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[7.5px] font-bold text-slate-700 truncate">10:30 AM</span>
              </div>
              <div className="bg-white border border-slate-200 py-1 px-1.5 rounded-xs flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[7.5px] font-bold text-slate-700 truncate">2:00 PM</span>
              </div>
              <div className="bg-white border border-slate-200 py-1 px-1.5 rounded-xs flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-[7.5px] font-bold text-slate-700 truncate">4:30 PM</span>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 py-1 px-1.5 rounded-xs flex items-center justify-center">
                <span className="text-[7.5px] font-bold text-indigo-700">All Slots &rarr;</span>
              </div>
            </div>

            {/* Direct Booking CTA */}
            <div className="w-full h-4 bg-indigo-600 text-white rounded-xs flex items-center justify-center text-[8px] font-delight font-bold">
              Reserve Time Slot
            </div>
          </div>
        );

      case 'hybrid':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col justify-between">
            <div className="w-10 h-2 bg-slate-300 rounded-xs" />
            <div className="w-full h-9 bg-blue-50 border border-blue-200 rounded-sm p-1 flex items-center justify-between px-2">
              <div className="w-1/2 h-2 bg-blue-600 rounded-xs" />
              <div className="w-10 h-3 bg-blue-600 rounded-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white border border-slate-200 p-1 rounded-sm flex items-center gap-1">
                <div className="w-5 h-5 bg-slate-200 rounded-xs shrink-0" />
                <div className="w-full space-y-0.5">
                  <div className="w-3/4 h-1.5 bg-slate-700 rounded-xs" />
                  <div className="w-1/2 h-1 bg-slate-300 rounded-xs" />
                </div>
              </div>
              <div className="bg-white border border-slate-200 p-1 rounded-sm flex items-center gap-1">
                <div className="w-5 h-5 bg-slate-200 rounded-xs shrink-0" />
                <div className="w-full space-y-0.5">
                  <div className="w-3/4 h-1.5 bg-slate-700 rounded-xs" />
                  <div className="w-1/2 h-1 bg-slate-300 rounded-xs" />
                </div>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-xs" />
          </div>
        );

      case 'inverted_pyramid':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col items-center justify-between">
            {/* Wide Base at Top */}
            <div className="w-full h-10 bg-amber-50 border border-amber-200 rounded-sm flex items-center justify-center text-[8px] font-delight font-bold text-amber-800">
              Broad Hero Visual (Wide Top)
            </div>
            {/* Tapering Copy (Middle) */}
            <div className="w-3/4 h-2 bg-slate-800 rounded-xs" />
            <div className="w-1/2 h-1.5 bg-slate-400 rounded-xs" />
            {/* Focused Vertex CTA */}
            <div className="w-28 h-4 bg-amber-600 text-white rounded-sm flex items-center justify-center text-[8px] font-delight font-bold">
              Single Focused CTA ▼
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-xs" />
          </div>
        );

      case 'interactive_roi':
      case 'zig_zag':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-2 flex flex-col justify-between">
            {/* Top comparison title */}
            <div className="flex justify-between items-center px-1">
              <div className="w-16 h-2 bg-slate-800 rounded-xs" />
              <div className="w-12 h-2 bg-emerald-600 rounded-xs" />
            </div>

            {/* Side-by-side comparative cards */}
            <div className="grid grid-cols-2 gap-1.5 my-0.5">
              {/* Legacy card */}
              <div className="bg-rose-50 border border-rose-200 p-1 rounded-xs flex flex-col space-y-0.5">
                <span className="text-[6.5px] font-bold text-rose-700 uppercase">Agency</span>
                <span className="text-[8px] font-extrabold text-rose-800 line-through">₹45k/mo</span>
                <div className="w-full h-1 bg-rose-200 rounded-xs" />
              </div>
              {/* LeadPulse card */}
              <div className="bg-emerald-50 border border-emerald-300 p-1 rounded-xs flex flex-col space-y-0.5 shadow-2xs">
                <span className="text-[6.5px] font-bold text-emerald-700 uppercase">LeadPulse</span>
                <span className="text-[9px] font-extrabold text-emerald-800">₹699/mo</span>
                <span className="text-[6.5px] font-semibold text-emerald-600">8.4x Lower CAC</span>
              </div>
            </div>

            {/* 3 Metrics pills */}
            <div className="grid grid-cols-3 gap-1">
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xs p-0.5 text-center">
                <span className="text-[6.5px] font-bold text-indigo-700 block">₹44k Sav</span>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-2xs p-0.5 text-center">
                <span className="text-[6.5px] font-bold text-slate-700 block">99.4% Inb</span>
              </div>
              <div className="bg-slate-100 border border-slate-200 rounded-2xs p-0.5 text-center">
                <span className="text-[6.5px] font-bold text-slate-700 block">300+ Lds</span>
              </div>
            </div>

            {/* Action CTA */}
            <div className="w-full h-3.5 bg-emerald-600 text-white rounded-xs flex items-center justify-center text-[7.5px] font-delight font-bold">
              Claim Growth Tier &rarr;
            </div>
          </div>
        );

      case 'f_pattern':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col justify-between">
            {/* Top Bar of F */}
            <div className="w-full h-3 bg-slate-900 rounded-xs" />
            {/* Left scan spine + Middle bar of F */}
            <div className="flex gap-2">
              <div className="w-1.5 h-12 bg-red-500 rounded-xs shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="w-3/4 h-2 bg-slate-700 rounded-xs" />
                <div className="w-full h-1.5 bg-slate-300 rounded-xs" />
                <div className="w-2/3 h-1.5 bg-slate-300 rounded-xs" />
                <div className="w-16 h-3 bg-red-600 rounded-xs" />
              </div>
            </div>
            {/* Bottom visual */}
            <div className="w-full h-5 bg-slate-200 rounded-xs" />
          </div>
        );

      case 'dynamic_product_feed':
        return (
          <div className="w-full h-32 bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="w-14 h-2 bg-slate-700 rounded-xs" />
              <div className="w-10 h-2.5 bg-blue-100 rounded-xs" />
            </div>
            {/* 3-Column Product Grid */}
            <div className="grid grid-cols-3 gap-1.5 my-1">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-white border border-slate-200 rounded-sm p-1 text-center space-y-1">
                  <div className="w-full h-6 bg-slate-200 rounded-xs" />
                  <div className="w-full h-1.5 bg-slate-700 rounded-xs" />
                  <div className="w-2/3 mx-auto h-1.5 bg-blue-600 rounded-xs" />
                </div>
              ))}
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-xs" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200/90 w-full max-w-5xl shadow-2xl overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-start justify-between shadow-2xs">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs border border-white/20 text-white font-delight text-[11px] font-bold mb-2.5">
              <Layout className="w-3.5 h-3.5" />
              <span>Email Template Studio (Link Mobility Standards)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-delight">
              Select an Email Layout Architecture
            </h2>
            <p className="text-xs text-indigo-100 mt-1 max-w-2xl leading-relaxed font-delight">
              Choose from the 8 industry-standard structural templates. Each layout is engineered with responsive desktop/mobile breakpoints and automatic CAN-SPAM compliance footers.
            </p>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Categories */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap gap-2 items-center px-6">
          <span className="text-xs font-delight font-bold text-slate-500 uppercase tracking-wider mr-2">Filter By:</span>
          {(['all', 'direct', 'promotional', 'newsletter', 'ecommerce'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-delight font-semibold transition-all cursor-pointer ${
                filterCategory === cat 
                  ? 'bg-indigo-600 text-white shadow-2xs shadow-indigo-200' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-indigo-50/40 hover:border-indigo-200'
              }`}
            >
              {cat === 'all' ? 'All 8 Structures' : cat}
            </button>
          ))}
        </div>

        {/* Template Grid (8 Templates) */}
        <div className="p-6 max-h-[65vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              const isLocked = isFreePlan && template.id !== 'text_only' && template.id !== 'one_column';

              return (
                <div 
                  key={template.id}
                  onClick={() => {
                    if (isLocked) {
                      onClose();
                      setUpgradeModalOpen(true);
                      return;
                    }
                    onSelectTemplate(template.id);
                    onClose();
                  }}
                  className={`rounded-2xl border p-4 cursor-pointer transition-all flex flex-col justify-between group relative shadow-2xs ${
                    isLocked 
                      ? 'border-slate-200 bg-slate-50/60 opacity-95 hover:border-amber-300'
                      : isSelected 
                        ? 'border-indigo-600 bg-indigo-50/30 ring-2 ring-indigo-500/20 shadow-xs' 
                        : 'border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-xs'
                  }`}
                >
                  <div>
                    {/* Visual Wireframe Preview */}
                    <div className="mb-3 relative overflow-hidden rounded-xl border border-slate-200/90 shadow-2xs">
                      {renderWireframe(template.id)}
                      
                      {isLocked && (
                        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-2xs flex flex-col items-center justify-center text-white gap-1 p-2">
                          <div className="w-8 h-8 rounded-full bg-slate-900/90 border border-white/20 flex items-center justify-center shadow-xs">
                            <Lock className="w-4 h-4 text-amber-400" />
                          </div>
                          <span className="text-[10px] font-delight font-bold uppercase tracking-wider bg-slate-900/90 px-2 py-0.5 rounded-full text-amber-300 border border-amber-400/30">
                            Basic Plan (₹699)
                          </span>
                        </div>
                      )}

                      {!isLocked && isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4 className="font-bold text-sm text-slate-900 group-hover:text-indigo-600 transition-colors font-delight">
                        {template.name}
                      </h4>
                      {isLocked && (
                        <span className="text-[9.5px] font-delight font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                          Basic Tier
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-delight text-indigo-600 mb-2 font-bold">
                      {template.tagline}
                    </p>
                    <p className="text-xs text-slate-500 leading-snug mb-3 font-delight">
                      {template.purpose}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[10px] font-delight font-normal text-slate-400 block mb-2.5">
                      Best For: <strong className="text-slate-700 font-semibold">{template.bestFor}</strong>
                    </span>
                    <button 
                      className={`w-full py-2 rounded-xl text-xs font-delight font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        isLocked
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-2xs'
                          : isSelected 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'bg-slate-100 text-slate-700 group-hover:bg-indigo-600 group-hover:text-white'
                      }`}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-white" />
                          <span>Unlock with Basic Tier &rarr;</span>
                        </>
                      ) : (
                        <>
                          <span>{isSelected ? 'Active Template' : 'Select Layout'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between px-6 text-xs text-slate-500 font-delight font-normal">
          <span>Standards Grounded in Link Mobility Design Framework</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-md font-delight font-medium text-xs text-slate-700 transition-colors cursor-pointer"
          >
            Close Gallery
          </button>
        </div>

      </div>
    </div>
  );
};

export default TemplateGalleryModal;
