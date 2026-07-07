import { WidgetConfigProps } from './types';

type MetricCardConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

export function MetricCardConfig({ config, setConfig }: MetricCardConfigProps) {
  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
        Metric Card Settings
      </h4>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Value Field
          </label>
          <input
            type="text"
            value={(config.valueField as string) || 'value'}
            onChange={(e) => updateConfig('valueField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="value"
          />
          <p className="text-xs text-gray-500 mt-1">JSON field containing the metric value</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Label Field
          </label>
          <input
            type="text"
            value={(config.labelField as string) || 'label'}
            onChange={(e) => updateConfig('labelField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="label"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Format
          </label>
          <select
            value={(config.format as string) || 'number'}
            onChange={(e) => updateConfig('format', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="number">Number</option>
            <option value="currency">Currency ($)</option>
            <option value="percent">Percent (%)</option>
            <option value="bytes">Bytes (KB/MB/GB)</option>
            <option value="duration">Duration</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Decimal Places
          </label>
          <input
            type="number"
            min={0}
            max={6}
            value={(config.decimals as number) || 0}
            onChange={(e) => updateConfig('decimals', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Prefix
          </label>
          <input
            type="text"
            value={(config.prefix as string) || ''}
            onChange={(e) => updateConfig('prefix', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="$, €, etc."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Suffix
          </label>
          <input
            type="text"
            value={(config.suffix as string) || ''}
            onChange={(e) => updateConfig('suffix', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="%, units, etc."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showTrend as boolean) || false}
            onChange={(e) => updateConfig('showTrend', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show trend indicator</span>
        </label>
      </div>

      {(config.showTrend as boolean) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Trend Field
          </label>
          <input
            type="text"
            value={(config.trendField as string) || 'trend'}
            onChange={(e) => updateConfig('trendField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="trend"
          />
          <p className="text-xs text-gray-500 mt-1">Field containing trend percentage (positive = up, negative = down)</p>
        </div>
      )}

      {/* Color Settings */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Value Color
        </label>
        <select
          value={(config.colorScheme as string) || 'default'}
          onChange={(e) => updateConfig('colorScheme', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
        >
          <option value="default">Default</option>
          <option value="blue">Blue</option>
          <option value="green">Green</option>
          <option value="amber">Amber</option>
          <option value="red">Red</option>
          <option value="purple">Purple</option>
        </select>
      </div>
    </div>
  );
}
