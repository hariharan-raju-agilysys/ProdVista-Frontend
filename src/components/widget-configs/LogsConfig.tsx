import { WidgetConfigProps } from './types';

type LogsConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

export function LogsConfig({ config, setConfig }: LogsConfigProps) {
  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
        Logs Viewer Settings
      </h4>

      {/* Field Mapping */}
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Map your log data fields</p>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timestamp Field *
            </label>
            <input
              type="text"
              value={(config.timestampField as string) || 'timestamp'}
              onChange={(e) => updateConfig('timestampField', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              placeholder="timestamp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Level Field
            </label>
            <input
              type="text"
              value={(config.levelField as string) || 'level'}
              onChange={(e) => updateConfig('levelField', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              placeholder="level (error, warn, info, debug)"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Message Field *
          </label>
          <input
            type="text"
            value={(config.messageField as string) || 'message'}
            onChange={(e) => updateConfig('messageField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="message"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source Field
            </label>
            <input
              type="text"
              value={(config.sourceField as string) || ''}
              onChange={(e) => updateConfig('sourceField', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              placeholder="source (optional)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Category Field
            </label>
            <input
              type="text"
              value={(config.categoryField as string) || ''}
              onChange={(e) => updateConfig('categoryField', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
              placeholder="category (optional)"
            />
          </div>
        </div>
      </div>

      {/* Display Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Max Lines
          </label>
          <select
            value={(config.maxLines as number) || 100}
            onChange={(e) => updateConfig('maxLines', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={200}>200 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Time Format
          </label>
          <select
            value={(config.timeFormat as string) || 'relative'}
            onChange={(e) => updateConfig('timeFormat', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value="relative">Relative (5m ago)</option>
            <option value="short">Short (10:30:45)</option>
            <option value="long">Full (2024-03-17 10:30:45)</option>
            <option value="iso">ISO 8601</option>
          </select>
        </div>
      </div>

      {/* Level Filters */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Show Log Levels
        </label>
        <div className="flex flex-wrap gap-2">
          {['error', 'warn', 'info', 'debug', 'trace'].map(level => {
            const levels = (config.visibleLevels as string[]) || ['error', 'warn', 'info'];
            const isChecked = levels.includes(level);
            const colors: Record<string, string> = {
              error: 'border-red-300 bg-red-50 text-red-700',
              warn: 'border-yellow-300 bg-yellow-50 text-yellow-700',
              info: 'border-blue-300 bg-blue-50 text-blue-700',
              debug: 'border-gray-300 bg-gray-50 text-gray-700',
              trace: 'border-gray-200 bg-gray-50 text-gray-500',
            };
            return (
              <label
                key={level}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer ${
                  isChecked ? colors[level] : 'border-gray-200 bg-white text-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateConfig('visibleLevels', [...levels, level]);
                    } else {
                      updateConfig('visibleLevels', levels.filter(l => l !== level));
                    }
                  }}
                  className="sr-only"
                />
                <span className="text-sm font-medium capitalize">{level}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.autoScroll as boolean) ?? true}
            onChange={(e) => updateConfig('autoScroll', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Auto-scroll to new logs</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showFilters as boolean) ?? true}
            onChange={(e) => updateConfig('showFilters', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show filter bar</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showSearch as boolean) ?? true}
            onChange={(e) => updateConfig('showSearch', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show search</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.wrapText as boolean) || false}
            onChange={(e) => updateConfig('wrapText', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Wrap long lines</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showLineNumbers as boolean) || false}
            onChange={(e) => updateConfig('showLineNumbers', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show line numbers</span>
        </label>
      </div>

      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Log Viewer Theme
        </label>
        <select
          value={(config.theme as string) || 'default'}
          onChange={(e) => updateConfig('theme', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
        >
          <option value="default">Default</option>
          <option value="terminal">Terminal (dark)</option>
          <option value="light">Light</option>
          <option value="solarized">Solarized</option>
        </select>
      </div>
    </div>
  );
}
