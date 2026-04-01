import api from './api';

export interface KpiMetric {
  id?: string;
  metricName: string;
  metricValue: number;
  unit: string;
  period: string;
  changePercent: number | null;
  targetValue: number | null;
  status: string | null;
  notes: string | null;
  displayOrder: number;
}

export interface KpiCategory {
  category: string;
  metrics: KpiMetric[];
}

export interface KpiDataResponse {
  categories: KpiCategory[];
  periods: string[];
  total: number;
}

export interface KpiSummaryCard {
  category: string;
  metricName: string;
  value: number;
  unit: string;
  change: number | null;
  target: number | null;
  status: string | null;
}

export interface KpiSummaryResponse {
  hasData: boolean;
  period: string | null;
  cards: KpiSummaryCard[];
  categories: KpiCategory[];
}

export interface KpiUploadResult {
  created: number;
  updated: number;
  errors: string[];
  batchId: string;
}

const dashboardKpiService = {
  async getSummary(): Promise<KpiSummaryResponse> {
    const { data } = await api.get<KpiSummaryResponse>('/dashboard-kpi/summary');
    return data;
  },

  async getKpis(period?: string, category?: string): Promise<KpiDataResponse> {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (category) params.set('category', category);
    const { data } = await api.get<KpiDataResponse>(`/dashboard-kpi?${params}`);
    return data;
  },

  async uploadExcel(file: File): Promise<KpiUploadResult> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<KpiUploadResult>('/dashboard-kpi/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async downloadTemplate(): Promise<void> {
    const { data } = await api.get('/dashboard-kpi/template', { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dashboard_kpi_template.xlsx';
    link.click();
    window.URL.revokeObjectURL(url);
  },

  async seedSampleData(): Promise<{ message: string; count?: number }> {
    const { data } = await api.post('/dashboard-kpi/seed');
    return data;
  },

  async clearAll(): Promise<{ deleted: number }> {
    const { data } = await api.delete('/dashboard-kpi');
    return data;
  },
};

export default dashboardKpiService;
