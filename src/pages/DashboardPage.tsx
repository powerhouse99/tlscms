import { useEffect, useState } from 'react';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Building2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { Card } from '../components/common/DataCard';
import type { DashboardMetrics, ActiveLoanView, CutoffSummaryView } from '../types/database';
import { formatCurrency, formatDate } from '../utils/formatters';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [activeLoans, setActiveLoans] = useState<ActiveLoanView[]>([]);
  const [cutoffs, setCutoffs] = useState<CutoffSummaryView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [metricsRes, loansRes, cutoffsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/metrics`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/active-loans`, { headers }),
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dashboard/cutoffs`, { headers }),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data);
      }

      if (loansRes.ok) {
        const data = await loansRes.json();
        setActiveLoans(data || []);
      }

      if (cutoffsRes.ok) {
        const data = await cutoffsRes.json();
        setCutoffs(data || []);
      }
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

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your lending cooperative system"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Share Capital"
          value={formatCurrency(metrics?.total_share_capital || 0)}
          icon={<Building2 className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="Active Loans"
          value={metrics?.active_loans || 0}
          subtitle={formatCurrency(metrics?.outstanding_balance || 0) + ' outstanding'}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="Active Members"
          value={metrics?.active_members || 0}
          icon={<Users className="w-6 h-6" />}
          color="gray"
        />
        <StatCard
          title="Total Earnings"
          value={formatCurrency(metrics?.total_earnings || 0)}
          icon={<TrendingUp className="w-6 h-6" />}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Due Today</p>
              <p className="text-3xl font-bold mt-1">{metrics?.due_today || 0}</p>
              <p className="text-blue-100 text-sm mt-2">Payments to collect</p>
            </div>
            <Calendar className="w-12 h-12 text-blue-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-100 text-sm">Overdue Payments</p>
              <p className="text-3xl font-bold mt-1">{metrics?.overdue_payments || 0}</p>
              <p className="text-yellow-100 text-sm mt-2">Require attention</p>
            </div>
            <AlertCircle className="w-12 h-12 text-yellow-200" />
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">Total Collections</p>
              <p className="text-3xl font-bold mt-1">{formatCurrency(metrics?.total_historical_collections || 0)}</p>
              <p className="text-green-100 text-sm mt-2">All time</p>
            </div>
            <CreditCard className="w-12 h-12 text-green-200" />
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Loans */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Active Loans
            </h2>
          </div>
          <div className="p-6">
            {activeLoans.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No active loans
              </div>
            ) : (
              <div className="space-y-4">
                {activeLoans.slice(0, 5).map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {loan.member_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {loan.loan_id} - {formatCurrency(loan.principal_amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {loan.payments_made}/{10}
                      </p>
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

        {/* Recent Cutoffs */}
        <Card padding="none">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cutoff Periods
            </h2>
          </div>
          <div className="p-6">
            {cutoffs.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No cutoff periods
              </div>
            ) : (
              <div className="space-y-4">
                {cutoffs.slice(0, 4).map((cutoff) => (
                  <div
                    key={cutoff.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(cutoff.cutoff_date)}
                      </p>
                      <p className="text-sm text-gray-500 capitalize">
                        {cutoff.cutoff_type.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cutoff.status === 'open'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {cutoff.status}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        {cutoff.borrower_count} borrowers
                      </p>
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
