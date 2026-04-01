import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BarChart3, 
  TrendingUp, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  LogOut, 
  ChevronRight,
  Globe,
  MousePointer2,
  Eye,
  Target,
  Filter,
  FileDown,
  X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

// Types
interface GSCRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  queryCount?: number;
  posChange?: number;
}

interface Site {
  siteUrl: string;
  permissionLevel: string;
}

interface GA4Property {
  name: string;
  displayName: string;
  propertyType: string;
}

interface GA4Row {
  dimensionValues: { value: string }[];
  metricValues: { value: string }[];
}

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [ga4Properties, setGa4Properties] = useState<GA4Property[]>([]);
  const [selectedGa4Property, setSelectedGa4Property] = useState<string | null>(null);
  const [ga4Data, setGa4Data] = useState<GA4Row[]>([]);
  const [isFetchingGa4, setIsFetchingGa4] = useState(false);
  const [data, setData] = useState<GSCRow[]>([]);
  const [summary, setSummary] = useState<GSCRow | null>(null);
  const [timeSeries, setTimeSeries] = useState<GSCRow[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'login' | 'select' | 'dashboard'>('login');
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [compareStartDate, setCompareStartDate] = useState<string>(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [compareEndDate, setCompareEndDate] = useState<string>(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonData, setComparisonData] = useState<GSCRow[]>([]);
  const [comparisonSummary, setComparisonSummary] = useState<GSCRow | null>(null);
  const [comparisonTimeSeries, setComparisonTimeSeries] = useState<GSCRow[]>([]);
  const [auditTab, setAuditTab] = useState<'ctr' | 'lhf' | 'declining' | 'zero' | 'enrichment' | 'ai' | 'consolidation' | 'scroll' | 'er' | 'cta'>('ctr');
  const [erSubTab, setErSubTab] = useState<'article' | 'product'>('article');
  const [ctaSubTab, setCtaSubTab] = useState<'article' | 'product'>('article');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCtrPosition, setSelectedCtrPosition] = useState<number | null>(null);
  const [selectedCtrPage, setSelectedCtrPage] = useState<string | null>(null);
  const [excludeProduk, setExcludeProduk] = useState(false);
  const [expandedDecliningPage, setExpandedDecliningPage] = useState<string | null>(null);
  const [expandedEnrichmentPage, setExpandedEnrichmentPage] = useState<string | null>(null);
  const [expandedZeroPage, setExpandedZeroPage] = useState<string | null>(null);
  const [expandedLhfPage, setExpandedLhfPage] = useState<string | null>(null);
  const [expandedAiPage, setExpandedAiPage] = useState<string | null>(null);
  const [expandedScrollPage, setExpandedScrollPage] = useState<string | null>(null);
  const [expandedErPage, setExpandedErPage] = useState<string | null>(null);
  const [expandedCtaPage, setExpandedCtaPage] = useState<string | null>(null);
  const [selectedCtaPages, setSelectedCtaPages] = useState<Set<string>>(new Set());
  const [selectedScrollPages, setSelectedScrollPages] = useState<Set<string>>(new Set());
  const [selectedErPages, setSelectedErPages] = useState<Set<string>>(new Set());
  const [expandedConsolidationQuery, setExpandedConsolidationQuery] = useState<string | null>(null);
  const [enrichmentSort, setEnrichmentSort] = useState<{ col: 'clicks' | 'impressions' | 'position', order: 'asc' | 'desc' }>({ col: 'position', order: 'asc' });
  const [lhfSort, setLhfSort] = useState<{ col: 'clicks' | 'impressions' | 'position', order: 'asc' | 'desc' }>({ col: 'position', order: 'asc' });
  const [scrollSort, setScrollSort] = useState<{ col: 'sessions' | 'scroll_25' | 'scroll_50' | 'scroll_75', order: 'asc' | 'desc' }>({ col: 'sessions', order: 'desc' });
  const [erSort, setErSort] = useState<{ col: 'sessions' | 'er', order: 'asc' | 'desc' }>({ col: 'er', order: 'asc' });
  const [ctaSort, setCtaSort] = useState<{ col: 'sessions' | 'cta_article' | 'cta_product', order: 'asc' | 'desc' }>({ col: 'sessions', order: 'desc' });

  const getSlug = (url: string) => {
    if (!url) return '';
    try {
      // Handle cases where URL might not have protocol
      const urlToParse = url.startsWith('http') ? url : `https://${url}`;
      const path = new URL(urlToParse).pathname;
      return path;
    } catch (e) {
      // Fallback: remove domain if possible
      return url.replace(/^https?:\/\/[^\/]+/, '') || '/';
    }
  };

  const TRACKED_EVENTS = [
    "click_cta_article",
    "click_cta_ke_produk",
    "purchase",
    "purchase_marketplace",
    "purchase_tiktok",
    "purchase_whatsapp",
    "scroll_25",
    "scroll_50",
    "scroll_75",
    "page_view",
    "sessions",
    "engagement_rate"
  ];

  const getGa4StatsForPage = (pageUrl: string) => {
    const slug = getSlug(pageUrl);
    const stats: Record<string, number> = {};
    TRACKED_EVENTS.forEach(event => stats[event] = 0);

    if (!ga4Data || ga4Data.length === 0) return stats;

    ga4Data.forEach(row => {
      const rowPath = row.dimensionValues[0].value;
      const eventName = row.dimensionValues[1].value;
      const count = parseInt(row.metricValues[0].value);
      const sessions = parseInt(row.metricValues[1].value);
      const er = parseFloat(row.metricValues[2].value);

      // Simple matching: check if slug matches or rowPath matches slug
      // Normalize both by removing trailing slashes
      const normalizedSlug = slug.replace(/\/$/, "");
      const normalizedRowPath = rowPath.replace(/\/$/, "");

      if (normalizedRowPath === normalizedSlug) {
        if (stats[eventName] !== undefined) {
          stats[eventName] += count;
        }
        // If this is the page_view row, we can get the total sessions for the page
        if (eventName === 'page_view') {
          stats['sessions'] += sessions;
          stats['engagement_rate'] = er;
        }
      }
    });

    return stats;
  };

  const Ga4EventBreakdown = ({ pageUrl }: { pageUrl: string }) => {
    if (!selectedGa4Property) return null;
    const stats = getGa4StatsForPage(pageUrl);
    const hasData = Object.values(stats).some(v => v > 0);

    return (
      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Target className="w-3 h-3 text-emerald-600" />
          <h5 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">GA4 Event Tracking (Starred)</h5>
        </div>
        {!hasData ? (
          <div className="p-4 text-center text-gray-400 text-[10px] italic bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
            No GA4 event data found for this page in the selected period.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-emerald-50/30 rounded-xl border border-emerald-100">
            {Object.entries(stats).map(([event, count]) => (
              <div key={event} className="flex flex-col p-2 bg-white rounded-lg border border-emerald-100 shadow-sm">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider truncate" title={event}>
                  {event.replace(/_/g, ' ')}
                </span>
                <span className={cn(
                  "text-sm font-bold",
                  count > 0 ? "text-emerald-600" : "text-gray-300"
                )}>
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const downloadPositionPdf = (position: number, avgCtr: number) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(`CTR Optimization Report - Position ${position}`, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Average CTR for this position: ${avgCtr.toFixed(2)}%`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    // Data processing
    const pageGroups = new Map<string, { clicks: number, impressions: number, topQuery: string, queryCount: number }>();
    data.forEach(row => {
      const page = row.keys[1] || '';
      if (excludeProduk && page.includes('/produk/')) return;
      
      if (Math.round(row.position) === position) {
        if (!pageGroups.has(page)) {
          pageGroups.set(page, { clicks: row.clicks, impressions: row.impressions, topQuery: row.keys[0], queryCount: 1 });
        } else {
          const group = pageGroups.get(page)!;
          group.clicks += row.clicks;
          group.impressions += row.impressions;
          group.queryCount += 1;
        }
      }
    });

    const underperformingPages = Array.from(pageGroups.entries())
      .map(([page, stats]) => ({
        page,
        ...stats,
        ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0
      }))
      .filter(p => p.ctr < avgCtr)
      .sort((a, b) => b.impressions - a.impressions);

    const tableData: any[] = [];
    
    underperformingPages.forEach(page => {
      // Add page row
      tableData.push([
        { content: `PAGE: ${getSlug(page.page)}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: `${page.ctr.toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251], textColor: [225, 29, 72] } },
        { content: page.clicks.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: page.impressions.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find underperforming queries for this page
      const queries = data
        .filter(d => d.keys[1] === page.page && Math.round(d.position) === position)
        .map(q => ({
          query: q.keys[0],
          ctr: q.impressions > 0 ? (q.clicks / q.impressions) * 100 : 0,
          clicks: q.clicks,
          impressions: q.impressions
        }))
        .filter(q => q.ctr < avgCtr)
        .sort((a, b) => b.impressions - a.impressions);

      queries.forEach(q => {
        tableData.push([
          `  - ${q.query}`,
          `${q.ctr.toFixed(2)}%`,
          q.clicks.toLocaleString(),
          q.impressions.toLocaleString()
        ]);
      });
    });

    autoTable(doc, {
      startY: 45,
      head: [['URL / Query', 'CTR', 'Clicks', 'Impressions']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105] },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 30 }
      },
      styles: { fontSize: 9 }
    });

    doc.save(`CTR-Optimization-Position-${position}.pdf`);
  };

  const downloadEnrichmentPDF = (enrichmentData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('SEO Enrichment Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('Pages with high potential (Pos 1-10) and keywords at Pos 10+', 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData: any[] = [];
    
    enrichmentData.forEach(row => {
      // Add page row
      tableData.push([
        { content: `PAGE: ${getSlug(row.keys[0])}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.clicks.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: `${(row.ctr * 100).toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.position.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find queries for this page with position >= 10
      const queries = data
        .filter(d => d.keys[1] === row.keys[0] && d.position >= 10)
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      queries.forEach(q => {
        tableData.push([
          { content: `  - ${q.keys[0]}`, styles: { fontSize: 9, textColor: [100, 116, 139] } },
          { content: q.clicks.toLocaleString(), styles: { fontSize: 9, textColor: [100, 116, 139] } },
          { content: q.impressions.toLocaleString(), styles: { fontSize: 9, textColor: [100, 116, 139] } },
          { content: `${(q.ctr * 100).toFixed(2)}%`, styles: { fontSize: 9, textColor: [100, 116, 139] } },
          { content: q.position.toFixed(1), styles: { fontSize: 9, textColor: [100, 116, 139] } }
        ]);
      });
    });

    autoTable(doc, {
      head: [['Page / Query', 'Avg. Clicks', 'Avg. Impressions', 'Avg. CTR', 'Avg. Position']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`SEO-Enrichment-Report.pdf`);
  };

  const downloadLHFPDF = (lhfData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('Low Hanging Fruit Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('Pages with Avg. Position 10+ and keywords at Pos 10+', 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData: any[] = [];
    
    lhfData.forEach(row => {
      // Add page row
      tableData.push([
        { content: `PAGE: ${getSlug(row.keys[0])}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.queryCount?.toString() || '0', styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.clicks.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.position.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find queries for this page with position >= 10
      const queries = data
        .filter(d => d.keys[1] === row.keys[0] && d.position >= 10)
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      queries.forEach(q => {
        tableData.push([
          { content: `  - ${q.keys[0]}`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: '1', styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.impressions.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.clicks.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.position.toFixed(1), styles: { fontSize: 9, textColor: [107, 114, 128] } }
        ]);
      });
    });

    autoTable(doc, {
      head: [['Page / Query', 'Queries', 'Avg. Impressions', 'Avg. Clicks', 'Avg. Position']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`SEO-LHF-Report.pdf`);
  };

  const downloadAiPDF = (aiData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('AI Search Audit Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('Pages with informational/question-based queries (Position > 6)', 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData: any[] = [];
    const aiQuestionWords = ['apa', 'siapa', 'kapan', 'dimana', 'mengapa', 'bagaimana', 'apakah', 'bisakah', 'berapa', '?'];

    aiData.forEach(row => {
      // Add page row
      tableData.push([
        { content: `PAGE: ${getSlug(row.keys[0])}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.clicks.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: `${(row.ctr * 100).toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.position.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find question queries for this page with position > 6
      const queries = data
        .filter(d => d.keys[1] === row.keys[0] && d.position > 6 && aiQuestionWords.some(word => d.keys[0]?.toLowerCase().includes(word)))
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      queries.forEach(q => {
        tableData.push([
          { content: `  - ${q.keys[0]}`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.clicks.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.impressions.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: `${(q.ctr * 100).toFixed(2)}%`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.position.toFixed(1), styles: { fontSize: 9, textColor: [107, 114, 128] } }
        ]);
      });
    });

    autoTable(doc, {
      head: [['Page / Question Query', 'Avg. Clicks', 'Avg. Impressions', 'Avg. CTR', 'Avg. Position']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`SEO-AI-Search-Report.pdf`);
  };

  const downloadZeroPDF = (zeroData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('Zero Traffic Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('Pages with impressions but zero clicks', 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData: any[] = [];
    
    zeroData.forEach(row => {
      // Add page row
      tableData.push([
        { content: `PAGE: ${getSlug(row.keys[0])}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.queryCount?.toString() || '0', styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.clicks.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.position.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find queries for this page
      const queries = data
        .filter(d => d.keys[1] === row.keys[0])
        .sort((a, b) => b.impressions - a.impressions);

      queries.forEach(q => {
        tableData.push([
          { content: `  - ${q.keys[0]}`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: '1', styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.impressions.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.clicks.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: q.position.toFixed(1), styles: { fontSize: 9, textColor: [107, 114, 128] } }
        ]);
      });
    });

    autoTable(doc, {
      head: [['Page / Query', 'Queries', 'Avg. Impressions', 'Avg. Clicks', 'Avg. Position']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`SEO-Zero-Traffic-Report.pdf`);
  };

  const downloadConsolidationPDF = (consolidationData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('Keyword Consolidation Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text('Queries ranking on multiple pages (Cannibalization)', 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData: any[] = [];

    consolidationData.forEach(row => {
      // Add query row
      tableData.push([
        { content: `QUERY: ${row.keys[0]}`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.clicks.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: `${(row.ctr * 100).toFixed(2)}%`, styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } },
        { content: row.position.toFixed(1), styles: { fontStyle: 'bold', fillColor: [249, 250, 251] } }
      ]);

      // Find pages for this query
      const pagesMap = new Map<string, { clicks: number, impressions: number, ctr: number[], position: number[] }>();
      data.filter(d => d.keys[0] === row.keys[0]).forEach(d => {
        const p = d.keys[1];
        if (!p) return;
        if (!pagesMap.has(p)) {
          pagesMap.set(p, { clicks: 0, impressions: 0, ctr: [], position: [] });
        }
        const group = pagesMap.get(p)!;
        group.clicks += d.clicks;
        group.impressions += d.impressions;
        group.ctr.push(d.ctr);
        group.position.push(d.position);
      });

      const uniquePages = Array.from(pagesMap.entries())
        .map(([url, vals]) => ({
          url,
          clicks: vals.clicks,
          impressions: vals.impressions,
          ctr: vals.impressions > 0 ? vals.clicks / vals.impressions : 0,
          position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length
        }))
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

      uniquePages.forEach(p => {
        tableData.push([
          { content: `  - ${getSlug(p.url)}`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: p.clicks.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: p.impressions.toLocaleString(), styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: `${(p.ctr * 100).toFixed(2)}%`, styles: { fontSize: 9, textColor: [107, 114, 128] } },
          { content: p.position.toFixed(1), styles: { fontSize: 9, textColor: [107, 114, 128] } }
        ]);

        /* GA4 stats removed as requested */
      });
    });

    autoTable(doc, {
      head: [['Query / Page', 'Clicks', 'Impressions', 'CTR', 'Position']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });

    doc.save(`SEO-Consolidation-Report.pdf`);
  };

  const downloadScrollPDF = (scrollData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Filter data if some are selected
    const dataToExport = selectedScrollPages.size > 0 
      ? scrollData.filter(row => selectedScrollPages.has(row.keys[0]))
      : scrollData;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('Scroll Optimization Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Page scroll depth analysis (GA4 Events)${selectedScrollPages.size > 0 ? ` (${selectedScrollPages.size} selected)` : ''}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData = dataToExport.map(row => {
      const ga4 = getGa4StatsForPage(row.keys[0]);
      const sessions = ga4['sessions'] || 0;
      const getPerc = (val: number) => sessions > 0 ? `${((val / sessions) * 100).toFixed(1)}%` : '0%';
      return [
        getSlug(row.keys[0]),
        sessions,
        getPerc(ga4['scroll_25'] || 0),
        getPerc(ga4['scroll_50'] || 0),
        getPerc(ga4['scroll_75'] || 0)
      ];
    });

    autoTable(doc, {
      head: [['Page URL', 'Sessions', 'Scroll 25%', 'Scroll 50%', 'Scroll 75%']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 30, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 30, halign: 'right' }
      }
    });

    doc.save(`SEO-Scroll-Optimization-Report.pdf`);
  };

  const downloadErPDF = (erData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Filter data if some are selected
    const dataToExport = selectedErPages.size > 0 
      ? erData.filter(row => selectedErPages.has(row.keys[0]))
      : erData;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('ER Optimization Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Engagement Rate Analysis - Sub-tab: ${erSubTab}${selectedErPages.size > 0 ? ` (${selectedErPages.size} selected)` : ''}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData = dataToExport.map(row => {
      const ga4 = getGa4StatsForPage(row.keys[0]);
      const sessions = ga4['sessions'] || 0;
      const er = ga4['engagement_rate'] || 0;
      return [
        getSlug(row.keys[0]),
        sessions.toLocaleString(),
        `${(er * 100).toFixed(2)}%`
      ];
    });

    autoTable(doc, {
      head: [['Page URL', 'Sessions', 'Engagement Rate']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save(`SEO-ER-Optimization-${erSubTab}-Report.pdf`);
  };

  const downloadCtaPDF = (ctaData: any[]) => {
    const doc = new jsPDF() as any;
    
    // Filter data if some are selected
    const dataToExport = selectedCtaPages.size > 0 
      ? ctaData.filter(row => selectedCtaPages.has(row.keys[0]))
      : ctaData;

    // Header
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text('CTA Optimization Report', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`CTA Analysis - Sub-tab: ${ctaSubTab}${selectedCtaPages.size > 0 ? ` (${selectedCtaPages.size} selected)` : ''}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 36);
    
    const tableData = dataToExport.map(row => {
      const ga4 = getGa4StatsForPage(row.keys[0]);
      const sessions = ga4['sessions'] || 0;
      const ctaArticle = ga4['click_cta_article'] || 0;
      const ctaProduct = ga4['click_cta_ke_produk'] || 0;
      
      const ctaArticlePerc = sessions > 0 ? (ctaArticle / sessions) * 100 : 0;
      const ctaProductPerc = sessions > 0 ? (ctaProduct / sessions) * 100 : 0;
      
      return [
        getSlug(row.keys[0]),
        sessions.toLocaleString(),
        `${ctaArticlePerc.toFixed(2)}%`,
        `${ctaProductPerc.toFixed(2)}%`
      ];
    });

    autoTable(doc, {
      head: [['Page URL', 'Sessions', 'CTA Article %', 'CTA Product %']],
      body: tableData,
      startY: 45,
      theme: 'striped',
      headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 3 },
    });

    doc.save(`SEO-CTA-Optimization-${ctaSubTab}-Report.pdf`);
  };

  useEffect(() => {
    setSelectedCtrPosition(null);
    setSelectedCtrPage(null);
    setExpandedDecliningPage(null);
    setExpandedEnrichmentPage(null);
    setExpandedZeroPage(null);
    setExpandedLhfPage(null);
    setExpandedAiPage(null);
    setExpandedConsolidationQuery(null);
    setExpandedCtaPage(null);
    setSelectedCtaPages(new Set());
  }, [auditTab]);

  useEffect(() => {
    setSelectedCtaPages(new Set());
  }, [ctaSubTab]);

  useEffect(() => {
    setSelectedCtrPage(null);
  }, [selectedCtrPosition]);

  useEffect(() => {
    checkAuthStatus();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsConnected(true);
        setViewState('select');
        fetchSites();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const status = await res.json();
      setIsConnected(status.connected);
      if (status.connected) {
        setViewState('select');
        fetchSites();
      }
    } catch (err) {
      console.error('Auth check failed', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSelectedCtaPages(new Set());
  }, [ctaSubTab]);

  useEffect(() => {
    setSelectedErPages(new Set());
  }, [erSubTab]);

  useEffect(() => {
    setSelectedCtaPages(new Set());
    setSelectedScrollPages(new Set());
    setSelectedErPages(new Set());
  }, [auditTab]);

  const fetchSites = async () => {
    try {
      const gscRes = await fetch('/api/gsc/sites');
      const sitesData = await gscRes.json();
      setSites(sitesData);
      
      const ga4Res = await fetch('/api/ga4/properties');
      const ga4Data = await ga4Res.json();
      if (ga4Res.ok) {
        setGa4Properties(ga4Data);
      } else if (ga4Data.error && ga4Data.error.includes("Google Analytics Admin API is not enabled")) {
        setError(ga4Data.error);
      }
    } catch (err) {
      setError('Failed to load sites or properties');
    }
  };

  const fetchData = async (siteUrl: string) => {
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after end date.');
      return;
    }
    if (isComparing && new Date(compareStartDate) > new Date(compareEndDate)) {
      setError('Comparison start date cannot be after end date.');
      return;
    }

    setIsFetchingData(true);
    setError(null);
    try {
      // Fetch current period
      const res = await fetch(`/api/gsc/data?siteUrl=${encodeURIComponent(siteUrl)}&startDate=${startDate}&endDate=${endDate}`);
      const gscResponse = await res.json();
      
      if (res.status !== 200) {
        throw new Error(gscResponse.error || 'Failed to fetch GSC data');
      }

      if (gscResponse.rows) {
        setData(gscResponse.rows);
        setSummary(gscResponse.summary);
        setTimeSeries(gscResponse.timeSeries);
        setViewState('dashboard');
      } else {
        setData([]);
        setSummary(null);
        setTimeSeries([]);
        setError('No data returned for current period.');
      }

      // Fetch comparison period if enabled
      if (isComparing) {
        const compRes = await fetch(`/api/gsc/data?siteUrl=${encodeURIComponent(siteUrl)}&startDate=${compareStartDate}&endDate=${compareEndDate}`);
        const compResponse = await compRes.json();
        
        if (compRes.status !== 200) {
          throw new Error(compResponse.error || 'Failed to fetch comparison data');
        }

        if (compResponse.rows) {
          setComparisonData(compResponse.rows);
          setComparisonSummary(compResponse.summary);
          setComparisonTimeSeries(compResponse.timeSeries);
        } else {
          setComparisonData([]);
          setComparisonSummary(null);
          setComparisonTimeSeries([]);
        }
      } else {
        setComparisonData([]);
        setComparisonSummary(null);
        setComparisonTimeSeries([]);
      }

      // Fetch GA4 data if property is selected
      if (selectedGa4Property) {
        setIsFetchingGa4(true);
        try {
          const ga4Res = await fetch(`/api/ga4/data?propertyId=${selectedGa4Property.split('/').pop()}&startDate=${startDate}&endDate=${endDate}`);
          const ga4Data = await ga4Res.json();
          if (ga4Res.ok) {
            setGa4Data(ga4Data);
          } else if (ga4Data.error && ga4Data.error.includes("Google Analytics Data API is not enabled")) {
            setError(ga4Data.error);
          }
        } catch (err) {
          console.error('Failed to fetch GA4 data:', err);
        } finally {
          setIsFetchingGa4(false);
        }
      } else {
        setGa4Data([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch GSC data');
    } finally {
      setIsFetchingData(false);
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/auth/url');
      const { url } = await res.json();
      window.open(url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      setError('Failed to start connection');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsConnected(false);
    setSites([]);
    setData([]);
    setSelectedSite(null);
    setViewState('login');
  };

  useEffect(() => {
    if (selectedSite && viewState === 'dashboard') {
      fetchData(selectedSite);
    }
  }, [startDate, endDate, compareStartDate, compareEndDate, isComparing]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (viewState === 'login') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl w-full text-center space-y-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-600/10 border border-emerald-600/20 mb-4">
            <Search className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-gradient-to-b from-gray-900 to-gray-700 bg-clip-text text-transparent">
            SEO Content Audit Ultimate
          </h1>
          <p className="text-xl text-gray-600 max-w-lg mx-auto leading-relaxed">
            Connect your Google Search Console to unlock deep insights, visualize performance, and audit your content like a pro.
          </p>
          
          <div className="pt-8">
            <button 
              onClick={handleConnect}
              className="group relative px-8 py-4 bg-emerald-600 text-white font-semibold rounded-full overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-600/20"
            >
              <span className="relative z-10 flex items-center gap-2">
                Connect Google Search Console
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
            {[
              { icon: BarChart3, title: "Visual Analytics", desc: "Interactive charts for clicks, impressions, and CTR.", color: "text-blue-500", bg: "bg-blue-50" },
              { icon: Target, title: "Opportunity Finder", desc: "Identify high-impression, low-CTR pages to optimize.", color: "text-rose-500", bg: "bg-rose-50" },
              { icon: Globe, title: "Global Reach", desc: "Analyze performance by country and device type.", color: "text-emerald-500", bg: "bg-emerald-50" }
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", feature.bg)}>
                  <feature.icon className={cn("w-6 h-6", feature.color)} />
                </div>
                <h3 className="font-semibold mb-2 text-gray-900">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  if (viewState === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-center p-6">
        {error && (
          <div className="max-w-md w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-600 text-sm shadow-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Error</p>
              <p className="opacity-90">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-3xl bg-white border border-gray-200 shadow-2xl space-y-6"
        >
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold">Select Property</h2>
            <p className="text-gray-500 text-sm mt-2">Choose the website you want to audit from your Search Console.</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-1">Search Console Property</label>
              {sites.length > 0 ? (
                sites.map((site) => (
                  <button
                    key={site.siteUrl}
                    onClick={() => setSelectedSite(site.siteUrl)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all flex items-center justify-between group",
                      selectedSite === site.siteUrl 
                        ? "bg-emerald-50 border-emerald-600 text-emerald-700" 
                        : "bg-white border-gray-200 hover:border-gray-300 text-gray-600"
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium truncate max-w-[240px]">{site.siteUrl}</span>
                      <span className="text-[10px] uppercase tracking-wider opacity-50">{site.permissionLevel}</span>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                      selectedSite === site.siteUrl ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                    )}>
                      {selectedSite === site.siteUrl && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">
                  No GSC properties found.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-400 px-1 flex items-center justify-between">
                <span>Google Analytics 4 (Optional)</span>
                {ga4Properties.length > 0 && <span className="text-emerald-600 text-[8px] bg-emerald-50 px-1.5 py-0.5 rounded">Connected</span>}
              </label>
              {ga4Properties.length > 0 ? (
                <div className="max-h-48 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                  {ga4Properties.map((prop) => (
                    <button
                      key={prop.name}
                      onClick={() => setSelectedGa4Property(selectedGa4Property === prop.name ? null : prop.name)}
                      className={cn(
                        "w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between group text-xs",
                        selectedGa4Property === prop.name 
                          ? "bg-emerald-50 border-emerald-600 text-emerald-700" 
                          : "bg-white border-gray-200 hover:border-gray-300 text-gray-600"
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium truncate max-w-[200px]">{prop.displayName}</span>
                        <span className="text-[8px] uppercase tracking-wider opacity-50">{prop.name.split('/').pop()}</span>
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                        selectedGa4Property === prop.name ? "border-emerald-600 bg-emerald-600" : "border-gray-300"
                      )}>
                        {selectedGa4Property === prop.name && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl">
                  No GA4 properties found or scope not granted.
                </div>
              )}
            </div>
          </div>

          <button
            disabled={!selectedSite || isFetchingData}
            onClick={() => selectedSite && fetchData(selectedSite)}
            className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            {isFetchingData ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Start Audit"}
          </button>

          <button 
            onClick={handleLogout}
            className="w-full py-2 text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            Switch Account
          </button>
        </motion.div>
      </div>
    );
  }

  // Dashboard View
  const isMainRecent = !isComparing || new Date(startDate) >= new Date(compareStartDate);
  
  const activeSummary = isMainRecent ? summary : comparisonSummary;
  const activeComparisonSummary = isMainRecent ? comparisonSummary : summary;
  const activeData = isMainRecent ? data : comparisonData;
  const activeComparisonData = isMainRecent ? comparisonData : data;
  const activeTimeSeries = isMainRecent ? timeSeries : comparisonTimeSeries;
  const activeComparisonTimeSeries = isMainRecent ? comparisonTimeSeries : timeSeries;

  const totalClicks = activeSummary?.clicks || 0;
  const totalImpressions = activeSummary?.impressions || 0;
  const avgCtr = (activeSummary?.ctr || 0) * 100;
  const avgPos = activeSummary?.position || 0;

  const totalGa4Events = ga4Data.reduce((acc, row) => acc + parseInt(row.metricValues[0].value), 0);
  const totalSales = ga4Data
    .filter(row => row.dimensionValues[1].value.includes('purchase'))
    .reduce((acc, row) => acc + parseInt(row.metricValues[0].value), 0);

  const compClicks = activeComparisonSummary?.clicks || 0;
  const compImpressions = activeComparisonSummary?.impressions || 0;
  const compCtr = (activeComparisonSummary?.ctr || 0) * 100;
  const compPos = activeComparisonSummary?.position || 0;

  const getChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const renderChange = (current: number, previous: number, inverse = false) => {
    if (!isComparing) return null;
    const change = getChange(current, previous);
    if (change === 0) return <div className="text-[10px] font-bold text-gray-400">—</div>;
    
    const isPositive = change > 0;
    const isGood = inverse ? !isPositive : isPositive;
    
    return (
      <div className={cn(
        "text-[10px] font-bold flex items-center gap-0.5 px-2 py-0.5 rounded-full",
        isGood ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      )}>
        {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
      </div>
    );
  };

  // Top Pages (simplified from query/page dimensions)
  const topQueries = [...activeData]
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  const getMonthlyData = (rows: GSCRow[]) => {
    const monthly: Record<string, { date: string, clicks: number, impressions: number }> = {};
    rows.forEach(row => {
      const d = new Date(row.keys[0]);
      if (isNaN(d.getTime())) return;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthly[monthKey]) {
        monthly[monthKey] = { 
          date: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 
          clicks: 0, 
          impressions: 0 
        };
      }
      monthly[monthKey].clicks += row.clicks;
      monthly[monthKey].impressions += row.impressions;
    });
    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => val);
  };

  const currentMonthly = getMonthlyData(activeTimeSeries);
  const prevMonthly = getMonthlyData(activeComparisonTimeSeries);

  const monthlyChartData = currentMonthly.map((curr, i) => ({
    ...curr,
    prevClicks: prevMonthly[i]?.clicks,
    prevImpressions: prevMonthly[i]?.impressions,
  }));

  const chartData = activeTimeSeries.length > 31 ? monthlyChartData : activeTimeSeries.map((row, i) => ({
    ...row,
    date: row.keys[0],
    prevClicks: activeComparisonTimeSeries[i]?.clicks,
    prevImpressions: activeComparisonTimeSeries[i]?.impressions,
  }));

  // Audit Logic
  const getAuditData = () => {
    let filtered = [...activeData];

    if (searchQuery) {
      filtered = filtered.filter(row => 
        row.keys[0]?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.keys[1]?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    switch (auditTab) {
      case 'lhf':
        const pageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], hasLowPosQuery: boolean, queries: Set<string> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          
          if (!pageGroups.has(page)) {
            pageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], hasLowPosQuery: false, queries: new Set() });
          }
          const group = pageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (row.keys[0]) group.queries.add(row.keys[0]);
          if (row.position >= 10) {
            group.hasLowPosQuery = true;
          }
        });

        let aggregated = Array.from(pageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0) / vals.clicks.length,
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            hasLowPosQuery: vals.hasLowPosQuery,
            queryCount: vals.queries.size
          }))
          .filter(row => row.position >= 10 && row.hasLowPosQuery);

        if (searchQuery) {
          aggregated = aggregated.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregated.sort((a, b) => {
          const factor = lhfSort.order === 'asc' ? 1 : -1;
          if (lhfSort.col === 'clicks') return (a.clicks - b.clicks) * factor;
          if (lhfSort.col === 'impressions') return (a.impressions - b.impressions) * factor;
          return (a.position - b.position) * factor;
        });
      case 'zero':
        // First, identify LHF pages to exclude them
        const lhfPagesForZero = new Set<string>();
        const tempLhfGroupsForZero = new Map<string, { position: number[], hasLowPosQuery: boolean }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          if (!tempLhfGroupsForZero.has(page)) {
            tempLhfGroupsForZero.set(page, { position: [], hasLowPosQuery: false });
          }
          const group = tempLhfGroupsForZero.get(page)!;
          group.position.push(row.position);
          if (row.position >= 10) group.hasLowPosQuery = true;
        });
        
        tempLhfGroupsForZero.forEach((vals, page) => {
          const avgPos = vals.position.reduce((a, b) => a + b, 0) / vals.position.length;
          if (avgPos >= 10 && vals.hasLowPosQuery) {
            lhfPagesForZero.add(page);
          }
        });

        const zeroPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Set<string> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          const query = row.keys[0];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          if (lhfPagesForZero.has(page)) return; // EXCLUDE LHF PAGES
          
          if (!zeroPageGroups.has(page)) {
            zeroPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Set() });
          }
          const group = zeroPageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (query) group.queries.add(query);
        });

        let aggregatedZero = Array.from(zeroPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0),
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            queryCount: vals.queries.size
          }))
          .filter(row => row.clicks === 0 && (row.queryCount || 0) < 6);

        if (searchQuery) {
          aggregatedZero = aggregatedZero.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }
        return aggregatedZero.sort((a, b) => b.impressions - a.impressions);
      case 'enrichment':
        // First, identify LHF pages to exclude them
        const lhfPages = new Set<string>();
        const tempLhfGroups = new Map<string, { position: number[], hasLowPosQuery: boolean }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          if (!tempLhfGroups.has(page)) {
            tempLhfGroups.set(page, { position: [], hasLowPosQuery: false });
          }
          const group = tempLhfGroups.get(page)!;
          group.position.push(row.position);
          if (row.position >= 10) group.hasLowPosQuery = true;
        });
        
        tempLhfGroups.forEach((vals, page) => {
          const avgPos = vals.position.reduce((a, b) => a + b, 0) / vals.position.length;
          if (avgPos >= 10 && vals.hasLowPosQuery) {
            lhfPages.add(page);
          }
        });

        const enrichmentPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], hasLowPosQuery: boolean }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          if (getSlug(page) === '/') return;
          if (lhfPages.has(page)) return; // EXCLUDE LHF PAGES
          
          if (!enrichmentPageGroups.has(page)) {
            enrichmentPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], hasLowPosQuery: false });
          }
          const group = enrichmentPageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (row.position >= 10) {
            group.hasLowPosQuery = true;
          }
        });

        let aggregatedEnrichment = Array.from(enrichmentPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0),
            impressions: vals.impressions.reduce((a, b) => a + b, 0),
            ctr: vals.impressions.reduce((a, b) => a + b, 0) > 0 
              ? vals.clicks.reduce((a, b) => a + b, 0) / vals.impressions.reduce((a, b) => a + b, 0) 
              : 0,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            hasLowPosQuery: vals.hasLowPosQuery
          }))
          .filter(row => row.position >= 1 && row.position <= 10 && row.hasLowPosQuery);

        if (searchQuery) {
          aggregatedEnrichment = aggregatedEnrichment.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedEnrichment.sort((a, b) => {
          const factor = enrichmentSort.order === 'asc' ? 1 : -1;
          if (enrichmentSort.col === 'clicks') return (a.clicks - b.clicks) * factor;
          if (enrichmentSort.col === 'impressions') return (a.impressions - b.impressions) * factor;
          return (a.position - b.position) * factor;
        });
      case 'ai':
        const aiQuestionWords = ['apa', 'siapa', 'kapan', 'dimana', 'mengapa', 'bagaimana', 'apakah', 'bisakah', 'berapa', '?'];
        const aiPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], hasQuestion: boolean }>();
        
        activeData.forEach(row => {
          const page = row.keys[1];
          const query = row.keys[0];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          
          if (!aiPageGroups.has(page)) {
            aiPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], hasQuestion: false });
          }
          const group = aiPageGroups.get(page)!;
          
          if (query && row.position > 6 && aiQuestionWords.some(word => query.toLowerCase().includes(word))) {
            group.hasQuestion = true;
            group.clicks.push(row.clicks);
            group.impressions.push(row.impressions);
            group.ctr.push(row.ctr);
            group.position.push(row.position);
          }
        });

        let aggregatedAi = Array.from(aiPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0) / vals.clicks.length,
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            hasQuestion: vals.hasQuestion
          }))
          .filter(row => row.hasQuestion);

        if (searchQuery) {
          aggregatedAi = aggregatedAi.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedAi.sort((a, b) => b.impressions - a.impressions);
      case 'declining':
        if (!isComparing || activeComparisonData.length === 0) return [];
        
        const currentPages = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Map<string, { clicks: number, impressions: number, ctr: number, position: number }> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          const query = row.keys[0];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          
          if (!currentPages.has(page)) {
            currentPages.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Map() });
          }
          const group = currentPages.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (query) {
            group.queries.set(query, { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position });
          }
        });

        const prevPages = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Map<string, { clicks: number, impressions: number, ctr: number, position: number }> }>();
        activeComparisonData.forEach(row => {
          const page = row.keys[1];
          const query = row.keys[0];
          if (!page || page.includes('#')) return;
          
          if (!prevPages.has(page)) {
            prevPages.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Map() });
          }
          const group = prevPages.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (query) {
            group.queries.set(query, { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position });
          }
        });

        let aggregatedDeclining = Array.from(currentPages.entries())
          .map(([page, vals]) => {
            const currentPos = vals.position.reduce((a, b) => a + b, 0) / vals.position.length;
            const currentClicks = vals.clicks.reduce((a, b) => a + b, 0);
            
            const prevVals = prevPages.get(page);
            const prevPos = prevVals ? prevVals.position.reduce((a, b) => a + b, 0) / prevVals.position.length : currentPos;
            const prevClicks = prevVals ? prevVals.clicks.reduce((a, b) => a + b, 0) : currentClicks;
            
            // Find declining queries for this page
            const decliningQueries: any[] = [];
            vals.queries.forEach((qData, qName) => {
              const pQData = prevVals?.queries.get(qName);
              const qClickChange = qData.clicks - (pQData?.clicks || 0);
              const qPosChange = qData.position - (pQData?.position || qData.position);
              
              if (qClickChange < 0 || qPosChange > 0) {
                decliningQueries.push({
                  query: qName,
                  clicks: qData.clicks,
                  clickChange: qClickChange,
                  position: qData.position,
                  posChange: qPosChange
                });
              }
            });

            return {
              keys: [page],
              clicks: currentClicks,
              impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
              ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
              position: currentPos,
              posChange: currentPos - prevPos,
              clickChange: currentClicks - prevClicks,
              queryCount: vals.queries.size,
              decliningQueries: decliningQueries.sort((a, b) => b.posChange - a.posChange)
            };
          })
          .filter(row => (row.clickChange < 0 || row.posChange > 0) && row.position >= 12);

        if (searchQuery) {
          aggregatedDeclining = aggregatedDeclining.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedDeclining.sort((a, b) => b.posChange - a.posChange);
      case 'consolidation':
        // Find queries that have multiple pages
        const queryGroups = new Map<string, { clicks: number, impressions: number, ctr: number[], position: number[], pages: string[] }>();
        
        activeData.forEach(row => {
          const q = row.keys[0];
          const p = row.keys[1];
          if (!q || !p) return;
          if (excludeProduk && p.includes('/produk/')) return;

          if (!queryGroups.has(q)) {
            queryGroups.set(q, { clicks: 0, impressions: 0, ctr: [], position: [], pages: [] });
          }
          const group = queryGroups.get(q)!;
          group.clicks += row.clicks;
          group.impressions += row.impressions;
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (!group.pages.includes(p)) group.pages.push(p);
        });

        let cannibalized = Array.from(queryGroups.entries())
          .filter(([_, data]) => data.pages.length > 1)
          .map(([query, data]) => ({
            keys: [query],
            clicks: data.clicks,
            impressions: data.impressions,
            ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
            position: data.position.reduce((a, b) => a + b, 0) / data.position.length,
            pages: data.pages
          }));

        if (searchQuery) {
          cannibalized = cannibalized.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return cannibalized.sort((a, b) => b.impressions - a.impressions);
      case 'scroll':
        const scrollPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Set<string> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          if (excludeProduk && page.includes('/produk/')) return;
          
          if (!scrollPageGroups.has(page)) {
            scrollPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Set() });
          }
          const group = scrollPageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (row.keys[0]) group.queries.add(row.keys[0]);
        });

        let aggregatedScroll = Array.from(scrollPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0) / vals.clicks.length,
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            queryCount: vals.queries.size
          }))
          .filter(row => {
            const stats = getGa4StatsForPage(row.keys[0]);
            const sessions = stats.sessions || 0;
            if (sessions === 0) return false;
            
            const p25 = (stats.scroll_25 || 0) / sessions;
            const p50 = (stats.scroll_50 || 0) / sessions;
            const p75 = (stats.scroll_75 || 0) / sessions;
            
            return p25 < 0.7 || p50 < 0.5 || p75 < 0.3;
          });

        if (searchQuery) {
          aggregatedScroll = aggregatedScroll.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedScroll.sort((a, b) => {
          const statsA = getGa4StatsForPage(a.keys[0]);
          const statsB = getGa4StatsForPage(b.keys[0]);
          const factor = scrollSort.order === 'asc' ? 1 : -1;
          
          if (scrollSort.col === 'sessions') return ((statsA.sessions || 0) - (statsB.sessions || 0)) * factor;
          
          const getPerc = (stats: any, col: string) => {
            const s = stats.sessions || 0;
            const v = stats[col] || 0;
            return s > 0 ? v / s : 0;
          };

          if (scrollSort.col === 'scroll_25') return (getPerc(statsA, 'scroll_25') - getPerc(statsB, 'scroll_25')) * factor;
          if (scrollSort.col === 'scroll_50') return (getPerc(statsA, 'scroll_50') - getPerc(statsB, 'scroll_50')) * factor;
          if (scrollSort.col === 'scroll_75') return (getPerc(statsA, 'scroll_75') - getPerc(statsB, 'scroll_75')) * factor;
          
          return (b.impressions - a.impressions);
        });
      case 'er':
        const erPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Set<string> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          
          // Filter based on sub-tab
          const isProduk = page.includes('/produk/');
          if (erSubTab === 'article' && isProduk) return;
          if (erSubTab === 'product' && !isProduk) return;
          
          if (excludeProduk && isProduk) return;
          
          if (!erPageGroups.has(page)) {
            erPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Set() });
          }
          const group = erPageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (row.keys[0]) group.queries.add(row.keys[0]);
        });

        let aggregatedEr = Array.from(erPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0) / vals.clicks.length,
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            queryCount: vals.queries.size
          }))
          .filter(row => {
            const stats = getGa4StatsForPage(row.keys[0]);
            const er = stats.engagement_rate || 0;
            const sessions = stats.sessions || 0;
            
            if (sessions === 0) return false;
            
            if (erSubTab === 'article') {
              return er < 0.5;
            } else {
              return er < 0.4;
            }
          });

        if (searchQuery) {
          aggregatedEr = aggregatedEr.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedEr.sort((a, b) => {
          const statsA = getGa4StatsForPage(a.keys[0]);
          const statsB = getGa4StatsForPage(b.keys[0]);
          const factor = erSort.order === 'asc' ? 1 : -1;
          
          if (erSort.col === 'sessions') return ((statsA.sessions || 0) - (statsB.sessions || 0)) * factor;
          if (erSort.col === 'er') return ((statsA.engagement_rate || 0) - (statsB.engagement_rate || 0)) * factor;
          
          return (b.impressions - a.impressions);
        });
      case 'cta':
        const ctaPageGroups = new Map<string, { clicks: number[], impressions: number[], ctr: number[], position: number[], queries: Set<string> }>();
        activeData.forEach(row => {
          const page = row.keys[1];
          if (!page || page.includes('#')) return;
          
          const isProduk = page.includes('/produk/');
          if (ctaSubTab === 'article' && isProduk) return;
          if (ctaSubTab === 'product' && !isProduk) return;
          
          if (excludeProduk && isProduk) return;
          
          if (!ctaPageGroups.has(page)) {
            ctaPageGroups.set(page, { clicks: [], impressions: [], ctr: [], position: [], queries: new Set() });
          }
          const group = ctaPageGroups.get(page)!;
          group.clicks.push(row.clicks);
          group.impressions.push(row.impressions);
          group.ctr.push(row.ctr);
          group.position.push(row.position);
          if (row.keys[0]) group.queries.add(row.keys[0]);
        });

        let aggregatedCta = Array.from(ctaPageGroups.entries())
          .map(([page, vals]) => ({
            keys: [page],
            clicks: vals.clicks.reduce((a, b) => a + b, 0) / vals.clicks.length,
            impressions: vals.impressions.reduce((a, b) => a + b, 0) / vals.impressions.length,
            ctr: vals.ctr.reduce((a, b) => a + b, 0) / vals.ctr.length,
            position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length,
            queryCount: vals.queries.size
          }))
          .filter(row => {
            const stats = getGa4StatsForPage(row.keys[0]);
            const sessions = stats.sessions || 0;
            return sessions > 0;
          });

        if (searchQuery) {
          aggregatedCta = aggregatedCta.filter(row => row.keys[0].toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return aggregatedCta.sort((a, b) => {
          const statsA = getGa4StatsForPage(a.keys[0]);
          const statsB = getGa4StatsForPage(b.keys[0]);
          const factor = ctaSort.order === 'asc' ? 1 : -1;
          
          if (ctaSort.col === 'sessions') return ((statsA.sessions || 0) - (statsB.sessions || 0)) * factor;
          
          const getPerc = (stats: any, col: string) => {
            const s = stats.sessions || 0;
            const v = stats[col] || 0;
            return s > 0 ? v / s : 0;
          };

          if (ctaSort.col === 'cta_article') return (getPerc(statsA, 'click_cta_article') - getPerc(statsB, 'click_cta_article')) * factor;
          if (ctaSort.col === 'cta_product') return (getPerc(statsA, 'click_cta_ke_produk') - getPerc(statsB, 'click_cta_ke_produk')) * factor;
          
          return (b.impressions - a.impressions);
        });
      case 'ctr':
        // This is handled by a special view, but for the table we'll just return all
        return filtered;
      default:
        return filtered;
    }
  };

  const getCTRStats = () => {
    const stats: Record<number, { clicks: number, impressions: number, queries: number }> = {};
    for (let i = 1; i <= 10; i++) {
      stats[i] = { clicks: 0, impressions: 0, queries: 0 };
    }

    activeData.forEach(row => {
      const page = row.keys[1] || '';
      if (excludeProduk && page.includes('/produk/')) return;
      
      const pos = Math.round(row.position);
      if (pos >= 1 && pos <= 10) {
        stats[pos].clicks += row.clicks;
        stats[pos].impressions += row.impressions;
        stats[pos].queries += 1;
      }
    });

    return Object.entries(stats).map(([pos, data]) => ({
      position: parseInt(pos),
      avgClicks: data.queries > 0 ? data.clicks / data.queries : 0,
      avgImpressions: data.queries > 0 ? data.impressions / data.queries : 0,
      avgCtr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      totalQueries: data.queries
    }));
  };

  const auditRows = getAuditData();
  const ctrStats = getCTRStats();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar / Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg hidden md:block">SEO Audit Ultimate</h1>
            
            <div className="h-6 w-px bg-gray-200 mx-2 hidden md:block" />
            
            <button 
              onClick={() => setViewState('select')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm hover:border-emerald-500/50 transition-colors shadow-sm"
            >
              <Globe className="w-4 h-4 text-emerald-600" />
              <span className="font-medium truncate max-w-[150px] md:max-w-md">{selectedSite}</span>
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg p-1">
                <div className="flex items-center gap-2 px-2">
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-[9px] uppercase font-black leading-none mb-0.5",
                      isMainRecent ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {isMainRecent ? 'Current' : 'Previous'}
                    </span>
                    <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 focus:outline-none font-bold"
                    />
                  </div>
                </div>
                <div className="w-px h-6 bg-gray-200" />
                <div className="flex items-center gap-2 px-2">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 uppercase font-black leading-none mb-0.5">End</span>
                    <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-xs text-gray-700 focus:outline-none font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsComparing(!isComparing)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-bold transition-all border flex items-center gap-2",
                    isComparing 
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                      : "bg-white border-gray-200 text-gray-500 hover:text-gray-700 shadow-sm"
                  )}
                >
                  <RefreshCw className={cn("w-3 h-3", isComparing && "animate-spin-once")} />
                  {isComparing ? 'Comparing' : 'Compare'}
                </button>
                
                {isComparing && (
                  <>
                    <button
                      onClick={() => {
                        const s = startDate;
                        const e = endDate;
                        setStartDate(compareStartDate);
                        setEndDate(compareEndDate);
                        setCompareStartDate(s);
                        setCompareEndDate(e);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors border border-gray-200 bg-white"
                      title="Swap periods"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg p-1 animate-in fade-in slide-in-from-left-2">
                      <div className="flex items-center gap-2 px-2">
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[9px] uppercase font-black leading-none mb-0.5",
                            !isMainRecent ? "text-emerald-600" : "text-amber-600"
                          )}>
                            {!isMainRecent ? 'Current' : 'Previous'}
                          </span>
                          <input 
                            type="date" 
                            value={compareStartDate}
                            onChange={(e) => setCompareStartDate(e.target.value)}
                            className="bg-transparent text-xs text-gray-700 focus:outline-none font-bold"
                          />
                        </div>
                      </div>
                      <div className="w-px h-6 bg-gray-200" />
                      <div className="flex items-center gap-2 px-2">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-gray-400 uppercase font-black leading-none mb-0.5">End</span>
                          <input 
                            type="date" 
                            value={compareEndDate}
                            onChange={(e) => setCompareEndDate(e.target.value)}
                            className="bg-transparent text-xs text-gray-700 focus:outline-none font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button 
              onClick={() => selectedSite && fetchData(selectedSite)}
              disabled={isFetchingData}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 text-gray-600"
            >
              <RefreshCw className={cn("w-5 h-5", isFetchingData && "animate-spin")} />
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-8">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { 
              label: 'Total clicks', 
              value: totalClicks >= 1000 ? `${(totalClicks/1000).toFixed(2)}K` : totalClicks.toLocaleString(), 
              prevValue: compClicks >= 1000 ? `${(compClicks/1000).toFixed(2)}K` : compClicks.toLocaleString(),
              icon: MousePointer2, 
              iconColor: 'text-[#4285f4]',
              currentRaw: totalClicks, 
              prevRaw: compClicks 
            },
            { 
              label: 'Total impressions', 
              value: totalImpressions >= 1000 ? `${(totalImpressions/1000).toFixed(0)}K` : totalImpressions.toLocaleString(), 
              prevValue: compImpressions >= 1000 ? `${(compImpressions/1000).toFixed(0)}K` : compImpressions.toLocaleString(),
              icon: Eye, 
              iconColor: 'text-[#7b1fa2]',
              currentRaw: totalImpressions, 
              prevRaw: compImpressions 
            },
            { 
              label: 'Average CTR', 
              value: `${avgCtr.toFixed(1)}%`, 
              prevValue: `${compCtr.toFixed(1)}%`,
              icon: TrendingUp, 
              iconColor: 'text-[#0097a7]',
              currentRaw: avgCtr, 
              prevRaw: compCtr 
            },
            { 
              label: 'Average position', 
              value: avgPos.toFixed(1), 
              prevValue: compPos.toFixed(1),
              icon: BarChart3, 
              iconColor: 'text-[#ef6c00]',
              currentRaw: avgPos, 
              prevRaw: compPos, 
              inverse: true 
            }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="p-4 rounded-xl shadow-sm border border-gray-200 bg-white transition-all relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-3">
                <stat.icon className={cn("w-4 h-4", stat.iconColor)} />
                <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{stat.label}</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-3xl font-bold leading-none mb-1 text-gray-900">{stat.value}</div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {new Date(isMainRecent ? startDate : compareStartDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' })} - {new Date(isMainRecent ? endDate : compareEndDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                    </div>
                  </div>
                  {isComparing && stat.currentRaw !== undefined && renderChange(stat.currentRaw, stat.prevRaw, stat.inverse)}
                </div>

                {isComparing && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="text-xl font-bold text-gray-600 mb-0.5">{stat.prevValue}</div>
                    <div className="text-[10px] text-gray-400 font-medium">
                      {new Date(isMainRecent ? compareStartDate : startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' })} - {new Date(isMainRecent ? compareEndDate : endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'numeric', year: '2-digit' })}
                    </div>
                  </div>
                )}
              </div>

              {/* Decorative Sparkline Placeholder */}
              <div className="absolute bottom-0 right-0 w-24 h-12 opacity-5 pointer-events-none">
                <svg viewBox="0 0 100 40" className="w-full h-full stroke-gray-900 fill-none stroke-2">
                  <path d="M0,35 Q15,30 25,35 T50,20 T75,25 T100,5" />
                </svg>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Audit Table */}
        <div className="rounded-3xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Content Audit</h2>
              <p className="text-sm text-gray-500">Analyze performance and find optimization opportunities.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search queries..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full md:w-64"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            {/* Sidebar Tabs */}
            <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-gray-100 p-6 space-y-1 bg-gray-50/50">
              {[
                { id: 'ctr', label: 'CTR Analysis', icon: MousePointer2 },
                { id: 'lhf', label: 'Low Hanging Fruit', icon: Target },
                { id: 'declining', label: 'Declining', icon: TrendingUp },
                { id: 'zero', label: 'Zero Traffic', icon: AlertCircle },
                { id: 'enrichment', label: 'Enrichment', icon: Target },
                { id: 'ai', label: 'AI Search', icon: Search },
                { id: 'consolidation', label: 'Consolidation', icon: Filter },
                { id: 'scroll', label: 'Scroll Optimization', icon: TrendingUp },
                { id: 'er', label: 'ER Optimization', icon: BarChart3 },
                { id: 'cta', label: 'CTA Optimization', icon: MousePointer2 },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAuditTab(tab.id as any)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left",
                    auditTab === tab.id 
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <tab.icon className={cn("w-4 h-4", auditTab === tab.id ? "text-white" : "text-gray-400")} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {auditTab === 'ctr' ? (
            <div className="space-y-8">
              <div className="px-8 pt-6 flex items-center justify-between bg-gray-50/30 border-b border-gray-100 pb-6">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filters:</span>
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div 
                      onClick={() => setExcludeProduk(!excludeProduk)}
                      className={cn(
                        "w-11 h-6 rounded-full transition-all relative shadow-inner",
                        excludeProduk ? "bg-rose-500" : "bg-gray-200"
                      )}
                    >
                      <div className={cn(
                        "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                        excludeProduk ? "left-6" : "left-1"
                      )} />
                    </div>
                    <span className={cn(
                      "text-sm font-bold transition-colors",
                      excludeProduk ? "text-rose-600" : "text-gray-600 group-hover:text-gray-900"
                    )}>
                      Exclude "/produk/" pages
                    </span>
                  </label>
                </div>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                  {excludeProduk ? "Filter Active" : "No Filters"}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Position</th>
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Avg. CTR</th>
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Avg. Clicks</th>
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Avg. Impressions</th>
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Total Queries</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ctrStats.map((stat) => (
                      <React.Fragment key={stat.position}>
                        <tr 
                          onClick={() => setSelectedCtrPosition(selectedCtrPosition === stat.position ? null : stat.position)}
                          className={cn(
                            "hover:bg-gray-50 transition-colors group cursor-pointer",
                            selectedCtrPosition === stat.position && "bg-emerald-50 border-l-4 border-emerald-600"
                          )}
                        >
                          <td className="px-8 py-4">
                            <span className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors",
                              selectedCtrPosition === stat.position ? "bg-emerald-600 text-white" : "bg-gray-100 text-emerald-600"
                            )}>
                              {stat.position}
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-gray-700">{stat.avgCtr.toFixed(2)}%</span>
                              <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${Math.min(stat.avgCtr * 2, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-4 text-sm font-medium text-gray-600">{stat.avgClicks.toFixed(1)}</td>
                          <td className="px-8 py-4 text-sm font-medium text-gray-600">{stat.avgImpressions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-8 py-4 text-sm font-medium text-gray-600">{stat.totalQueries}</td>
                        </tr>
                        <AnimatePresence>
                          {selectedCtrPosition === stat.position && (
                            <tr>
                              <td colSpan={5} className="p-0 border-b border-gray-100 bg-gray-50/30">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-8">
                                    <div className="mb-6 flex items-center justify-between">
                                      <div>
                                        <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900">
                                          <TrendingUp className="w-5 h-5 text-rose-500" />
                                          Underperforming Pages (Position {stat.position})
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                          Pages at position {stat.position} with CTR below the average of {stat.avgCtr.toFixed(2)}%
                                        </p>
                                      </div>
                                      <button
                                        onClick={() => downloadPositionPdf(stat.position, stat.avgCtr)}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20"
                                      >
                                        <FileDown className="w-4 h-4" />
                                        Download PDF
                                      </button>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                      <table className="w-full text-left border-collapse">
                                        <thead>
                                          <tr className="border-b border-gray-100 bg-gray-50/50">
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">Query / Page</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Queries</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">CTR</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Clicks</th>
                                            <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 text-right">Impressions</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {(() => {
                                            const avgCtr = stat.avgCtr;
                                            const pageGroups = new Map<string, { clicks: number, impressions: number, topQuery: string, maxQueryImpressions: number, queryCount: number }>();
                                            
                                            data.forEach(row => {
                                              const page = row.keys[1] || '';
                                              if (excludeProduk && page.includes('/produk/')) return;
                                              
                                              const pos = Math.round(row.position);
                                              if (pos !== stat.position) return;
                                              
                                              if (!pageGroups.has(page)) {
                                                pageGroups.set(page, { 
                                                  clicks: row.clicks, 
                                                  impressions: row.impressions, 
                                                  topQuery: row.keys[0], 
                                                  maxQueryImpressions: row.impressions,
                                                  queryCount: 1
                                                });
                                              } else {
                                                const group = pageGroups.get(page)!;
                                                group.clicks += row.clicks;
                                                group.impressions += row.impressions;
                                                group.queryCount += 1;
                                                if (row.impressions > group.maxQueryImpressions) {
                                                  group.topQuery = row.keys[0];
                                                  group.maxQueryImpressions = row.impressions;
                                                }
                                              }
                                            });

                                            const results = Array.from(pageGroups.entries())
                                              .map(([page, stats]) => ({
                                                page,
                                                ...stats,
                                                ctr: stats.impressions > 0 ? (stats.clicks / stats.impressions) * 100 : 0
                                              }))
                                              .filter(p => p.ctr < avgCtr)
                                              .sort((a, b) => b.impressions - a.impressions)
                                              .slice(0, 50);

                                            if (results.length === 0) {
                                              return (
                                                <tr>
                                                  <td colSpan={5} className="px-8 py-12 text-center text-gray-400 italic">
                                                    No underperforming pages found for this position.
                                                  </td>
                                                </tr>
                                              );
                                            }

                                            return results.map((row, idx) => (
                                              <React.Fragment key={idx}>
                                                <tr 
                                                  onClick={() => setSelectedCtrPage(selectedCtrPage === row.page ? null : row.page)}
                                                  className={cn(
                                                    "hover:bg-gray-50 transition-colors group cursor-pointer",
                                                    selectedCtrPage === row.page && "bg-rose-50/50"
                                                  )}
                                                >
                                                  <td className="px-8 py-4 max-w-md">
                                                    <div className="flex flex-col gap-1">
                                                      <span className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                                                        <ExternalLink className="w-3 h-3 text-gray-400" />
                                                        {getSlug(row.page)}
                                                      </span>
                                                      <span className="text-[10px] text-gray-400 truncate">
                                                        Top Query: {row.topQuery}
                                                      </span>
                                                    </div>
                                                  </td>
                                                  <td className="px-8 py-4 text-right text-sm font-medium text-gray-600">
                                                    {row.queryCount}
                                                  </td>
                                                  <td className="px-8 py-4 text-right">
                                                    <span className="text-sm font-bold text-rose-500">
                                                      {row.ctr.toFixed(2)}%
                                                    </span>
                                                  </td>
                                                  <td className="px-8 py-4 text-sm font-medium text-gray-600 text-right">{row.clicks.toLocaleString()}</td>
                                                  <td className="px-8 py-4 text-sm font-medium text-gray-400 text-right">{row.impressions.toLocaleString()}</td>
                                                </tr>
                                                <AnimatePresence>
                                                  {selectedCtrPage === row.page && (
                                                    <tr>
                                                      <td colSpan={5} className="p-0 bg-gray-50/50 border-b border-gray-100">
                                                        <motion.div
                                                          initial={{ height: 0, opacity: 0 }}
                                                          animate={{ height: "auto", opacity: 1 }}
                                                          exit={{ height: 0, opacity: 0 }}
                                                          className="overflow-hidden"
                                                        >
                                                          <div className="p-6">
                                                            <div className="mb-4">
                                                              <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                                <Search className="w-4 h-4 text-emerald-500" />
                                                                Underperforming Queries for this Page (Position {stat.position})
                                                              </h4>
                                                              <p className="text-[10px] text-gray-500 mt-0.5">
                                                                Queries with CTR below {avgCtr.toFixed(2)}%
                                                              </p>
                                                            </div>
                                                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                              <table className="w-full text-left border-collapse">
                                                                <thead>
                                                                  <tr className="border-b border-gray-100 bg-gray-50/50">
                                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">Query</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">CTR</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Clicks</th>
                                                                    <th className="px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Impressions</th>
                                                                  </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                  {data
                                                                    .filter(d => 
                                                                      d.keys[1] === row.page && 
                                                                      Math.round(d.position) === stat.position &&
                                                                      (d.clicks / d.impressions) * 100 < avgCtr
                                                                    )
                                                                    .sort((a, b) => b.impressions - a.impressions)
                                                                    .map((q, qIdx) => (
                                                                      <tr key={qIdx} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-6 py-3 text-xs font-medium text-gray-700">{q.keys[0]}</td>
                                                                        <td className="px-6 py-3 text-right">
                                                                          <span className="text-xs font-bold text-rose-500">
                                                                            {((q.clicks / q.impressions) * 100).toFixed(2)}%
                                                                          </span>
                                                                        </td>
                                                                        <td className="px-6 py-3 text-right text-xs text-gray-600">{q.clicks.toLocaleString()}</td>
                                                                        <td className="px-6 py-3 text-right text-xs text-gray-400">{q.impressions.toLocaleString()}</td>
                                                                      </tr>
                                                                    ))
                                                                  }
                                                                </tbody>
                                                              </table>
                                                            </div>
                                                          </div>
                                                        </motion.div>
                                                      </td>
                                                    </tr>
                                                  )}
                                                </AnimatePresence>
                                              </React.Fragment>
                                            ));
                                          })()}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {(auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation' || auditTab === 'scroll' || auditTab === 'er' || auditTab === 'cta') && (
                <div className="px-8 pt-6 flex items-center justify-between bg-gray-50/30 border-b border-gray-100 pb-6">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                      <Filter className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Filters:</span>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        onClick={() => setExcludeProduk(!excludeProduk)}
                        className={cn(
                          "w-11 h-6 rounded-full transition-all relative shadow-inner",
                          excludeProduk ? "bg-rose-500" : "bg-gray-200"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                          excludeProduk ? "left-6" : "left-1"
                        )} />
                      </div>
                      <span className={cn(
                        "text-sm font-bold transition-colors",
                        excludeProduk ? "text-rose-600" : "text-gray-600 group-hover:text-gray-900"
                      )}>
                        Exclude "/produk/" pages
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
                      {excludeProduk ? "Filter Active" : "No Filters"}
                    </div>
                    {auditTab === 'enrichment' && (
                      <button
                        onClick={() => downloadEnrichmentPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                    {auditTab === 'lhf' && (
                      <button
                        onClick={() => downloadLHFPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                    {auditTab === 'ai' && (
                      <button
                        onClick={() => downloadAiPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                    {auditTab === 'zero' && (
                      <button
                        onClick={() => downloadZeroPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                    {auditTab === 'consolidation' && (
                      <button
                        onClick={() => downloadConsolidationPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                      </button>
                    )}
                    {auditTab === 'scroll' && (
                      <button
                        onClick={() => downloadScrollPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        {selectedScrollPages.size > 0 ? `Export Selected (${selectedScrollPages.size})` : 'Download PDF'}
                      </button>
                    )}
                    {auditTab === 'er' && (
                      <button
                        onClick={() => downloadErPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        {selectedErPages.size > 0 ? `Export Selected (${selectedErPages.size})` : 'Download PDF'}
                      </button>
                    )}
                    {auditTab === 'cta' && (
                      <button
                        onClick={() => downloadCtaPDF(auditRows)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        <FileDown className="w-4 h-4" />
                        {selectedCtaPages.size > 0 ? `Export Selected (${selectedCtaPages.size})` : 'Download PDF'}
                      </button>
                    )}
                  </div>
                  {auditTab === 'er' && (
                    <div className="px-8 py-4 bg-gray-50/30 border-b border-gray-100 flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-xl w-fit">
                        <button
                          onClick={() => setErSubTab('article')}
                          className={cn(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                            erSubTab === 'article' 
                              ? "bg-white text-emerald-600 shadow-sm" 
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Artikel Biasa (&lt; 50% ER)
                        </button>
                        <button
                          onClick={() => setErSubTab('product')}
                          className={cn(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                            erSubTab === 'product' 
                              ? "bg-white text-emerald-600 shadow-sm" 
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Halaman Produk (&lt; 40% ER)
                        </button>
                      </div>
                    </div>
                  )}
                  {auditTab === 'cta' && (
                    <div className="px-8 py-4 bg-gray-50/30 border-b border-gray-100 flex items-center gap-2">
                      <div className="flex items-center gap-2 bg-gray-100/50 p-1 rounded-xl w-fit">
                        <button
                          onClick={() => setCtaSubTab('article')}
                          className={cn(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                            ctaSubTab === 'article' 
                              ? "bg-white text-emerald-600 shadow-sm" 
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Artikel Biasa
                        </button>
                        <button
                          onClick={() => setCtaSubTab('product')}
                          className={cn(
                            "px-6 py-2 rounded-lg text-xs font-bold transition-all",
                            ctaSubTab === 'product' 
                              ? "bg-white text-emerald-600 shadow-sm" 
                              : "text-gray-500 hover:text-gray-700"
                          )}
                        >
                          Halaman Artikel Produk
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    {(auditTab === 'cta' || auditTab === 'scroll' || auditTab === 'er') && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400 w-10">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          checked={
                            auditRows.length > 0 && 
                            (auditTab === 'cta' ? selectedCtaPages.size === auditRows.length :
                             auditTab === 'scroll' ? selectedScrollPages.size === auditRows.length :
                             selectedErPages.size === auditRows.length)
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allIds = auditRows.map(r => r.keys[0]);
                              if (auditTab === 'cta') setSelectedCtaPages(new Set(allIds));
                              else if (auditTab === 'scroll') setSelectedScrollPages(new Set(allIds));
                              else setSelectedErPages(new Set(allIds));
                            } else {
                              if (auditTab === 'cta') setSelectedCtaPages(new Set());
                              else if (auditTab === 'scroll') setSelectedScrollPages(new Set());
                              else setSelectedErPages(new Set());
                            }
                          }}
                        />
                      </th>
                    )}
                    <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                      {auditTab === 'consolidation' ? 'Query' : (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'scroll' || auditTab === 'er' || auditTab === 'cta') ? 'Page URL' : 'Query / Page'}
                    </th>
                    {(auditTab === 'scroll' || auditTab === 'er' || auditTab === 'cta') && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          Sessions
                          <button 
                            onClick={() => {
                              if (auditTab === 'scroll') {
                                setScrollSort({ col: 'sessions', order: scrollSort.col === 'sessions' && scrollSort.order === 'desc' ? 'asc' : 'desc' });
                              } else if (auditTab === 'er') {
                                setErSort({ col: 'sessions', order: erSort.col === 'sessions' && erSort.order === 'desc' ? 'asc' : 'desc' });
                              } else {
                                setCtaSort({ col: 'sessions', order: ctaSort.col === 'sessions' && ctaSort.order === 'desc' ? 'asc' : 'desc' });
                              }
                            }}
                            className={cn("p-1 rounded hover:bg-gray-200 transition-colors", (auditTab === 'scroll' ? scrollSort.col === 'sessions' : auditTab === 'er' ? erSort.col === 'sessions' : ctaSort.col === 'sessions') && "text-emerald-600 bg-emerald-50")}
                          >
                            <TrendingUp className={cn("w-3 h-3", (auditTab === 'scroll' ? (scrollSort.col === 'sessions' && scrollSort.order === 'asc') : auditTab === 'er' ? (erSort.col === 'sessions' && erSort.order === 'asc') : (ctaSort.col === 'sessions' && ctaSort.order === 'asc')) && "rotate-180")} />
                          </button>
                        </div>
                      </th>
                    )}
                    {auditTab === 'er' && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          Engagement Rate
                          <button 
                            onClick={() => setErSort({ col: 'er', order: erSort.col === 'er' && erSort.order === 'desc' ? 'asc' : 'desc' })}
                            className={cn("p-1 rounded hover:bg-gray-200 transition-colors", erSort.col === 'er' && "text-emerald-600 bg-emerald-50")}
                          >
                            <TrendingUp className={cn("w-3 h-3", erSort.col === 'er' && erSort.order === 'asc' && "rotate-180")} />
                          </button>
                        </div>
                      </th>
                    )}
                    {auditTab === 'cta' && (
                      <>
                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <div className="flex items-center gap-2">
                            CTA Article %
                            <button 
                              onClick={() => setCtaSort({ col: 'cta_article', order: ctaSort.col === 'cta_article' && ctaSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", ctaSort.col === 'cta_article' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", ctaSort.col === 'cta_article' && ctaSort.order === 'asc' && "rotate-180")} />
                            </button>
                          </div>
                        </th>
                        <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                          <div className="flex items-center gap-2">
                            CTA Product %
                            <button 
                              onClick={() => setCtaSort({ col: 'cta_product', order: ctaSort.col === 'cta_product' && ctaSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", ctaSort.col === 'cta_product' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", ctaSort.col === 'cta_product' && ctaSort.order === 'asc' && "rotate-180")} />
                            </button>
                          </div>
                        </th>
                      </>
                    )}
                    {auditTab !== 'er' && auditTab !== 'cta' && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          {auditTab === 'scroll' ? 'Scroll 25%' : (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? 'Avg. Clicks' : 'Clicks'}
                          {auditTab === 'scroll' && (
                            <button 
                              onClick={() => setScrollSort({ col: 'scroll_25', order: scrollSort.col === 'scroll_25' && scrollSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", scrollSort.col === 'scroll_25' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", scrollSort.col === 'scroll_25' && scrollSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                          {auditTab === 'enrichment' && (
                            <button 
                              onClick={() => setEnrichmentSort({ col: 'clicks', order: enrichmentSort.col === 'clicks' && enrichmentSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", enrichmentSort.col === 'clicks' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", enrichmentSort.col === 'clicks' && enrichmentSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                          {auditTab === 'lhf' && (
                            <button 
                              onClick={() => setLhfSort({ col: 'clicks', order: lhfSort.col === 'clicks' && lhfSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", lhfSort.col === 'clicks' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", lhfSort.col === 'clicks' && lhfSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                        </div>
                      </th>
                    )}
                    {auditTab !== 'er' && auditTab !== 'cta' && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          {auditTab === 'scroll' ? 'Scroll 50%' : (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? 'Avg. Impressions' : 'Impressions'}
                          {auditTab === 'scroll' && (
                            <button 
                              onClick={() => setScrollSort({ col: 'scroll_50', order: scrollSort.col === 'scroll_50' && scrollSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", scrollSort.col === 'scroll_50' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", scrollSort.col === 'scroll_50' && scrollSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                          {auditTab === 'enrichment' && (
                            <button 
                              onClick={() => setEnrichmentSort({ col: 'impressions', order: enrichmentSort.col === 'impressions' && enrichmentSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", enrichmentSort.col === 'impressions' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", enrichmentSort.col === 'impressions' && enrichmentSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                          {auditTab === 'lhf' && (
                            <button 
                              onClick={() => setLhfSort({ col: 'impressions', order: lhfSort.col === 'impressions' && lhfSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", lhfSort.col === 'impressions' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", lhfSort.col === 'impressions' && lhfSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                        </div>
                      </th>
                    )}

                    {auditTab !== 'lhf' && auditTab !== 'er' && auditTab !== 'cta' && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          {auditTab === 'scroll' ? 'Scroll 75%' : (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? 'Avg. CTR' : 'CTR'}
                          {auditTab === 'scroll' && (
                            <button 
                              onClick={() => setScrollSort({ col: 'scroll_75', order: scrollSort.col === 'scroll_75' && scrollSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", scrollSort.col === 'scroll_75' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", scrollSort.col === 'scroll_75' && scrollSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                        </div>
                      </th>
                    )}
                    {auditTab !== 'scroll' && auditTab !== 'er' && auditTab !== 'cta' && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        <div className="flex items-center gap-2">
                          {(auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? 'Avg. Position' : 'Position'}
                          {auditTab === 'enrichment' && (
                            <button 
                              onClick={() => setEnrichmentSort({ col: 'position', order: enrichmentSort.col === 'position' && enrichmentSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", enrichmentSort.col === 'clicks' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", enrichmentSort.col === 'position' && enrichmentSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                          {auditTab === 'lhf' && (
                            <button 
                              onClick={() => setLhfSort({ col: 'position', order: lhfSort.col === 'position' && lhfSort.order === 'desc' ? 'asc' : 'desc' })}
                              className={cn("p-1 rounded hover:bg-gray-200 transition-colors", lhfSort.col === 'position' && "text-emerald-600 bg-emerald-50")}
                            >
                              <TrendingUp className={cn("w-3 h-3", lhfSort.col === 'position' && lhfSort.order === 'asc' && "rotate-180")} />
                            </button>
                          )}
                        </div>
                      </th>
                    )}
                    {(auditTab === 'declining' || auditTab === 'zero' || auditTab === 'consolidation' || auditTab === 'lhf') && (
                      <th className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-gray-400">
                        {auditTab === 'consolidation' ? 'Pages' : 'Queries'}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditRows.map((row, idx) => (
                    <React.Fragment key={idx}>
                      <tr 
                        className={cn(
                          "hover:bg-gray-50 transition-colors group",
                          (auditTab === 'declining' || auditTab === 'enrichment' || auditTab === 'zero' || auditTab === 'lhf' || auditTab === 'ai' || auditTab === 'consolidation' || auditTab === 'scroll') && "cursor-pointer",
                          ((expandedDecliningPage === row.keys[0] && auditTab === 'declining') || (expandedEnrichmentPage === row.keys[0] && auditTab === 'enrichment') || (expandedZeroPage === row.keys[0] && auditTab === 'zero') || (expandedLhfPage === row.keys[0] && auditTab === 'lhf') || (expandedAiPage === row.keys[0] && auditTab === 'ai') || (expandedConsolidationQuery === row.keys[0] && auditTab === 'consolidation') || (expandedScrollPage === row.keys[0] && auditTab === 'scroll')) && "bg-emerald-50/30"
                        )}
                        onClick={() => {
                          if (auditTab === 'declining') {
                            setExpandedDecliningPage(expandedDecliningPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'enrichment') {
                            setExpandedEnrichmentPage(expandedEnrichmentPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'zero') {
                            setExpandedZeroPage(expandedZeroPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'lhf') {
                            setExpandedLhfPage(expandedLhfPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'ai') {
                            setExpandedAiPage(expandedAiPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'consolidation') {
                            setExpandedConsolidationQuery(expandedConsolidationQuery === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'scroll') {
                            setExpandedScrollPage(expandedScrollPage === row.keys[0] ? null : row.keys[0]);
                          } else if (auditTab === 'er') {
                            setExpandedErPage(expandedErPage === row.keys[0] ? null : row.keys[0]);
                          }
                        }}
                      >
                        {(auditTab === 'cta' || auditTab === 'scroll' || auditTab === 'er') && (
                          <td className="px-8 py-4 w-10">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              checked={
                                auditTab === 'cta' ? selectedCtaPages.has(row.keys[0]) :
                                auditTab === 'scroll' ? selectedScrollPages.has(row.keys[0]) :
                                selectedErPages.has(row.keys[0])
                              }
                              onChange={(e) => {
                                if (auditTab === 'cta') {
                                  const newSelected = new Set(selectedCtaPages);
                                  if (e.target.checked) newSelected.add(row.keys[0]);
                                  else newSelected.delete(row.keys[0]);
                                  setSelectedCtaPages(newSelected);
                                } else if (auditTab === 'scroll') {
                                  const newSelected = new Set(selectedScrollPages);
                                  if (e.target.checked) newSelected.add(row.keys[0]);
                                  else newSelected.delete(row.keys[0]);
                                  setSelectedScrollPages(newSelected);
                                } else {
                                  const newSelected = new Set(selectedErPages);
                                  if (e.target.checked) newSelected.add(row.keys[0]);
                                  else newSelected.delete(row.keys[0]);
                                  setSelectedErPages(newSelected);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                        )}
                        <td className="px-8 py-4 max-w-md">
                          <div className="flex flex-col gap-1">
                            {auditTab === 'consolidation' ? (
                              <span className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                                <Search className="w-3 h-3 text-gray-400" />
                                {row.keys[0]}
                              </span>
                            ) : (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'scroll' || auditTab === 'er' || auditTab === 'cta') ? (
                              <span className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors flex items-center gap-2">
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                                {getSlug(row.keys[0])}
                              </span>
                            ) : (
                              <>
                                <span className="text-sm font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                                  {row.keys[0]}
                                </span>
                                <span className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                                  <ExternalLink className="w-2 h-2" />
                                  {row.keys[1]}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        {(auditTab === 'scroll' || auditTab === 'er' || auditTab === 'cta') && (
                          <td className="px-8 py-4 text-sm font-bold text-gray-700">
                            {getGa4StatsForPage(row.keys[0])['sessions'] || 0}
                          </td>
                        )}
                        {auditTab === 'er' && (
                          <td className="px-8 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-700">
                                {((getGa4StatsForPage(row.keys[0])['engagement_rate'] || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                          </td>
                        )}
                        {auditTab === 'cta' && (
                          <>
                            <td className="px-8 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-700">
                                  {(() => {
                                    const stats = getGa4StatsForPage(row.keys[0]);
                                    const sessions = stats.sessions || 0;
                                    const val = stats.click_cta_article || 0;
                                    return sessions > 0 ? `${((val / sessions) * 100).toFixed(2)}%` : '0.00%';
                                  })()}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-700">
                                  {(() => {
                                    const stats = getGa4StatsForPage(row.keys[0]);
                                    const sessions = stats.sessions || 0;
                                    const val = stats.click_cta_ke_produk || 0;
                                    return sessions > 0 ? `${((val / sessions) * 100).toFixed(2)}%` : '0.00%';
                                  })()}
                                </span>
                              </div>
                            </td>
                          </>
                        )}
                      {auditTab !== 'er' && auditTab !== 'cta' && (
                        <td className="px-8 py-4 text-sm font-bold text-gray-700">
                        <div className="flex flex-col">
                          {auditTab === 'scroll' ? (
                            (() => {
                              const stats = getGa4StatsForPage(row.keys[0]);
                              const sessions = stats['sessions'] || 0;
                              const scrollValue = stats['scroll_25'] || 0;
                              const percentage = sessions > 0 ? (scrollValue / sessions) * 100 : 0;
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-700">{percentage.toFixed(1)}%</span>
                                  <span className="text-[10px] text-gray-400 font-normal">{scrollValue.toLocaleString()} events</span>
                                </div>
                              );
                            })()
                          ) : (
                            <span>{(auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? row.clicks.toFixed(1) : row.clicks.toLocaleString()}</span>
                          )}
                          {auditTab === 'declining' && row.clickChange !== undefined && (
                            <span className={cn("text-[10px] font-bold", row.clickChange < 0 ? "text-rose-600" : "text-emerald-600")}>
                              {row.clickChange < 0 ? '↓' : '↑'} {Math.abs(row.clickChange).toFixed(1)}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {auditTab !== 'er' && auditTab !== 'cta' && (
                        <td className="px-8 py-4 text-sm font-medium text-gray-500">
                        {auditTab === 'scroll' ? (
                          (() => {
                            const stats = getGa4StatsForPage(row.keys[0]);
                            const sessions = stats['sessions'] || 0;
                            const scrollValue = stats['scroll_50'] || 0;
                            const percentage = sessions > 0 ? (scrollValue / sessions) * 100 : 0;
                            return (
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-700">{percentage.toFixed(1)}%</span>
                                <span className="text-[10px] text-gray-400 font-normal">{scrollValue.toLocaleString()} events</span>
                              </div>
                            );
                          })()
                        ) : (
                          (auditTab === 'lhf' || auditTab === 'declining' || auditTab === 'zero' || auditTab === 'enrichment' || auditTab === 'ai' || auditTab === 'consolidation') ? row.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 }) : row.impressions.toLocaleString()
                        )}
                      </td>
                    )}

                      {auditTab !== 'er' && auditTab !== 'cta' && (auditTab !== 'lhf' || auditTab === 'scroll') && (
                        <td className="px-8 py-4">
                          {auditTab === 'scroll' ? (
                            (() => {
                              const stats = getGa4StatsForPage(row.keys[0]);
                              const sessions = stats['sessions'] || 0;
                              const scrollValue = stats['scroll_75'] || 0;
                              const percentage = sessions > 0 ? (scrollValue / sessions) * 100 : 0;
                              return (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-700">{percentage.toFixed(1)}%</span>
                                  <span className="text-[10px] text-gray-400 font-normal">{scrollValue.toLocaleString()} events</span>
                                </div>
                              );
                            })()
                          ) : (
                            <span className={cn(
                              "px-2 py-1 rounded text-[10px] font-bold",
                              row.ctr > 0.05 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                            )}>
                              {(row.ctr * 100).toFixed(2)}%
                            </span>
                          )}
                        </td>
                      )}
                        {auditTab !== 'scroll' && auditTab !== 'er' && auditTab !== 'cta' && (
                          <td className="px-8 py-4">
                            <div className="flex flex-col">
                              <span className={cn(
                                "text-sm font-bold",
                                row.position <= 3 ? "text-emerald-600" : row.position <= 10 ? "text-emerald-600" : "text-gray-400"
                              )}>
                                {row.position.toFixed(1)}
                              </span>
                              {auditTab === 'declining' && row.posChange !== undefined && (
                                <span className={cn("text-[10px] font-bold", row.posChange > 0 ? "text-rose-600" : "text-emerald-600")}>
                                  {row.posChange > 0 ? '↓' : '↑'} {Math.abs(row.posChange).toFixed(1)}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {(auditTab === 'declining' || auditTab === 'zero' || auditTab === 'consolidation' || auditTab === 'lhf') && (
                          <td className="px-8 py-4">
                            <span className="text-sm font-bold text-gray-600">
                              {auditTab === 'consolidation' ? row.pages.length : (row.queryCount || 0)}
                            </span>
                          </td>
                        )}
                    </tr>
                    {expandedConsolidationQuery === row.keys[0] && auditTab === 'consolidation' && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pages Ranking for this Query</h4>
                              <span className="text-[10px] text-gray-400 italic">Showing pages for "{row.keys[0]}"</span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Page URL</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Impressions</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">CTR</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {(() => {
                                  const pagesMap = new Map<string, { clicks: number, impressions: number, ctr: number[], position: number[] }>();
                                  data.filter(d => d.keys[0] === row.keys[0]).forEach(d => {
                                    const p = d.keys[1];
                                    if (!p) return;
                                    if (!pagesMap.has(p)) {
                                      pagesMap.set(p, { clicks: 0, impressions: 0, ctr: [], position: [] });
                                    }
                                    const group = pagesMap.get(p)!;
                                    group.clicks += d.clicks;
                                    group.impressions += d.impressions;
                                    group.ctr.push(d.ctr);
                                    group.position.push(d.position);
                                  });
                                  
                                  return Array.from(pagesMap.entries())
                                    .map(([url, vals]) => ({
                                      url,
                                      clicks: vals.clicks,
                                      impressions: vals.impressions,
                                      ctr: vals.impressions > 0 ? vals.clicks / vals.impressions : 0,
                                      position: vals.position.reduce((a, b) => a + b, 0) / vals.position.length
                                    }))
                                    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
                                    .map((p, pIdx) => (
                                      <tr key={pIdx} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2 text-xs font-medium text-gray-700 flex items-center gap-2">
                                          <ExternalLink className="w-3 h-3 text-gray-400" />
                                          {getSlug(p.url)}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-right font-bold text-gray-700">{p.clicks.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-xs text-right text-gray-500">{p.impressions.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-xs text-right">
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                                            {(p.ctr * 100).toFixed(2)}%
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-right font-medium text-gray-600">{p.position.toFixed(1)}</td>
                                      </tr>
                                    ));
                                })()}
                              </tbody>
                            </table>
                            <div className="px-4 py-4 border-t border-gray-100">
                              <Ga4EventBreakdown pageUrl={row.keys[0]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedAiPage === row.keys[0] && auditTab === 'ai' && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Question-based Queries</h4>
                              <span className="text-[10px] text-gray-400 italic">Showing queries for {getSlug(row.keys[0])}</span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Query</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Impressions</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. CTR</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {data
                                  .filter(d => d.keys[1] === row.keys[0] && d.position > 6 && ['apa', 'siapa', 'kapan', 'dimana', 'mengapa', 'bagaimana', 'apakah', 'bisakah', 'berapa', '?'].some(word => d.keys[0]?.toLowerCase().includes(word)))
                                  .sort((a, b) => b.impressions - a.impressions)
                                  .map((q, qIdx) => (
                                    <tr key={qIdx} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 text-xs font-medium text-gray-700">{q.keys[0]}</td>
                                      <td className="px-4 py-2 text-xs text-right font-bold text-gray-700">{q.clicks.toFixed(1)}</td>
                                      <td className="px-4 py-2 text-xs text-right text-gray-500">{q.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                      <td className="px-4 py-2 text-xs text-right">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                                          {(q.ctr * 100).toFixed(2)}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-right font-medium text-gray-600">{q.position.toFixed(1)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-4 border-t border-gray-100">
                              <Ga4EventBreakdown pageUrl={row.keys[0]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedLhfPage === row.keys[0] && auditTab === 'lhf' && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Associated Queries (Position 10+)</h4>
                              <span className="text-[10px] text-gray-400 italic">Showing queries for {getSlug(row.keys[0])}</span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Query</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Impressions</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. CTR</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {data
                                  .filter(d => d.keys[1] === row.keys[0] && d.position >= 10)
                                  .sort((a, b) => b.impressions - a.impressions)
                                  .map((q, qIdx) => (
                                    <tr key={qIdx} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 text-xs font-medium text-gray-700">{q.keys[0]}</td>
                                      <td className="px-4 py-2 text-xs text-right font-bold text-gray-700">{q.clicks.toFixed(1)}</td>
                                      <td className="px-4 py-2 text-xs text-right text-gray-500">{q.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                      <td className="px-4 py-2 text-xs text-right">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                                          {(q.ctr * 100).toFixed(2)}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-right font-medium text-gray-600">{q.position.toFixed(1)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-4 border-t border-gray-100">
                              <Ga4EventBreakdown pageUrl={row.keys[0]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedDecliningPage === row.keys[0] && auditTab === 'declining' && row.decliningQueries && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                              <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Declining Query</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {row.decliningQueries.map((q: any, qIdx: number) => (
                                  <tr key={qIdx} className="hover:bg-gray-50/50">
                                    <td className="px-4 py-2 text-xs font-medium text-gray-700">{q.query}</td>
                                    <td className="px-4 py-2 text-xs text-right">
                                      <div className="flex flex-col items-end">
                                        <span className="font-bold">{q.clicks}</span>
                                        <span className={cn("text-[9px] font-bold", q.clickChange < 0 ? "text-rose-600" : "text-emerald-600")}>
                                          {q.clickChange < 0 ? '↓' : '↑'} {Math.abs(q.clickChange).toFixed(1)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-xs text-right">
                                      <div className="flex flex-col items-end">
                                        <span className="font-bold">{q.position.toFixed(1)}</span>
                                        <span className={cn("text-[9px] font-bold", q.posChange > 0 ? "text-rose-600" : "text-emerald-600")}>
                                          {q.posChange > 0 ? '↓' : '↑'} {Math.abs(q.posChange).toFixed(1)}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-4 border-t border-gray-100">
                              <Ga4EventBreakdown pageUrl={row.keys[0]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedZeroPage === row.keys[0] && auditTab === 'zero' && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Associated Queries for Zero Traffic Page</h4>
                              <span className="text-[10px] text-gray-400 italic">Showing queries for {getSlug(row.keys[0])}</span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Query</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Impressions</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. CTR</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Avg. Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {data
                                  .filter(d => d.keys[1] === row.keys[0])
                                  .sort((a, b) => b.impressions - a.impressions)
                                  .map((q, qIdx) => (
                                    <tr key={qIdx} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 text-xs font-medium text-gray-700">{q.keys[0]}</td>
                                      <td className="px-4 py-2 text-xs text-right font-bold text-gray-700">{q.clicks.toFixed(1)}</td>
                                      <td className="px-4 py-2 text-xs text-right text-gray-500">{q.impressions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                      <td className="px-4 py-2 text-xs text-right">
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">
                                          {(q.ctr * 100).toFixed(2)}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-right font-medium text-gray-600">{q.position.toFixed(1)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                            <div className="px-4 py-4 border-t border-gray-100">
                              <Ga4EventBreakdown pageUrl={row.keys[0]} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {expandedEnrichmentPage === row.keys[0] && auditTab === 'enrichment' && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={6} className="px-8 py-4">
                          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Potential Queries (Position 10+)</h4>
                              <span className="text-[10px] text-gray-400 italic">Showing queries with position ≥ 10 for {getSlug(row.keys[0])}</span>
                            </div>
                            <table className="w-full text-left">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Query</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Clicks</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Impressions</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">CTR</th>
                                  <th className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 text-right">Position</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {data
                                  .filter(d => d.keys[1] === row.keys[0] && d.position >= 10)
                                  .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
                                  .map((q, qIdx) => (
                                    <tr key={qIdx} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-2 text-xs font-medium text-gray-700">{q.keys[0]}</td>
                                      <td className="px-4 py-2 text-xs text-right font-bold text-gray-700">{q.clicks.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-xs text-right text-gray-500">{q.impressions.toLocaleString()}</td>
                                      <td className="px-4 py-2 text-xs text-right">
                                        <span className={cn(
                                          "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                          q.ctr > 0.05 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                                        )}>
                                          {(q.ctr * 100).toFixed(2)}%
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-xs text-right font-medium text-gray-600">{q.position.toFixed(1)}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
              </table>
            </div>
            {auditRows.length === 0 && (
              <div className="p-12 text-center">
                <AlertCircle className="w-8 h-8 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-medium">No data found for this audit filter.</p>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </div>
    </main>

      <footer className="max-w-[1600px] mx-auto p-8 border-t border-gray-200 mt-12 text-center text-gray-400 text-sm font-medium">
        <p>© 2026 SEO Content Audit Ultimate. Built with Google Search Console API.</p>
      </footer>
    </div>
  );
}
