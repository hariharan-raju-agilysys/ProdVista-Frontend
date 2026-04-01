import { ChartCard, MetricCard, StatusBadge } from '../components/Charts'
import { Activity, Bug, GitPullRequest, Server, Users } from 'lucide-react'

export default function Dashboard() {
  // Sample data for charts
  const bugTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Opened',
        data: [45, 52, 38, 24, 33, 28],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
      {
        label: 'Closed',
        data: [35, 48, 42, 35, 40, 45],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      },
    ],
  }

  const deploymentData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [
      {
        label: 'Deployments',
        data: [12, 8, 15, 10, 6],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }

  const versionDistribution = {
    labels: ['v2.5.0', 'v2.4.2', 'v2.4.1', 'v2.3.x', 'Other'],
    datasets: [
      {
        data: [35, 28, 20, 12, 5],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Last updated: 2 minutes ago</span>
          <button className="btn-primary text-sm">Refresh</button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Active Bugs" 
          value={127} 
          change={-12}
          icon={<Bug className="w-6 h-6" />}
          color="red"
        />
        <MetricCard 
          title="Open PRs" 
          value={23} 
          change={5}
          icon={<GitPullRequest className="w-6 h-6" />}
          color="purple"
        />
        <MetricCard 
          title="Active Customers" 
          value={1842} 
          change={8}
          icon={<Users className="w-6 h-6" />}
          color="green"
        />
        <MetricCard 
          title="API Uptime" 
          value="99.97%" 
          icon={<Server className="w-6 h-6" />}
          color="blue"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard 
          title="Bug Trend" 
          type="line" 
          data={bugTrendData}
          height={300}
        />
        <ChartCard 
          title="Daily Deployments" 
          type="bar" 
          data={deploymentData}
          height={300}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard 
          title="Version Distribution" 
          type="doughnut" 
          data={versionDistribution}
          height={250}
        />
        
        {/* Recent Activity */}
        <div className="card lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: 'Deployed v2.5.1 to Production', status: 'success', time: '5 min ago' },
              { action: 'Critical bug #4521 resolved', status: 'success', time: '12 min ago' },
              { action: 'Customer Acme Inc upgraded to v2.5.0', status: 'info', time: '1 hour ago' },
              { action: 'Build pipeline failed - main branch', status: 'error', time: '2 hours ago' },
              { action: 'New incident reported - High latency', status: 'warning', time: '3 hours ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{item.action}</span>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={item.status as any} text={item.status} />
                  <span className="text-xs text-gray-500">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
