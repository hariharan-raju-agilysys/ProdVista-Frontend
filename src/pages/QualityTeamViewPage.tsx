import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactECharts from 'echarts-for-react';
import {
  getConnections, getKpiSummary, getBugs, getOwnerEfficiency, getTrend,
  getAgingDistribution, getCustomerIssues, getUserBugAnalysis, getTeamSummary,
  QualityConnection, KpiSummary, QualityWorkItemDto, QualityTrendPointDto,
  BugAgingDistributionDto, CustomerIssueGroupDto, OwnerEfficiencyDto,
  UserBugAnalysis, TeamSummaryResponse,
  getSeverityColor, getStateColor
} from '../services/qualityService';
import {
  getDepartments, getEmployees,
  HrDepartment, HrEmployee
} from '../services/hrPortalService';
import {
  Bug, Shield, Clock, AlertTriangle, TrendingUp, TrendingDown, Users, Activity,
  BarChart3, Target, RefreshCw, Flame, Zap, ExternalLink,
  ChevronDown, ChevronRight, Award, Layers, Filter, UserCheck
} from 'lucide-react';

// ============================================================================
// Quality Team View — Executive Dashboard (Big, Bold, Clear)
// ============================================================================
export default function QualityTeamViewPage() {
  const { } = useAuth();

  // State
  const [connections, setConnections] = useState<QualityConnection[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>();
  const [kpi, setKpi] = useState<KpiSummary | null>(null);
  const [allBugs, setAllBugs] = useState<QualityWorkItemDto[]>([]);
  const [efficiency, setEfficiency] = useState<OwnerEfficiencyDto[]>([]);
  const [trend, setTrend] = useState<QualityTrendPointDto[]>([]);
  const [aging, setAging] = useState<BugAgingDistributionDto[]>([]);
  const [customerIssues, setCustomerIssues] = useState<CustomerIssueGroupDto[]>([]);
  const [, setTeamSummary] = useState<TeamSummaryResponse | null>(null);
  const [userAnalysis, setUserAnalysis] = useState<UserBugAnalysis[]>([]);

  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  // ── NEW: Employee Hierarchy Filtering ───────────────────────────────────
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [selectedDepartmentCode, setSelectedDepartmentCode] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<HrEmployee[]>([]);
  const [showHierarchyFilter, setShowHierarchyFilter] = useState(false);

  // Load connections
  useEffect(() => {
    (async () => {
      try {
        const conns = await getConnections();
        setConnections(conns);
        if (conns.length > 0) setSelectedConnectionId(conns[0].id);
      } catch { /* skip */ }
    })();
  }, []);

  // ── NEW: Load departments for hierarchy filtering ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const depts = await getDepartments();
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    })();
  }, []);

  // ── NEW: Load team members when department selected ─────────────────────
  useEffect(() => {
    if (!selectedDepartmentCode) {
      setTeamMembers([]);
      return;
    }
    (async () => {
      try {
        const result = await getEmployees({ departmentCode: selectedDepartmentCode, status: 'Active' });
        setTeamMembers(result.employees || []);
      } catch (err) {
        console.error('Failed to load team members:', err);
        setTeamMembers([]);
      }
    })();
  }, [selectedDepartmentCode]);

  // Load all dashboard data (with hierarchy filtering)
  const loadAll = useCallback(async () => {
    if (!selectedConnectionId) return;
    setLoading(true);
    try {
      // Build email filter from selected team members
      const emailsParam = teamMembers.length > 0
        ? (teamMembers.map(m => m.email).filter(Boolean) as string[])
        : undefined;

      const [kpiData, bugsData, effData, trendData, agingData, custData, teamData, userData] = await Promise.all([
        getKpiSummary(selectedConnectionId).catch(() => null),
        getBugs({ state: 'Active' }, selectedConnectionId).catch(() => []),
        getOwnerEfficiency(selectedConnectionId, undefined, emailsParam).catch(() => []),
        getTrend(90, selectedConnectionId).catch(() => []),
        getAgingDistribution(selectedConnectionId).catch(() => []),
        getCustomerIssues().catch(() => []),
        getTeamSummary({ connectionId: selectedConnectionId }).catch(() => null),
        getUserBugAnalysis({ connectionId: selectedConnectionId }).catch(() => ({ users: [] })),
      ]);
      if (kpiData) setKpi(kpiData);
      setAllBugs(bugsData);
      setEfficiency(effData);
      setTrend(trendData);
      setAging(agingData);
      setCustomerIssues(custData);
      if (teamData) setTeamSummary(teamData);
      setUserAnalysis(userData.users || []);
    } catch { /* skip */ }
    setLoading(false);
  }, [selectedConnectionId, teamMembers]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived
  const criticalBugs = useMemo(() => allBugs.filter(b => b.severity === '1 - Critical'), [allBugs]);
  const staleBugs = useMemo(() => allBugs.filter(b => b.ageDays > 14), [allBugs]);

  // Health score
  const healthScore = useMemo(() => {
    if (!kpi) return 0;
    let score = 100;
    score -= criticalBugs.length * 15;
    score -= staleBugs.length * 3;
    if (kpi.mttr > 7) score -= (kpi.mttr - 7) * 2;
    if (kpi.weeklyCreated > kpi.weeklyResolved) score -= 10;
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [kpi, criticalBugs, staleBugs]);

  const healthColor = healthScore >= 80 ? 'emerald' : healthScore >= 50 ? 'amber' : 'red';
  const healthLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 50 ? 'Needs Attention' : 'Critical';

  if (loading && !kpi) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100 dark:border-blue-900" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
          </div>
          <p className="text-xl font-semibold text-slate-600 dark:text-slate-300">Loading Team Dashboard...</p>
          <p className="text-sm text-slate-400">Fetching data from Azure DevOps</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
      {/* ================================================================
          HEADER — Gradient banner with title + controls
          ================================================================ */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
        <div className="relative max-w-[1800px] mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-white tracking-tight">
                    Quality Command Center
                  </h1>
                  <p className="text-lg text-white/70 font-medium mt-1">
                    Full Team View — All Bugs & Analytics
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {connections.length > 1 && (
                <select
                  value={selectedConnectionId || ''}
                  onChange={e => setSelectedConnectionId(e.target.value)}
                  className="text-sm border-0 rounded-xl px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white font-medium focus:ring-2 focus:ring-white/30 [&>option]:text-gray-900"
                >
                  {connections.map(c => <option key={c.id} value={c.id}>{c.connectionName || c.projectName}</option>)}
                </select>
              )}
              <button
                onClick={() => setShowHierarchyFilter(!showHierarchyFilter)}
                className={`flex items-center gap-2 px-5 py-2.5 backdrop-blur-sm text-white font-semibold rounded-xl transition-all shadow-lg ${
                  showHierarchyFilter ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                <Filter className="w-4 h-4" />
                {selectedDepartmentCode ? `Dept: ${selectedDepartmentCode}` : 'Filter by Team'}
                {selectedDepartmentCode && <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">{teamMembers.length}</span>}
              </button>
              <button
                onClick={loadAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/20 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/30 transition-all shadow-lg"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-8 -mt-4 pb-12 space-y-8">
        {/* ================================================================
            EMPLOYEE HIERARCHY FILTER PANEL (collapsible)
            ================================================================ */}
        {showHierarchyFilter && (
          <section className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <Filter className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">Filter by Employee Hierarchy</h3>
                <p className="text-sm text-indigo-600 dark:text-indigo-300">Filter bugs and analytics by department/team structure</p>
              </div>
              <button
                onClick={() => {
                  setSelectedDepartmentCode('');
                  setTeamMembers([]);
                  setShowHierarchyFilter(false);
                }}
                className="px-4 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium border border-gray-200 dark:border-gray-700"
              >
                Clear Filter
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Department</label>
                <select
                  value={selectedDepartmentCode}
                  onChange={(e) => setSelectedDepartmentCode(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                >
                  <option value="">All Departments</option>
                  {departments.map(d => (
                    <option key={d.departmentCode} value={d.departmentCode}>
                      {d.departmentCode}: {d.departmentName} ({d.actualCount} members)
                    </option>
                  ))}
                </select>
              </div>
              {selectedDepartmentCode && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Team Members ({teamMembers.length})
                  </label>
                  <div className="bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl p-4 max-h-32 overflow-y-auto">
                    {teamMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {teamMembers.slice(0, 10).map(m => (
                          <span key={m.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium border border-indigo-200 dark:border-indigo-700">
                            <UserCheck className="w-3.5 h-3.5" />
                            {m.name.split(' ').slice(0, 2).join(' ')}
                          </span>
                        ))}
                        {teamMembers.length > 10 && (
                          <span className="text-sm text-gray-500">+{teamMembers.length - 10} more</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No active team members found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================================================================
            HERO KPI CARDS — Massive gradient cards
            ================================================================ */}
        {kpi && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <HeroCard
              label="Active Bugs"
              value={kpi.activeBugs}
              sub={`${criticalBugs.length} critical · ${staleBugs.length} stale (14d+)`}
              gradient="from-red-500 to-rose-600"
              icon={<Bug className="w-10 h-10" />}
              pulse={criticalBugs.length > 0}
            />
            <HeroCard
              label="Resolution Rate"
              value={`${kpi.resolutionRate.toFixed(0)}%`}
              sub={`${kpi.resolvedBugs} of ${kpi.totalBugs} total bugs resolved`}
              gradient="from-emerald-500 to-green-600"
              icon={<Shield className="w-10 h-10" />}
            />
            <HeroCard
              label="Mean Time to Resolve"
              value={`${kpi.mttr.toFixed(1)}d`}
              sub={kpi.mttr <= 7 ? 'Excellent response time' : kpi.mttr <= 14 ? 'Moderate — room to improve' : 'Slow — needs attention'}
              gradient="from-amber-500 to-orange-600"
              icon={<Clock className="w-10 h-10" />}
            />
            <HeroCard
              label="Quality Health"
              value={healthScore}
              sub={healthLabel}
              gradient={healthColor === 'emerald' ? 'from-emerald-500 to-teal-600' : healthColor === 'amber' ? 'from-amber-500 to-yellow-600' : 'from-red-500 to-pink-600'}
              icon={<Target className="w-10 h-10" />}
              suffix="/100"
            />
          </section>
        )}

        {/* ================================================================
            SECONDARY METRICS ROW — Compact but bold
            ================================================================ */}
        {kpi && (
          <section className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <MetricTile label="Total Items" value={kpi.totalWorkItems} icon={<BarChart3 className="w-5 h-5" />} color="text-blue-600 dark:text-blue-400" />
            <MetricTile label="Total Bugs" value={kpi.totalBugs} icon={<Bug className="w-5 h-5" />} color="text-red-600 dark:text-red-400" />
            <MetricTile label="Features" value={kpi.features} icon={<Layers className="w-5 h-5" />} color="text-purple-600 dark:text-purple-400" />
            <MetricTile label="User Stories" value={kpi.userStories} icon={<Target className="w-5 h-5" />} color="text-indigo-600 dark:text-indigo-400" />
            <MetricTile label="Tasks" value={kpi.tasks} icon={<Activity className="w-5 h-5" />} color="text-cyan-600 dark:text-cyan-400" />
            <MetricTile
              label="Weekly Velocity"
              value={`+${kpi.weeklyCreated}/-${kpi.weeklyResolved}`}
              icon={kpi.weeklyResolved >= kpi.weeklyCreated ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
              color={kpi.weeklyResolved >= kpi.weeklyCreated ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}
            />
          </section>
        )}

        {/* ================================================================
            CRITICAL ALERT BANNER
            ================================================================ */}
        {criticalBugs.length > 0 && (
          <section className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/40 dark:to-orange-950/40 border-2 border-red-200 dark:border-red-800 rounded-2xl p-8">
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 w-20 h-20 bg-red-500 rounded-2xl flex items-center justify-center shadow-xl shadow-red-200 dark:shadow-red-900/50">
                <Flame className="w-10 h-10 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-extrabold text-red-800 dark:text-red-200">
                  {criticalBugs.length} Critical Bug{criticalBugs.length > 1 ? 's' : ''} — Immediate Action Required
                </h2>
                <p className="text-lg text-red-600 dark:text-red-300 mt-2">
                  Oldest: <span className="font-bold">{Math.max(...criticalBugs.map(b => b.ageDays))} days</span>
                  {' · '}Avg age: <span className="font-bold">{Math.round(criticalBugs.reduce((s, b) => s + b.ageDays, 0) / criticalBugs.length)} days</span>
                  {' · '}Customer-reported: <span className="font-bold">{criticalBugs.filter(b => b.customer).length}</span>
                </p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
              {criticalBugs.slice(0, 6).map(bug => (
                <a key={bug.id} href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-xl px-5 py-4 border border-red-200 dark:border-red-800 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
                  <span className="text-lg font-mono font-bold text-red-600">#{bug.id}</span>
                  <span className="text-base text-gray-800 dark:text-gray-200 font-medium truncate flex-1">{bug.title}</span>
                  <span className="text-sm font-bold text-red-500">{bug.ageDays}d</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* ================================================================
            SEVERITY BREAKDOWN — Large horizontal bars
            ================================================================ */}
        {kpi && Object.keys(kpi.bySeverity).length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Zap className="w-7 h-7 text-red-500" />
                Severity Breakdown
              </h2>
            </div>
            <div className="px-8 py-6 space-y-5">
              {Object.entries(kpi.bySeverity).sort().map(([sev, count]) => {
                const total = Object.values(kpi.bySeverity).reduce((s, v) => s + v, 0);
                const pct = total > 0 ? (count / total) * 100 : 0;
                const barColor = sev.includes('Critical') ? 'bg-red-500' : sev.includes('High') ? 'bg-orange-500' : sev.includes('Medium') ? 'bg-yellow-400' : 'bg-green-400';
                return (
                  <div key={sev} className="flex items-center gap-6">
                    <span className={`text-base font-semibold px-4 py-2 rounded-xl w-40 text-center ${getSeverityColor(sev)}`}>{sev}</span>
                    <div className="flex-1 h-8 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-200 w-16 text-right">{count}</span>
                    <span className="text-base text-gray-400 w-16">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ================================================================
            CHARTS ROW — Trend + Aging
            ================================================================ */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Bug Trend */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <TrendingUp className="w-7 h-7 text-purple-500" />
                Bug Trend (90 Days)
              </h2>
            </div>
            <div className="p-6">
              {trend.length > 0 ? (
                <>
                  <div className="flex items-center gap-8 mb-4 px-2">
                    <TrendStat label="Opened" value={trend.reduce((s, d) => s + d.opened, 0)} color="text-red-600" dot="bg-red-500" />
                    <TrendStat label="Closed" value={trend.reduce((s, d) => s + d.closed, 0)} color="text-green-600" dot="bg-green-500" />
                    <TrendStat
                      label="Net"
                      value={trend.reduce((s, d) => s + d.opened, 0) - trend.reduce((s, d) => s + d.closed, 0)}
                      color={trend.reduce((s, d) => s + d.opened, 0) <= trend.reduce((s, d) => s + d.closed, 0) ? 'text-green-600' : 'text-red-600'}
                      dot={trend.reduce((s, d) => s + d.opened, 0) <= trend.reduce((s, d) => s + d.closed, 0) ? 'bg-green-500' : 'bg-red-500'}
                      prefix={trend.reduce((s, d) => s + d.opened, 0) - trend.reduce((s, d) => s + d.closed, 0) > 0 ? '+' : ''}
                    />
                  </div>
                  <BugTrendChart data={trend} />
                </>
              ) : <EmptyState text="No trend data available" />}
            </div>
          </div>

          {/* Aging Distribution */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Clock className="w-7 h-7 text-orange-500" />
                Bug Aging Distribution
              </h2>
            </div>
            <div className="p-6">
              {aging.length > 0 ? <AgingChart data={aging} /> : <EmptyState text="No aging data available" />}
            </div>
          </div>
        </section>

        {/* ================================================================
            RESOLVER QUALITY ANALYTICS — Who resolves bugs that get reopened
            ================================================================ */}
        {efficiency.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Shield className="w-7 h-7 text-emerald-500" />
                Resolver Quality Analytics
                <span className="text-lg font-normal text-gray-400 ml-2">
                  — Track bugs resolved by each team member that got reopened
                </span>
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {efficiency
                  .filter(e => e.totalResolvedByUser > 0)
                  .sort((a, b) => a.resolutionQuality - b.resolutionQuality)
                  .map(member => {
                    const displayName = member.ownerName.split(' <')[0];
                    const qualityColor = member.resolutionQuality >= 90 ? 'emerald' : member.resolutionQuality >= 70 ? 'amber' : 'red';
                    const avatarColors = ['bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-teal-500', 'bg-rose-500', 'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500'];
                    const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length];
                    return (
                      <div
                        key={member.ownerName}
                        className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg transition-all p-6"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`w-14 h-14 rounded-2xl ${avatarColor} text-white flex items-center justify-center text-xl font-bold shadow-lg`}>
                            {displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{displayName}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {member.totalResolvedByUser} resolved · {member.reopenedCount} reopened
                            </p>
                          </div>
                        </div>
                        
                        {/* Quality Score */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Resolution Quality</span>
                            <span className={`text-3xl font-extrabold ${qualityColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : qualityColor === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                              {member.resolutionQuality.toFixed(0)}%
                            </span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${qualityColor === 'emerald' ? 'bg-emerald-500' : qualityColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${Math.min(100, member.resolutionQuality)}%` }}
                            />
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{member.totalResolvedByUser}</span>
                            <span className="text-[10px] text-gray-400 block mt-1 font-bold uppercase">Resolved</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <span className="text-2xl font-black text-red-600 dark:text-red-400">{member.reopenedCount}</span>
                            <span className="text-[10px] text-gray-400 block mt-1 font-bold uppercase">Reopened</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{member.reopenRate.toFixed(1)}%</span>
                            <span className="text-[10px] text-gray-400 block mt-1 font-bold uppercase">Reopen Rate</span>
                          </div>
                          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                            <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{member.avgResolutionDays.toFixed(1)}d</span>
                            <span className="text-[10px] text-gray-400 block mt-1 font-bold uppercase">Avg Time</span>
                          </div>
                        </div>

                        {/* Quality Label */}
                        <div className="mt-4 text-center">
                          <span className={`inline-block px-4 py-2 rounded-lg text-sm font-bold ${
                            member.resolutionQuality >= 90 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' :
                            member.resolutionQuality >= 70 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' :
                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                          }`}>
                            {member.resolutionQuality >= 90 ? '\u2728 Excellent' : member.resolutionQuality >= 70 ? '\u26A0\uFE0F Needs Improvement' : '\u{1F198} Critical'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            ACTIVE BUGS BY TEAM MEMBER — Show who has which bugs still open
            ================================================================ */}
        {efficiency.length > 0 && (
          <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <AlertTriangle className="w-7 h-7 text-orange-500" />
                Active Bugs by Team Member
                <span className="text-lg font-normal text-gray-400 ml-2">
                  — Current bug ownership and aging
                </span>
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {efficiency
                  .filter(e => e.active > 0)
                  .sort((a, b) => b.active - a.active)
                  .map(member => {
                    const displayName = member.ownerName.split(' <')[0];
                    const criticalCount = member.workItems?.filter(w => w.severity === '1 - Critical' && (w.state === 'Active' || w.state === 'New')).length || 0;
                    const staleCount = member.workItems?.filter(w => w.ageDays > 14 && (w.state === 'Active' || w.state === 'New')).length || 0;
                    const avatarColors = ['bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-teal-500', 'bg-rose-500', 'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500'];
                    const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length];
                    return (
                      <div
                        key={member.ownerName}
                        className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg transition-all p-6"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className={`w-12 h-12 rounded-xl ${avatarColor} text-white flex items-center justify-center text-lg font-bold shadow-lg`}>
                            {displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm font-bold text-gray-500">{member.active} active bugs</span>
                              {criticalCount > 0 && <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full font-bold">{criticalCount} critical</span>}
                              {staleCount > 0 && <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full font-bold">{staleCount} stale (14d+)</span>}
                            </div>
                          </div>
                          <div className="text-4xl font-black text-gray-800 dark:text-gray-200">{member.active}</div>
                        </div>

                        {/* Recent Active Bugs */}
                        {member.workItems && member.workItems.length > 0 && (
                          <div className="space-y-2">
                            {member.workItems
                              .filter(bug => bug.state === 'Active' || bug.state === 'New')
                              .slice(0, 5)
                              .map(bug => (
                                <a key={bug.id} href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group border-l-4 ${
                                    bug.severity === '1 - Critical' ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20' :
                                    bug.severity?.includes('High') ? 'border-orange-400 bg-orange-50/20 dark:bg-orange-950/10' :
                                    bug.ageDays > 14 ? 'border-yellow-400' :
                                    'border-transparent'
                                  }`}>
                                  <span className="text-sm font-mono font-bold text-blue-600">#{bug.id}</span>
                                  {bug.severity && <span className={`text-xs px-2 py-0.5 rounded-lg font-bold ${getSeverityColor(bug.severity)}`}>{bug.severity.split(' - ')[1]}</span>}
                                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">{bug.title}</span>
                                  <span className={`text-xs font-bold font-mono ${bug.ageDays > 14 ? 'text-red-600' : bug.ageDays > 7 ? 'text-amber-600' : 'text-gray-400'}`}>{bug.ageDays}d</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                </a>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        )}

        {/* ================================================================
            FULL TEAM ROSTER — Big bold member cards
            ================================================================ */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Users className="w-7 h-7 text-indigo-500" />
              Team Members
              <span className="text-lg font-normal text-gray-400 ml-2">({efficiency.length} members)</span>
            </h2>
          </div>
          <div className="p-6">
            {efficiency.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {efficiency.sort((a, b) => b.totalAssigned - a.totalAssigned).map(member => {
                  const displayName = member.ownerName.split(' <')[0];
                  const isExpanded = expandedMember === member.ownerName;
                  const userDetail = userAnalysis.find(u => u.userName === member.ownerName || u.userName.includes(displayName));
                  const effColor = member.efficiencyScore >= 70 ? 'emerald' : member.efficiencyScore >= 40 ? 'amber' : 'red';
                  const avatarColors = ['bg-indigo-500', 'bg-purple-500', 'bg-blue-500', 'bg-teal-500', 'bg-rose-500', 'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500'];
                  const avatarColor = avatarColors[displayName.charCodeAt(0) % avatarColors.length];
                  return (
                    <div
                      key={member.ownerName}
                      className={`rounded-2xl border-2 transition-all duration-200 ${
                        isExpanded
                          ? 'border-indigo-300 dark:border-indigo-700 shadow-xl bg-indigo-50/30 dark:bg-indigo-950/20'
                          : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-lg bg-white dark:bg-gray-900'
                      }`}
                    >
                      {/* Member Header */}
                      <button
                        onClick={() => setExpandedMember(isExpanded ? null : member.ownerName)}
                        className="w-full px-6 py-5 flex items-center gap-4 text-left"
                      >
                        <div className={`w-14 h-14 rounded-2xl ${avatarColor} text-white flex items-center justify-center text-xl font-bold shadow-lg flex-shrink-0`}>
                          {displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white truncate">{displayName}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {member.totalAssigned} items · {member.resolved} resolved · {member.active} active
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`text-3xl font-extrabold ${effColor === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : effColor === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                            {member.efficiencyScore.toFixed(0)}%
                          </span>
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Efficiency</span>
                        </div>
                        {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Efficiency Bar */}
                      <div className="px-6 pb-4">
                        <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${effColor === 'emerald' ? 'bg-emerald-500' : effColor === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, member.efficiencyScore)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                          <span>Avg resolution: {member.avgResolutionDays.toFixed(1)}d</span>
                          <span>Reopen rate: {(member.reopenRate * 100).toFixed(0)}%</span>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                          {/* Stats Grid */}
                          <div className="grid grid-cols-4 gap-3">
                            <MiniCard label="Total" value={member.totalAssigned} color="text-blue-600" />
                            <MiniCard label="Active" value={member.active} color="text-amber-600" />
                            <MiniCard label="Resolved" value={member.resolved} color="text-emerald-600" />
                            <MiniCard label="Avg Days" value={`${member.avgResolutionDays.toFixed(1)}d`} color="text-purple-600" />
                          </div>

                          {/* Extra stats from user analysis */}
                          {userDetail && (
                            <>
                              <div className="grid grid-cols-4 gap-3">
                                <MiniCard label="Critical" value={userDetail.criticalBugs} color="text-red-600" />
                                <MiniCard label="High" value={userDetail.highBugs} color="text-orange-600" />
                                <MiniCard label="Features" value={userDetail.features} color="text-purple-600" />
                                <MiniCard label="Tasks" value={userDetail.tasks} color="text-cyan-600" />
                              </div>

                              {/* Top Areas */}
                              {userDetail.topAreas.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Active Areas</h4>
                                  <div className="flex flex-wrap gap-2">
                                    {userDetail.topAreas.slice(0, 5).map(a => (
                                      <span key={a.area} className="text-sm px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg font-medium border border-indigo-200 dark:border-indigo-800">
                                        {a.area} ({a.count})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Recent Bugs */}
                              {userDetail.recentBugs.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Recent Work Items</h4>
                                  <div className="space-y-1.5">
                                    {userDetail.recentBugs.slice(0, 5).map(bug => (
                                      <a key={bug.id} href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group border-l-4 ${
                                          bug.severity === '1 - Critical' ? 'border-red-500 bg-red-50/30 dark:bg-red-950/10' :
                                          bug.severity?.includes('High') ? 'border-orange-400' :
                                          'border-transparent'
                                        }`}>
                                        <span className="text-sm font-mono font-bold text-blue-600">#{bug.id}</span>
                                        <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${getStateColor(bug.state)}`}>{bug.state}</span>
                                        {bug.severity && <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${getSeverityColor(bug.severity)}`}>{bug.severity.split(' - ')[1]}</span>}
                                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">{bug.title}</span>
                                        <span className={`text-xs font-bold font-mono ${bug.ageDays > 14 ? 'text-red-600' : bug.ageDays > 7 ? 'text-amber-600' : 'text-gray-400'}`}>{bug.ageDays}d</span>
                                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No team efficiency data available" />
            )}
          </div>
        </section>

        {/* ================================================================
            AREA HOTSPOTS + CUSTOMER IMPACT — Side by side
            ================================================================ */}
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Area Hotspots */}
          {kpi && kpi.topAreas.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Layers className="w-7 h-7 text-pink-500" />
                  Bug Hotspot Areas
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {kpi.topAreas.map((area, i) => (
                  <div key={area.area} className="flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <span className="text-2xl font-extrabold text-gray-300 dark:text-gray-700 w-8 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 block truncate">{area.area}</span>
                      <span className="text-sm text-gray-500">
                        {area.active} active · {area.critical > 0 ? <span className="text-red-600 font-bold">{area.critical} critical</span> : `${area.total} total`}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-3xl font-extrabold text-gray-800 dark:text-gray-200">{area.total}</span>
                        <span className="text-sm text-gray-400 block">{area.avgAge.toFixed(0)}d avg</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Impact */}
          {customerIssues.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <Award className="w-7 h-7 text-blue-500" />
                  Customer Impact
                </h2>
              </div>
              <div className="p-6 space-y-3">
                {customerIssues.slice(0, 8).map(ci => (
                  <div key={ci.customerName} className="flex items-center gap-4 px-4 py-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center text-lg font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                      {ci.customerName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-lg font-semibold text-gray-800 dark:text-gray-200 block truncate">{ci.customerName}</span>
                      <span className="text-sm text-gray-500">
                        {ci.activeIssues} active · {ci.criticalIssues > 0 ? <span className="text-red-600 font-bold">{ci.criticalIssues} critical</span> : `${ci.resolvedIssues} resolved`}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-3xl font-extrabold text-gray-800 dark:text-gray-200">{ci.totalIssues}</span>
                      <span className="text-sm text-gray-400 block">{ci.avgResolutionDays.toFixed(0)}d avg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ================================================================
            ALL ACTIVE BUGS TABLE — Full sortable list
            ================================================================ */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
              All Active Bugs
              <span className="text-lg font-normal text-gray-400 ml-2">({allBugs.length})</span>
            </h2>
          </div>
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm z-10">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Severity</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">State</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Age</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Area</th>
                  <th className="px-4 py-4 text-sm font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {allBugs.slice(0, 100).map(bug => (
                  <tr key={bug.id} className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors border-l-4 ${
                    bug.severity === '1 - Critical' ? 'bg-red-50/60 dark:bg-red-950/30 border-red-500' :
                    bug.severity?.includes('High') ? 'bg-orange-50/30 dark:bg-orange-950/10 border-orange-400' :
                    bug.severity?.includes('Medium') ? 'border-yellow-300' :
                    'border-transparent'
                  }`}>
                    <td className="px-6 py-3.5">
                      <a href={bug.devOpsUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-base font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline">
                        {bug.id} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </td>
                    <td className="px-4 py-3.5 text-base text-gray-900 dark:text-gray-100 max-w-[320px] truncate font-semibold" title={bug.title}>{bug.title}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${getSeverityColor(bug.severity)}`}>
                        {bug.severity || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${getStateColor(bug.state)}`}>
                        {bug.state}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-base font-mono font-bold ${bug.ageDays > 14 ? 'text-red-600' : bug.ageDays > 7 ? 'text-amber-600' : 'text-gray-600 dark:text-gray-400'}`}>
                        {bug.ageDays}d
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-base text-gray-700 dark:text-gray-300 max-w-[160px] truncate" title={bug.assignedTo || ''}>
                      {bug.assignedTo ? bug.assignedTo.split(' <')[0] : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-500 max-w-[120px] truncate" title={bug.areaPath || ''}>
                      {bug.areaPath?.split('\\').pop() || '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {bug.customer ? (
                        <span className="inline-flex items-center gap-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-lg font-medium">
                          <Users className="w-3.5 h-3.5" /> {bug.customer}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allBugs.length > 100 && (
              <div className="text-center py-4 text-base text-gray-400 border-t border-gray-100 dark:border-gray-800">
                Showing 100 of {allBugs.length} active bugs
              </div>
            )}
            {allBugs.length === 0 && (
              <div className="py-16 text-center text-gray-400 text-lg">No active bugs — excellent work!</div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

// ============================================================================
// Hero KPI Card — Massive gradient card
// ============================================================================
function HeroCard({ label, value, sub, gradient, icon, pulse, suffix }: {
  label: string; value: string | number; sub: string;
  gradient: string; icon: React.ReactNode;
  pulse?: boolean; suffix?: string;
}) {
  return (
    <div className={`relative rounded-2xl bg-gradient-to-br ${gradient} text-white p-8 shadow-xl overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300`}>
      {/* Background pattern */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-black text-white/70 uppercase tracking-widest">{label}</span>
          <div className="text-white/50 bg-white/10 rounded-xl p-2">{icon}</div>
        </div>
        <div className={`flex items-baseline gap-2 ${pulse ? 'animate-pulse' : ''}`}>
          <span className="text-6xl font-black leading-none">{value}</span>
          {suffix && <span className="text-2xl font-bold text-white/60">{suffix}</span>}
        </div>
        <p className="text-sm text-white/80 mt-3 font-semibold">{sub}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Metric Tile — Secondary stats
// ============================================================================
function MetricTile({ label, value, icon, color }: {
  label: string; value: string | number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-current to-transparent opacity-30" style={{ color: 'currentColor' }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{label}</span>
        <span className={`${color} bg-gray-50 dark:bg-gray-800 rounded-lg p-1.5`}>{icon}</span>
      </div>
      <span className={`text-4xl font-black text-gray-900 dark:text-white`}>{typeof value === 'number' ? value.toLocaleString() : value}</span>
    </div>
  );
}

// ============================================================================
// Mini Card — For expanded member detail
// ============================================================================
function MiniCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 text-center border border-gray-100 dark:border-gray-700 shadow-sm">
      <span className={`text-2xl font-black ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-400 block mt-1 font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ============================================================================
// Trend Stat — Summary numbers above chart
// ============================================================================
function TrendStat({ label, value, color, dot, prefix }: {
  label: string; value: number; color: string; dot: string; prefix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${dot}`} />
      <span className="text-sm text-gray-500 font-medium">{label}:</span>
      <span className={`text-lg font-extrabold ${color}`}>{prefix}{value}</span>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================
function EmptyState({ text }: { text: string }) {
  return <div className="h-48 flex items-center justify-center text-lg text-gray-400">{text}</div>;
}

// ============================================================================
// Bug Trend Chart (ECharts)
// ============================================================================
function BugTrendChart({ data }: { data: QualityTrendPointDto[] }) {
  const dates = data.map(d => { const dt = new Date(d.date); return `${dt.getMonth() + 1}/${dt.getDate()}`; });
  const opened = data.map(d => d.opened);
  const closed = data.map(d => d.closed);
  const active = data.map(d => d.cumulativeActive);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30, 30, 46, 0.95)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#e5e7eb', fontSize: 13 },
    },
    legend: {
      data: ['Opened', 'Closed', 'Active Backlog'],
      bottom: 0,
      textStyle: { fontSize: 13, color: '#9ca3af' },
    },
    grid: { left: 50, right: 16, top: 16, bottom: 50 },
    xAxis: {
      type: 'category' as const,
      data: dates,
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 11, color: '#9ca3af', rotate: data.length > 45 ? 45 : 0 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' as const } },
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Opened', type: 'line' as const, data: opened, smooth: true,
        symbol: 'circle', symbolSize: 5, showSymbol: data.length <= 40,
        lineStyle: { width: 2.5, color: '#ef4444' },
        itemStyle: { color: '#ef4444' },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(239,68,68,0.15)' }, { offset: 1, color: 'rgba(239,68,68,0.01)' }] } },
      },
      {
        name: 'Closed', type: 'line' as const, data: closed, smooth: true,
        symbol: 'circle', symbolSize: 5, showSymbol: data.length <= 40,
        lineStyle: { width: 2.5, color: '#22c55e' },
        itemStyle: { color: '#22c55e' },
        areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,197,94,0.15)' }, { offset: 1, color: 'rgba(34,197,94,0.01)' }] } },
      },
      {
        name: 'Active Backlog', type: 'line' as const, data: active, smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#a78bfa', type: 'dashed' as const },
        itemStyle: { color: '#a78bfa' },
      },
    ],
    animationDuration: 800,
  }), [data, dates, opened, closed, active]);

  return <ReactECharts option={option} style={{ height: 360 }} notMerge lazyUpdate />;
}

// ============================================================================
// Aging Chart (ECharts)
// ============================================================================
function AgingChart({ data }: { data: BugAgingDistributionDto[] }) {
  const colors = ['#22c55e', '#86efac', '#fbbf24', '#f97316', '#ef4444', '#dc2626'];
  const totalBugs = data.reduce((s, d) => s + d.count, 0);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: 'rgba(30, 30, 46, 0.95)',
      borderColor: 'rgba(249, 115, 22, 0.3)',
      borderWidth: 1,
      textStyle: { color: '#e5e7eb', fontSize: 13 },
      formatter: (params: Array<{ name: string; value: number; dataIndex: number }>) => {
        if (!params?.length) return '';
        const p = params[0];
        const pct = data[p.dataIndex]?.percentage ?? 0;
        return `<div style="font-weight:700;margin-bottom:4px;font-size:14px">${p.name}</div>
          <div style="font-size:22px;font-weight:800">${p.value} bugs</div>
          <div style="color:#9ca3af;margin-top:4px">${pct.toFixed(1)}% of ${totalBugs} total</div>`;
      },
    },
    grid: { left: 12, right: 12, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: data.map(d => d.range),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 13, color: '#6b7280', fontWeight: 600 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' as const } },
      axisLabel: { fontSize: 11, color: '#9ca3af' },
      axisLine: { show: false },
    },
    series: [{
      type: 'bar' as const,
      data: data.map((d, i) => ({
        value: d.count,
        itemStyle: {
          color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: colors[i % colors.length] }, { offset: 1, color: colors[i % colors.length] + '80' }] },
          borderRadius: [8, 8, 0, 0],
        },
        label: {
          show: true, position: 'top' as const,
          formatter: `{bold|${d.count}}\n{pct|${d.percentage.toFixed(0)}%}`,
          rich: { bold: { fontSize: 16, fontWeight: 'bold' as const, color: '#374151', lineHeight: 22 }, pct: { fontSize: 12, color: '#9ca3af', lineHeight: 18 } },
        },
      })),
      barWidth: '55%',
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(0,0,0,0.15)' } },
    }],
    animationDuration: 600,
  }), [data, totalBugs]);

  return <ReactECharts option={option} style={{ height: 360 }} notMerge lazyUpdate />;
}
