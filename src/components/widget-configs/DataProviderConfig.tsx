import { ReactNode } from 'react';
import clsx from 'clsx';
import { Play, Loader2, CheckCircle, X, Hash } from 'lucide-react';
import { 
  DataProviderType, 
  getDataProvidersForWidget,
  ALL_DATA_PROVIDERS
} from './types';

interface DataProviderSelectorProps {
  widgetType: string;
  selectedType: DataProviderType;
  onSelect: (type: DataProviderType) => void;
}

export function DataProviderSelector({ widgetType, selectedType, onSelect }: DataProviderSelectorProps) {
  const providers = getDataProvidersForWidget(widgetType);

  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Select Data Source
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {providers.map(option => {
          const Icon = option.icon;
          const isSelected = selectedType === option.type;
          return (
            <button
              key={option.type}
              onClick={() => onSelect(option.type)}
              className={clsx(
                'flex items-start gap-3 p-3 rounded-lg border transition-all text-left',
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              )}
            >
              <Icon className={clsx('w-5 h-5 mt-0.5 flex-shrink-0', option.color)} />
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-800 dark:text-gray-200">
                  {option.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DataProviderConfigFormProps {
  type: DataProviderType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  onTest?: () => void;
  testing?: boolean;
  testResult?: { success: boolean; data?: unknown; error?: string } | null;
}

export function DataProviderConfigForm({ 
  type, 
  config, 
  onChange, 
  onTest, 
  testing = false, 
  testResult 
}: DataProviderConfigFormProps) {
  const updateConfig = (key: string, value: unknown) => {
    onChange({ ...config, [key]: value });
  };

  const providerOption = ALL_DATA_PROVIDERS.find(p => p.type === type);

  const renderConfigFields = (): ReactNode => {
    switch (type) {
      case 'Static':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              JSON Data
            </label>
            <textarea
              value={typeof config.data === 'string' ? config.data : JSON.stringify(config.data || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updateConfig('data', parsed);
                } catch {
                  updateConfig('data', e.target.value);
                }
              }}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
              placeholder='{ "value": 123, "label": "Sample" }'
            />
          </div>
        );

      case 'ApiEndpoint':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API URL *
              </label>
              <input
                type="text"
                value={(config.url as string) || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="https://api.example.com/data"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Method
                </label>
                <select
                  value={(config.method as string) || 'GET'}
                  onChange={(e) => updateConfig('method', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data Path
                </label>
                <input
                  type="text"
                  value={(config.dataPath as string) || ''}
                  onChange={(e) => updateConfig('dataPath', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="$.data.items"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Headers (JSON)
              </label>
              <textarea
                value={(config.headers as string) || ''}
                onChange={(e) => updateConfig('headers', e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                placeholder='{ "Authorization": "Bearer token" }'
              />
            </div>
          </div>
        );

      case 'DatabaseQuery':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Connection Name *
              </label>
              <input
                type="text"
                value={(config.connectionName as string) || ''}
                onChange={(e) => updateConfig('connectionName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="my-database"
              />
              <p className="text-xs text-gray-500 mt-1">Saved connection from Settings → Database Connections</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SQL Query *
              </label>
              <textarea
                value={(config.query as string) || ''}
                onChange={(e) => updateConfig('query', e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                placeholder="SELECT * FROM your_table WHERE ..."
              />
            </div>
          </div>
        );

      case 'AzureMetrics':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource ID *
              </label>
              <input
                type="text"
                value={(config.resourceId as string) || ''}
                onChange={(e) => updateConfig('resourceId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm font-mono"
                placeholder="/subscriptions/{sub}/resourceGroups/{rg}/providers/..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Metric Name *
                </label>
                <input
                  type="text"
                  value={(config.metricName as string) || ''}
                  onChange={(e) => updateConfig('metricName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                  placeholder="Percentage CPU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aggregation
                </label>
                <select
                  value={(config.aggregation as string) || 'Average'}
                  onChange={(e) => updateConfig('aggregation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="Average">Average</option>
                  <option value="Total">Total</option>
                  <option value="Maximum">Maximum</option>
                  <option value="Minimum">Minimum</option>
                  <option value="Count">Count</option>
                </select>
              </div>
            </div>
          </div>
        );

      case 'AzureLogAnalytics':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace ID *
              </label>
              <input
                type="text"
                value={(config.workspaceId as string) || ''}
                onChange={(e) => updateConfig('workspaceId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="Log Analytics Workspace ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                KQL Query *
              </label>
              <textarea
                value={(config.query as string) || ''}
                onChange={(e) => updateConfig('query', e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
                placeholder="AzureActivity | summarize count() by Category"
              />
            </div>
          </div>
        );

      case 'AppInsights':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Application ID *
              </label>
              <input
                type="text"
                value={(config.appId as string) || ''}
                onChange={(e) => updateConfig('appId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="Application Insights Application ID"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Metric Type
              </label>
              <select
                value={(config.metricType as string) || 'requests'}
                onChange={(e) => updateConfig('metricType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              >
                <option value="requests">Requests</option>
                <option value="exceptions">Exceptions</option>
                <option value="dependencies">Dependencies</option>
                <option value="performance">Performance</option>
                <option value="availability">Availability</option>
              </select>
            </div>
          </div>
        );

      case 'SignalR':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hub Name *
              </label>
              <input
                type="text"
                value={(config.hubName as string) || ''}
                onChange={(e) => updateConfig('hubName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="dashboardHub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Event Name *
              </label>
              <input
                type="text"
                value={(config.eventName as string) || ''}
                onChange={(e) => updateConfig('eventName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="ReceiveMetricUpdate"
              />
            </div>
          </div>
        );

      case 'Custom':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Script (JavaScript)
            </label>
            <textarea
              value={(config.script as string) || ''}
              onChange={(e) => updateConfig('script', e.target.value)}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm"
              placeholder={`async function fetchData() {
  // Your custom logic here
  return { value: 42, label: "Result" };
}`}
            />
          </div>
        );

      case 'None':
        return (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 text-center">
            <Hash className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">
              No data provider. Widget will show placeholder content.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  if (type === 'None') {
    return renderConfigFields();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        {providerOption && (
          <>
            <providerOption.icon className={clsx('w-5 h-5', providerOption.color)} />
            <span className="font-medium text-sm text-gray-800 dark:text-gray-200">
              {providerOption.name} Configuration
            </span>
          </>
        )}
      </div>

      {renderConfigFields()}

      {/* Test Button */}
      {onTest && (
        <div className="flex items-center gap-4 pt-2 border-t">
          <button
            onClick={onTest}
            disabled={testing}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm',
              testing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Test Connection
          </button>

          {testResult && (
            <div className={clsx(
              'flex items-center gap-2 text-sm',
              testResult.success ? 'text-green-600' : 'text-red-600'
            )}>
              {testResult.success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Success
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  {String(testResult.error || 'Test failed')}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Test Result Preview */}
      {testResult?.success === true && testResult.data !== undefined && testResult.data !== null && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview Data:</h4>
          <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-32">
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
