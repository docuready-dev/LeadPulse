import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, ChevronDown } from 'lucide-react';
import { zoomManager, ZOOM_PRESETS, MIN_ZOOM, MAX_ZOOM } from '../utils/zoomManager';

interface ZoomControllerProps {
  variant?: 'compact' | 'header' | 'banner' | 'settings';
  className?: string;
}

export const ZoomController: React.FC<ZoomControllerProps> = ({
  variant = 'compact',
  className = ''
}) => {
  const [zoom, setZoom] = useState<number>(zoomManager.getZoom());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = zoomManager.subscribe((newZoom) => {
      setZoom(newZoom);
    });
    return unsubscribe;
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const percent = Math.round(zoom * 100);

  // Settings Variant (Full Slider & Preset Grid)
  if (variant === 'settings') {
    return (
      <div className={`p-4 bg-white border border-slate-200 rounded-md space-y-4 font-delight ${className}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ZoomIn className="w-4 h-4 text-[#C85A32]" />
              <span>Interface Zoom &amp; Scaling (50% &ndash; 200%)</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-normal mt-0.5">
              Adjust application scale to fit your monitor resolution. Use shortcuts <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Ctrl + +</kbd> and <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono">Ctrl + -</kbd>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-mono font-medium text-slate-900 bg-slate-100 px-3 py-1 rounded border border-slate-200">
              {percent}%
            </span>
            {percent !== 100 && (
              <button
                type="button"
                onClick={() => zoomManager.reset()}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                title="Reset zoom to 100%"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Range Slider */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => zoomManager.zoomOut(0.1)}
            disabled={zoom <= MIN_ZOOM}
            className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
            title="Zoom out (-10%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={zoom}
            onChange={(e) => zoomManager.setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-[#C85A32] cursor-pointer"
          />
          <button
            type="button"
            onClick={() => zoomManager.zoomIn(0.1)}
            disabled={zoom >= MAX_ZOOM}
            className="w-7 h-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
            title="Zoom in (+10%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ZOOM_PRESETS.map((p) => {
            const isSelected = Math.abs(zoom - p.value) < 0.02;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => zoomManager.setZoom(p.value)}
                className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer font-delight ${
                  isSelected
                    ? 'bg-[#C85A32] text-white font-medium shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Banner Variant (for dark top banner in App.tsx)
  if (variant === 'banner') {
    return (
      <div ref={dropdownRef} className={`relative inline-flex items-center gap-1 text-xs font-delight select-none ${className}`}>
        <div className="inline-flex items-center bg-[#2B2623] border border-[#443C37] rounded p-0.5 text-[#E7E2DA]">
          <button
            type="button"
            onClick={() => zoomManager.zoomOut(0.1)}
            disabled={zoom <= MIN_ZOOM}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3D3631] text-[#D6CFC7] disabled:opacity-30 cursor-pointer transition-colors"
            title="Zoom Out (Ctrl + -)"
          >
            &minus;
          </button>

          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-1.5 h-5 flex items-center gap-1 font-mono text-[11px] font-medium text-white hover:bg-[#3D3631] rounded cursor-pointer transition-colors"
            title="Click to select zoom preset (50% - 200%)"
          >
            <span>{percent}%</span>
            <ChevronDown className="w-2.5 h-2.5 text-[#A8A096]" />
          </button>

          <button
            type="button"
            onClick={() => zoomManager.zoomIn(0.1)}
            disabled={zoom >= MAX_ZOOM}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3D3631] text-[#D6CFC7] disabled:opacity-30 cursor-pointer transition-colors"
            title="Zoom In (Ctrl + +)"
          >
            &#43;
          </button>
        </div>

        {percent !== 100 && (
          <button
            type="button"
            onClick={() => zoomManager.reset()}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#3D3631] text-[#A8A096] hover:text-white cursor-pointer transition-colors"
            title="Reset Zoom to 100% (Ctrl + 0)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full right-0 mt-1 w-32 bg-[#1C1816] border border-[#3E3732] rounded-md shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-delight">
            <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[#8A8077] border-b border-[#2C2723]">
              Zoom Level
            </div>
            {ZOOM_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  zoomManager.setZoom(p.value);
                  setIsDropdownOpen(false);
                }}
                className={`w-full px-2.5 py-1 text-left text-xs font-mono flex items-center justify-between hover:bg-[#2F2925] cursor-pointer transition-colors ${
                  Math.abs(zoom - p.value) < 0.02 ? 'text-[#C85A32] font-bold bg-[#29231F]' : 'text-[#D6CFC7]'
                }`}
              >
                <span>{p.label}</span>
                {p.value === 1.0 && <span className="text-[9px] text-[#8A8077] uppercase font-sans">Default</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Header / Compact Variant (light background)
  return (
    <div ref={dropdownRef} className={`relative inline-flex items-center gap-1 text-xs font-delight select-none ${className}`}>
      <div className="inline-flex items-center bg-white border border-[#E5E0D5] rounded-md p-0.5 shadow-2xs">
        <button
          type="button"
          onClick={() => zoomManager.zoomOut(0.1)}
          disabled={zoom <= MIN_ZOOM}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer transition-colors"
          title="Zoom Out (Ctrl + -)"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-2 h-6 flex items-center gap-1 font-mono text-xs font-medium text-slate-800 hover:bg-slate-50 rounded cursor-pointer transition-colors"
          title="Click to select zoom preset (50% - 200%)"
        >
          <span>{percent}%</span>
          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => zoomManager.zoomIn(0.1)}
          disabled={zoom >= MAX_ZOOM}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 cursor-pointer transition-colors"
          title="Zoom In (Ctrl + +)"
        >
          <ZoomIn className="w-3 h-3" />
        </button>
      </div>

      {percent !== 100 && (
        <button
          type="button"
          onClick={() => zoomManager.reset()}
          className="w-6 h-6 flex items-center justify-center rounded border border-[#E5E0D5] bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors shadow-2xs"
          title="Reset Zoom to 100% (Ctrl + 0)"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-1 w-32 bg-white border border-slate-200 rounded-md shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100 font-delight">
          <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Select Scale
          </div>
          {ZOOM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                zoomManager.setZoom(p.value);
                setIsDropdownOpen(false);
              }}
              className={`w-full px-2.5 py-1.5 text-left text-xs font-mono flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${
                Math.abs(zoom - p.value) < 0.02 ? 'text-[#C85A32] font-semibold bg-[#C85A32]/5' : 'text-slate-700'
              }`}
            >
              <span>{p.label}</span>
              {p.value === 1.0 && <span className="text-[9px] text-slate-400 uppercase font-sans">Default</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ZoomController;
