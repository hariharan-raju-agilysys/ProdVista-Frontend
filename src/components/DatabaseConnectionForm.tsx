import React, { useState, useEffect } from 'react';
import {
  AuthenticationType,
  DatabaseType,
  CreateDatabaseConnectionRequest,
  DatabaseConnection
} from '../services/databaseQueryService';

interface DatabaseConnectionFormProps {
  connection?: DatabaseConnection;
  onSave: (connection: CreateDatabaseConnectionRequest) => Promise<void>;
  onCancel: () => void;
  onTest?: (connectionId: string) => Promise<{ success: boolean; message: string }>;
}

const DATABASE_TYPES: { value: DatabaseType; label: string; icon: string }[] = [
  { value: 'SqlServer', label: 'SQL Server', icon: '🗄️' },
  { value: 'PostgreSQL', label: 'PostgreSQL', icon: '🐘' },
  { value: 'MySQL', label: 'MySQL', icon: '🐬' },
  { value: 'Oracle', label: 'Oracle', icon: '🔶' },
  { value: 'AzureLogAnalytics', label: 'Azure Log Analytics', icon: '☁️' },
];

const AUTH_TYPES: { value: AuthenticationType; label: string; description: string }[] = [
  { value: 'SqlAuthentication', label: 'SQL Server Authentication', description: 'Use username and password' },
  { value: 'WindowsAuthentication', label: 'Windows Authentication', description: 'Use integrated Windows credentials' },
  { value: 'AzureActiveDirectory', label: 'Azure Active Directory', description: 'Use Azure AD authentication' },
  { value: 'ManagedIdentity', label: 'Managed Identity', description: 'Use Azure Managed Identity' },
];

const DEFAULT_PORTS: Record<string, number> = {
  SqlServer: 1433,
  PostgreSQL: 5432,
  MySQL: 3306,
  Oracle: 1521,
};

export const DatabaseConnectionForm: React.FC<DatabaseConnectionFormProps> = ({
  connection,
  onSave,
  onCancel,
  onTest
}) => {
  const [formData, setFormData] = useState<CreateDatabaseConnectionRequest>({
    name: '',
    databaseType: 'SqlServer',
    connectionMethod: 'IndividualFields',
    connectionString: '',
    serverName: '',
    port: 1433,
    databaseName: '',
    authenticationType: 'SqlAuthentication',
    username: '',
    password: '',
    useEncryption: true,
    trustServerCertificate: true,
    workspaceId: '',
    azureTenantId: '',
    azureClientId: '',
    azureClientSecret: '',
    description: '',
    connectionTimeoutSeconds: 30,
    queryTimeoutSeconds: 120,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (connection) {
      setFormData({
        name: connection.name,
        databaseType: connection.databaseType,
        connectionMethod: connection.connectionMethod,
        serverName: connection.serverName || '',
        port: connection.port || DEFAULT_PORTS[connection.databaseType] || 1433,
        databaseName: connection.databaseName || '',
        authenticationType: connection.authenticationType,
        useEncryption: connection.useEncryption,
        trustServerCertificate: connection.trustServerCertificate,
        workspaceId: connection.workspaceId || '',
        azureTenantId: connection.azureTenantId || '',
        azureClientId: connection.azureClientId || '',
        description: connection.description || '',
        connectionTimeoutSeconds: connection.connectionTimeoutSeconds,
        queryTimeoutSeconds: connection.queryTimeoutSeconds,
      });
    }
  }, [connection]);

  const handleDatabaseTypeChange = (type: DatabaseType) => {
    setFormData(prev => ({
      ...prev,
      databaseType: type,
      port: DEFAULT_PORTS[type] || prev.port,
      connectionMethod: type === 'AzureLogAnalytics' ? 'IndividualFields' : prev.connectionMethod,
    }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Connection name is required';
    }

    if (formData.connectionMethod === 'ConnectionString') {
      if (!formData.connectionString?.trim()) {
        newErrors.connectionString = 'Connection string is required';
      }
    } else {
      if (formData.databaseType === 'AzureLogAnalytics') {
        if (!formData.workspaceId?.trim()) {
          newErrors.workspaceId = 'Workspace ID is required';
        }
      } else {
        if (!formData.serverName?.trim()) {
          newErrors.serverName = 'Server name is required';
        }
        if (formData.authenticationType === 'SqlAuthentication') {
          if (!formData.username?.trim()) {
            newErrors.username = 'Username is required for SQL Authentication';
          }
          if (!formData.password?.trim() && !connection) {
            newErrors.password = 'Password is required for SQL Authentication';
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!connection?.id || !onTest) return;
    
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(connection.id);
      setTestResult(result);
    } catch (error) {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const isAzureLogAnalytics = formData.databaseType === 'AzureLogAnalytics';

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <h2 className="text-xl font-semibold text-white">
          {connection ? 'Edit Database Connection' : 'New Database Connection'}
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          Configure your database connection settings
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Connection Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Connection Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="My Production Database"
          />
          {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
        </div>

        {/* Database Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Database Type *
          </label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {DATABASE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleDatabaseTypeChange(type.value)}
                className={`p-3 rounded-lg border-2 text-center transition-all ${
                  formData.databaseType === type.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                }`}
              >
                <span className="text-2xl">{type.icon}</span>
                <p className="text-xs font-medium mt-1 text-gray-700 dark:text-gray-300">{type.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Connection Method Toggle (not for Azure Log Analytics) */}
        {!isAzureLogAnalytics && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Connection Method
            </label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, connectionMethod: 'IndividualFields' }))}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  formData.connectionMethod === 'IndividualFields'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                }`}
              >
                🔧 Individual Fields
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, connectionMethod: 'ConnectionString' }))}
                className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                  formData.connectionMethod === 'ConnectionString'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                }`}
              >
                📝 Connection String
              </button>
            </div>
          </div>
        )}

        {/* Connection String Input */}
        {formData.connectionMethod === 'ConnectionString' && !isAzureLogAnalytics && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Connection String *
            </label>
            <textarea
              value={formData.connectionString || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, connectionString: e.target.value }))}
              rows={3}
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 font-mono text-sm dark:bg-gray-700 dark:border-gray-600 ${
                errors.connectionString ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Server=myserver;Database=mydb;User Id=user;Password=***;"
            />
            {errors.connectionString && <p className="text-red-500 text-sm mt-1">{errors.connectionString}</p>}
            <p className="text-xs text-gray-500 mt-1">
              Enter the full connection string. Credentials will be encrypted at rest.
            </p>
          </div>
        )}

        {/* Individual Fields - Standard Database */}
        {formData.connectionMethod === 'IndividualFields' && !isAzureLogAnalytics && (
          <div className="space-y-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span>🖥️</span> Server Configuration
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Server / Host *
                </label>
                <input
                  type="text"
                  value={formData.serverName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, serverName: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 ${
                    errors.serverName ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="localhost or myserver.database.windows.net"
                />
                {errors.serverName && <p className="text-red-500 text-sm mt-1">{errors.serverName}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={formData.port || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder={String(DEFAULT_PORTS[formData.databaseType] || 1433)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Database Name
              </label>
              <input
                type="text"
                value={formData.databaseName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, databaseName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                placeholder="myDatabase"
              />
            </div>

            {/* Authentication Section */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                <span>🔐</span> Authentication
              </h3>
              
              <div className="space-y-3">
                {AUTH_TYPES.map((auth) => (
                  <label
                    key={auth.value}
                    className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                      formData.authenticationType === auth.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="authenticationType"
                      value={auth.value}
                      checked={formData.authenticationType === auth.value}
                      onChange={() => setFormData(prev => ({ ...prev, authenticationType: auth.value }))}
                      className="mt-1 text-blue-600"
                    />
                    <div className="ml-3">
                      <p className="font-medium text-gray-700 dark:text-gray-300">{auth.label}</p>
                      <p className="text-sm text-gray-500">{auth.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {/* Username/Password for SQL Auth */}
              {formData.authenticationType === 'SqlAuthentication' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={formData.username || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 ${
                        errors.username ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder="sa"
                    />
                    {errors.username && <p className="text-red-500 text-sm mt-1">{errors.username}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Password {!connection && '*'}
                    </label>
                    <input
                      type="password"
                      value={formData.password || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                      placeholder={connection ? '(unchanged)' : '••••••••'}
                    />
                    {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Security Options */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
              <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2 mb-3">
                <span>🔒</span> Security Options
              </h3>
              
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.useEncryption}
                    onChange={(e) => setFormData(prev => ({ ...prev, useEncryption: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Use encryption (TLS/SSL)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.trustServerCertificate}
                    onChange={(e) => setFormData(prev => ({ ...prev, trustServerCertificate: e.target.checked }))}
                    className="rounded text-blue-600"
                  />
                  <span className="ml-2 text-gray-700 dark:text-gray-300">Trust server certificate</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Azure Log Analytics Fields */}
        {isAzureLogAnalytics && (
          <div className="space-y-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span>☁️</span> Azure Log Analytics Configuration
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace ID *
              </label>
              <input
                type="text"
                value={formData.workspaceId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, workspaceId: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 ${
                  errors.workspaceId ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              />
              {errors.workspaceId && <p className="text-red-500 text-sm mt-1">{errors.workspaceId}</p>}
              <p className="text-xs text-gray-500 mt-1">
                Find this in Azure Portal &gt; Log Analytics workspace &gt; Overview
              </p>
            </div>

            <div className="border-t border-blue-200 dark:border-blue-800 pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Service Principal (Optional - for non-interactive access)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tenant ID
                  </label>
                  <input
                    type="text"
                    value={formData.azureTenantId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, azureTenantId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="Azure AD Tenant ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Client ID (Application ID)
                  </label>
                  <input
                    type="text"
                    value={formData.azureClientId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, azureClientId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                    placeholder="App Registration Client ID"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={formData.azureClientSecret || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, azureClientSecret: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                  placeholder={connection ? '(unchanged)' : '••••••••'}
                />
              </div>
            </div>
          </div>
        )}

        {/* Advanced Options */}
        <details className="border border-gray-200 dark:border-gray-600 rounded-lg">
          <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
            ⚙️ Advanced Options
          </summary>
          <div className="px-4 pb-4 pt-2 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                placeholder="Brief description of this connection..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Connection Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={formData.connectionTimeoutSeconds || 30}
                  onChange={(e) => setFormData(prev => ({ ...prev, connectionTimeoutSeconds: parseInt(e.target.value) || 30 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Query Timeout (seconds)
                </label>
                <input
                  type="number"
                  value={formData.queryTimeoutSeconds || 120}
                  onChange={(e) => setFormData(prev => ({ ...prev, queryTimeoutSeconds: parseInt(e.target.value) || 120 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
            </div>
          </div>
        </details>

        {/* Test Result */}
        {testResult && (
          <div className={`p-4 rounded-lg ${
            testResult.success 
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2">
              <span>{testResult.success ? '✅' : '❌'}</span>
              <span className={testResult.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
                {testResult.message}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-between items-center">
        <div>
          {connection && onTest && (
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 disabled:opacity-50"
            >
              {isTesting ? '🔄 Testing...' : '🔌 Test Connection'}
            </button>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : connection ? 'Update' : 'Create Connection'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatabaseConnectionForm;
