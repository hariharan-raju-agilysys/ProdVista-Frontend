import { WidgetConfigProps } from './types';

type KpiConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

export function KpiConfig({ config, setConfig }: KpiConfigProps) {
  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  const thresholds = (config.thresholds as { warning?: number; critical?: number }) || {};

  const updateThreshold = (key: string, value: number) => {
    setConfig({ ...config, thresholds: { ...thresholds, [key]: value } });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
        KPI Settings
      </h4>

      {/* Data Field Mapping */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Value Field *
          </label>
          <input
            type="text"
            value={(config.valueField as string) || 'value'}
            onChange={(e) => updateConfig('valueField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="value"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Target Field
          </label>
          <input
            type="text"
            value={(config.targetField as string) || 'target'}
            onChange={(e) => updateConfig('targetField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="target"
          />
        </div>
      </div>

      {/* Format */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Value Format
          </label>
          <select
            value={(config.format as string) || 'number'}
            onChange={(e) => updateConfig('format', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="number">Number</option>
            <option value="percent">Percentage</option>
            <option value="currency">Currency</option>
            <option value="compact">Compact (1K, 1M)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Comparison Period
          </label>
          <select
            value={(config.comparisonPeriod as string) || 'none'}
            onChange={(e) => updateConfig('comparisonPeriod', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="none">None</option>
            <option value="previous">vs Previous Period</option>
            <option value="target">vs Target</option>
            <option value="lastWeek">vs Last Week</option>
            <option value="lastMonth">vs Last Month</option>
          </select>
        </div>
      </div>

      {/* Display Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showTarget as boolean) ?? true}
            onChange={(e) => updateConfig('showTarget', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show target value</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showProgress as boolean) ?? true}
            onChange={(e) => updateConfig('showProgress', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show progress bar</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showTrend as boolean) || false}
            onChange={(e) => updateConfig('showTrend', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show trend arrow</span>
        </label>
      </div>

      {/* Thresholds */}
      <div className="border-t pt-4">
        <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
          Status Thresholds
        </h5>
        <p className="text-xs text-gray-500 mb-3">
          Define thresholds for status colors (as percentage of target)
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">
              Warning Threshold (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={thresholds.warning || 70}
              onChange={(e) => updateThreshold('warning', Number(e.target.value))}
              className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Below this = Warning status</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-1">
              Critical Threshold (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={thresholds.critical || 50}
              onChange={(e) => updateThreshold('critical', Number(e.target.value))}
              className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Below this = Critical status</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded">≥ {thresholds.warning || 70}%: Good</span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">{thresholds.critical || 50}-{(thresholds.warning || 70) - 1}%: Warning</span>
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded">&lt; {thresholds.critical || 50}%: Critical</span>
        </div>
      </div>

      {/* Color Scheme */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Color Scheme
        </label>
        <select
          value={(config.colorScheme as string) || 'default'}
          onChange={(e) => updateConfig('colorScheme', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
        >
          <option value="default">Default (Green/Yellow/Red)</option>
          <option value="blue">Blue gradient</option>
          <option value="purple">Purple gradient</option>
          <option value="monochrome">Monochrome</option>
        </select>
      </div>
    </div>
  );
}
