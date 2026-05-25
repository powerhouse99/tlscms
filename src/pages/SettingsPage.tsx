import { useEffect, useState } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/common/PageHeader';
import { Card, Button, Input } from '../components/common/DataCard';
import type { SystemConfig } from '../types/database';

export function SettingsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setConfigs(data || []);
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');

      for (const [key, value] of Object.entries(editedConfigs)) {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/config`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              config_key: key,
              config_value: value,
            }),
          }
        );
      }

      setEditedConfigs({});
      fetchConfigs();
    } catch (error) {
      console.error('Error saving configs:', error);
    } finally {
      setSaving(false);
    }
  };

  const groupedConfigs = configs.reduce((acc, config) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push(config);
    return acc;
  }, {} as Record<string, SystemConfig[]>);

  const categoryTitles: Record<string, string> = {
    lending: 'Lending Settings',
    system: 'System Settings',
    backup: 'Backup Settings',
    general: 'General Settings',
  };

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="System Settings"
        description="Configure system parameters and options"
        actions={
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={Object.keys(editedConfigs).length === 0}
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedConfigs).map(([category, categoryConfigs]) => (
            <Card key={category}>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {categoryTitles[category] || category}
              </h2>
              <div className="space-y-4">
                {categoryConfigs.map((config) => {
                  const isEdited = config.config_key in editedConfigs;
                  const currentValue = isEdited
                    ? editedConfigs[config.config_key]
                    : config.config_value;

                  return (
                    <div
                      key={config.id}
                      className={`p-4 rounded-lg border ${
                        isEdited
                          ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {config.config_key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          {config.description && (
                            <p className="text-sm text-gray-500">{config.description}</p>
                          )}
                        </div>
                        {isEdited && (
                          <span className="text-xs text-blue-600 font-medium">Modified</span>
                        )}
                      </div>

                      <ConfigEditor
                        config={config}
                        value={currentValue}
                        onChange={(value) => {
                          setEditedConfigs((prev) => ({
                            ...prev,
                            [config.config_key]: value,
                          }));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ConfigEditor({
  config,
  value,
  onChange,
}: {
  config: SystemConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-2">
        {Object.entries(value as Record<string, unknown>).map(([key, val]) => (
          <div key={key} className="flex items-center gap-4">
            <label className="text-sm text-gray-600 dark:text-gray-400 w-40">{key}:</label>
            <input
              type={typeof val === 'number' ? 'number' : typeof val === 'boolean' ? 'checkbox' : 'text'}
              value={typeof val === 'boolean' ? undefined : String(val)}
              checked={typeof val === 'boolean' ? Boolean(val) : undefined}
              onChange={(e) => {
                let newValue: unknown;
                if (typeof val === 'boolean') {
                  newValue = e.target.checked;
                } else if (typeof val === 'number') {
                  newValue = Number(e.target.value);
                } else {
                  newValue = e.target.value;
                }
                onChange({ ...(value as Record<string, unknown>), [key]: newValue });
              }}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <input
      type="text"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
    />
  );
}
