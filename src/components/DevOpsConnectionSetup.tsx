import { useState, useEffect, useCallback } from 'react';
import {
  getPatStatus,
  testPatConnection,
  discoverOrganizationsWithPat,
  discoverProjectsWithPat,
  savePatConnection,
  removePat,
  type PatStatus,
  type DevOpsOrganization,
  type DevOpsProject,
} from '../services/azureDevOpsMcpService';

interface Props {
  onConnectionChange?: () => void;
}

export default function DevOpsConnectionSetup({ onConnectionChange }: Props) {
  const [status, setStatus] = useState<PatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Form state
  const [pat, setPat] = useState('');
  const [selectedOrg, setSelectedOrg] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [connectionName, setConnectionName] = useState('');

  // Dropdown data
  const [organizations, setOrganizations] = useState<DevOpsOrganization[]>([]);
  const [projects, setProjects] = useState<DevOpsProject[]>([]);

  // UI state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [discoveringOrgs, setDiscoveringOrgs] = useState(false);
  const [discoveringProjects, setDiscoveringProjects] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [removing, setRemoving] = useState(false);
  const [showPat, setShowPat] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getPatStatus();
      setStatus(s);
      if (s.configured && s.organizationUrl) setSelectedOrg(s.organizationUrl);
      if (s.configured && s.projectName) setSelectedProject(s.projectName);
      if (s.configured && s.connectionName) setConnectionName(s.connectionName);
    } catch {
      // ignore — not configured
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleTestPat = async () => {
    if (!pat.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testPatConnection(pat.trim());
      setTestResult(result);
      if (result.success) {
        // Auto-discover organizations on successful test
        handleDiscoverOrgs();
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.response?.data?.message || err.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleDiscoverOrgs = async () => {
    const token = pat.trim();
    if (!token) return;
    setDiscoveringOrgs(true);
    try {
      const result = await discoverOrganizationsWithPat(token);
      if (result.success && result.organizations.length > 0) {
        setOrganizations(result.organizations);
        if (!selectedOrg && result.organizations.length === 1) {
          setSelectedOrg(result.organizations[0].url);
          // Auto-discover projects for single org
          handleDiscoverProjects(result.organizations[0].url);
        }
      }
    } catch { /* ignore */ }
    finally { setDiscoveringOrgs(false); }
  };

  const handleDiscoverProjects = async (orgUrl?: string) => {
    const token = pat.trim();
    const org = orgUrl || selectedOrg;
    if (!token || !org) return;
    setDiscoveringProjects(true);
    setProjects([]);
    try {
      const result = await discoverProjectsWithPat(token, org);
      if (result.success) {
        setProjects(result.projects);
        if (!selectedProject && result.projects.length === 1) {
          setSelectedProject(result.projects[0].name);
        }
      }
    } catch { /* ignore */ }
    finally { setDiscoveringProjects(false); }
  };

  const handleSave = async () => {
    if (!selectedOrg || !selectedProject) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const result = await savePatConnection({
        pat: pat.trim() || undefined,
        organizationUrl: selectedOrg,
        projectName: selectedProject,
        connectionName: connectionName.trim() || undefined,
      });
      setSaveResult(result);
      if (result.success) {
        setPat('');
        await loadStatus();
        onConnectionChange?.();
        // Auto-collapse after success
        setTimeout(() => setExpanded(false), 1500);
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err?.response?.data?.message || err.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removePat();
      setStatus(null);
      setPat('');
      setSelectedOrg('');
      setSelectedProject('');
      setConnectionName('');
      setOrganizations([]);
      setProjects([]);
      setTestResult(null);
      setSaveResult(null);
      onConnectionChange?.();
    } catch { /* ignore */ }
    finally { setRemoving(false); }
  };

  const handleOrgChange = (org: string) => {
    setSelectedOrg(org);
    setSelectedProject('');
    setProjects([]);
    if (org) handleDiscoverProjects(org);
  };

  if (loading) return null;

  // Collapsed view — shows connection status + expand button
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] transition-all hover:ring-1 ${
          status?.configured
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:ring-green-300 dark:hover:ring-green-700'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:ring-amber-300 dark:hover:ring-amber-700'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${status?.configured ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
        Azure DevOps {status?.configured ? '✓' : '— Setup'}
        {status?.configured && status.maskedPat && (
          <span className="text-[9px] font-mono opacity-60">{status.maskedPat}</span>
        )}
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 space-y-4 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 8.877zm5.07 1.68l2.248-3.07 8.405-3.416V1.51l7.37 5.393-15.055 2.96v8.225L5.07 10.557z"/></svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Azure DevOps Connection</h3>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              {status?.configured ? `Connected to ${status.projectName}` : 'Enter your Personal Access Token (PAT) to connect'}
            </p>
          </div>
        </div>
        <button onClick={() => { setExpanded(false); setTestResult(null); setSaveResult(null); }}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Current connection info (when configured) */}
      {status?.configured && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-green-700 dark:text-green-400">Connected</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            {status.connectionName && (
              <div><span className="text-gray-500 dark:text-gray-400">Name:</span> <span className="text-gray-800 dark:text-gray-200">{status.connectionName}</span></div>
            )}
            {status.organizationUrl && (
              <div><span className="text-gray-500 dark:text-gray-400">Org:</span> <span className="text-gray-800 dark:text-gray-200">{status.organizationUrl}</span></div>
            )}
            {status.projectName && (
              <div><span className="text-gray-500 dark:text-gray-400">Project:</span> <span className="text-gray-800 dark:text-gray-200">{status.projectName}</span></div>
            )}
            {status.maskedPat && (
              <div><span className="text-gray-500 dark:text-gray-400">PAT:</span> <span className="font-mono text-gray-800 dark:text-gray-200">{status.maskedPat}</span></div>
            )}
            {status.lastSync && (
              <div><span className="text-gray-500 dark:text-gray-400">Last sync:</span> <span className="text-gray-800 dark:text-gray-200">{new Date(status.lastSync).toLocaleString()}</span></div>
            )}
          </div>
        </div>
      )}

      {/* PAT Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Personal Access Token (PAT)
          {status?.configured && <span className="text-gray-400 ml-1">— leave empty to keep current</span>}
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPat ? 'text' : 'password'}
              value={pat}
              onChange={e => { setPat(e.target.value); setTestResult(null); setSaveResult(null); }}
              placeholder={status?.configured ? 'Enter new PAT to update...' : 'Paste your Azure DevOps PAT here...'}
              className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-8"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowPat(!showPat)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={showPat ? 'Hide' : 'Show'}
            >
              {showPat ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768L6.11 6.11M6.11 6.11L3 3m18 18l-3.11-3.11m0 0a9.953 9.953 0 01-4.89 1.11c-4.478 0-8.268-2.943-9.542-7a10.024 10.024 0 014.132-5.411"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              )}
            </button>
          </div>
          <button
            onClick={handleTestPat}
            disabled={!pat.trim() || testing}
            className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1.5"
          >
            {testing ? (
              <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Testing...</>
            ) : 'Test Connection'}
          </button>
        </div>
        {/* Test result */}
        {testResult && (
          <div className={`text-[11px] flex items-center gap-1 ${testResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {testResult.success ? '✓' : '✗'} {testResult.message}
          </div>
        )}
      </div>

      {/* Organization dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Organization</label>
        <div className="flex gap-2">
          <select
            value={selectedOrg}
            onChange={e => handleOrgChange(e.target.value)}
            className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">
              {discoveringOrgs ? 'Discovering organizations...' : organizations.length ? 'Select an organization' : 'Enter PAT & test to discover orgs'}
            </option>
            {organizations.map(org => (
              <option key={org.id || org.name} value={org.url}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleDiscoverOrgs()}
            disabled={!pat.trim() || discoveringOrgs}
            className="px-2.5 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
            title="Refresh organizations"
          >
            {discoveringOrgs ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : '🔄'}
          </button>
        </div>
      </div>

      {/* Project dropdown */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Project</label>
        <div className="flex gap-2">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            disabled={!selectedOrg}
            className="flex-1 px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          >
            <option value="">
              {discoveringProjects ? 'Discovering projects...' : projects.length ? 'Select a project' : selectedOrg ? 'No projects found' : 'Select org first'}
            </option>
            {projects.map(p => (
              <option key={p.id || p.name} value={p.name}>
                {p.name}{p.description ? ` — ${p.description}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleDiscoverProjects()}
            disabled={!selectedOrg || !pat.trim() || discoveringProjects}
            className="px-2.5 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 text-gray-600 dark:text-gray-300"
            title="Refresh projects"
          >
            {discoveringProjects ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : '🔄'}
          </button>
        </div>
      </div>

      {/* Connection Name (optional) */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          Connection Name <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={connectionName}
          onChange={e => setConnectionName(e.target.value)}
          placeholder="e.g. My DevOps Connection"
          className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Save result */}
      {saveResult && (
        <div className={`text-xs p-2 rounded-lg ${saveResult.success ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
          {saveResult.success ? '✓' : '✗'} {saveResult.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {status?.configured && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40"
            >
              {removing ? 'Removing...' : 'Remove Connection'}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setExpanded(false); setTestResult(null); setSaveResult(null); }}
            className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedOrg || !selectedProject || saving || (!pat.trim() && !status?.configured)}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {saving ? (
              <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving...</>
            ) : 'Save Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
