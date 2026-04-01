import { useNavigate } from 'react-router-dom'
import {
  Activity, Bug, FileText, Workflow, Zap, Settings, Search, Bot, Database,
  Wrench, ChevronRight, Users, GitBranch, Building2
} from 'lucide-react'
import { useFeatureStore } from '../store/featureStore'

interface ToolCard {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  path: string
  color: string
  bgColor: string
  category: 'monitoring' | 'ai' | 'devops' | 'setup'
  featureFlag?: keyof import('../store/featureStore').FeatureFlags
}

const tools: ToolCard[] = [
  {
    id: 'command-center',
    name: 'Command Center',
    description: 'Real-time engineering operations dashboard with live metrics and alerts',
    icon: Activity,
    path: '/command-center',
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50 border-cyan-200',
    category: 'monitoring',
    featureFlag: 'enableCommandCenter',
  },
  {
    id: 'observability',
    name: 'Observability',
    description: 'Application performance monitoring with Azure App Insights integration',
    icon: Activity,
    path: '/observability',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50 border-teal-200',
    category: 'monitoring',
  },
  {
    id: 'query-explorer',
    name: 'Query Explorer',
    description: 'Run KQL queries against Azure Application Insights and Log Analytics',
    icon: Zap,
    path: '/observability-query',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50 border-emerald-200',
    category: 'monitoring',
  },
  {
    id: 'engineering',
    name: 'Engineering Analytics',
    description: 'PRs, builds, commits, and team velocity metrics from Azure DevOps',
    icon: GitBranch,
    path: '/engineering',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    category: 'devops',
  },
  {
    id: 'bug-analytics',
    name: 'Bug Analytics',
    description: 'Track bug trends, resolution rates, and quality metrics across sprints',
    icon: Bug,
    path: '/bug-analytics',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    category: 'devops',
  },
  {
    id: 'release-notes',
    name: 'Release Notes',
    description: 'Generate automated release notes from Azure DevOps work items',
    icon: FileText,
    path: '/release-notes',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    category: 'devops',
    featureFlag: 'enableReleaseNotes',
  },
  {
    id: 'jenkins',
    name: 'Jenkins Pipelines',
    description: 'Monitor CI/CD pipeline status, build history, and deployment stats',
    icon: Workflow,
    path: '/jenkins',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    category: 'devops',
    featureFlag: 'enableJenkins',
  },
  {
    id: 'ai-assistant',
    name: 'AI Assistant',
    description: 'Chat with AI to analyze data, query Azure, and get engineering insights',
    icon: Bot,
    path: '/ai-chat',
    color: 'text-violet-600',
    bgColor: 'bg-violet-50 border-violet-200',
    category: 'ai',
    featureFlag: 'enableAI',
  },
  {
    id: 'query-assistant',
    name: 'Query Assistant',
    description: 'Natural language to SQL — ask questions about your databases',
    icon: Database,
    path: '/ai-query',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    category: 'ai',
    featureFlag: 'enableAI',
  },
  {
    id: 'hr-setup',
    name: 'HR Integration',
    description: 'Configure HR provider connections to sync employee data for widgets',
    icon: Users,
    path: '/hr-setup',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50 border-indigo-200',
    category: 'setup',
  },
  {
    id: 'production-customers',
    name: 'Production Customers',
    description: 'Region-based customer drill-down with version tracking and DevOps issue integration',
    icon: Building2,
    path: '/production-customers',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
    category: 'monitoring',
  },
]

const categories = [
  { key: 'monitoring', label: 'Monitoring & Observability', icon: Search },
  { key: 'devops', label: 'DevOps & Quality', icon: Workflow },
  { key: 'ai', label: 'AI & Intelligence', icon: Bot },
  { key: 'setup', label: 'Integrations & Setup', icon: Settings },
] as const

export default function ToolsPage() {
  const navigate = useNavigate()
  const { features } = useFeatureStore()

  const visibleTools = tools.filter(t => {
    if (t.featureFlag && !features[t.featureFlag]) return false
    return true
  })

  return (
    <div className="p-4 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Wrench className="w-6 h-6 text-indigo-600" /> Tools
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">All engineering tools and integrations in one place</p>
      </div>

      {/* Categories */}
      {categories.map(cat => {
        const catTools = visibleTools.filter(t => t.category === cat.key)
        if (catTools.length === 0) return null
        return (
          <div key={cat.key}>
            <div className="flex items-center gap-2 mb-3">
              <cat.icon className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">{cat.label}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catTools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => navigate(tool.path)}
                  className={`text-left border rounded-xl p-4 transition-all hover:shadow-md hover:-translate-y-0.5 group ${tool.bgColor}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm ${tool.color}`}>
                      <tool.icon className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 mt-3">{tool.name}</h3>
                  <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{tool.description}</p>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
