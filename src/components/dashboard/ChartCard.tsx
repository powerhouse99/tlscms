import type { ReactNode } from 'react';

import { Card } from '../common/DataCard';

export function ChartCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding="none">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon ? <div className="text-gray-500">{icon}</div> : null}
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}

