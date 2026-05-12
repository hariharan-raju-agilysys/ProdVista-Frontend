import api from './api';

const BASE = '/hr-portal';

// ========================================
// Types
// ========================================

export interface HrConnection {
  id: string;
  connectionName: string;
  providerType: string;
  baseUrl: string;
  useSso: boolean;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  cacheUpdatedAt?: string;
  defaultDepartmentCode?: string;
  defaultDepartmentName?: string;
  employeeCount: number;
  departmentCount: number;
  greythrDepartmentIdsJson?: string; // JSON array of int dept IDs e.g. "[2044,2630]"
}

export interface HrDepartment {
  id: string;
  departmentCode: string;
  departmentName: string;
  parentDepartmentCode?: string;
  location?: string;
  managerName?: string;
  managerEmployeeId?: string;
  employeeCount: number;
  actualCount: number;
}

export interface HrEmployee {
  id: string;
  employeeId: number;
  name: string;
  email?: string;
  department?: string;
  departmentCode?: string;
  designation?: string;
  location?: string;
  category?: string;
  extensionNo?: string;
  dateOfBirth?: string;
  joiningDate?: string;
  reportingTo?: string;
  reportingToId?: string;
  managerId?: string;
  managerName?: string;
  managerDesignation?: string;
  managerEmployeeId?: string;
  directReports?: { id: string; employeeId?: number; name: string; designation?: string; department?: string; avatarUrl?: string; }[];
  team?: string;
  project?: string;
  activity?: string;
  gender?: string;
  avatarUrl?: string;
  status: string;
  appUserId?: string;
  appUserName?: string;
  appUserEmail?: string;
}

export interface HrBirthday {
  employeeId: number;
  name: string;
  department?: string;
  departmentCode?: string;
  designation?: string;
  location?: string;
  reportingTo?: string;
  avatarUrl?: string;
  birthday: string;
  daysUntil: number;
  isToday: boolean;
}

export interface DepartmentSummary {
  departmentCode: string;
  departmentName: string;
  managerName?: string;
  totalEmployees: number;
  activeEmployees: number;
  upcomingBirthdays: { employeeId: number; name: string; designation?: string; birthday: string; daysUntil: number; isToday: boolean }[];
  newJoiners: { employeeId: number; name: string; designation?: string; joiningDate: string }[];
  byDesignation: { designation: string; count: number }[];
  byLocation: { location: string; count: number }[];
  employees: HrEmployee[];
}

export interface HrStats {
  totalEmployees: number;
  departments: number;
  birthdaysToday: number;
  birthdaysThisWeek: number;
  newJoinersThisMonth: number;
  byLocation: { location: string; count: number }[];
}

export interface HrAuthStatus {
  authenticated: boolean;
  method: string; // 'Azure CLI' | 'Managed Identity' | 'Service Principal' | 'None'
  message: string;
  user?: { name?: string; email?: string } | null;
  isDevelopment?: boolean;
  instructions?: string | null;
}

// ========================================
// API Functions
// ========================================

export const getHrAuthStatus = async (): Promise<HrAuthStatus> => {
  const { data } = await api.get(`${BASE}/auth-status`);
  return data;
};

export const getConnections = async (): Promise<HrConnection[]> => {
  const { data } = await api.get(`${BASE}/connections`);
  return data;
};

export const createConnection = async (dto: {
  connectionName: string;
  providerType: string;
  baseUrl: string;
  clientId?: string;
  apiKey?: string;
  useSso: boolean;
  defaultDepartmentCode?: string;
  defaultDepartmentName?: string;
  greythrDepartmentIds?: number[];
}) => {
  const { data } = await api.post(`${BASE}/connections`, dto);
  return data;
};

export const updateConnection = async (id: string, dto: {
  connectionName: string;
  providerType: string;
  baseUrl: string;
  clientId?: string;
  apiKey?: string;
  useSso: boolean;
  defaultDepartmentCode?: string;
  defaultDepartmentName?: string;
  greythrDepartmentIds?: number[];
}) => {
  const { data } = await api.put(`${BASE}/connections/${id}`, dto);
  return data;
};

export const deleteConnection = async (id: string) => {
  const { data } = await api.delete(`${BASE}/connections/${id}`);
  return data;
};

export interface DepartmentPreview {
  departmentCode: string;
  departmentName: string;
}

export interface TestPreviewResult {
  success: boolean;
  message: string;
  statusCode?: number;
  providerType: string;
  authMethod: string;
  departments?: DepartmentPreview[];
}

/**
 * Test connection preview - validates URL and credentials BEFORE saving.
 * Can also attempt to fetch departments from the provider.
 */
export const testConnectionPreview = async (dto: {
  baseUrl: string;
  providerType: string;
  useSso: boolean;
  clientId?: string;
  apiKey?: string;
  fetchDepartments?: boolean;
}): Promise<TestPreviewResult> => {
  const { data } = await api.post(`${BASE}/connections/test-preview`, dto);
  return data;
};

export const getDepartments = async (connectionId?: string): Promise<HrDepartment[]> => {
  const params = connectionId ? { connectionId } : {};
  const { data } = await api.get(`${BASE}/departments`, { params });
  return data;
};

export const createDepartment = async (dto: {
  departmentCode: string;
  departmentName: string;
  parentDepartmentCode?: string;
  location?: string;
  managerName?: string;
  managerEmployeeId?: string;
}) => {
  const { data } = await api.post(`${BASE}/departments`, dto);
  return data;
};

export const getEmployees = async (params: {
  connectionId?: string;
  department?: string;
  departmentCode?: string;
  location?: string;
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<{ total: number; page: number; pageSize: number; employees: HrEmployee[] }> => {
  const { data } = await api.get(`${BASE}/employees`, { params });
  return data;
};

export const getEmployee = async (employeeId: number): Promise<HrEmployee> => {
  const { data } = await api.get(`${BASE}/employees/${employeeId}`);
  return data;
};

export const createEmployee = async (dto: Partial<HrEmployee> & { employeeId: number; name: string }) => {
  const { data } = await api.post(`${BASE}/employees`, dto);
  return data;
};

export const bulkCreateEmployees = async (employees: Array<Partial<HrEmployee> & { employeeId: number; name: string }>) => {
  const { data } = await api.post(`${BASE}/employees/bulk`, employees);
  return data as { created: number; updated: number; total: number };
};

export const updateEmployee = async (employeeId: number, dto: Partial<HrEmployee>) => {
  const { data } = await api.put(`${BASE}/employees/${employeeId}`, dto);
  return data;
};

export const deleteEmployee = async (employeeId: number): Promise<{ message: string }> => {
  const { data } = await api.delete(`${BASE}/employees/${employeeId}`);
  return data;
};

export const deleteAllEmployees = async (): Promise<{ message: string }> => {
  const { data } = await api.delete(`${BASE}/employees`);
  return data;
};

export const checkEmailForAppUser = async (email: string): Promise<{
  found: boolean;
  appUserId?: string;
  displayName?: string;
  username?: string;
}> => {
  const { data } = await api.get(`${BASE}/employees/check-email`, { params: { email } });
  return data;
};

export const linkAllEmployeesToAppUsers = async (): Promise<{ message: string; linked: number; total: number }> => {
  const { data } = await api.post(`${BASE}/employees/link-app-users`);
  return data;
};

export const getBirthdays = async (params: {
  departmentCode?: string;
  location?: string;
  daysAhead?: number;
} = {}): Promise<{ total: number; todayCount: number; birthdays: HrBirthday[] }> => {
  const { data } = await api.get(`${BASE}/birthdays`, { params });
  return data;
};

export const getDepartmentSummary = async (departmentCode: string, connectionId?: string): Promise<DepartmentSummary> => {
  const params: Record<string, string> = { departmentCode };
  if (connectionId) params.connectionId = connectionId;
  const { data } = await api.get(`${BASE}/department-summary`, { params });
  return data;
};

export const getStats = async (): Promise<HrStats> => {
  const { data } = await api.get(`${BASE}/stats`);
  return data;
};

// ========================================
// Org Tree Types & API
// ========================================

export interface OrgNode {
  id: string;
  employeeId: number;
  name: string;
  designation?: string;
  department?: string;
  team?: string;
  project?: string;
  activity?: string;
  location?: string;
  avatarUrl?: string;
  status: string;
  managerId?: string;
  reportingTo?: string;
  // set only on the root of a tree fetch
  managerName?: string;
  managerEmployeeId?: string;
  managerDesignation?: string;
  // children — null means depth limit reached, check hasMore
  children?: OrgNode[] | null;
  hasMore?: boolean;
}

export const getOrgRoots = async (connectionId?: string): Promise<OrgNode[]> => {
  const params: Record<string, string> = {};
  if (connectionId) params.connectionId = connectionId;
  const { data } = await api.get(`${BASE}/employees/roots`, { params });
  return data;
};

export const getOrgTree = async (employeeId: number, depth = 5): Promise<OrgNode> => {
  const { data } = await api.get(`${BASE}/employees/${employeeId}/org-tree`, { params: { depth } });
  return data;
};

export const resolveManagers = async (connectionId?: string): Promise<{ resolved: number; message: string }> => {
  const params: Record<string, string> = {};
  if (connectionId) params.connectionId = connectionId;
  const { data } = await api.post(`${BASE}/employees/resolve-managers`, null, { params });
  return data;
};

// ========================================
// Integration / Sync Types
// ========================================

export interface HrSyncLog {
  id: string;
  connectionId: string;
  connectionName?: string;
  syncType: string;
  status: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  triggeredBy?: string;
  duration?: number;
}

export interface SyncSettings {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  nextSyncAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  syncEmployees: boolean;
  syncDepartments: boolean;
  syncOnlyActive: boolean;
  overwriteManualEdits: boolean;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  statusCode?: number;
  providerType?: string;
  employeeCount?: number;
  departmentCount?: number;
}

export interface CsvImportResult {
  message: string;
  created: number;
  updated: number;
  total: number;
  failed: number;
  errors: string[];
  syncLogId: string;
}

export type FieldMapping = Record<string, string>;

// ========================================
// Integration API Functions
// ========================================

export interface SyncResult {
  success: boolean;
  message: string;
  departmentsCreated: number;
  departmentsUpdated: number;
  employeesCreated: number;
  employeesUpdated: number;
  departmentErrors: string[];
  employeeErrors: string[];
  errors: string[];
}

export const testConnection = async (connectionId: string): Promise<TestConnectionResult> => {
  const { data } = await api.post(`${BASE}/connections/${connectionId}/test`);
  return data;
};

/**
 * Sync employees and departments from the HR provider API.
 * This calls the provider's API endpoints (e.g., GreytHR /api/v2/employees)
 * and imports/updates data in ProdVista.
 */
export const syncFromProvider = async (connectionId: string): Promise<SyncResult> => {
  const { data } = await api.post(`${BASE}/connections/${connectionId}/sync`);
  return data;
};

export const getSyncSettings = async (connectionId: string): Promise<SyncSettings> => {
  const { data } = await api.get(`${BASE}/connections/${connectionId}/sync-settings`);
  return data;
};

export const updateSyncSettings = async (connectionId: string, settings: {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  syncEmployees: boolean;
  syncDepartments: boolean;
  syncOnlyActive: boolean;
  overwriteManualEdits: boolean;
}) => {
  const { data } = await api.put(`${BASE}/connections/${connectionId}/sync-settings`, settings);
  return data;
};

export const getFieldMapping = async (connectionId: string): Promise<FieldMapping> => {
  const { data } = await api.get(`${BASE}/connections/${connectionId}/field-mapping`);
  return data;
};

export const updateFieldMapping = async (connectionId: string, mapping: FieldMapping) => {
  const { data } = await api.put(`${BASE}/connections/${connectionId}/field-mapping`, mapping);
  return data;
};

export const getSyncLogs = async (params: {
  connectionId?: string;
  count?: number;
} = {}): Promise<HrSyncLog[]> => {
  const { data } = await api.get(`${BASE}/sync-logs`, { params });
  return data;
};

export const previewCsv = async (file: File, connectionId?: string): Promise<ExcelPreviewResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post(`${BASE}/import/csv/preview${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const importCsv = async (file: File, columnMapping?: ExcelImportMapping, connectionId?: string): Promise<CsvImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  if (columnMapping && Object.keys(columnMapping).length > 0) {
    formData.append('columnMapping', JSON.stringify(columnMapping));
  }
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post(`${BASE}/import/csv${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export interface ExcelPreviewResult {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
}

export type ExcelImportMapping = Record<string, string>; // fieldName → excelColumnHeader

export const previewExcel = async (file: File, connectionId?: string): Promise<ExcelPreviewResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post(`${BASE}/import/excel/preview${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const importExcel = async (file: File, columnMapping: ExcelImportMapping, connectionId?: string): Promise<CsvImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('columnMapping', JSON.stringify(columnMapping));
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post(`${BASE}/import/excel${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadCsvTemplate = async (): Promise<void> => {
  const { data } = await api.get(`${BASE}/import/template`, { responseType: 'blob' });
  triggerBlobDownload(data, 'hr_employee_template.csv');
};

// ========================================
// EMPLOYEE FIELD DISCOVERY & EXCEL TEMPLATE
// ========================================

export interface EmployeeField {
  field: string;
  label: string;
  required: boolean;
  description: string;
}

export const getEmployeeFields = async (): Promise<EmployeeField[]> => {
  const { data } = await api.get<EmployeeField[]>(`${BASE}/employees/fields`);
  return data;
};

export const downloadExcelTemplate = async (fields: string[]): Promise<void> => {
  const params = fields.length > 0 ? `?fields=${fields.join(',')}` : '?fields=all';
  const { data } = await api.get(`${BASE}/employees/excel-template${params}`, { responseType: 'blob' });
  triggerBlobDownload(data, 'hr_employee_template.xlsx');
};

/**
 * Download an Excel template whose column headers reflect the connection's stored field mapping.
 * Columns = the "Excel label" values saved in the field mapping (not the default labels).
 */
export const downloadConnectionExcelTemplate = async (connectionId: string): Promise<void> => {
  const { data } = await api.get(`${BASE}/connections/${connectionId}/excel-template`, { responseType: 'blob' });
  triggerBlobDownload(data, 'hr_employee_template.xlsx');
};

/**
 * Import an Excel file using the connection's stored field mapping to auto-resolve column names.
 * No explicit columnMapping needed — the stored mapping on the connection handles it.
 */
export const importExcelWithMapping = async (file: File, connectionId: string): Promise<CsvImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<CsvImportResult>(
    `${BASE}/import/excel?connectionId=${connectionId}`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
};

// ========================================
// EXCEL UPLOAD (file or URL) — auto-resolves ManagerId from ReportingToId
// ========================================

export interface EmployeeUploadResult {
  message: string;
  created: number;
  updated: number;
  failed: number;
  total: number;
  resolvedManagers: number;
  linkedUsers: number;
  errors: string[];
  syncLogId?: string;
}

export const uploadEmployeeExcel = async (
  file: File,
  connectionId?: string
): Promise<EmployeeUploadResult> => {
  const form = new FormData();
  form.append('file', file);
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post<EmployeeUploadResult>(
    `${BASE}/employees/upload-excel${params}`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
};

export const uploadEmployeeExcelFromUrl = async (
  url: string,
  connectionId?: string
): Promise<EmployeeUploadResult> => {
  const params = new URLSearchParams({ url });
  if (connectionId) params.set('connectionId', connectionId);
  const { data } = await api.post<EmployeeUploadResult>(
    `${BASE}/employees/upload-excel?${params.toString()}`
  );
  return data;
};

// ========================================
// SYNC APP USERS → EMPLOYEES
// ========================================

export interface SyncAppUsersResult {
  synced: number;
  linked: number;
  message: string;
}

export const syncEmployeesFromAppUsers = async (): Promise<SyncAppUsersResult> => {
  const { data } = await api.post<SyncAppUsersResult>(`${BASE}/employees/sync-from-app-users`);
  return data;
};

export const exportEmployeesCsv = async (departmentCode?: string): Promise<void> => {
  const params = departmentCode ? `?departmentCode=${departmentCode}` : '';
  const { data } = await api.get(`${BASE}/export/csv${params}`, { responseType: 'blob' });
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  triggerBlobDownload(data, `hr_employees_${date}.csv`);
};
