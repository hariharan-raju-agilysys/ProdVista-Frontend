import api from './api'

// ============================================================================
// Types (matching backend DTOs)
// ============================================================================

export type AutomationJobType =
  | 'BuildTrigger'
  | 'DataSync'
  | 'ReleaseNotes'
  | 'HealthCheck'
  | 'Webhook'
  | 'CacheRefresh'
  | 'ReportGeneration'

export type ScheduleType = 'Manual' | 'Interval' | 'Cron' | 'Event'

export type AutomationRunStatus =
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled'
  | 'Skipped'
  | 'TimedOut'

export interface AutomationJobDto {
  id: string
  name: string
  description: string
  jobType: AutomationJobType
  isEnabled: boolean
  scheduleType: ScheduleType
  cronExpression?: string
  intervalMinutes?: number
  timezone?: string
  lastRunAt?: string
  nextRunAt?: string
  lastRunStatus?: AutomationRunStatus
  lastRunError?: string
  lastRunDurationMs?: number
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  configurationJson: string
  maxRetries: number
  retryDelaySeconds: number
  notifyOnFailure: boolean
  notifyOnSuccess: boolean
  createdBy: string
  createdAt: string
  updatedAt?: string
}

export interface AutomationJobRunDto {
  id: string
  automationJobId: string
  jobName?: string
  status: AutomationRunStatus
  startedAt: string
  completedAt?: string
  durationMs?: number
  triggerType?: string
  triggeredBy?: string
  output?: string
  errorMessage?: string
  externalBuildId?: string
  externalBuildUrl?: string
  externalBuildStatus?: string
  retryAttempt: number
}

export interface AutomationDashboardDto {
  totalJobs: number
  enabledJobs: number
  disabledJobs: number
  runsToday: number
  successToday: number
  failedToday: number
  successRate: number
  recentRuns: AutomationJobRunDto[]
  upcomingJobs: AutomationJobDto[]
}

export interface CreateAutomationJobRequest {
  name: string
  description: string
  jobType: AutomationJobType
  scheduleType: ScheduleType
  cronExpression?: string
  intervalMinutes?: number
  timezone?: string
  configurationJson: string
  maxRetries: number
  retryDelaySeconds: number
  notifyOnFailure: boolean
  notifyOnSuccess: boolean
}

export interface UpdateAutomationJobRequest {
  name?: string
  description?: string
  scheduleType?: ScheduleType
  cronExpression?: string
  intervalMinutes?: number
  timezone?: string
  configurationJson?: string
  maxRetries?: number
  retryDelaySeconds?: number
  notifyOnFailure?: boolean
  notifyOnSuccess?: boolean
  isEnabled?: boolean
}

// ============================================================================
// Service API
// ============================================================================

const BASE = '/automation-jobs'

export async function getDashboard(): Promise<AutomationDashboardDto> {
  const { data } = await api.get<AutomationDashboardDto>(`${BASE}/dashboard`)
  return data
}

export async function getJobs(): Promise<AutomationJobDto[]> {
  const { data } = await api.get<AutomationJobDto[]>(BASE)
  return data
}

export async function getJob(id: string): Promise<AutomationJobDto> {
  const { data } = await api.get<AutomationJobDto>(`${BASE}/${id}`)
  return data
}

export async function createJob(req: CreateAutomationJobRequest): Promise<AutomationJobDto> {
  const { data } = await api.post<AutomationJobDto>(BASE, req)
  return data
}

export async function updateJob(id: string, req: UpdateAutomationJobRequest): Promise<AutomationJobDto> {
  const { data } = await api.put<AutomationJobDto>(`${BASE}/${id}`, req)
  return data
}

export async function deleteJob(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

export async function toggleJob(id: string, isEnabled: boolean): Promise<void> {
  await api.put(`${BASE}/${id}/toggle`, { isEnabled })
}

export async function triggerJob(id: string): Promise<AutomationJobRunDto> {
  const { data } = await api.post<AutomationJobRunDto>(`${BASE}/${id}/trigger`)
  return data
}

export async function cancelRun(runId: string): Promise<void> {
  await api.post(`${BASE}/runs/${runId}/cancel`)
}

export async function getJobRuns(jobId: string, take = 50): Promise<AutomationJobRunDto[]> {
  const { data } = await api.get<AutomationJobRunDto[]>(`${BASE}/${jobId}/runs`, { params: { take } })
  return data
}

export async function getRecentRuns(take = 20): Promise<AutomationJobRunDto[]> {
  const { data } = await api.get<AutomationJobRunDto[]>(`${BASE}/recent-runs`, { params: { take } })
  return data
}

// ============================================================================
// Helpers
// ============================================================================

export const JOB_TYPE_LABELS: Record<AutomationJobType, string> = {
  BuildTrigger: 'Build Trigger',
  DataSync: 'Data Sync',
  ReleaseNotes: 'Release Notes',
  HealthCheck: 'Health Check',
  Webhook: 'Webhook',
  CacheRefresh: 'Cache Refresh',
  ReportGeneration: 'Report Generation',
}

export const JOB_TYPE_COLORS: Record<AutomationJobType, string> = {
  BuildTrigger: 'from-blue-500 to-cyan-500',
  DataSync: 'from-emerald-500 to-teal-500',
  ReleaseNotes: 'from-violet-500 to-purple-500',
  HealthCheck: 'from-amber-500 to-orange-500',
  Webhook: 'from-rose-500 to-pink-500',
  CacheRefresh: 'from-indigo-500 to-blue-500',
  ReportGeneration: 'from-fuchsia-500 to-pink-500',
}

export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  Manual: 'Manual',
  Interval: 'Interval',
  Cron: 'Cron Expression',
  Event: 'Event-Driven',
}

export const RUN_STATUS_COLORS: Record<AutomationRunStatus, string> = {
  Queued: 'bg-slate-500',
  Running: 'bg-blue-500 animate-pulse',
  Completed: 'bg-emerald-500',
  Failed: 'bg-red-500',
  Cancelled: 'bg-gray-500',
  Skipped: 'bg-yellow-500',
  TimedOut: 'bg-orange-500',
}
