import { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Building2,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button } from '../components/common/DataCard';

const reportTypes = [
  {
    id: 'share-capital',
    name: 'Share Capital Report',
    description: 'Complete list of member share capital contributions',
    icon: Building2,
    color: 'blue',
  },
  {
    id: 'active-loans',
    name: 'Active Loans Report',
    description: 'All currently active and delayed loans',
    icon: DollarSign,
    color: 'green',
  },
  {
    id: 'fully-paid',
    name: 'Fully Paid Loans',
    description: 'History of completed loans',
    icon: TrendingUp,
    color: 'purple',
  },
  {
    id: 'delayed-payments',
    name: 'Delayed Payments Report',
    description: 'Loans with missed payments',
    icon: AlertTriangle,
    color: 'yellow',
  },
  {
    id: 'collections',
    name: 'Collection Report',
    description: 'Payment collections summary',
    icon: Calendar,
    color: 'blue',
  },
  {
    id: 'cutoff-summary',
    name: 'Cutoff Summary',
    description: 'Lending period summaries',
    icon: Calendar,
    color: 'gray',
  },
];

export function ReportsPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGenerateReport = async (reportId: string) => {
    setLoading(reportId);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reports/${reportId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Download as JSON for now - in production you'd generate PDF/Excel
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportId}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Reports"
        description="Generate and export financial reports"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportTypes.map((report) => {
          const Icon = report.icon;
          const colorStyles = {
            blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
            green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
            yellow: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
            purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
            gray: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
          };

          return (
            <Card key={report.id} className="hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-lg ${colorStyles[report.color as keyof typeof colorStyles]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {report.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {report.description}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => handleGenerateReport(report.id)}
                loading={loading === report.id}
                variant="secondary"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Generate Report
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
