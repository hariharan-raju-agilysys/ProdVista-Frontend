import { MetricCard, ProgressBar, StatusBadge } from '../components/MetricCard'
import { ChartCard } from '../components/Charts'
import { GitPullRequest, GitCommit, Code2, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Engineering() {
  const { isManager } = useAuth()
  
  const prStatusData = {
    labels: ['Awaiting Review', 'In Review', 'Approved', 'Changes Requested'],
    datasets: [{
      data: [8, 5, 7, 3],
      backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'],
    }],
  }

  const commitActivityData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Commits',
      data: [45, 52, 38, 65, 42, 15, 8],
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
    }],
  }

  const buildTrendData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    datasets: [
      {
        label: 'Build Duration (min)',
        data: [12, 11, 10, 9],
        borderColor: 'rgb(59, 130, 246)',
        fill: false,
      },
      {
        label: 'Success Rate (%)',
        data: [92, 94, 96, 95],
        borderColor: 'rgb(34, 197, 94)',
        fill: false,
        yAxisID: 'percentage',
      },
    ],
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Open Pull Requests"
          value="23"
          change={-8}
          changeLabel="vs last week"
          trend="up"
          icon={<GitPullRequest size={20} />}
        />
        <MetricCard
          title="Commits Today"
          value="67"
          change={12}
          changeLabel="vs yesterday"
          trend="up"
          icon={<GitCommit size={20} />}
        />
        <MetricCard
          title="Code Coverage"
          value="84.5%"
          change={2.1}
          changeLabel="vs last month"
          trend="up"
          icon={<Code2 size={20} />}
        />
        {/* Build Time - only visible to managers */}
        {isManager && (
        <MetricCard
          title="Avg Build Time"
          value="9.2 min"
          change={-15}
          changeLabel="vs last week"
          trend="up"
          icon={<Clock size={20} />}
        />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="PR Review Status" type="doughnut" data={prStatusData} />
        <ChartCard title="Commit Activity" type="bar" data={commitActivityData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Build Performance Trend - only visible to managers */}
        {isManager && (
        <ChartCard title="Build Performance Trend" type="line" data={buildTrendData} />
        )}
        
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Active Pull Requests</h3>
          <div className="space-y-3">
            {[
              { title: 'Add dashboard metrics API', author: 'john.doe', status: 'review', reviewers: 2 },
              { title: 'Fix authentication bug', author: 'jane.smith', status: 'approved', reviewers: 3 },
              { title: 'Update dependencies', author: 'bob.wilson', status: 'changes', reviewers: 1 },
              { title: 'Add unit tests for adapters', author: 'alice.johnson', status: 'pending', reviewers: 0 },
            ].map((pr, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{pr.title}</p>
                  <p className="text-xs text-gray-500">by {pr.author}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{pr.reviewers} reviewers</span>
                  <StatusBadge status={
                    pr.status === 'approved' ? 'success' :
                    pr.status === 'changes' ? 'error' :
                    pr.status === 'review' ? 'info' : 'neutral'
                  }>
                    {pr.status}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">CI/CD Pipelines</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Pipeline</th>
                <th className="text-left py-3 px-4">Last Run</th>
                <th className="text-left py-3 px-4">Duration</th>
                <th className="text-left py-3 px-4">Success Rate</th>
                <th className="text-left py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'main-build', lastRun: '10 min ago', duration: '8m 32s', rate: 96, status: 'success' },
                { name: 'staging-deploy', lastRun: '2 hours ago', duration: '12m 45s', rate: 92, status: 'success' },
                { name: 'integration-tests', lastRun: '30 min ago', duration: '25m 10s', rate: 88, status: 'warning' },
                { name: 'security-scan', lastRun: '1 hour ago', duration: '5m 20s', rate: 100, status: 'success' },
              ].map((pipeline, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{pipeline.name}</td>
                  <td className="py-3 px-4 text-gray-500">{pipeline.lastRun}</td>
                  <td className="py-3 px-4 text-gray-500">{pipeline.duration}</td>
                  <td className="py-3 px-4">
                    <div className="w-24">
                      <ProgressBar 
                        value={pipeline.rate} 
                        color={pipeline.rate >= 95 ? 'green' : pipeline.rate >= 85 ? 'yellow' : 'red'} 
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={pipeline.status as any}>
                      {pipeline.status === 'success' ? 'Passing' : 'Warning'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
