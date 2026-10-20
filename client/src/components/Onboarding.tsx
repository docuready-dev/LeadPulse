import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';
import API_URL from '../config/api';
import { motion } from 'framer-motion';

const Onboarding = () => {
  const { user, setUser } = useStore();
  const [companyName, setCompanyName] = useState('');
  const [fieldOfWork, setFieldOfWork] = useState('');
  const [customFieldOfWork, setCustomFieldOfWork] = useState('');
  const [niche, setNiche] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [goals, setGoals] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const finalFieldOfWork = fieldOfWork === 'Other' ? customFieldOfWork : fieldOfWork;
      const res = await axios.post(`${API_URL}/api/auth/onboarding`, {
        userId: user?._id,
        company_name: companyName,
        field_of_work: finalFieldOfWork,
        niche,
        target_audience: targetAudience,
        goals
      });
      setUser(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 flex items-center justify-center z-50 backdrop-blur-xs font-sans">
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white p-7 rounded-md shadow-xl border border-slate-200 w-[520px] max-w-[95vw] max-h-[92vh] overflow-y-auto"
      >
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 mb-2 bg-slate-100 border border-slate-200 rounded-sm text-[10px] font-delight font-semibold uppercase tracking-wider text-slate-600">
          Profile Provisioning
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Configure Workspace Profile</h2>
        <p className="text-xs text-slate-500 mb-5">Provide organization context to calibrate algorithmic lead scoring and personalization models.</p>
        
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">First Name</label>
              <input 
                type="text" 
                required
                placeholder="Alex"
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Last Name</label>
              <input 
                type="text" 
                required
                placeholder="Rivera"
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Company Name</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Apex Agency"
              className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Direct Phone</label>
            <input 
              type="tel" 
              required
              placeholder="+1 (555) 000-0000"
              className="w-full border border-slate-300 rounded-sm p-2 text-xs font-delight font-medium focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Industry</label>
              <select 
                required
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none bg-white transition-colors"
                value={fieldOfWork}
                onChange={(e) => setFieldOfWork(e.target.value)}
              >
                <option value="" disabled>Select an industry</option>
                <option value="Digital Agency">Digital Agency / Marketing</option>
                <option value="Real Estate">Real Estate</option>
                <option value="Local F&B">Local Restaurants / F&B</option>
                <option value="SaaS">SaaS & Software</option>
                <option value="Healthcare">Healthcare & Clinics</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Home Services">Home Services (Plumbing, HVAC)</option>
                <option value="Legal Services">Legal Services / Law Firm</option>
                <option value="Finance">Finance & Accounting</option>
                <option value="Fitness">Fitness & Wellness</option>
                <option value="Education">Education & Coaching</option>
                <option value="Other">Other (Custom)</option>
              </select>
            </div>
            
            {fieldOfWork === 'Other' && (
              <div className="col-span-2">
                <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Custom Industry</label>
                <input 
                  type="text" 
                  required
                  placeholder="Specify sector..."
                  className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                  value={customFieldOfWork}
                  onChange={(e) => setCustomFieldOfWork(e.target.value)}
                />
              </div>
            )}
            
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Headcount</label>
              <select 
                required
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none bg-white transition-colors"
              >
                <option value="" disabled>Select headcount</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201+">201+ employees</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Monthly Lead Target</label>
            <input 
              type="number" 
              required
              placeholder="e.g. 500"
              className="w-full border border-slate-300 rounded-sm p-2 text-xs font-delight font-medium focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Commercial Niche</label>
              <input 
                type="text" 
                placeholder="e.g. B2B SaaS, Dental"
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Target Persona</label>
              <input 
                type="text" 
                placeholder="e.g. VP Marketing, Owners"
                className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-delight font-semibold text-slate-600 mb-1 uppercase tracking-wider">Quarterly Objective</label>
            <input 
              type="text" 
              placeholder="e.g. Book 15 discovery calls/mo"
              className="w-full border border-slate-300 rounded-sm p-2 text-xs focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
            />
          </div>

          <button type="submit" className="w-full bg-slate-900 hover:bg-slate-950 text-white rounded-sm py-2.5 mt-2 transition-colors font-medium text-xs border border-slate-800 shadow-xs">
            Save Organization Profile &amp; Launch
          </button>

          <button 
            type="button" 
            onClick={async () => {
              try {
                const res = await axios.post(`${API_URL}/api/auth/onboarding`, {
                  userId: user?._id,
                  company_name: 'Strovr Growth Team',
                  field_of_work: 'B2B Sales',
                  niche: 'B2B',
                  target_audience: 'Founders & Sales Leaders',
                  goals: 'Accelerate Pipeline'
                });
                setUser(res.data);
              } catch (err) {
                if (user) {
                  setUser({ ...user, onboarding_complete: true });
                }
              }
            }} 
            className="w-full text-center text-xs font-delight font-normal text-slate-400 hover:text-slate-800 transition-colors pt-2 block"
          >
            Skip calibration step &rarr;
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Onboarding;
