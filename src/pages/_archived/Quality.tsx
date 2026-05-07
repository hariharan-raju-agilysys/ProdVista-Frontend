import { MetricCard, StatusBadge } from '../components/MetricCard'
import { ChartCard } from '../components/Charts'
import { Bug, Clock, TrendingDown, Award } from 'lucide-react'

export default function Quality() {
  const bugTrendData = {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
    datasets: [
      {
        label: 'Opened',
        data: [25, 32, 28, 35, 22, 18],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
      {
        label: 'Closed',
        data: [22, 28, 35, 30, 28, 25],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      },
    ],
  }

  const severityData = {
    labels: ['Critical', 'High', 'Medium', 'Low'],
    datasets: [{
      data: [8, 25, 52, 42],
      backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
    }],
  }

  const bugAgingData = {
    labels: ['0-7 days', '8-14 days', '15-30 days', '30-60 days', '60+ days'],
    datasets: [{
      label: 'Bug Count',
      data: [45, 28, 22, 18, 14],
      backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#7c3aed'],
    }],
  }

  const longRunningBugs = [
    { id: 'BUG-1234', title: 'Memory leak in data processor', age: 45, assignee: 'John Doe', severity: 'High' },
    { id: 'BUG-1156', title: 'Intermittent timeout on API calls', age: 38, assignee: 'Jane Smith', severity: 'Critical' },
    { id: 'BUG-1089', title: 'UI rendering issue on Safari', age: 35, assignee: 'Bob Wilson', severity: 'Medium' },
    { id: 'BUG-998', title: 'Export fails for large datasets', age: 32, assignee: 'Alice Johnson', severity: 'High' },
  ]

  const leaderboard = [
    { name: 'Jane Smith', fixed: 28, avgTime: 2.3 },
    { name: 'John Doe', fixed: 24, avgTime: 3.1 },
    { name: 'Bob Wilson', fixed: 22, avgTime: 2.8 },
    { name: 'Alice Johnson', fixed: 19, avgTime: 2.5 },
    { name: 'Charlie Brown', fixed: 15, avgTime: 3.5 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Active Bugs"
          value="127"
          change={-8}
          changeLabel="vs last week"
          trend="up"
          icon={<Bug size={20} />}
        />
        <MetricCard
          title="Critical Bugs"
          value="8"
          change={-20}
          changeLabel="vs last week"
          trend="up"
          icon={<Bug size={20} />}
        />
        <MetricCard
          title="Avg Resolution Time"
          value="4.2 days"
          change={-15}
          changeLabel="vs last month"
          trend="up"
          icon={<Clock size={20} />}
        />
        <MetricCard
          title="Bug Escape Rate"
          value="2.3%"
          change={-0.5}
          changeLabel="vs last release"
          trend="up"
          icon={<TrendingDown size={20} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Bug Trend" type="line" data={bugTrendData} />
        <ChartCard title="Bugs by Severity" type="doughnut" data={severityData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Bug Aging Distribution" type="bar" data={bugAgingData} />
        
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Award size={20} className="text-yellow-500" />
            Bug Fix Leaderboard
          </h3>
          <div className="space-y-3">
            {leaderboard.map((dev, index) => (
              <div key={index} className="flex items-center gap-4">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-200 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{dev.name}</p>
                  <p className="text-xs text-gray-500">{dev.fixed} bugs fixed • {dev.avgTime} days avg</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">{dev.fixed}</p>
                  <p className="text-xs text-gray-500">bugs</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Long Running Bugs (&gt;30 days)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Bug ID</th>
                <th className="text-left py-3 px-4">Title</th>
                <th className="text-left py-3 px-4">Age</th>
                <th className="text-left py-3 px-4">Assignee</th>
                <th className="text-left py-3 px-4">Severity</th>
              </tr>
            </thead>
            <tbody>
              {longRunningBugs.map((bug, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-primary-600">{bug.id}</td>
                  <td className="py-3 px-4">{bug.title}</td>
                  <td className="py-3 px-4">
                    <span className="text-red-600 font-medium">{bug.age} days</span>
                  </td>
                  <td className="py-3 px-4 text-gray-500">{bug.assignee}</td>
                  <td className="py-3 px-4">
                    <StatusBadge status={
                      bug.severity === 'Critical' ? 'error' :
                      bug.severity === 'High' ? 'warning' : 'info'
                    }>
                      {bug.severity}
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
