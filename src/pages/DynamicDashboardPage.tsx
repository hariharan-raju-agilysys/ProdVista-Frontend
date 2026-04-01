import { useParams } from 'react-router-dom';
import { DynamicDashboardRenderer } from '../components/DynamicDashboardRenderer';

/**
 * Dynamic Dashboard Page
 * 
 * This page provides full widget configuration when adding/editing widgets:
 * - Step 1: Select widget type (Chart, KPI, Table, etc.)
 * - Step 2: Enter basic info (title, subtitle, size)
 * - Step 3: Configure data source (API, Database, Azure, Static, etc.)
 * - Step 4: Widget-specific settings (field mappings, display options)
 */
export default function DynamicDashboardPage() {
  const { pageSlug } = useParams<{ pageSlug: string }>();
  
  // Default to 'overview' if no page slug specified
  const dashboardPageSlug = pageSlug || 'overview';
  
  return (
    <div className="h-full">
      <DynamicDashboardRenderer 
        pageSlug={dashboardPageSlug} 
        key={dashboardPageSlug}
      />
    </div>
  );
}
