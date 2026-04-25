import api from './api';

// ============================================================================
// Types
// ============================================================================

export interface SubPropertyDto {
  id: string;
  name: string;
  propertyId?: number;
}

export interface CustomerDetailDto {
  id: string;
  customerId: string;
  customerName: string;
  customerNameAlias: string;
  tenantId: string;
  propertyId: string;
  propertyName: string;
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
  propertyIdSearch?: string;
  tenantIdSearch?: string;
  subPropertySearch?: string;
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
  if (filter?.propertyIdSearch) params.append('propertyIdSearch', filter.propertyIdSearch);
  if (filter?.tenantIdSearch) params.append('tenantIdSearch', filter.tenantIdSearch);
  if (filter?.subPropertySearch) params.append('subPropertySearch', filter.subPropertySearch);
  
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
