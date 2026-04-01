import React, { useState } from 'react';
import { Plus, Trash2, Play, CheckCircle, XCircle, Loader2, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';

// Types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
export type AuthMode = 'none' | 'basic' | 'bearer' | 'oauth2' | 'apikey';
export type BodyType = 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface OAuth2Config {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  grantType: 'client_credentials' | 'password' | 'authorization_code';
  scope?: string;
}

export interface ApiEndpointConfiguration {
  url: string;
  method: HttpMethod;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyType: BodyType;
  body: string;
  formData: KeyValuePair[];
  auth: {
    mode: AuthMode;
    basic?: { username: string; password: string };
    bearer?: { token: string };
    oauth2?: OAuth2Config;
    apiKey?: { key: string; value: string; addTo: 'header' | 'query' };
  };
  jsonPath?: string;
}

export interface ApiTestResult {
  success: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  data?: unknown;
  error?: string;
  duration?: number;
}

interface ApiEndpointConfigProps {
  config: ApiEndpointConfiguration;
  onChange: (config: ApiEndpointConfiguration) => void;
  onTest?: (config: ApiEndpointConfiguration) => Promise<ApiTestResult>;
  previewData?: unknown;
  isLoading?: boolean;
}

const HTTP_METHODS: { value: HttpMethod; color: string }[] = [
  { value: 'GET', color: 'bg-green-500' },
  { value: 'POST', color: 'bg-yellow-500' },
  { value: 'PUT', color: 'bg-blue-500' },
  { value: 'PATCH', color: 'bg-purple-500' },
  { value: 'DELETE', color: 'bg-red-500' },
];

const AUTH_MODES: { value: AuthMode; label: string; description: string }[] = [
  { value: 'none', label: 'No Auth', description: 'No authentication required' },
  { value: 'basic', label: 'Basic Auth', description: 'Username and password' },
  { value: 'bearer', label: 'Bearer Token', description: 'JWT or access token' },
  { value: 'oauth2', label: 'OAuth 2.0', description: 'Token generation flow' },
  { value: 'apikey', label: 'API Key', description: 'Key-value authentication' },
];

const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'Raw' },
];

const GRANT_TYPES = [
  { value: 'client_credentials', label: 'Client Credentials' },
  { value: 'password', label: 'Password Grant' },
  { value: 'authorization_code', label: 'Authorization Code' },
];

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Default configuration
export const getDefaultApiConfig = (): ApiEndpointConfiguration => ({
  url: '',
  method: 'GET',
  headers: [{ id: generateId(), key: '', value: '', enabled: true }],
  queryParams: [{ id: generateId(), key: '', value: '', enabled: true }],
  bodyType: 'none',
  body: '',
  formData: [{ id: generateId(), key: '', value: '', enabled: true }],
  auth: { mode: 'none' },
  jsonPath: '',
});

export const ApiEndpointConfig: React.FC<ApiEndpointConfigProps> = ({
  config,
  onChange,
  onTest,
  previewData: _previewData,
  isLoading: _isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'params' | 'auth' | 'headers' | 'body'>('params');
  const [testResult, setTestResult] = useState<ApiTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Update URL with query params
  const buildUrlWithParams = (): string => {
    if (!config.url) return '';
    const enabledParams = config.queryParams.filter(p => p.enabled && p.key);
    if (enabledParams.length === 0) return config.url;
    
    const params = new URLSearchParams();
    enabledParams.forEach(p => params.append(p.key, p.value));
    const separator = config.url.includes('?') ? '&' : '?';
    return `${config.url}${separator}${params.toString()}`;
  };

  // Key-Value pair handlers
  const addKeyValuePair = (field: 'headers' | 'queryParams' | 'formData') => {
    onChange({
      ...config,
      [field]: [...config[field], { id: generateId(), key: '', value: '', enabled: true }],
    });
  };

  const updateKeyValuePair = (
    field: 'headers' | 'queryParams' | 'formData',
    id: string,
    updates: Partial<KeyValuePair>
  ) => {
    onChange({
      ...config,
      [field]: config[field].map(item =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  };

  const removeKeyValuePair = (field: 'headers' | 'queryParams' | 'formData', id: string) => {
    onChange({
      ...config,
      [field]: config[field].filter(item => item.id !== id),
    });
  };

  // Test API endpoint
  const handleTest = async () => {
    if (!onTest) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(config);
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Generate OAuth token
  const handleGenerateToken = async () => {
    if (!config.auth.oauth2?.tokenEndpoint) return;
    
    setIsGeneratingToken(true);
    try {
      const oauth = config.auth.oauth2;
      const body = new URLSearchParams();
      body.append('grant_type', oauth.grantType);
      body.append('client_id', oauth.clientId);
      body.append('client_secret', oauth.clientSecret);
      
      if (oauth.grantType === 'password') {
        body.append('username', oauth.username || '');
        body.append('password', oauth.password || '');
      }
      if (oauth.scope) {
        body.append('scope', oauth.scope);
      }

      const response = await fetch(oauth.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = await response.json();
      if (data.access_token) {
        setGeneratedToken(data.access_token);
        // Auto-update bearer token
        onChange({
          ...config,
          auth: {
            ...config.auth,
            bearer: { token: data.access_token },
          },
        });
      } else {
        throw new Error(data.error_description || 'Failed to get token');
      }
    } catch (error) {
      setTestResult({
        success: false,
        error: `Token generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Render Key-Value pairs editor
  const renderKeyValueEditor = (
    field: 'headers' | 'queryParams' | 'formData',
    items: KeyValuePair[],
    keyPlaceholder: string = 'Key',
    valuePlaceholder: string = 'Value'
  ) => (
    <div className="space-y-2">
      {items.map((item, _index) => (
        <div key={item.id} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => updateKeyValuePair(field, item.id, { enabled: e.target.checked })}
            className="rounded text-blue-600"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => updateKeyValuePair(field, item.id, { key: e.target.value })}
            placeholder={keyPlaceholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => updateKeyValuePair(field, item.id, { value: e.target.value })}
            placeholder={valuePlaceholder}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => removeKeyValuePair(field, item.id)}
            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
            disabled={items.length === 1}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addKeyValuePair(field)}
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
      >
        <Plus className="w-4 h-4" /> Add {field === 'headers' ? 'Header' : field === 'queryParams' ? 'Parameter' : 'Field'}
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* URL and Method Row */}
      <div className="flex gap-2">
        {/* Method Selector */}
        <select
          value={config.method}
          onChange={(e) => onChange({ ...config, method: e.target.value as HttpMethod })}
          className={`px-3 py-2 text-sm font-bold text-white rounded-md border-0 ${
            HTTP_METHODS.find(m => m.value === config.method)?.color || 'bg-gray-500'
          }`}
        >
          {HTTP_METHODS.map(m => (
            <option key={m.value} value={m.value} className="bg-white text-gray-900">
              {m.value}
            </option>
          ))}
        </select>

        {/* URL Input */}
        <input
          type="url"
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 font-mono"
        />

        {/* Test Button */}
        {onTest && (
          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting || !config.url}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Send
          </button>
        )}
      </div>

      {/* Built URL Preview */}
      {config.queryParams.some(p => p.enabled && p.key) && (
        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono text-gray-600 dark:text-gray-300 overflow-x-auto">
          {buildUrlWithParams()}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-600">
        <nav className="flex -mb-px space-x-4">
          {(['params', 'auth', 'headers', 'body'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'params' && 'Params'}
              {tab === 'auth' && 'Authorization'}
              {tab === 'headers' && 'Headers'}
              {tab === 'body' && 'Body'}
              {tab === 'params' && config.queryParams.filter(p => p.enabled && p.key).length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                  {config.queryParams.filter(p => p.enabled && p.key).length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {/* Query Parameters Tab */}
        {activeTab === 'params' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Query parameters are appended to the URL</p>
            {renderKeyValueEditor('queryParams', config.queryParams, 'Parameter name', 'Value')}
          </div>
        )}

        {/* Authorization Tab */}
        {activeTab === 'auth' && (
          <div className="space-y-4">
            {/* Auth Type Selection */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {AUTH_MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onChange({ ...config, auth: { ...config.auth, mode: mode.value } })}
                  className={`p-3 text-left rounded-lg border-2 transition-colors ${
                    config.auth.mode === mode.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-700 dark:text-gray-300">{mode.label}</p>
                  <p className="text-xs text-gray-500">{mode.description}</p>
                </button>
              ))}
            </div>

            {/* Basic Auth */}
            {config.auth.mode === 'basic' && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-medium text-sm">Basic Authentication</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
                    <input
                      type="text"
                      value={config.auth.basic?.username || ''}
                      onChange={(e) => onChange({
                        ...config,
                        auth: { ...config.auth, basic: { ...config.auth.basic, username: e.target.value, password: config.auth.basic?.password || '' } }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword.basic ? 'text' : 'password'}
                        value={config.auth.basic?.password || ''}
                        onChange={(e) => onChange({
                          ...config,
                          auth: { ...config.auth, basic: { ...config.auth.basic, username: config.auth.basic?.username || '', password: e.target.value } }
                        })}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => ({ ...p, basic: !p.basic }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword.basic ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bearer Token */}
            {config.auth.mode === 'bearer' && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-medium text-sm">Bearer Token</h4>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Token</label>
                  <div className="relative">
                    <input
                      type={showPassword.bearer ? 'text' : 'password'}
                      value={config.auth.bearer?.token || ''}
                      onChange={(e) => onChange({
                        ...config,
                        auth: { ...config.auth, bearer: { token: e.target.value } }
                      })}
                      className="w-full px-3 py-2 pr-20 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                      placeholder="Paste your token here"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(config.auth.bearer?.token || '')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Copy"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => ({ ...p, bearer: !p.bearer }))}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword.bearer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  The token will be sent as: <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">Authorization: Bearer {'<token>'}</code>
                </p>
              </div>
            )}

            {/* OAuth 2.0 */}
            {config.auth.mode === 'oauth2' && (
              <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">OAuth 2.0 Configuration</h4>
                  <button
                    type="button"
                    onClick={handleGenerateToken}
                    disabled={isGeneratingToken || !config.auth.oauth2?.tokenEndpoint}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-500 rounded hover:bg-orange-600 disabled:opacity-50"
                  >
                    {isGeneratingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Get New Access Token
                  </button>
                </div>

                {/* Grant Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Grant Type</label>
                  <select
                    value={config.auth.oauth2?.grantType || 'client_credentials'}
                    onChange={(e) => onChange({
                      ...config,
                      auth: {
                        ...config.auth,
                        oauth2: { ...config.auth.oauth2!, grantType: e.target.value as OAuth2Config['grantType'] }
                      }
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                  >
                    {GRANT_TYPES.map(gt => (
                      <option key={gt.value} value={gt.value}>{gt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Token Endpoint */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Token Endpoint URL *</label>
                  <input
                    type="url"
                    value={config.auth.oauth2?.tokenEndpoint || ''}
                    onChange={(e) => onChange({
                      ...config,
                      auth: {
                        ...config.auth,
                        oauth2: { ...config.auth.oauth2!, tokenEndpoint: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                    placeholder="https://auth.example.com/oauth/token"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client ID *</label>
                    <input
                      type="text"
                      value={config.auth.oauth2?.clientId || ''}
                      onChange={(e) => onChange({
                        ...config,
                        auth: {
                          ...config.auth,
                          oauth2: { ...config.auth.oauth2!, clientId: e.target.value }
                        }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Your client ID"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client Secret *</label>
                    <div className="relative">
                      <input
                        type={showPassword.clientSecret ? 'text' : 'password'}
                        value={config.auth.oauth2?.clientSecret || ''}
                        onChange={(e) => onChange({
                          ...config,
                          auth: {
                            ...config.auth,
                            oauth2: { ...config.auth.oauth2!, clientSecret: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Your client secret"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => ({ ...p, clientSecret: !p.clientSecret }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword.clientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Grant fields */}
                {config.auth.oauth2?.grantType === 'password' && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Username *</label>
                      <input
                        type="text"
                        value={config.auth.oauth2?.username || ''}
                        onChange={(e) => onChange({
                          ...config,
                          auth: {
                            ...config.auth,
                            oauth2: { ...config.auth.oauth2!, username: e.target.value }
                          }
                        })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                        placeholder="Resource owner username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Password *</label>
                      <div className="relative">
                        <input
                          type={showPassword.oauth2Pass ? 'text' : 'password'}
                          value={config.auth.oauth2?.password || ''}
                          onChange={(e) => onChange({
                            ...config,
                            auth: {
                              ...config.auth,
                              oauth2: { ...config.auth.oauth2!, password: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                          placeholder="Resource owner password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => ({ ...p, oauth2Pass: !p.oauth2Pass }))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword.oauth2Pass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scope */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Scope (optional)</label>
                  <input
                    type="text"
                    value={config.auth.oauth2?.scope || ''}
                    onChange={(e) => onChange({
                      ...config,
                      auth: {
                        ...config.auth,
                        oauth2: { ...config.auth.oauth2!, scope: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    placeholder="read write openid"
                  />
                </div>

                {/* Generated Token Display */}
                {generatedToken && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">Access Token Generated</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedToken)}
                        className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <code className="text-xs text-green-800 dark:text-green-200 break-all block">
                      {generatedToken.substring(0, 50)}...
                    </code>
                  </div>
                )}
              </div>
            )}

            {/* API Key */}
            {config.auth.mode === 'apikey' && (
              <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <h4 className="font-medium text-sm">API Key Authentication</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Key Name</label>
                    <input
                      type="text"
                      value={config.auth.apiKey?.key || ''}
                      onChange={(e) => onChange({
                        ...config,
                        auth: { ...config.auth, apiKey: { ...config.auth.apiKey!, key: e.target.value } }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="X-API-Key"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
                    <input
                      type="text"
                      value={config.auth.apiKey?.value || ''}
                      onChange={(e) => onChange({
                        ...config,
                        auth: { ...config.auth, apiKey: { ...config.auth.apiKey!, value: e.target.value } }
                      })}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                      placeholder="Your API key"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Add To</label>
                  <div className="flex gap-3">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="apikey-location"
                        checked={config.auth.apiKey?.addTo === 'header'}
                        onChange={() => onChange({
                          ...config,
                          auth: { ...config.auth, apiKey: { ...config.auth.apiKey!, addTo: 'header' } }
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm">Header</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="apikey-location"
                        checked={config.auth.apiKey?.addTo === 'query'}
                        onChange={() => onChange({
                          ...config,
                          auth: { ...config.auth, apiKey: { ...config.auth.apiKey!, addTo: 'query' } }
                        })}
                        className="mr-2"
                      />
                      <span className="text-sm">Query Param</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Headers Tab */}
        {activeTab === 'headers' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Custom headers to include with the request</p>
            {renderKeyValueEditor('headers', config.headers, 'Header name', 'Value')}
          </div>
        )}

        {/* Body Tab */}
        {activeTab === 'body' && (
          <div className="space-y-3">
            {config.method === 'GET' ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg text-sm text-yellow-700 dark:text-yellow-300">
                ⚠️ GET requests typically don't have a body. Switch to POST, PUT, or PATCH to add a request body.
              </div>
            ) : (
              <>
                {/* Body Type Selection */}
                <div className="flex gap-2">
                  {BODY_TYPES.map(bt => (
                    <button
                      key={bt.value}
                      type="button"
                      onClick={() => onChange({ ...config, bodyType: bt.value })}
                      className={`px-3 py-1.5 text-sm rounded-md ${
                        config.bodyType === bt.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {bt.label}
                    </button>
                  ))}
                </div>

                {/* Body Content */}
                {config.bodyType === 'json' && (
                  <div>
                    <textarea
                      value={config.body}
                      onChange={(e) => onChange({ ...config, body: e.target.value })}
                      rows={8}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                      placeholder={'{\n  "key": "value"\n}'}
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter valid JSON</p>
                  </div>
                )}

                {config.bodyType === 'raw' && (
                  <textarea
                    value={config.body}
                    onChange={(e) => onChange({ ...config, body: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
                    placeholder="Enter raw body content..."
                  />
                )}

                {(config.bodyType === 'form-data' || config.bodyType === 'x-www-form-urlencoded') && (
                  renderKeyValueEditor('formData', config.formData, 'Field name', 'Value')
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* JSON Path for response */}
      <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          JSON Path (optional)
        </label>
        <input
          type="text"
          value={config.jsonPath || ''}
          onChange={(e) => onChange({ ...config, jsonPath: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 font-mono"
          placeholder="$.data.items or data.results"
        />
        <p className="text-xs text-gray-500 mt-1">Extract specific data from the JSON response (supports JSONPath or dot notation)</p>
      </div>

      {/* Test Result */}
      {testResult && (
        <div className={`p-4 rounded-lg ${
          testResult.success 
            ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              <span className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {testResult.success 
                  ? `${testResult.status} ${testResult.statusText}` 
                  : 'Request Failed'}
              </span>
            </div>
            {testResult.duration && (
              <span className="text-sm text-gray-500">{testResult.duration}ms</span>
            )}
          </div>
          
          {testResult.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{testResult.error}</p>
          )}
          
          {testResult.data !== undefined && testResult.data !== null && (
            <details className="mt-2">
              <summary className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-800">
                View Response Data
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-48">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default ApiEndpointConfig;
