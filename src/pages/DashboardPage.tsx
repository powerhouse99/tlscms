import { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  ArrowDownRight,
  Wallet,
  Clock,
  CheckCircle2,
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Card } from '../components/common/DataCard';
import { ChartCard } from '../components/dashboard/ChartCard';
import {
  MonthlyCollectionsChart,
  LoanDistributionChart,
  FinancialTrendsChart,
  EarningsTrendsChart,
  DelinquencyReportsChart,
} from '../components/dashboard/charts';

import type {
  DashboardMetrics,
  ActiveLoanView,
  CutoffSummaryView,
  MonthlyCollectionsPoint,
  LoanDistributionPoint,
  FinancialTrendPoint,
  EarningsTrendPoint,
  DelinquencyReportPoint,
} from '../types/database';

import { formatCurrency, formatDate } from '../utils/formatters';

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanView[]>([]);
  const [cutoffs, setCutoffs] = useState<CutoffSummaryView[]>([]);

  const [monthlyCollections, setMonthlyCollections] = useState<MonthlyCollectionsPoint[]>([]);
  const [loanDistribution, setLoanDistribution] = useState<LoanDistributionPoint[]>([]);
  const [financialTrends, setFinancialTrends] = useState<FinancialTrendPoint[]>([]);
  const [earningsTrends, setEarningsTrends] = useState<EarningsTrendPoint[]>([]);
  const [delinquencyReports, setDelinquencyReports] = useState<DelinquencyReportPoint[]>([]);

  const [loading, setLoading] = useState(true);

  // Preserve scroll position across refresh/back-navigation for a better UX.
  useEffect(() => {
    const key = 'dashboard_scroll_y';

    const savedY = sessionStorage.getItem(key);
    if (savedY) {
      const y = Number(savedY);
      if (Number.isFinite(y)) {
        window.scrollTo({ top: y });
      }
    }

    const onScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY));
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    void fetchDashboardData();

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);

    const runFetches = async (withAuth: boolean) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (withAuth && token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const [
        metricsRes,
        loansRes,
        cutoffsRes,
        monthlyRes,
        distributionRes,
        financialRes,
        earningsRes,
        delinquencyRes,
      ] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/metrics`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/active-loans`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/cutoffs`, { headers }),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/monthly-collections`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/loan-distribution`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/financial-trends`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/earnings-trends`,
          { headers },
        ),
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/analytics/delinquency-reports`,
          { headers },
        ),
      ]);

      return {
        metricsRes,
        loansRes,
        cutoffsRes,
        monthlyRes,
        distributionRes,
        financialRes,
        earningsRes,
        delinquencyRes,
      };
    };

    try {
      // Try with auth first; if the function is configured to reject auth (or token is invalid), fall back to public.
      const first = await runFetches(true);

      const shouldRetryWithoutAuth =
        first.metricsRes.status === 401 ||
        first.loansRes.status === 401 ||
        first.cutoffsRes.status === 401 ||
        first.monthlyRes.status === 401 ||
        first.distributionRes.status === 401 ||
        first.financialRes.status === 401 ||
        first.earningsRes.status === 401 ||
        first.delinquencyRes.status === 401;

      const res = shouldRetryWithoutAuth ? await runFetches(false) : first;

      if (res.metricsRes.ok) setMetrics(await res.metricsRes.json());
      if (res.loansRes.ok) setActiveLoans((await res.loansRes.json()) || []);
      if (res.cutoffsRes.ok) setCutoffs((await res.cutoffsRes.json()) || []);

      if (res.monthlyRes.ok) setMonthlyCollections((await res.monthlyRes.json()) || []);
      if (res.distributionRes.ok) setLoanDistribution((await res.distributionRes.json()) || []);
      if (res.financialRes.ok) setFinancialTrends((await res.financialRes.json()) || []);
      if (res.earningsRes.ok) setEarningsTrends((await res.earningsRes.json()) || []);
      if (res.delinquencyRes.ok) setDelinquencyReports((await res.delinquencyRes.json()) || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const m: any = metrics;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader title="Dashboard" description="Cooperative financial analytics overview" />

      {/* Dashboard Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Share Capital"
          value={formatCurrency(safeNumber(m?.total_share_capital, 0))}
          icon={<Building2 className="w-6 h-6" />}
          color="blue"
        />

        <StatCard
          title="Cash on Hand"
          value={formatCurrency(safeNumber(m?.cash_on_hand, 0))}
          icon={<Wallet className="w-6 h-6" />}
          color="gray"
        />

        <StatCard
          title="Total Active Loans"
          value={safeNumber(m?.active_loans, 0)}
          subtitle={formatCurrency(safeNumber(m?.outstanding_balance, 0)) + ' outstanding'}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />

        <StatCard
          title="Outstanding Balances"
          value={formatCurrency(safeNumber(m?.outstanding_balance, 0))}
          icon={<CreditCard className="w-6 h-6" />}
          color="yellow"
        />

        <StatCard
          title="Due This Cutoff"
          value={safeNumber(m?.due_this_cutoff, m?.due_today, 0)}
          icon={<Clock className="w-6 h-6" />}
          color="blue"
        />

        <StatCard
          title="Collected This Cutoff"
          value={formatCurrency(safeNumber(m?.collected_this_cutoff, 0))}
          icon={<CheckCircle2 className="w-6 h-6" />}
          color="green"
        />

        <StatCard
          title="Total Earnings"
          value={formatCurrency(safeNumber(m?.total_earnings, 0))}
          icon={<TrendingUp className="w-6 h-6" />}
          color="purple"
        />

        <StatCard
          title="Delayed Payments"
          value={safeNumber(m?.delayed_payments, m?.overdue_payments, 0)}
          icon={<AlertCircle className="w-6 h-6" />}
          color="red"
        />
      </div>

      {/* Analytics Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Monthly Collections"
            subtitle="Collected amounts per month"
            icon={<Calendar className="w-5 h-5" />}
          >
            {monthlyCollections.length === 0 ? (
              <div className="text-sm text-gray-500">No data available</div>
            ) : (
              <MonthlyCollectionsChart data={monthlyCollections as any} />
            )}
          </ChartCard>

          <ChartCard
            title="Loan Distribution"
            subtitle="Active loan allocation by status"
            icon={<DollarSign className="w-5 h-5" />}
          >
            {loanDistribution.length === 0 ? (
              <div className="text-sm text-gray-500">No data available</div>
            ) : (
              <LoanDistributionChart data={loanDistribution as any} />
            )}
          </ChartCard>

          <ChartCard
            title="Financial Trends"
            subtitle="Outstanding vs due trend"
            icon={<CreditCard className="w-5 h-5" />}
          >
            {financialTrends.length === 0 ? (
              <div className="text-sm text-gray-500">No data available</div>
            ) : (
              <FinancialTrendsChart data={financialTrends as any} />
            )}
          </ChartCard>

          <ChartCard
            title="Earnings Trends"
            subtitle="Monthly earnings curve"
            icon={<TrendingUp className="w-5 h-5" />}
          >
            {earningsTrends.length === 0 ? (
              <div className="text-sm text-gray-500">No data available</div>
            ) : (
              <EarningsTrendsChart data={earningsTrends as any} />
            )}
          </ChartCard>

          <ChartCard
            title="Delinquency Reports"
            subtitle="Delayed payment count by bucket"
            icon={<AlertCircle className="w-5 h-5" />}
          >
            {delinquencyReports.length === 0 ? (
              <div className="text-sm text-gray-500">No data available</div>
            ) : (
              <DelinquencyReportsChart data={delinquencyReports as any} />
            )}
          </ChartCard>

          <div className="hidden lg:block" />
        </div>
      </div>

      {/* Recent Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Loans</h2>
          </div>
          <div className="p-6">
            {activeLoans.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No active loans</div>
            ) : (
              <div className="space-y-4">
                {activeLoans.slice(0, 5).map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{loan.member_name}</p>
                      <p className="text-sm text-gray-500">
                        {loan.loan_id} - {formatCurrency(loan.principal_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">{loan.payments_made}/10</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        {loan.missed_payment_count > 0 && (
                          <span className="text-red-500">
                            <ArrowDownRight className="w-4 h-4" />
                          </span>
                        )}
                        {loan.remaining_balance.toLocaleString()} remaining
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cutoff Periods</h2>
          </div>
          <div className="p-6">
            {cutoffs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No cutoff periods</div>
            ) : (
              <div className="space-y-4">
                {cutoffs.slice(0, 4).map((cutoff) => (
                  <div
                    key={cutoff.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(cutoff.cutoff_date)}</p>
                      <p className="text-sm text-gray-500 capitalize">{cutoff.cutoff_type.replace('_', ' ')}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cutoff.status === 'open'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {cutoff.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{cutoff.borrower_count} borrowers</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

