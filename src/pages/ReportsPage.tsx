import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Building2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Search,
  Printer,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Input, Select } from '../components/common/DataCard';
import { formatCurrency, formatDate } from '../utils/formatters';
import { safeNumber } from '../utils/reporting';

type ReportId =
  | 'share-capital'
  | 'loan-release'
  | 'collections'
  | 'active-loans'
  | 'fully-paid'
  | 'missed-payments'
  | 'member-loan-history'
  | 'kinsenas-summary'
  | 'cash-flow';

type SortDir = 'asc' | 'desc';

type ReportType = {
  id: ReportId;
  name: string;
  description: string;
  icon: any;
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'gray';
};

// Local UI types (ReportId is shared via src/pages/types.ts)
const reportTypes: ReportType[] = [
  {
    id: 'share-capital',
    name: 'Share Capital Report',
    description: 'Per member contribution',
    icon: Building2,
    color: 'blue',
  },
  {
    id: 'loan-release',
    name: 'Loan Release Report',
    description: 'All released loans',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'collections',
    name: 'Collection Report',
    description: 'All received payments',
    icon: Calendar,
    color: 'blue',
  },
  {
    id: 'active-loans',
    name: 'Active Loan Report',
    description: 'All active loans',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'fully-paid',
    name: 'Fully Paid Loan Report',
    description: 'All fully paid loans',
    icon: TrendingUp,
    color: 'purple',
  },
  {
    id: 'missed-payments',
    name: 'Missed Payment Report',
    description: 'Loans with missed payments',
    icon: AlertTriangle,
    color: 'yellow',
  },
  {
    id: 'member-loan-history',
    name: 'Member Loan History Report',
    description: 'Loans by member',
    icon: AlertTriangle,
    color: 'gray',
  },
  {
    id: 'kinsenas-summary',
    name: 'Kinsenas Summary Report',
    description: 'Kinsenas collection summary',
    icon: Calendar,
    color: 'gray',
  },
  {
    id: 'cash-flow',
    name: 'Cash Flow Report',
    description: 'Beginning cash + collections - loans released',
    icon: DollarSign,
    color: 'gray',
  },
];

const colorStyles: Record<ReportType['color'], string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function buildReportUrl(reportId: ReportId, params?: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') sp.set(k, v);
    }
  }
  const query = sp.toString();
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports/${reportId}`;
  return query ? `${base}?${query}` : base;
}

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
};

export function ReportsPage() {
  const [activeReport, setActiveReport] = useState<ReportId>('share-capital');

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [memberId, setMemberId] = useState<string>('');
  const [beginningCash, setBeginningCash] = useState<string>('0');

  // Table controls
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  const reportMeta = useMemo(() => reportTypes.find((r) => r.id === activeReport)!, [activeReport]);

  useEffect(() => {
    setPage(1);
  }, [activeReport, startDate, endDate, memberId, beginningCash, pageSize, debouncedSearch, sortKey, sortDir]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      const query: Record<string, string | undefined> = {
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };

      if (activeReport === 'cash-flow') {
        // Cash flow is derived client-side from collections + active loans (used as released proxy).
        const collectionsUrl = buildReportUrl('collections', query);
        const loansReleasedUrl = buildReportUrl('active-loans', query);

        const [collectionsRes, loansRes] = await Promise.all([
          fetch(collectionsUrl, { headers }),
          fetch(loansReleasedUrl, { headers }),
        ]);

        const [collectionsJson, loansJson] = await Promise.all([
          collectionsRes.ok ? collectionsRes.json() : [],
          loansRes.ok ? loansRes.json() : [],
        ]);

        const collections = Array.isArray(collectionsJson) ? collectionsJson : [];
        const releasedLoans = Array.isArray(loansJson) ? loansJson : [];

        const collectionsTotal = collections.reduce((sum: number, p: any) => sum + safeNumber(p?.amount), 0);
        const releasedTotal = releasedLoans.reduce(
          (sum: number, l: any) => sum + safeNumber(l?.principal_amount),
          0
        );

        const beginning = safeNumber(beginningCash, 0);
        const cashOnHand = beginning + collectionsTotal - releasedTotal;

        setData([
          {
            beginning_cash: beginning,
            collections: collectionsTotal,
            loans_released: releasedTotal,
            cash_on_hand: cashOnHand,
          },
        ]);
        return;
      }

      if (activeReport === 'missed-payments') {
        // Backend maps delayed->missed.
        const url = buildReportUrl('active-loans' as ReportId, query);
        // Try delayed-payments endpoint first if present in backend; otherwise use active-loans.
        const delayedUrl = buildReportUrl('missed-payments' as ReportId, query);
        const res = await fetch(delayedUrl, { headers }).catch(() => null);
        if (res && res.ok) {
          const json = await res.json();
          setData(Array.isArray(json) ? json : json?.data || []);
        } else {
          const res2 = await fetch(url, { headers });
          const json2 = await res2.json();
          setData(Array.isArray(json2) ? json2 : json2?.data || []);
        }
        return;
      }

      if (activeReport === 'member-loan-history') {
        if (!memberId) {
          setData([]);
          return;
        }
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports/member/${memberId}`;
        const res = await fetch(url, { headers });
        const json = await res.json();
        setData(Array.isArray(json) ? json : json?.data || []);
        return;
      }

      if (activeReport === 'loan-release') {
        // Backend has no dedicated loan-release endpoint in current codebase.
        // Best-effort: treat active loans as released proxy.
        const url = buildReportUrl('active-loans', query);
        const res = await fetch(url, { headers });
        const json = await res.json();
        setData(Array.isArray(json) ? json : json?.data || []);
        return;
      }

      if (activeReport === 'kinsenas-summary') {
        setData([]);
        return;
      }

      const url = buildReportUrl(activeReport, query);
      const res = await fetch(url, { headers });
      const json = await res.json();
      setData(Array.isArray(json) ? json : json?.data || []);
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeReport === 'member-loan-history' && !memberId) {
      setData([]);
      return;
    }
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, startDate, endDate, memberId, beginningCash]);

  const filteredAndSorted = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let rows = data;

    if (q) {
      rows = rows.filter((r) => JSON.stringify(r).toLowerCase().includes(q));
    }

    if (sortKey) {
      const dir = sortDir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = a?.[sortKey];
        const bv = b?.[sortKey];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      });
    }

    return rows;
  }, [data, debouncedSearch, sortKey, sortDir]);

  const totalRows = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pageRows = filteredAndSorted.slice((page - 1) * pageSize, page * pageSize);

  const tableColumns = useMemo<Column<any>[]>(() => {
    switch (activeReport) {
      case 'share-capital':
        return [
          { key: 'employee_id', header: 'Employee ID' },
          { key: 'full_name', header: 'Member', render: (r) => r?.member?.full_name ?? r?.member_full_name ?? '' },
          { key: 'position', header: 'Position', render: (r) => r?.member?.position ?? '' },
          { key: 'amount', header: 'Contribution', render: (r) => formatCurrency(safeNumber(r?.amount)) },
          { key: 'payment_date', header: 'Date', render: (r) => formatDate(r?.payment_date) },
        ];
      case 'active-loans':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member_name', header: 'Member' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'remaining_balance', header: 'Remaining', render: (r) => formatCurrency(safeNumber(r?.remaining_balance)) },
          { key: 'release_date', header: 'Release Date', render: (r) => formatDate(r?.release_date) },
          { key: 'next_due_date', header: 'Next Due', render: (r) => (r?.next_due_date ? formatDate(r?.next_due_date) : '-') },
        ];
      case 'fully-paid':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member', header: 'Member', render: (r) => r?.member?.full_name ?? '' },
          { key: 'principal_amount', header: 'Principal', render: (r) => formatCurrency(safeNumber(r?.principal_amount)) },
          { key: 'release_date', header: 'Release Date', render: (r) => formatDate(r?.release_date) },
          { key: 'status', header: 'Status', render: () => 'Fully Paid' },
        ];
      case 'collections':
        return [
          { key: 'payment_date', header: 'Payment Date', render: (r) => formatDate(r?.payment_date) },
          { key: 'receipt_number', header: 'Receipt #', render: (r) => r?.receipt_number ?? '-' },
          { key: 'loan_id', header: 'Loan ID', render: (r) => r?.loan?.loan_id ?? r?.loan_id ?? '-' },
          { key: 'member', header: 'Member', render: (r) => r?.loan?.member?.full_name ?? '' },
          { key: 'amount', header: 'Amount', render: (r) => formatCurrency(safeNumber(r?.amount)) },
          { key: 'payment_method', header: 'Method', render: (r) => r?.payment_method ?? '-' },
        ];
      case 'missed-payments':
        return [
          { key: 'loan_id', header: 'Loan ID' },
          { key: 'member', header: 'Member', render: (r) => r?.member?.full_name ?? '' },
          { key: 'installment_amount', header: 'Installment', render: (r) => formatCurrency(safeNumber(r?.installment_amount)) },
          { key: 'missed_payment_count', header: 'Missed', render: (r) => safeNumber(r?.missed_payment_count) },
          { key: 'next_due_date', header: 'Next Due', render: (r) => (r?.next_due_date ? formatDate(r?.next_due_date) : '-') },
        ];
      case 'cash-flow':
        return [
          { key: 'beginning_cash', header: 'Beginning Cash', render: (r) => formatCurrency(safeNumber(r?.beginning_cash)) },
          { key: 'collections', header: 'Collections', render: (r) => formatCurrency(safeNumber(r?.collections)) },
          { key: 'loans_released', header: 'Loans Released', render: (r) => formatCurrency(safeNumber(r?.loans_released)) },
          { key: 'cash_on_hand', header: 'Cash on Hand', render: (r) => formatCurrency(safeNumber(r?.cash_on_hand)) },
        ];
      default:
        return [];
    }
  }, [activeReport]);

  const exportToExcel = () => {
    const out = filteredAndSorted.map((r) => {
      const obj: Record<string, any> = {};
      tableColumns.forEach((c) => {
        const val = c.render ? c.render(r) : r?.[c.key];
        obj[c.header] = typeof val === 'string' ? val : val;
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');

    XLSX.writeFile(wb, `${activeReport}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const title = reportMeta.name;

    doc.setFontSize(14);
    doc.text(title, 20, 30);

    const subtitleParts: string[] = [];
    if (startDate) subtitleParts.push(`From: ${startDate}`);
    if (endDate) subtitleParts.push(`To: ${endDate}`);
    if (activeReport === 'member-loan-history' && memberId) subtitleParts.push(`Member: ${memberId}`);

    if (subtitleParts.length) {
      doc.setFontSize(10);
      doc.text(subtitleParts.join(' | '), 20, 50);
    }

    const body = filteredAndSorted.map((r) =>
      tableColumns.map((c) => {
        const v = c.render ? c.render(r) : r?.[c.key];
        return v === undefined || v === null ? '' : String(v);
      })
    );

    autoTable(doc, {
      head: [tableColumns.map((c) => c.header)],
      body,
      startY: 70,
      styles: { fontSize: 8, cellPadding: 3 },
      theme: 'grid',
      pageBreak: 'auto',
    });

    doc.save(`${activeReport}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const printCurrent = () => window.print();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Reports" description="Create printable and exportable audit reports" />

      <div className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => {
            const Icon = report.icon;
            return (
              <div
                key={report.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveReport(report.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setActiveReport(report.id);
                }}
                className={`cursor-pointer ${activeReport === report.id ? 'ring-2 ring-blue-500' : ''}`}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-lg ${colorStyles[report.color]}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{report.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-500" />
                  <p className="font-semibold">{reportMeta.name}</p>
                </div>
                <p className="text-sm text-gray-500 mt-1">{reportMeta.description}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={exportToPdf} disabled={loading || tableColumns.length === 0}>
                  <Download className="w-4 h-4 mr-2" />PDF
                </Button>
                <Button variant="secondary" onClick={exportToExcel} disabled={loading || tableColumns.length === 0}>
                  <Download className="w-4 h-4 mr-2" />Excel
                </Button>
                <Button variant="ghost" onClick={printCurrent} disabled={loading || tableColumns.length === 0}>
                  <Printer className="w-4 h-4 mr-2" />Print
                </Button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input label="Start Date" type="date" value={startDate} onChange={setStartDate} />
              <Input label="End Date" type="date" value={endDate} onChange={setEndDate} />
              {activeReport === 'member-loan-history' && (
                <Input label="Member ID" value={memberId} onChange={setMemberId} placeholder="UUID" />
              )}
              {activeReport === 'cash-flow' && (
                <Input
                  label="Beginning Cash"
                  value={beginningCash}
                  onChange={setBeginningCash}
                  placeholder="0"
                />
              )}
            </div>

            <div className="mt-4 flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
              <div className="flex-1">
                <Input
                  label="Search"
                  value={search}
                  onChange={setSearch}
                  placeholder="Search within the report..."
                />
              </div>

              <div className="w-full md:w-56">
                <Select
                  label="Sort"
                  value={sortKey}
                  onChange={setSortKey}
                  options={[{ value: '', label: 'None' }, ...tableColumns.map((c) => ({ value: c.key, label: c.header }))]}
                />
              </div>

              <div className="w-full md:w-44">
                <Select
                  label="Direction"
                  value={sortDir}
                  onChange={(v) => setSortDir(v as SortDir)}
                  options={[
                    { value: 'asc', label: 'Ascending' },
                    { value: 'desc', label: 'Descending' },
                  ]}
                />
              </div>
            </div>
          </div>

          <div className="p-4">
            <div id="report-print" className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Summary</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Records: <span className="font-medium">{totalRows}</span>
                      {activeReport === 'cash-flow' && (
                        <span className="ml-3">Formula: Beginning Cash + Collections - Loans Released</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                      {tableColumns.map((c) => (
                        <th
                          key={c.key}
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                        >
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {loading ? (
                      <tr>
                        <td colSpan={tableColumns.length} className="text-center py-12 text-gray-500">
                          Loading...
                        </td>
                      </tr>
                    ) : pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={tableColumns.length} className="text-center py-12 text-gray-500">
                          No data
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row, idx) => (
                        <tr key={row?.id ?? idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          {tableColumns.map((c) => (
                            <td key={c.key} className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                              {c.render ? c.render(row) : String(row?.[c.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  Prev
                </Button>
                <Button variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                  Next
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Rows per page</span>
                <select
                  className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-sm"
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  {[5, 10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Print: hide non-print controls */}
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
    </div>
  );
}

