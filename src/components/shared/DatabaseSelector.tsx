import React, { useState, useEffect, useMemo } from 'react';
import { Database, Server, Check, AlertCircle, RefreshCw, Search, ChevronDown, ChevronRight, Loader2, Link2, Zap } from 'lucide-react';
import { AzureSqlDatabase, DatabaseConnection } from '../../types';
import { azureResourceService } from '../../services/azureResourceService';

interface DatabaseSelectorProps {
  selectedDatabases: DatabaseConnection[];
  onSelectionChange: (databases: DatabaseConnection[]) => void;
  maxSelections?: number;
  enableCrossJoins?: boolean;
  onCrossJoinChange?: (enabled: boolean) => void;
  showTestConnection?: boolean;
  className?: string;
}

interface GroupedDatabases {
  [serverName: string]: AzureSqlDatabase[];
}

export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  selectedDatabases,
  onSelectionChange,
  maxSelections = 5,
  enableCrossJoins = false,
  onCrossJoinChange,
  showTestConnection = true,
  className = '',
}) => {
  const [databases, setDatabases] = useState<AzureSqlDatabase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  // Load databases on mount
  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await azureResourceService.getDatabases();
      setDatabases(result);
      // Auto-expand servers that have selected databases
      const serversWithSelection = new Set(
        selectedDatabases.map(db => {
          const found = result.find(d => d.connectionString === db.connectionString);
          return found?.serverName || '';
        }).filter(Boolean)
      );
      setExpandedServers(serversWithSelection);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load databases');
    } finally {
      setLoading(false);
    }
  };

  // Group databases by server
  const groupedDatabases = useMemo(() => {
    const filtered = databases.filter(db =>
      db.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      db.serverName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return filtered.reduce((acc, db) => {
      if (!acc[db.serverName]) {
        acc[db.serverName] = [];
      }
      acc[db.serverName].push(db);
      return acc;
    }, {} as GroupedDatabases);
  }, [databases, searchTerm]);

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

  const isDatabaseSelected = (db: AzureSqlDatabase) => {
    return selectedDatabases.some(selected => selected.connectionString === db.connectionString);
  };

  const toggleDatabase = (db: AzureSqlDatabase) => {
    if (isDatabaseSelected(db)) {
      onSelectionChange(selectedDatabases.filter(selected => selected.connectionString !== db.connectionString));
    } else if (selectedDatabases.length < maxSelections) {
      const newConnection: DatabaseConnection = {
        id: db.id,
        name: db.name,
        connectionString: db.connectionString,
        serverName: db.serverName,
        databaseType: 'sqlserver',
        isConnected: connectionStatus[db.id] === 'success',
      };
      onSelectionChange([...selectedDatabases, newConnection]);
    }
  };

  const testConnection = async (db: AzureSqlDatabase) => {
    if (!db.connectionString) {
      setConnectionStatus(prev => ({ ...prev, [db.id]: 'error' }));
      return;
    }
    setTestingConnection(db.id);
    try {
      const result = await azureResourceService.testDatabaseConnection(db.connectionString);
      setConnectionStatus(prev => ({ ...prev, [db.id]: result.success ? 'success' : 'error' }));
      
      // Update selected database status if it's selected
      if (isDatabaseSelected(db)) {
        onSelectionChange(
          selectedDatabases.map(selected =>
            selected.connectionString === db.connectionString
              ? { ...selected, isConnected: result.success }
              : selected
          )
        );
      }
    } catch {
      setConnectionStatus(prev => ({ ...prev, [db.id]: 'error' }));
    } finally {
      setTestingConnection(null);
    }
  };

  const serverCount = Object.keys(groupedDatabases).length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500 dark:text-blue-400" />
          Database Selection
          <span className="text-sm text-gray-500 dark:text-gray-400 font-normal">
            ({selectedDatabases.length}/{maxSelections})
          </span>
        </h3>
        <button
          onClick={loadDatabases}
          disabled={loading}
          className="p-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          title="Refresh databases"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cross-Database Joins Toggle */}
      {selectedDatabases.length > 1 && onCrossJoinChange && (
        <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Cross-Database Joins</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Allow AI to write queries that join across databases</p>
            </div>
          </div>
          <button
            onClick={() => onCrossJoinChange(!enableCrossJoins)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enableCrossJoins ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                enableCrossJoins ? 'translate-x-7' : 'translate-x-1'
              }`}
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
          placeholder="Search databases or servers..."
          className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Database List */}
      {!loading && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {Object.entries(groupedDatabases).map(([serverName, serverDatabases]) => (
            <div key={serverName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Server Header */}
              <button
                onClick={() => toggleServer(serverName)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {expandedServers.has(serverName) ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                )}
                <Server className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{serverName}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                  {serverDatabases.filter(db => isDatabaseSelected(db)).length}/{serverDatabases.length} selected
                </span>
              </button>

              {/* Databases */}
              {expandedServers.has(serverName) && (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {serverDatabases.map((db) => {
                    const isSelected = isDatabaseSelected(db);
                    const status = connectionStatus[db.id];
                    const isTesting = testingConnection === db.id;

                    return (
                      <div
                        key={db.id}
                        className={`flex items-center gap-3 px-4 py-3 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleDatabase(db)}
                          disabled={!isSelected && selectedDatabases.length >= maxSelections}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-500 hover:border-gray-400'
                          } ${
                            !isSelected && selectedDatabases.length >= maxSelections
                              ? 'opacity-50 cursor-not-allowed'
                              : ''
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </button>

                        {/* Database Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-sm text-gray-900 dark:text-white truncate">{db.name}</span>
                            {db.tier && (
                              <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                                {db.tier}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mt-0.5">
                            {db.location}
                          </p>
                        </div>

                        {/* Connection Status */}
                        {status && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              status === 'success' ? 'bg-green-400' : 'bg-red-400'
                            }`}
                            title={status === 'success' ? 'Connected' : 'Connection failed'}
                          />
                        )}

                        {/* Test Connection Button */}
                        {showTestConnection && (
                          <button
                            onClick={() => testConnection(db)}
                            disabled={isTesting}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Test connection"
                          >
                            {isTesting ? (
                              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            ) : (
                              <Zap className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Empty State */}
          {serverCount === 0 && !loading && (
            <div className="p-8 text-center border border-gray-300 dark:border-gray-700 rounded-lg border-dashed">
              <Database className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                {searchTerm ? 'No databases match your search' : 'No databases found'}
              </p>
              {!searchTerm && (
                <p className="text-xs text-gray-500 mb-4">
                  Sign in to Azure to discover SQL databases in your subscriptions.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Selected Summary */}
      {selectedDatabases.length > 0 && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Selected Databases:</p>
          <div className="flex flex-wrap gap-2">
            {selectedDatabases.map((db) => (
              <span
                key={db.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-sm text-blue-300"
              >
                <Database className="w-3 h-3" />
                {db.name}
                <button
                  onClick={() => onSelectionChange(selectedDatabases.filter(d => d.id !== db.id))}
                  className="ml-1 hover:text-white transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      {selectedDatabases.length >= maxSelections && (
        <p className="text-xs text-amber-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Maximum of {maxSelections} databases can be selected
        </p>
      )}
    </div>
  );
};

export default DatabaseSelector;
