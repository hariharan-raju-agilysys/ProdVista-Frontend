import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  RefreshCw,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  getSectionRules,
  updateSectionRule,
  seedSectionRules,
  type SectionAccessRule,
  type UpdateSectionRuleRequest,
} from '../services/sectionAccessService';
import { useAuth } from '../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'user', label: 'User' },
  { value: 'lead', label: 'Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

const CATEGORY_LABELS: Record<string, string> = {
  hr: 'Human Resources',
  ai: 'AI Features',
  devops: 'DevOps & CI/CD',
  azure: 'Azure & Cloud',
  release: 'Release Management',
  admin: 'Administration',
};

const CATEGORY_ORDER = ['hr', 'ai', 'devops', 'azure', 'release', 'admin'];

function groupByCategory(rules: SectionAccessRule[]): Record<string, SectionAccessRule[]> {
  const grouped: Record<string, SectionAccessRule[]> = {};
  for (const rule of rules) {
    if (!grouped[rule.category]) grouped[rule.category] = [];
    grouped[rule.category].push(rule);
  }
  // Sort within each group by displayOrder
  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.displayOrder - b.displayOrder);
  }
  return grouped;
}

// ── Pending edits type ─────────────────────────────────────────────────────────

type PendingEdit = {
  minimumRoleForView: string;
  minimumRoleForWrite: string;
  isEnabled: boolean;
};

// ── Role selector ─────────────────────────────────────────────────────────────

interface RoleSelectorProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function RoleSelector({ value, onChange, disabled }: RoleSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="
        text-xs rounded-md border border-gray-200 dark:border-gray-700
        bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200
        px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500
        disabled:opacity-50 disabled:cursor-not-allowed
      "
    >
      {ROLE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AccessControlHubPage() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const [rules, setRules] = useState<SectionAccessRule[]>([]);
  const [pending, setPending] = useState<Record<string, PendingEdit>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // ── Load rules ──────────────────────────────────────────────────────────────

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSectionRules();
      setRules(data);
      // Initialize pending edits from current DB values
      const init: Record<string, PendingEdit> = {};
      for (const r of data) {
        init[r.sectionKey] = {
          minimumRoleForView: r.minimumRoleForView,
          minimumRoleForWrite: r.minimumRoleForWrite,
          isEnabled: r.isEnabled,
        };
      }
      setPending(init);
    } catch {
      setError('Failed to load section rules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function updatePending(key: string, patch: Partial<PendingEdit>) {
    setPending((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function isDirty(rule: SectionAccessRule): boolean {
    const p = pending[rule.sectionKey];
    if (!p) return false;
    return (
      p.minimumRoleForView !== rule.minimumRoleForView ||
      p.minimumRoleForWrite !== rule.minimumRoleForWrite ||
      p.isEnabled !== rule.isEnabled
    );
  }

  function resetRule(rule: SectionAccessRule) {
    setPending((prev) => ({
      ...prev,
      [rule.sectionKey]: {
        minimumRoleForView: rule.minimumRoleForView,
        minimumRoleForWrite: rule.minimumRoleForWrite,
        isEnabled: rule.isEnabled,
      },
    }));
  }

  // Managers cannot demote admin-only rules (they cannot lower admin requirements)
  function isFieldLocked(rule: SectionAccessRule, field: 'view' | 'write'): boolean {
    if (isAdmin) return false;
    const currentRequired =
      field === 'view' ? rule.minimumRoleForView : rule.minimumRoleForWrite;
    return currentRequired === 'admin';
  }

  // ── Save single rule ─────────────────────────────────────────────────────────

  async function handleSave(rule: SectionAccessRule) {
    const p = pending[rule.sectionKey];
    if (!p) return;
    const dto: UpdateSectionRuleRequest = {
      minimumRoleForView: p.minimumRoleForView,
      minimumRoleForWrite: p.minimumRoleForWrite,
      isEnabled: p.isEnabled,
    };
    setSaving((prev) => ({ ...prev, [rule.sectionKey]: true }));
    try {
      const updated = await updateSectionRule(rule.sectionKey, dto);
      // Patch local rules array so isDirty is re-evaluated against new DB state
      setRules((prev) =>
        prev.map((r) => (r.sectionKey === updated.sectionKey ? updated : r)),
      );
      setSaved((prev) => ({ ...prev, [rule.sectionKey]: true }));
      setTimeout(() => {
        setSaved((prev) => ({ ...prev, [rule.sectionKey]: false }));
      }, 2000);
    } catch {
      setError(`Failed to save "${rule.sectionLabel}". Please try again.`);
    } finally {
      setSaving((prev) => ({ ...prev, [rule.sectionKey]: false }));
    }
  }

  // ── Seed defaults ─────────────────────────────────────────────────────────────

  async function handleSeed() {
    setIsSeeding(true);
    try {
      await seedSectionRules();
      await loadRules();
    } catch {
      setError('Failed to reset to defaults.');
    } finally {
      setIsSeeding(false);
    }
  }

  // ── Toggle category ───────────────────────────────────────────────────────────

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const grouped = groupByCategory(rules);
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
              <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Access Control Hub
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Configure which roles can view or write to each section of the application.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadRules}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {isAdmin && (
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                title="Reset all rules to system defaults"
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 transition-colors"
              >
                {isSeeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Reset Defaults
              </button>
            )}
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 p-4 mb-6 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Changes take effect immediately for new requests. The hierarchy is:
            <strong className="font-semibold"> Viewer → User → Lead → Manager → Admin</strong>.
            Higher roles always include access of lower roles.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-4 mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700 dark:hover:text-red-200 text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Categories */}
        {!isLoading && (
          <div className="space-y-4">
            {orderedCategories.map((category) => {
              const catRules = grouped[category] ?? [];
              const isCollapsed = collapsedCategories[category];
              const label = CATEGORY_LABELS[category] ?? category;
              const dirtyCount = catRules.filter(isDirty).length;

              return (
                <div
                  key={category}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
                >
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {label}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        ({catRules.length} section{catRules.length !== 1 ? 's' : ''})
                      </span>
                      {dirtyCount > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          {dirtyCount} unsaved
                        </span>
                      )}
                    </div>
                    {isCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-gray-400" />
                    )}
                  </button>

                  {/* Rules list */}
                  {!isCollapsed && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {catRules.map((rule) => {
                        const p = pending[rule.sectionKey];
                        const dirty = isDirty(rule);
                        const isSaving = saving[rule.sectionKey];
                        const wasSaved = saved[rule.sectionKey];
                        const viewLocked = isFieldLocked(rule, 'view');
                        const writeLocked = isFieldLocked(rule, 'write');

                        return (
                          <div
                            key={rule.sectionKey}
                            className={`px-5 py-4 ${
                              dirty
                                ? 'bg-amber-50/40 dark:bg-amber-900/10'
                                : ''
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              {/* Label + description */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                                    {rule.sectionLabel}
                                  </span>
                                  <code className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-mono">
                                    {rule.sectionKey}
                                  </code>
                                </div>
                                {rule.description && (
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                    {rule.description}
                                  </p>
                                )}
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-3 flex-wrap">
                                {/* View role */}
                                <div className="flex items-center gap-1.5">
                                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-400">View:</span>
                                  <RoleSelector
                                    value={p?.minimumRoleForView ?? rule.minimumRoleForView}
                                    onChange={(v) =>
                                      updatePending(rule.sectionKey, { minimumRoleForView: v })
                                    }
                                    disabled={viewLocked || !p?.isEnabled}
                                  />
                                </div>

                                {/* Write role */}
                                <div className="flex items-center gap-1.5">
                                  <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="text-xs text-gray-400">Write:</span>
                                  <RoleSelector
                                    value={p?.minimumRoleForWrite ?? rule.minimumRoleForWrite}
                                    onChange={(v) =>
                                      updatePending(rule.sectionKey, { minimumRoleForWrite: v })
                                    }
                                    disabled={writeLocked || !p?.isEnabled}
                                  />
                                </div>

                                {/* Enabled toggle */}
                                <button
                                  onClick={() =>
                                    updatePending(rule.sectionKey, {
                                      isEnabled: !(p?.isEnabled ?? rule.isEnabled),
                                    })
                                  }
                                  title={p?.isEnabled ? 'Disable section' : 'Enable section'}
                                  className="flex items-center gap-1 text-xs"
                                >
                                  {p?.isEnabled ? (
                                    <ToggleRight className="w-5 h-5 text-emerald-500" />
                                  ) : (
                                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                                  )}
                                  <span
                                    className={
                                      p?.isEnabled
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-gray-400'
                                    }
                                  >
                                    {p?.isEnabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                </button>

                                {/* Save / Reset buttons */}
                                {dirty && (
                                  <>
                                    <button
                                      onClick={() => resetRule(rule)}
                                      disabled={isSaving}
                                      title="Discard changes"
                                      className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleSave(rule)}
                                      disabled={isSaving}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
                                    >
                                      {isSaving ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Save className="w-3 h-3" />
                                      )}
                                      Save
                                    </button>
                                  </>
                                )}

                                {/* Saved checkmark */}
                                {wasSaved && !dirty && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                )}

                                {/* Locked indicator */}
                                {(viewLocked || writeLocked) && !isAdmin && (
                                  <span className="text-xs text-gray-400 italic">
                                    (admin-only)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && rules.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No section rules found.</p>
            {isAdmin && (
              <button
                onClick={handleSeed}
                className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 underline"
              >
                Seed default rules
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
