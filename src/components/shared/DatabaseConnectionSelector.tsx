import React, { useState, useMemo, useEffect } from 'react';
import {
  Database, Server, Check, ChevronDown, ChevronRight,
  Search, Link2, X, RefreshCw, Star, AlertCircle
} from 'lucide-react';
import clsx from 'clsx';

// ============================================================================
// Types
// ============================================================================
interface DatabaseConnection {
  id: string;
  name: string;
  databaseType: string;
  serverName?: string | null;
  databaseName?: string | null;
  description?: string | null;
  isActive?: boolean;
  lastTestSuccessful?: boolean | null;
}

interface DatabaseConnectionSelectorProps {
  connections: DatabaseConnection[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  defaultConnectionId?: string;
  onDefaultChange?: (id: string | undefined) => void;
  enableCrossJoins?: boolean;
  onCrossJoinChange?: (enabled: boolean) => void;
  maxSelections?: number;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

interface GroupedConnections {
  [serverName: string]: DatabaseConnection[];
}

// ============================================================================
// Helper to truncate server names
// ============================================================================
const getDisplayServerName = (serverName: string): string => {
  // Extract just the server name if it's a fully qualified domain
  if (serverName.includes('.database.windows.net')) {
    return serverName.replace('.database.windows.net', '');
  }
  if (serverName.includes('.')) {
    return serverName.split('.')[0];
  }
  return serverName;
};

// ============================================================================
// Main Component
// ============================================================================
export const DatabaseConnectionSelector: React.FC<DatabaseConnectionSelectorProps> = ({
  connections,
  selectedIds,
  onSelectionChange,
  defaultConnectionId,
  onDefaultChange,
  enableCrossJoins = false,
  onCrossJoinChange,
  maxSelections = 10,
  loading = false,
  onRefresh,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  // Auto-expand servers with selections
  useEffect(() => {
    const serversWithSelection = new Set<string>();
    connections.forEach(conn => {
      if (selectedIds.includes(conn.id) && conn.serverName) {
        serversWithSelection.add(conn.serverName);
      }
    });
    if (serversWithSelection.size > 0) {
      setExpandedServers(serversWithSelection);
    }
  }, [connections, selectedIds]);

  // Group connections by server
  const groupedConnections = useMemo(() => {
    const filtered = connections.filter(conn =>
      conn.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (conn.serverName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (conn.databaseName?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    );

    return filtered.reduce((acc, conn) => {
      const serverKey = conn.serverName || 'Local / Other';
      if (!acc[serverKey]) {
        acc[serverKey] = [];
      }
      acc[serverKey].push(conn);
      return acc;
    }, {} as GroupedConnections);
  }, [connections, searchTerm]);

  const toggleServer = (serverName: string) => {
    setExpandedServers(prev => {
      const next = new Set(prev);
      if (next.has(serverName)) {
        next.delete(serverName);
      } else {
        next.add(serverName);
      }
      return next;
    });
  };

  const isSelected = (id: string) => selectedIds.includes(id);

  const toggleConnection = (id: string) => {
    if (isSelected(id)) {
      onSelectionChange(selectedIds.filter(i => i !== id));
      // If default was removed, clear it
      if (defaultConnectionId === id && onDefaultChange) {
        onDefaultChange(undefined);
      }
    } else if (selectedIds.length < maxSelections) {
      const newSelection = [...selectedIds, id];
      onSelectionChange(newSelection);
      // If this is the first selection, make it default
      if (newSelection.length === 1 && onDefaultChange) {
        onDefaultChange(id);
      }
    }
  };

  const setAsDefault = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDefaultChange) {
      onDefaultChange(id);
    }
    // Ensure it's selected
    if (!isSelected(id)) {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const clearAll = () => {
    onSelectionChange([]);
    if (onDefaultChange) {
      onDefaultChange(undefined);
    }
  };

  const selectAll = (serverName: string) => {
    const serverConns = groupedConnections[serverName] || [];
    const unselected = serverConns.filter(c => !isSelected(c.id));
    const remaining = maxSelections - selectedIds.length;
    const toAdd = unselected.slice(0, remaining);
    if (toAdd.length > 0) {
      onSelectionChange([...selectedIds, ...toAdd.map(c => c.id)]);
    }
  };

  const deselectAll = (serverName: string) => {
    const serverConns = groupedConnections[serverName] || [];
    const serverIds = new Set(serverConns.map(c => c.id));
    onSelectionChange(selectedIds.filter(id => !serverIds.has(id)));
    // Clear default if it was in this server
    if (defaultConnectionId && serverIds.has(defaultConnectionId) && onDefaultChange) {
      onDefaultChange(undefined);
    }
  };

  const serverCount = Object.keys(groupedConnections).length;
  const totalSelected = selectedIds.length;

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Database Selection
          </h3>
          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full">
            {totalSelected}/{maxSelections}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {totalSelected > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-red-500 hover:text-red-600 dark:text-red-400 hover:underline"
            >
              Clear all
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Refresh connections"
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
            </button>
          )}
        </div>
      </div>

      {/* Cross-Database Joins Toggle */}
      {totalSelected > 1 && onCrossJoinChange && (
        <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Cross-Database JOINs
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Allow AI to write queries joining across databases
              </p>
            </div>
          </div>
          <button
            onClick={() => onCrossJoinChange(!enableCrossJoins)}
            className={clsx(
              'relative w-11 h-6 rounded-full transition-colors',
              enableCrossJoins ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'
            )}
          >
            <span
              className={clsx(
                'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                enableCrossJoins ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search databases..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Database List */}
      <div className="space-y-2 max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-1">
        {serverCount === 0 && !loading && (
          <div className="p-6 text-center">
            <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No databases match your search' : 'No database connections available'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add connections in the Database Connections page
            </p>
          </div>
        )}

        {loading && (
          <div className="p-6 text-center">
            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading connections...</p>
          </div>
        )}

        {Object.entries(groupedConnections).map(([serverName, serverConns]) => {
          const selectedCount = serverConns.filter(c => isSelected(c.id)).length;
          const isExpanded = expandedServers.has(serverName);
          const displayName = getDisplayServerName(serverName);

          return (
            <div key={serverName} className="border border-gray-100 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800/50">
              {/* Server Header */}
              <button
                onClick={() => toggleServer(serverName)}
                className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <Server className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-200 truncate" title={serverName}>
                  {displayName}
                </span>
                <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300 rounded-full">
                  {selectedCount}/{serverConns.length}
                </span>
              </button>

              {/* Databases */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-slate-700">
                  {/* Server Actions */}
                  <div className="flex items-center justify-end gap-3 px-3 py-1.5 bg-gray-25 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => selectAll(serverName)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                      disabled={selectedCount === serverConns.length}
                    >
                      Select all
                    </button>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <button
                      onClick={() => deselectAll(serverName)}
                      className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:underline"
                      disabled={selectedCount === 0}
                    >
                      Deselect all
                    </button>
                  </div>

                  {serverConns.map((conn) => {
                    const selected = isSelected(conn.id);
                    const isDefault = defaultConnectionId === conn.id;
                    const atLimit = !selected && selectedIds.length >= maxSelections;

                    return (
                      <div
                        key={conn.id}
                        onClick={() => !atLimit && toggleConnection(conn.id)}
                        className={clsx(
                          'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-all border-l-4',
                          selected
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500 dark:border-l-blue-400'
                            : 'bg-white dark:bg-transparent border-l-transparent hover:bg-gray-50 dark:hover:bg-slate-800',
                          atLimit && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={clsx(
                            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                            selected
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300 dark:border-gray-500'
                          )}
                        >
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Connection Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Database className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                              {conn.name}
                            </span>
                            {isDefault && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-400 rounded">
                                DEFAULT
                              </span>
                            )}
                            {conn.lastTestSuccessful === false && (
                              <span title="Last test failed">
                                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                              </span>
                            )}
                          </div>
                          {conn.databaseName && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                              {conn.databaseName}
                            </p>
                          )}
                        </div>

                        {/* Make Default Button */}
                        {selected && onDefaultChange && !isDefault && (
                          <button
                            onClick={(e) => setAsDefault(conn.id, e)}
                            className="p-1.5 text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            title="Set as default"
                          >
                            <Star className="w-4 h-4" />
                          </button>
                        )}
                        {isDefault && (
                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}

                        {/* Database Type Badge */}
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded uppercase">
                          {conn.databaseType}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Summary */}
      {totalSelected > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Selected Databases ({totalSelected})
            </p>
            {defaultConnectionId && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <Star className="w-3 h-3 fill-current" />
                Default: {connections.find(c => c.id === defaultConnectionId)?.name || 'Unknown'}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const conn = connections.find(c => c.id === id);
              if (!conn) return null;
              return (
                <span
                  key={id}
                  className={clsx(
                    'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full',
                    defaultConnectionId === id
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700'
                  )}
                >
                  <Database className="w-3 h-3" />
                  {conn.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleConnection(id);
                    }}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseConnectionSelector;
