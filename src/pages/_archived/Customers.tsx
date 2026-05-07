import { MetricCard, StatusBadge } from '../components/MetricCard'
import { ChartCard } from '../components/Charts'
import { Users, Globe, TrendingUp, Headphones } from 'lucide-react'

export default function Customers() {
  const versionDistributionData = {
    labels: ['v2.5.x', 'v2.4.x', 'v2.3.x', 'v2.2.x', 'Older'],
    datasets: [{
      data: [45, 28, 15, 8, 4],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'],
    }],
  }

  const deploymentTrendData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [{
      label: 'New Deployments',
      data: [12, 15, 18, 22, 25, 28],
      borderColor: 'rgb(59, 130, 246)',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
    }],
  }

  const regionData = {
    labels: ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Other'],
    datasets: [{
      label: 'Customers',
      data: [85, 62, 45, 18, 10],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6b7280'],
    }],
  }

  const customers = [
    { name: 'Acme Corp', version: 'v2.5.1', region: 'North America', status: 'healthy', lastSync: '5 min ago' },
    { name: 'TechGiant Inc', version: 'v2.5.0', region: 'Europe', status: 'healthy', lastSync: '12 min ago' },
    { name: 'Global Systems', version: 'v2.4.3', region: 'Asia Pacific', status: 'warning', lastSync: '2 hours ago' },
    { name: 'DataFlow Ltd', version: 'v2.5.1', region: 'North America', status: 'healthy', lastSync: '8 min ago' },
    { name: 'CloudFirst', version: 'v2.3.5', region: 'Europe', status: 'outdated', lastSync: '1 hour ago' },
  ]

  const onboardingPipeline = [
    { customer: 'NewCorp Inc', stage: 'Provisioning', progress: 75, startDate: '2024-03-01' },
    { customer: 'StartupXYZ', stage: 'Configuration', progress: 45, startDate: '2024-03-05' },
    { customer: 'Enterprise Co', stage: 'Data Migration', progress: 20, startDate: '2024-03-08' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Customers"
          value="220"
          change={8}
          changeLabel="this month"
          trend="up"
          icon={<Users size={20} />}
        />
        <MetricCard
          title="Active Deployments"
          value="198"
          change={5}
          changeLabel="vs last month"
          trend="up"
          icon={<Globe size={20} />}
        />
        <MetricCard
          title="On Latest Version"
          value="73%"
          change={12}
          changeLabel="vs last month"
          trend="up"
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          title="Support Tickets"
          value="14"
          change={-22}
          changeLabel="vs last week"
          trend="up"
          icon={<Headphones size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Version Distribution" type="doughnut" data={versionDistributionData} />
        <ChartCard title="Deployment Trend" type="line" data={deploymentTrendData} />
        <ChartCard title="Customers by Region" type="bar" data={regionData} />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Customer Deployments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Customer</th>
                <th className="text-left py-3 px-4">Version</th>
                <th className="text-left py-3 px-4">Region</th>
                <th className="text-left py-3 px-4">Last Sync</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{customer.name}</td>
                  <td className="py-3 px-4">
                    <span className={`font-mono text-sm ${
                      customer.version.startsWith('v2.5') ? 'text-green-600' :
                      customer.version.startsWith('v2.4') ? 'text-blue-600' : 'text-yellow-600'
                    }`}>
                      {customer.version}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{customer.region}</td>
                  <td className="py-3 px-4 text-gray-500">{customer.lastSync}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={
                      customer.status === 'healthy' ? 'success' :
                      customer.status === 'warning' ? 'warning' : 'neutral'
                    }>
                      {customer.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Onboarding Pipeline</h3>
        <div className="space-y-4">
          {onboardingPipeline.map((item, index) => (
            <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-800">{item.customer}</p>
                <p className="text-sm text-gray-500">Started: {item.startDate}</p>
              </div>
              <div className="w-32 text-center">
                <StatusBadge status="info">{item.stage}</StatusBadge>
              </div>
              <div className="w-48">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span>
                  <span>{item.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
