import { WidgetConfigProps } from './types';

interface ChartConfigProps extends Pick<WidgetConfigProps, 'config' | 'setConfig'> {
  chartType: 'line-chart' | 'bar-chart' | 'area-chart' | 'doughnut-chart';
}

export function ChartConfig({ config, setConfig, chartType }: ChartConfigProps) {
  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  const isTimeSeries = chartType === 'line-chart' || chartType === 'area-chart';
  const isPieStyle = chartType === 'doughnut-chart';

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
        {chartType === 'line-chart' && 'Line Chart Settings'}
        {chartType === 'bar-chart' && 'Bar Chart Settings'}
        {chartType === 'area-chart' && 'Area Chart Settings'}
        {chartType === 'doughnut-chart' && 'Doughnut Chart Settings'}
      </h4>

      {/* Data Field Mapping */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Map your data fields to chart elements</p>
        
        {isPieStyle ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Label Field *
                </label>
                <input
                  type="text"
                  value={(config.labelField as string) || 'label'}
                  onChange={(e) => updateConfig('labelField', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                  placeholder="label"
                />
              </div>
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
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Inner Radius (%)
              </label>
              <input
                type="range"
                min={0}
                max={80}
                value={(config.innerRadius as number) || 60}
                onChange={(e) => updateConfig('innerRadius', Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Pie (0%)</span>
                <span>{(config.innerRadius as number) || 60}%</span>
                <span>Thin Ring (80%)</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {isTimeSeries ? 'X-Axis (Time) Field *' : 'X-Axis (Category) Field *'}
                </label>
                <input
                  type="text"
                  value={(config.xAxisField as string) || (isTimeSeries ? 'timestamp' : 'category')}
                  onChange={(e) => updateConfig('xAxisField', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                  placeholder={isTimeSeries ? 'timestamp' : 'category'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Y-Axis (Value) Field *
                </label>
                <input
                  type="text"
                  value={(config.yAxisField as string) || 'value'}
                  onChange={(e) => updateConfig('yAxisField', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                  placeholder="value"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Series Field (for multiple lines/bars)
              </label>
              <input
                type="text"
                value={(config.seriesField as string) || ''}
                onChange={(e) => updateConfig('seriesField', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
                placeholder="series (optional)"
              />
              <p className="text-xs text-gray-500 mt-1">Leave empty for single series</p>
            </div>
          </>
        )}
      </div>

      {/* Chart Type Specific Options */}
      {chartType === 'line-chart' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Line Style
          </label>
          <select
            value={(config.lineType as string) || 'smooth'}
            onChange={(e) => updateConfig('lineType', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="smooth">Smooth (curved)</option>
            <option value="linear">Linear (straight)</option>
            <option value="step">Step</option>
          </select>
        </div>
      )}

      {chartType === 'bar-chart' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Orientation
            </label>
            <select
              value={(config.orientation as string) || 'vertical'}
              onChange={(e) => updateConfig('orientation', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.stacked as boolean) || false}
                onChange={(e) => updateConfig('stacked', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Stacked bars</span>
            </label>
          </div>
        </div>
      )}

      {chartType === 'area-chart' && (
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config.filled as boolean) ?? true}
              onChange={(e) => updateConfig('filled', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Fill area under line</span>
          </label>
        </div>
      )}

      {/* Common Display Options */}
      <div className="border-t pt-4 mt-4">
        <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase">Display Options</h5>
        
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config.showLegend as boolean) ?? true}
              onChange={(e) => updateConfig('showLegend', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show legend</span>
          </label>

          {!isPieStyle && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.showGrid as boolean) ?? true}
                onChange={(e) => updateConfig('showGrid', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show grid</span>
            </label>
          )}

          {isPieStyle && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(config.showLabels as boolean) ?? true}
                onChange={(e) => updateConfig('showLabels', e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Show labels</span>
            </label>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(config.showTooltip as boolean) ?? true}
              onChange={(e) => updateConfig('showTooltip', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Show tooltips</span>
          </label>
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
          <option value="default">Default</option>
          <option value="blues">Blues</option>
          <option value="greens">Greens</option>
          <option value="warm">Warm (Reds/Oranges)</option>
          <option value="cool">Cool (Blues/Purples)</option>
          <option value="rainbow">Rainbow</option>
        </select>
      </div>
    </div>
  );
}
