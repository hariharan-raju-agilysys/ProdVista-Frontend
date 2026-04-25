import api from './api';

// ── Types ──────────────────────────────────────────────────────────────

export interface SubProperty {
  id: string;
  name: string;
  propertyId?: number;
}

export interface RegionCustomer {
  id: string;
  customerId: string;
  customerName: string;
  propertyId: string;
  subProperties: SubProperty[];
  totalProperties: number;
  currentVersion: string;
  deploymentType: string;
  isSaaS: boolean;
  status: string;
  priority: string;
  activeUsers: number;
  openTickets: number;
  healthScore: string;
  city: string;
  state: string;
  country: string;
  customerManager: string;
  supportManager: string;
  goLiveDate: string | null;
  lastActivityDate: string | null;
  products: string[];
}

export interface RegionOverview {
  region: string;
  customerCount: number;
  totalProperties: number;
  totalUsers: number;
  totalOpenTickets: number;
  versionDistribution: Record<string, number>;
  deploymentTypes: Record<string, number>;
  healthDistribution: Record<string, number>;
  customers: RegionCustomer[];
}

export interface ProductionOverviewResponse {
  summary: {
    totalCustomers: number;
    totalRegions: number;
    totalProperties: number;
    totalOpenTickets: number;
    versionDistribution: Record<string, number>;
    deploymentTypes: Record<string, number>;
  };
  regions: RegionOverview[];
}

export interface CustomerIssue {
  id: number;
  workItemType: string;
  title: string;
  state: string;
  assignedTo: string;
  priority: number;
  severity: string;
  tags: string;
  areaPath: string;
  iterationPath: string;
  createdDate: string;
  changedDate: string;
  isCustomerReported: boolean;
  reproSteps: string | null;
}

export interface CustomerIssuesResponse {
  customer: {
    customerId: string;
    customerName: string;
    currentVersion?: string;
    deploymentType?: string;
  };
  issues: CustomerIssue[];
  connected: boolean;
  totalCount?: number;
  message?: string;
  error?: string;
}

// ── API Calls ──────────────────────────────────────────────────────────

export async function getProductionOverview(): Promise<ProductionOverviewResponse> {
  const { data } = await api.get('/customers/production-overview');
  return data;
}

export async function getCustomerIssues(customerId: string, top = 50): Promise<CustomerIssuesResponse> {
  const { data } = await api.get(`/customers/${encodeURIComponent(customerId)}/devops-issues`, {
    params: { top },
  });
  return data;
}
