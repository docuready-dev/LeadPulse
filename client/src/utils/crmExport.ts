import * as XLSX from 'xlsx';

export interface CrmExportLead {
  _id?: string;
  businessName: string;
  firstName?: string;
  email?: string;
  phone?: string;
  category?: string;
  location?: string;
  website?: string;
  rating?: string;
  status?: string;
  priority?: 'High' | 'Medium' | 'Low';
  dealName?: string;
  dealOwner?: string;
  dealStatus?: 'Open' | 'Lost' | 'Closed' | 'Won';
  dealValue?: number | string;
  probability?: number | string;
  lossReason?: string;
  source?: string;
  requirements?: string[];
  notes?: string;
  activities?: any[];
  [key: string]: any;
}

export function mapStageToQuickSheets(stage?: string): 'Lead' | 'Qualified' | 'Demo' | 'Proposal' | 'Closed' {
  if (!stage) return 'Lead';
  const s = stage.toLowerCase();
  if (s.includes('closed') || s.includes('won')) return 'Closed';
  if (s.includes('proposal')) return 'Proposal';
  if (s.includes('demo') || s.includes('verified') || s.includes('meeting')) return 'Demo';
  if (s.includes('replied') || s.includes('qualified') || s.includes('awaiting')) return 'Qualified';
  return 'Lead';
}

export function getStageColorTheme(stage?: string) {
  const mapped = mapStageToQuickSheets(stage);
  switch (mapped) {
    case 'Lead':
      return { bg: 'bg-[#EF4444]', text: 'text-white', lightBg: 'bg-red-50', border: 'border-red-200', hex: '#EF4444' };
    case 'Qualified':
      return { bg: 'bg-[#FB923C]', text: 'text-white', lightBg: 'bg-orange-50', border: 'border-orange-200', hex: '#FB923C' };
    case 'Demo':
      return { bg: 'bg-[#F59E0B]', text: 'text-white', lightBg: 'bg-amber-50', border: 'border-amber-200', hex: '#F59E0B' };
    case 'Proposal':
      return { bg: 'bg-[#14B8A6]', text: 'text-white', lightBg: 'bg-teal-50', border: 'border-teal-200', hex: '#14B8A6' };
    case 'Closed':
      return { bg: 'bg-[#6366F1]', text: 'text-white', lightBg: 'bg-indigo-50', border: 'border-indigo-200', hex: '#6366F1' };
  }
}

export function getStatusPillTheme(status?: string) {
  const s = (status || 'Open').toLowerCase();
  if (s.includes('lost')) {
    return { bg: 'bg-rose-100 text-rose-800 border-rose-200', label: 'Lost' };
  }
  if (s.includes('closed') || s.includes('won')) {
    return { bg: 'bg-slate-200 text-slate-800 border-slate-300', label: 'Closed' };
  }
  return { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Open' };
}

export function getPriorityTheme(priority?: string) {
  const p = (priority || 'Medium').toLowerCase();
  if (p === 'high') {
    return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'High' };
  }
  if (p === 'low') {
    return { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Low' };
  }
  return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Medium' };
}

export function getEstimatedValue(lead: CrmExportLead): number {
  if (typeof lead.dealValue === 'number') return lead.dealValue;
  if (typeof lead.dealValue === 'string') {
    const parsed = parseInt(lead.dealValue.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const ratingNum = parseFloat(lead.rating || '4.5');
  if (ratingNum >= 4.8) return 100000;
  if (ratingNum >= 4.4) return 65000;
  return 35000;
}

export function getProbabilityForStage(stage?: string): number {
  const mapped = mapStageToQuickSheets(stage);
  switch (mapped) {
    case 'Lead': return 20;
    case 'Qualified': return 40;
    case 'Demo': return 60;
    case 'Proposal': return 80;
    case 'Closed': return 100;
  }
}

// Generates professional Multi-Tab XLSX formatted exactly as QuickSheetsCo CRM (Image 2)
export function exportCrmToXlsx(leads: CrmExportLead[], user?: any) {
  const ownerName = user?.name || user?.email?.split('@')[0] || 'Lisa Jones';

  // 1. Opportunities Sheet (Exact columns & formatting from Image 2)
  const opportunitiesData = leads.map((lead) => {
    const stage = mapStageToQuickSheets(lead.status);
    const prob = lead.probability ? `${lead.probability}%` : `${getProbabilityForStage(lead.status)}%`;
    const val = getEstimatedValue(lead);
    const priority = lead.priority || (val >= 80000 ? 'High' : val >= 50000 ? 'Medium' : 'Low');
    const dealStatus = lead.dealStatus || (lead.status === 'Closed Won' ? 'Closed' : lead.status === 'Lost' ? 'Lost' : 'Open');
    const lossReason = lead.lossReason || (dealStatus === 'Lost' ? 'Competitor Pricing' : '');
    const source = lead.source || (lead.category ? `${lead.category} Scraper` : 'Email Campaign');

    return {
      'Priority': priority,
      'Name': lead.dealName || `${lead.businessName} - Growth Project`,
      'Deal Owner': lead.dealOwner || ownerName,
      'Organization': lead.businessName,
      'Status': dealStatus,
      'Stage': stage,
      'Loss Reason': lossReason,
      'Source': source,
      'Value': val,
      'Probability': prob,
      'Direct Phone': lead.phone || '',
      'Direct Email': lead.email || '',
      'Location': lead.location || '',
      'Website': lead.website || ''
    };
  });

  // 2. Contacts Sheet (QuickSheetsCo tab 2)
  const contactsData = leads.map((lead) => ({
    'Contact Name': lead.firstName || (lead.businessName ? lead.businessName.split(' ')[0] + ' (Lead Contact)' : 'Primary Contact'),
    'Organization': lead.businessName,
    'Email': lead.email || 'N/A',
    'Phone': lead.phone || 'N/A',
    'Category / Industry': lead.category || 'Professional Services',
    'Location': lead.location || '',
    'Website': lead.website || '',
    'Rating': lead.rating || '4.8',
    'Current Stage': mapStageToQuickSheets(lead.status)
  }));

  // 3. Organizations Sheet (QuickSheetsCo tab 3)
  const orgsData = leads.map((lead) => ({
    'Organization': lead.businessName,
    'Industry': lead.category || 'Commercial Services',
    'Location': lead.location || '',
    'Website': lead.website || '',
    'Main Phone': lead.phone || '',
    'Work Email': lead.email || '',
    'Deal Owner': lead.dealOwner || ownerName,
    'Account Status': lead.dealStatus || 'Active Prospect'
  }));

  // 4. Interactions Sheet (QuickSheetsCo tab 4)
  const interactionsData: any[] = [];
  leads.forEach((lead) => {
    if (Array.isArray(lead.activities) && lead.activities.length > 0) {
      lead.activities.forEach((act: any) => {
        interactionsData.push({
          'Date': act.date || new Date().toISOString().split('T')[0],
          'Organization': lead.businessName,
          'Type': act.type || 'Activity',
          'Title / Agenda': act.title || act.text || 'Outreach Touchpoint',
          'Logged By': act.author || ownerName,
          'Status': act.status || 'Completed'
        });
      });
    } else {
      interactionsData.push({
        'Date': new Date().toISOString().split('T')[0],
        'Organization': lead.businessName,
        'Type': lead.phone ? 'Phone Outreach' : 'Email Dispatch',
        'Title / Agenda': `Initial touchpoint for ${lead.businessName}`,
        'Logged By': ownerName,
        'Status': lead.status || 'New'
      });
    }
  });

  // Create Sheets
  const wsOpportunities = XLSX.utils.json_to_sheet(opportunitiesData);
  const wsContacts = XLSX.utils.json_to_sheet(contactsData);
  const wsOrgs = XLSX.utils.json_to_sheet(orgsData);
  const wsInteractions = XLSX.utils.json_to_sheet(interactionsData);

  // Set Optimal Column Widths
  wsOpportunities['!cols'] = [
    { wch: 10 }, // Priority
    { wch: 30 }, // Name
    { wch: 16 }, // Deal Owner
    { wch: 28 }, // Organization
    { wch: 10 }, // Status
    { wch: 14 }, // Stage
    { wch: 16 }, // Loss Reason
    { wch: 20 }, // Source
    { wch: 14 }, // Value
    { wch: 14 }, // Probability
    { wch: 18 }, // Direct Phone
    { wch: 26 }, // Direct Email
    { wch: 20 }, // Location
    { wch: 28 }  // Website
  ];

  wsContacts['!cols'] = [
    { wch: 22 }, { wch: 28 }, { wch: 26 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 26 }, { wch: 8 }, { wch: 14 }
  ];

  wsOrgs['!cols'] = [
    { wch: 28 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 16 }
  ];

  wsInteractions['!cols'] = [
    { wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 36 }, { wch: 16 }, { wch: 14 }
  ];

  // Build Workbook with Tabs matching QuickSheetsCo
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsOpportunities, 'Opportunities');
  XLSX.utils.book_append_sheet(wb, wsContacts, 'Contacts');
  XLSX.utils.book_append_sheet(wb, wsOrgs, 'Organizations');
  XLSX.utils.book_append_sheet(wb, wsInteractions, 'Interactions');

  // Trigger Download
  XLSX.writeFile(wb, 'CRM - Customer Relationship Management | QuickSheetsCo.xlsx');
}

// Generates CSV formatted matching Image 2 columns with UTF-8 BOM
export function exportCrmToCsv(leads: CrmExportLead[], user?: any) {
  const ownerName = user?.name || user?.email?.split('@')[0] || 'Lisa Jones';

  const headers = [
    'Priority',
    'Name',
    'Deal Owner',
    'Organization',
    'Status',
    'Stage',
    'Loss Reason',
    'Source',
    'Value',
    'Probability',
    'Direct Phone',
    'Direct Email',
    'Location',
    'Website'
  ];

  const escapeCsv = (val: any) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = leads.map((lead) => {
    const stage = mapStageToQuickSheets(lead.status);
    const prob = lead.probability ? `${lead.probability}%` : `${getProbabilityForStage(lead.status)}%`;
    const val = getEstimatedValue(lead);
    const priority = lead.priority || (val >= 80000 ? 'High' : val >= 50000 ? 'Medium' : 'Low');
    const dealStatus = lead.dealStatus || (lead.status === 'Closed Won' ? 'Closed' : lead.status === 'Lost' ? 'Lost' : 'Open');
    const lossReason = lead.lossReason || (dealStatus === 'Lost' ? 'Competitor Pricing' : '');
    const source = lead.source || (lead.category ? `${lead.category} Scraper` : 'Email Campaign');

    return [
      escapeCsv(priority),
      escapeCsv(lead.dealName || `${lead.businessName} - Growth Project`),
      escapeCsv(lead.dealOwner || ownerName),
      escapeCsv(lead.businessName),
      escapeCsv(dealStatus),
      escapeCsv(stage),
      escapeCsv(lossReason),
      escapeCsv(source),
      escapeCsv(val),
      escapeCsv(prob),
      escapeCsv(lead.phone || ''),
      escapeCsv(lead.email || ''),
      escapeCsv(lead.location || ''),
      escapeCsv(lead.website || '')
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'CRM - Customer Relationship Management | QuickSheetsCo.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
