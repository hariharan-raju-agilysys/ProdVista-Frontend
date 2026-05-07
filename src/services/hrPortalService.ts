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
  employeeId: string;
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
  avatarUrl?: string;
  status: string;
}

export interface HrBirthday {
  employeeId: string;
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
  upcomingBirthdays: { employeeId: string; name: string; designation?: string; birthday: string; daysUntil: number; isToday: boolean }[];
  newJoiners: { employeeId: string; name: string; designation?: string; joiningDate: string }[];
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

export const getEmployee = async (employeeId: string): Promise<HrEmployee> => {
  const { data } = await api.get(`${BASE}/employees/${employeeId}`);
  return data;
};

export const createEmployee = async (dto: Partial<HrEmployee> & { employeeId: string; name: string }) => {
  const { data } = await api.post(`${BASE}/employees`, dto);
  return data;
};

export const bulkCreateEmployees = async (employees: Array<Partial<HrEmployee> & { employeeId: string; name: string }>) => {
  const { data } = await api.post(`${BASE}/employees/bulk`, employees);
  return data as { created: number; updated: number; total: number };
};

export const updateEmployee = async (employeeId: string, dto: Partial<HrEmployee>) => {
  const { data } = await api.put(`${BASE}/employees/${employeeId}`, dto);
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

export const importCsv = async (file: File, connectionId?: string): Promise<CsvImportResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const params = connectionId ? `?connectionId=${connectionId}` : '';
  const { data } = await api.post(`${BASE}/import/csv${params}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const downloadCsvTemplate = (): string => {
  return `/api${BASE}/import/template`;
};

export const getExportCsvUrl = (departmentCode?: string): string => {
  const params = departmentCode ? `?departmentCode=${departmentCode}` : '';
  return `/api${BASE}/export/csv${params}`;
};
