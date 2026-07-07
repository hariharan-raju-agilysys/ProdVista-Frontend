import { WidgetConfigProps } from './types';

type GaugeConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

export function GaugeConfig({ config, setConfig }: GaugeConfigProps) {
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
        Gauge Settings
      </h4>

      {/* Data Field */}
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

      {/* Range */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Min Value
          </label>
          <input
            type="number"
            value={(config.minValue as number) ?? 0}
            onChange={(e) => updateConfig('minValue', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Value
          </label>
          <input
            type="number"
            value={(config.maxValue as number) ?? 100}
            onChange={(e) => updateConfig('maxValue', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Unit
          </label>
          <input
            type="text"
            value={(config.unit as string) || '%'}
            onChange={(e) => updateConfig('unit', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="%"
          />
        </div>
      </div>

      {/* Gauge Style */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Gauge Style
          </label>
          <select
            value={(config.gaugeStyle as string) || 'semicircle'}
            onChange={(e) => updateConfig('gaugeStyle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="semicircle">Semi-circle</option>
            <option value="full">Full circle</option>
            <option value="arc">Arc</option>
            <option value="radial">Radial bar</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Needle Style
          </label>
          <select
            value={(config.needleStyle as string) || 'arrow'}
            onChange={(e) => updateConfig('needleStyle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="arrow">Arrow</option>
            <option value="line">Line</option>
            <option value="dot">Dot</option>
            <option value="none">None (fill only)</option>
          </select>
        </div>
      </div>

      {/* Thresholds */}
      <div className="border-t pt-4">
        <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">
          Color Thresholds
        </h5>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">
              Warning Level
            </label>
            <input
              type="number"
              value={thresholds.warning || 70}
              onChange={(e) => updateThreshold('warning', Number(e.target.value))}
              className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-600 dark:text-red-400 mb-1">
              Critical Level
            </label>
            <input
              type="number"
              value={thresholds.critical || 90}
              onChange={(e) => updateThreshold('critical', Number(e.target.value))}
              className="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 h-4 rounded-full overflow-hidden flex">
          <div className="bg-green-500 flex-1" style={{ maxWidth: `${thresholds.warning || 70}%` }} />
          <div className="bg-yellow-500 flex-1" style={{ maxWidth: `${(thresholds.critical || 90) - (thresholds.warning || 70)}%` }} />
          <div className="bg-red-500 flex-1" />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0</span>
          <span className="text-yellow-600">{thresholds.warning || 70}</span>
          <span className="text-red-600">{thresholds.critical || 90}</span>
          <span>{(config.maxValue as number) || 100}</span>
        </div>
      </div>

      {/* Display Options */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showValue as boolean) ?? true}
            onChange={(e) => updateConfig('showValue', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show value</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showLabel as boolean) ?? true}
            onChange={(e) => updateConfig('showLabel', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show label</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showTicks as boolean) || false}
            onChange={(e) => updateConfig('showTicks', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show tick marks</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.animated as boolean) ?? true}
            onChange={(e) => updateConfig('animated', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Animated</span>
        </label>
      </div>
    </div>
  );
}
