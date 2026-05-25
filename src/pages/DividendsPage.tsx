import { useEffect, useMemo, useState } from 'react';
import { Shield, Lock, Unlock, RefreshCw } from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Badge, Table } from '../components/common/DataCard';
import type {
  DividendPeriod,
  DividendMemberAllocation,
  DividendPeriodStatus,
} from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';

type ApiError = { error?: string };

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusBadge(status: DividendPeriodStatus) {
  const map: Record<DividendPeriodStatus, { variant: any; label: string }> = {
    pending: { variant: 'info', label: 'pending' },
    estimated_approved: { variant: 'success', label: 'estimated approved' },
    audit_pending: { variant: 'warning', label: 'audit pending' },
    audit_approved: { variant: 'success', label: 'audit approved' },
    final_locked: { variant: 'default', label: 'final locked' },
  };
  return map[status] ?? { variant: 'default', label: status };
}

export function DividendsPage() {
  const [periods, setPeriods] = useState<DividendPeriod[]>([]);
  const [allocations, setAllocations] = useState<DividendMemberAllocation[]>([]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(false);

  const [busyAction, setBusyAction] = useState<string>('');
  const [error, setError] = useState<string>('');

  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const isFinal = selectedPeriod?.status === 'final_locked';

  useEffect(() => {
    const fetchPeriods = async () => {
      setLoadingPeriods(true);
      setError('');
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods`, {
          headers,
        });
        const data = (await res.json()) as DividendPeriod[];
        if (!res.ok) throw new Error((data as ApiError)?.error ?? 'Failed to load periods');

        setPeriods(data || []);

        const first = (data || [])[0];
        if (first && !selectedPeriodId) setSelectedPeriodId(first.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load periods');
      } finally {
        setLoadingPeriods(false);
      }
    };

    void fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchAllocations = async () => {
      if (!selectedPeriodId) return;
      setLoadingAllocations(true);
      setError('');
      try {
        const token = localStorage.getItem('auth_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/allocations?period_id=${encodeURIComponent(
            selectedPeriodId,
          )}`,
          { headers },
        );
        const data = (await res.json()) as DividendMemberAllocation[];
        if (!res.ok) throw new Error((data as ApiError)?.error ?? 'Failed to load allocations');

        setAllocations(data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load allocations');
      } finally {
        setLoadingAllocations(false);
      }
    };

    void fetchAllocations();
  }, [selectedPeriodId]);

  const runAction = async (action: 'compute-estimated' | 'submit-audit' | 'lock-final') => {
    if (!selectedPeriodId) return;

    setBusyAction(action);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods/${encodeURIComponent(
          selectedPeriodId,
        )}/${action}`,
        {
          method: 'POST',
          headers,
        },
      );

      const body = (await res.json()) as ApiError;
      if (!res.ok) throw new Error(body?.error ?? `Failed to ${action}`);

      // refresh
      const headers2 = headers;
      const periodsRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/periods`, {
        headers: headers2,
      });
      const periodsData = (await periodsRes.json()) as DividendPeriod[];
      setPeriods(periodsData || []);

      const allocRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dividends/allocations?period_id=${encodeURIComponent(
          selectedPeriodId,
        )}`,
        { headers: headers2 },
      );
      const allocData = (await allocRes.json()) as DividendMemberAllocation[];
      setAllocations(allocData || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusyAction('');
    }
  };

  const columns = useMemo(() => {
    const showFinal =
      selectedPeriod?.status === 'final_locked' || selectedPeriod?.status === 'audit_approved';

    return [
      {
        key: 'member_full_name',
        header: 'Member',
        render: (row: DividendMemberAllocation) => (
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.member_full_name}</p>
            <p className="text-sm text-gray-500">{row.employee_id}</p>
          </div>
        ),
      },
      {
        key: 'member_share_capital',
        header: 'Share Capital',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium">{formatCurrency(safeNumber(row.member_share_capital))}</span>
        ),
      },
      {
        key: 'ownership_percent',
        header: 'Ownership %',
        render: (row: DividendMemberAllocation) => (
          <span className="font-medium">{(safeNumber(row.ownership_percent) * 100).toFixed(2)}%</span>
        ),
      },
      {
        key: showFinal ? 'profit_share_final' : 'profit_share_estimated',
        header: showFinal ? 'Profit Share (Final)' : 'Profit Share (Estimated)',
        render: (row: DividendMemberAllocation) => {
          const v = showFinal ? row.profit_share_final : row.profit_share_estimated;
          return <span className="font-medium">{formatCurrency(safeNumber(v))}</span>;
        },
      },
    ];
  }, [selectedPeriod?.status]);

  const shareTotal = useMemo(() => {
    if (!selectedPeriod) return 0;
    return safeNumber(selectedPeriod.total_share_capital);
  }, [selectedPeriod]);

  const finalizedPeriods = useMemo(
    () => periods.filter((p) => p.status === 'final_locked'),
    [periods],
  );

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Profit Sharing / Dividends"
        description="Estimated and final profit sharing computed using share capital only."
        actions={
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Shield className="w-4 h-4" />
              3rd-year audit gate: <span className="font-medium">{selectedPeriod?.status ? 'enforced' : '—'}</span>
            </div>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card padding="none" className="lg:col-span-1">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dividend Periods</h2>
          </div>
          <div className="p-4 space-y-3">
            {loadingPeriods ? (
              <div className="text-sm text-gray-500">Loading…</div>
            ) : periods.length === 0 ? (
              <div className="text-sm text-gray-500">No dividend periods found.</div>
            ) : (
              <div className="space-y-2">
                {periods.map((p) => {
                  const active = p.id === selectedPeriodId;
                  const b = statusBadge(p.status as DividendPeriodStatus);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPeriodId(p.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">Year {p.fiscal_year}</p>
                          <p className="text-sm text-gray-500">{p.cutoff_date ? formatDate(p.cutoff_date) : '—'}</p>
                        </div>
                        <Badge variant={b.variant}>{b.label}</Badge>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="none">
          <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Allocation Details</h2>
              <p className="text-sm text-gray-500">
                {selectedPeriod
                  ? `Share capital snapshot: ${formatCurrency(shareTotal)}.`
                  : 'Select a period to view allocations.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => runAction('compute-estimated')}
                disabled={!selectedPeriod || busyAction !== ''}
                loading={busyAction === 'compute-estimated'}
                variant="secondary"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Compute Estimated
              </Button>

              <Button
                onClick={() => runAction('submit-audit')}
                disabled={!selectedPeriod || busyAction !== '' || isFinal}
                loading={busyAction === 'submit-audit'}
                variant="secondary"
              >
                <Shield className="w-4 h-4 mr-2" />
                Submit Audit
              </Button>

              <Button
                onClick={() => runAction('lock-final')}
                disabled={!selectedPeriod || busyAction !== '' || isFinal}
                loading={busyAction === 'lock-final'}
              >
                {isFinal ? (
                  <Lock className="w-4 h-4 mr-2" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Lock Final
              </Button>
            </div>
          </div>

          <div className="p-6">
            {loadingAllocations ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : allocations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">No allocations found for this period.</div>
            ) : (
              <Table
                columns={columns as any}
                data={allocations as any}
                keyExtractor={(r: any) => r.id}

                loading={loadingAllocations}
                emptyMessage="No allocations found"
              />
            )}
          </div>
        </Card>
      </div>

      <Card padding="none">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historical Dividend Records</h2>
          <p className="text-sm text-gray-500">Final locked periods with recorded distributions.</p>
        </div>
        <div className="p-6">
          {finalizedPeriods.length === 0 ? (
            <div className="text-sm text-gray-500">No finalized dividend periods yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {finalizedPeriods.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(p.id)}
                  className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Year {p.fiscal_year}</p>
                      <p className="text-sm text-gray-500">{p.cutoff_date ? formatDate(p.cutoff_date) : '—'}</p>
                    </div>
                    <Badge variant="default">final locked</Badge>
                  </div>
                  <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                    Total cooperative earnings snapshot:{' '}
                    <span className="font-medium">
                      {formatCurrency(safeNumber(p.total_cooperative_earnings))}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

