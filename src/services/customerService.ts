import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface SubPropertyDto {
  id: string;
  name: string;
}

export interface CustomerDetailDto {
  id: string;
  customerId: string;
  customerName: string;
  tenantId: string;
  propertyId: string;
  subProperties: SubPropertyDto[];
  region: string;
  status: string;
  priority: string;
  isSaaS: boolean;
  deploymentType: string;
  products: string[];
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  customerManager: string;
  customerManagerEmail: string;
  supportManager: string;
  supportManagerEmail: string;
  onboardedBy: string;
  onboardedByEmail: string;
  onboardingStartDate: string;
  goLiveDate: string;
  contractStartDate: string;
  contractEndDate: string;
  activeUsers: number;
  totalProperties: number;
  currentVersion: string;
  lastActivityDate: string;
  openTickets: number;
  healthScore: string;
}

export interface CustomerSummaryDto {
  totalCustomers: number;
  activeCustomers: number;
  onboardingCustomers: number;
  suspendedCustomers: number;
  saaSCustomers: number;
  onPremiseCustomers: number;
  hybridCustomers: number;
  byRegion: Record<string, number>;
  byPriority: Record<string, number>;
  byProduct: Record<string, number>;
}

export interface CustomerFilterDto {
  status?: string;
  region?: string;
  priority?: string;
  deploymentType?: string;
  searchTerm?: string;
}

export interface OnboardingCustomerDto {
  id: string;
  customerId: string;
  customerName: string;
  stage: string;
  progressPercent: number;
  startDate: string;
  targetGoLiveDate: string;
  assignedManager: string;
  products: string[];
  region: string;
  isDelayed: boolean;
  notes: string;
}

export interface FilterOptions {
  statuses: string[];
  priorities: string[];
  regions: string[];
  deploymentTypes: string[];
  products: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get customer summary statistics
 */
export const getCustomerSummary = async (): Promise<CustomerSummaryDto> => {
  const response = await api.get<CustomerSummaryDto>('/customers/summary');
  return response.data;
};

/**
 * Get all customers with optional filtering
 */
export const getCustomers = async (filter?: CustomerFilterDto): Promise<CustomerDetailDto[]> => {
  const params = new URLSearchParams();
  if (filter?.status) params.append('status', filter.status);
  if (filter?.region) params.append('region', filter.region);
  if (filter?.priority) params.append('priority', filter.priority);
  if (filter?.deploymentType) params.append('deploymentType', filter.deploymentType);
  if (filter?.searchTerm) params.append('searchTerm', filter.searchTerm);
  
  const queryString = params.toString();
  const url = queryString ? `/customers?${queryString}` : '/customers';
  
  const response = await api.get<CustomerDetailDto[]>(url);
  return response.data;
};

/**
 * Get a specific customer by ID
 */
export const getCustomer = async (customerId: string): Promise<CustomerDetailDto> => {
  const response = await api.get<CustomerDetailDto>(`/customers/${customerId}`);
  return response.data;
};

/**
 * Get customers currently in onboarding
 */
export const getOnboardingCustomers = async (): Promise<OnboardingCustomerDto[]> => {
  const response = await api.get<OnboardingCustomerDto[]>('/customers/onboarding');
  return response.data;
};

/**
 * Get available filter options
 */
export const getFilterOptions = async (): Promise<FilterOptions> => {
  const response = await api.get<FilterOptions>('/customers/filters');
  return response.data;
};

/**
 * Check if current user can edit customers (manager/admin only)
 */
export const checkCanEdit = async (): Promise<{ canEdit: boolean; role: string }> => {
  const response = await api.get<{ canEdit: boolean; role: string }>('/customers/can-edit');
  return response.data;
};

/**
 * Update a customer record (manager/admin only)
 */
export const updateCustomer = async (id: string, data: Partial<CustomerDetailDto>): Promise<CustomerDetailDto> => {
  const response = await api.put<CustomerDetailDto>(`/customers/${id}`, data);
  return response.data;
};

/**
 * Download Excel template for bulk customer upload
 */
export const downloadTemplate = async (): Promise<void> => {
  const response = await api.get('/customers/template', { responseType: 'blob' });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'customer_template.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export interface UploadResult {
  success: boolean;
  message: string;
  created: number;
  updated: number;
  totalRows: number;
  errors?: string[];
  batchId: string;
}

/**
 * Upload Excel file with customer data (manager/admin only)
 */
export const uploadCustomerExcel = async (file: File): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<UploadResult>('/customers/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

/**
 * Seed realistic customer data for the current tenant
 */
export const seedCustomerData = async (): Promise<{ success: boolean; message: string; count: number }> => {
  const response = await api.post('/customers/seed');
  return response.data;
};

/**
 * Export all customers as Excel with product tabs
 */
export const exportCustomerExcel = async (): Promise<void> => {
  const response = await api.get('/customers/export-excel', { responseType: 'blob' });
  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Customer_List_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ============================================================================
// Helper Functions
// ============================================================================

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'onboarding': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'suspended': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'churned': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  }
};

export const getHealthScoreColor = (healthScore: string): string => {
  switch (healthScore.toLowerCase()) {
    case 'good': return 'text-green-600 dark:text-green-400';
    case 'warning': return 'text-yellow-600 dark:text-yellow-400';
    case 'critical': return 'text-red-600 dark:text-red-400';
    default: return 'text-gray-600 dark:text-gray-400';
  }
};

export const getDeploymentTypeIcon = (deploymentType: string): string => {
  switch (deploymentType.toLowerCase()) {
    case 'saas': return '☁️';
    case 'onpremise': return '🖥️';
    case 'hybrid': return '🔀';
    default: return '📦';
  }
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateString);
};

export const getOnboardingStageInfo = (stage: string): { label: string; color: string; order: number } => {
  const stages: Record<string, { label: string; color: string; order: number }> = {
    'Discovery': { label: 'Discovery', color: 'bg-purple-500', order: 1 },
    'Contract': { label: 'Contract', color: 'bg-blue-500', order: 2 },
    'Setup': { label: 'Setup', color: 'bg-cyan-500', order: 3 },
    'DataMigration': { label: 'Data Migration', color: 'bg-yellow-500', order: 4 },
    'Training': { label: 'Training', color: 'bg-orange-500', order: 5 },
    'GoLive': { label: 'Go Live', color: 'bg-green-500', order: 6 }
  };
  return stages[stage] || { label: stage, color: 'bg-gray-500', order: 0 };
};
