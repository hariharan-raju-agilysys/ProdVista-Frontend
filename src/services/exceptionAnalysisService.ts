import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface StackFrame {
  assembly: string | null;
  method: string | null;
  fileName: string | null;
  lineNumber: number | null;
}

export interface ExceptionDetail {
  problemId: string;
  type: string;
  message: string;
  outerMessage: string | null;
  stackTrace: string | null;
  assembly: string;
  method: string;
  cloudRoleName: string;
  count: number;
  operationId: string | null;
  parsedFrames: StackFrame[];
}

export interface AnalysisResult {
  success: boolean;
  summary: string | null;
  rootCause: string | null;
  suggestedFix: string | null;
  fixedCode: string | null;
  originalCode: string | null;
  filePath: string | null;
  lineNumber: number | null;
  error: string | null;
  model: string | null;
}

export interface CreatePrResult {
  success: boolean;
  message: string;
  pullRequestId: number | null;
  pullRequestUrl: string | null;
  branchName: string | null;
}

export interface RepoInfo {
  id: string;
  name: string;
  url: string;
  defaultBranch: string;
  projectName: string;
  size: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get detailed exception info with parsed stack trace
 */
export async function getExceptionDetail(
  problemId: string,
  timeRange: string = '24h',
  resourceOrWorkspaceId?: string
): Promise<ExceptionDetail> {
  const isResourceId = resourceOrWorkspaceId?.startsWith('/subscriptions/');
  const response = await api.post<ExceptionDetail>('/exception-analysis/detail', {
    problemId,
    timeRange,
    ...(isResourceId ? { resourceId: resourceOrWorkspaceId } : { workspaceId: resourceOrWorkspaceId }),
  });
  return response.data;
}

/**
 * Analyze exception with AI - fetches code from DevOps and sends to LLM
 */
export async function analyzeException(params: {
  problemId: string;
  exceptionType: string;
  message: string;
  stackTrace: string | null;
  parsedFrames: StackFrame[];
  organizationUrl: string;
  projectName: string;
  repositoryId: string;
  branch?: string;
}): Promise<AnalysisResult> {
  const response = await api.post<AnalysisResult>('/exception-analysis/analyze', params);
  return response.data;
}

/**
 * Create a PR with the AI-suggested fix
 */
export async function createFixPR(params: {
  organizationUrl: string;
  projectName: string;
  repositoryId: string;
  filePath: string;
  fixedCode: string;
  exceptionType: string;
  exceptionMessage: string;
  targetBranch?: string;
}): Promise<CreatePrResult> {
  const response = await api.post<CreatePrResult>('/exception-analysis/create-pr', params);
  return response.data;
}

/**
 * Get repositories for analysis config
 */
export async function getRepositories(
  organizationUrl: string,
  projectName: string
): Promise<RepoInfo[]> {
  const response = await api.get<RepoInfo[]>('/exception-analysis/repositories', {
    params: { organizationUrl, projectName },
  });
  return response.data;
}

export default {
  getExceptionDetail,
  analyzeException,
  createFixPR,
  getRepositories,
};
