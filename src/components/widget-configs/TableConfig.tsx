import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { WidgetConfigProps } from './types';

interface TableColumn {
  field: string;
  header: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  format?: string;
}

type TableConfigProps = Pick<WidgetConfigProps, 'config' | 'setConfig'>;

export function TableConfig({ config, setConfig }: TableConfigProps) {
  const columns = (config.columns as TableColumn[]) || [];
  const [newColumn, setNewColumn] = useState({ field: '', header: '' });

  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  const addColumn = () => {
    if (newColumn.field && newColumn.header) {
      updateConfig('columns', [...columns, { ...newColumn, sortable: true, filterable: true }]);
      setNewColumn({ field: '', header: '' });
    }
  };

  const removeColumn = (index: number) => {
    updateConfig('columns', columns.filter((_, i) => i !== index));
  };

  const updateColumn = (index: number, updates: Partial<TableColumn>) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], ...updates };
    updateConfig('columns', newColumns);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
        Data Table Settings
      </h4>

      {/* Column Configuration */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Table Columns
        </label>
        
        {/* Existing Columns */}
        {columns.length > 0 && (
          <div className="space-y-2 mb-3">
            {columns.map((col, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                <input
                  type="text"
                  value={col.field}
                  onChange={(e) => updateColumn(index, { field: e.target.value })}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  placeholder="Field name"
                />
                <input
                  type="text"
                  value={col.header}
                  onChange={(e) => updateColumn(index, { header: e.target.value })}
                  className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                  placeholder="Header label"
                />
                <select
                  value={col.format || 'text'}
                  onChange={(e) => updateColumn(index, { format: e.target.value })}
                  className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-sm"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="currency">Currency</option>
                  <option value="badge">Badge</option>
                </select>
                <button
                  onClick={() => removeColumn(index)}
                  className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Column */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newColumn.field}
            onChange={(e) => setNewColumn({ ...newColumn, field: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            placeholder="Field name (e.g., user.name)"
          />
          <input
            type="text"
            value={newColumn.header}
            onChange={(e) => setNewColumn({ ...newColumn, header: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            placeholder="Column header"
          />
          <button
            onClick={addColumn}
            disabled={!newColumn.field || !newColumn.header}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Leave empty to auto-detect columns from data</p>
      </div>

      {/* Table Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Page Size
          </label>
          <select
            value={(config.pageSize as number) || 10}
            onChange={(e) => updateConfig('pageSize', Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
          >
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Default Sort Field
          </label>
          <input
            type="text"
            value={(config.defaultSortField as string) || ''}
            onChange={(e) => updateConfig('defaultSortField', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.sortable as boolean) ?? true}
            onChange={(e) => updateConfig('sortable', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Sortable columns</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.filterable as boolean) ?? true}
            onChange={(e) => updateConfig('filterable', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show filters</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showPagination as boolean) ?? true}
            onChange={(e) => updateConfig('showPagination', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Show pagination</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.showExport as boolean) || false}
            onChange={(e) => updateConfig('showExport', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Export button</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={(config.striped as boolean) ?? true}
            onChange={(e) => updateConfig('striped', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Striped rows</span>
        </label>
      </div>

      {/* Row Actions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Row Click Action
        </label>
        <select
          value={(config.onRowClick as string) || 'none'}
          onChange={(e) => updateConfig('onRowClick', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-sm"
        >
          <option value="none">None</option>
          <option value="expand">Expand details</option>
          <option value="navigate">Navigate to link</option>
          <option value="modal">Open in modal</option>
        </select>
      </div>
    </div>
  );
}
