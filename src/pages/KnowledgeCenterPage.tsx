import { useState, useMemo } from 'react'
import {
  BookOpen, Search, ExternalLink, Star, BookMarked, Code2, Rocket,
  Users, Wrench, ShieldCheck, GitBranch, Database, Cloud, Plus, X, ChevronDown, ChevronUp
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

type KnowledgeCategory =
  | 'All'
  | 'Runbooks'
  | 'Architecture'
  | 'DevOps'
  | 'Best Practices'
  | 'Onboarding'
  | 'Tooling'
  | 'Security'

interface KnowledgeArticle {
  id: string
  title: string
  description: string
  category: KnowledgeCategory
  tags: string[]
  url?: string
  isStarred?: boolean
  author?: string
  isCustom?: boolean
}

const ICONS: Record<KnowledgeCategory, React.ReactNode> = {
  All: <BookOpen className="w-4 h-4" />,
  Runbooks: <BookMarked className="w-4 h-4" />,
  Architecture: <Database className="w-4 h-4" />,
  DevOps: <GitBranch className="w-4 h-4" />,
  'Best Practices': <Star className="w-4 h-4" />,
  Onboarding: <Users className="w-4 h-4" />,
  Tooling: <Wrench className="w-4 h-4" />,
  Security: <ShieldCheck className="w-4 h-4" />,
}

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  All: 'bg-gray-100 text-gray-700',
  Runbooks: 'bg-amber-100 text-amber-700',
  Architecture: 'bg-blue-100 text-blue-700',
  DevOps: 'bg-indigo-100 text-indigo-700',
  'Best Practices': 'bg-yellow-100 text-yellow-700',
  Onboarding: 'bg-green-100 text-green-700',
  Tooling: 'bg-purple-100 text-purple-700',
  Security: 'bg-red-100 text-red-700',
}

const BUILT_IN_ARTICLES: KnowledgeArticle[] = [
  // Runbooks
  {
    id: 'rb-1', category: 'Runbooks', title: 'Hotfix Deployment Runbook',
    description: 'Step-by-step process for deploying a hotfix to production AKS — from branch creation to merge and smoke test validation.',
    tags: ['hotfix', 'deployment', 'AKS', 'production'], author: 'DevOps Team',
  },
  {
    id: 'rb-2', category: 'Runbooks', title: 'Incident Response Playbook',
    description: 'Triage, escalation paths, communication templates, and post-mortem checklist for production incidents.',
    tags: ['incident', 'on-call', 'escalation'],
  },
  {
    id: 'rb-3', category: 'Runbooks', title: 'Database Rollback Procedure',
    description: 'How to safely roll back EF Core migrations in AKS. Includes pre-rollback snapshot and validation steps.',
    tags: ['database', 'rollback', 'EF Core', 'SQL'],
  },
  {
    id: 'rb-4', category: 'Runbooks', title: 'Jenkins Pipeline Failure Recovery',
    description: 'Common Jenkins build failures (Docker build, ACR push, K8s deploy) and their remediation steps.',
    tags: ['Jenkins', 'CI/CD', 'build'],
  },
  // Architecture
  {
    id: 'arch-1', category: 'Architecture', title: 'VisualOne AKS Architecture Overview',
    description: 'High-level diagram of AKS namespaces, Istio VirtualServices, ingress routing, and service-to-service communication.',
    tags: ['AKS', 'Istio', 'architecture', 'microservices'],
  },
  {
    id: 'arch-2', category: 'Architecture', title: 'Multi-Tenant Data Isolation Pattern',
    description: 'How TenantId is propagated through JWT claims, applied as EF Core global query filters, and enforced per-request.',
    tags: ['multi-tenant', 'EF Core', 'security', 'isolation'],
  },
  {
    id: 'arch-3', category: 'Architecture', title: 'Payment Gateway Integration Flow',
    description: 'Shift4, FreedomPay, Datacap integration points, outletId validation requirements, and the CEDS configuration pattern.',
    tags: ['payment', 'Shift4', 'FreedomPay', 'outletId'],
  },
  {
    id: 'arch-4', category: 'Architecture', title: 'SignalR Hub Design Patterns',
    description: 'How the 6 SignalR hubs (AI Chat, Widget, Cloud, Azure, InternalDashboard, MCP) are structured, authenticated, and scaled in AKS.',
    tags: ['SignalR', 'real-time', 'WebSocket', 'AKS'],
  },
  // DevOps
  {
    id: 'do-1', category: 'DevOps', title: 'Azure DevOps Board Iteration Guide',
    description: 'How to create/manage sprints, set iteration paths, and connect work items to releases in the V1 PMS project.',
    tags: ['Azure DevOps', 'sprints', 'iterations', 'work items'],
  },
  {
    id: 'do-2', category: 'DevOps', title: 'AKS Deployment Checklist',
    description: 'Pre-deployment checks, ConfigMap values to validate, health probe verification, and Istio VirtualService routing confirmation.',
    tags: ['AKS', 'deployment', 'checklist', 'ConfigMap'],
  },
  {
    id: 'do-3', category: 'DevOps', title: 'Docker Image Build & Push Workflow',
    description: 'Local build commands, ACR (v1registrydev.azurecr.io) push steps, tagging conventions, and image scanning.',
    tags: ['Docker', 'ACR', 'container', 'build'],
  },
  {
    id: 'do-4', category: 'DevOps', title: 'Branching Strategy & PR Guidelines',
    description: 'Branch naming conventions (hotfix/*, feature/*, release/*), PR template requirements, and code review checklist.',
    tags: ['git', 'branching', 'PR', 'code review'],
  },
  // Best Practices
  {
    id: 'bp-1', category: 'Best Practices', title: 'Async/Await Patterns in .NET 8',
    description: 'Why you NEVER use .Result or .Wait(). ConfigureAwait(false) usage, cancellation token patterns, and avoiding deadlocks.',
    tags: ['async', '.NET', 'C#', 'deadlock'],
  },
  {
    id: 'bp-2', category: 'Best Practices', title: 'Payment Flow Safety Checklist',
    description: 'outletId > 0 validation, CEDS config check before external calls, null-safe response access patterns.',
    tags: ['payment', 'validation', 'outletId', 'CEDS'],
  },
  {
    id: 'bp-3', category: 'Best Practices', title: 'React TypeScript Patterns',
    description: 'Service layer structure, typed API calls, useEffect cleanup, context vs Zustand, and form handling without Redux.',
    tags: ['React', 'TypeScript', 'hooks', 'patterns'],
  },
  {
    id: 'bp-4', category: 'Best Practices', title: 'SQL Query Safety Rules',
    description: 'WITH(NOLOCK) usage, indexed column filtering order (TenantId → PropertyId → Date), 1-minute timeout rule.',
    tags: ['SQL', 'query', 'performance', 'safety'],
  },
  // Onboarding
  {
    id: 'ob-1', category: 'Onboarding', title: 'New Dev Setup: Local Environment',
    description: 'Prerequisites (Docker, Node 20, .NET 8 SDK, SQL Server LocalDB), clone steps, appsettings, and first run.',
    tags: ['setup', 'local', 'environment', 'new-dev'],
  },
  {
    id: 'ob-2', category: 'Onboarding', title: 'Codebase Orientation: Backend',
    description: 'Controllers → Application Services → Infrastructure pattern, DI registration in DependencyInjection.cs, EF Core migrations.',
    tags: ['backend', '.NET', 'architecture', 'orientation'],
  },
  {
    id: 'ob-3', category: 'Onboarding', title: 'Codebase Orientation: Frontend',
    description: 'React 18 + Vite setup, lazy-loaded pages in App.tsx, auth context, TailwindCSS conventions, service layer.',
    tags: ['frontend', 'React', 'Vite', 'orientation'],
  },
  {
    id: 'ob-4', category: 'Onboarding', title: 'Understanding Multi-Tenant Architecture',
    description: 'How tenantCode maps to TenantId, JWT claims flow, global EF query filters, and testing with "versa" tenant.',
    tags: ['multi-tenant', 'JWT', 'EF Core', 'onboarding'],
  },
  // Tooling
  {
    id: 'tool-1', category: 'Tooling', title: 'ProdVista: Using the AI Query Assistant',
    description: 'How to use NL→SQL queries, save/pin panels, and interpret AI-generated SQL for Azure SQL.',
    tags: ['ProdVista', 'AI', 'SQL', 'query assistant'],
  },
  {
    id: 'tool-2', category: 'Tooling', title: 'App Insights KQL Quick Reference',
    description: 'Common KQL templates for requests, exceptions, traces with TenantId/CorrelationId filters for V1 PMS troubleshooting.',
    tags: ['KQL', 'App Insights', 'monitoring', 'logs'],
  },
  {
    id: 'tool-3', category: 'Tooling', title: 'ProdVista: Dashboard Widget Configuration',
    description: 'Adding database query widgets, configuring auto-refresh intervals, and using the drag-drop grid layout.',
    tags: ['ProdVista', 'dashboard', 'widget', 'configuration'],
  },
  {
    id: 'tool-4', category: 'Tooling', title: 'Dev Environment Ports & Proxies',
    description: 'Backend: 5555 (dotnet), Frontend: 5173 (Vite). Vite proxies /api and /hubs. Why port 5000 is reserved on Windows.',
    tags: ['ports', 'Vite', 'proxy', 'dev setup'],
  },
  // Security
  {
    id: 'sec-1', category: 'Security', title: 'Azure Read-Only Safety Rules',
    description: 'What KQL commands are allowed (read-only operators only). Never use .set, .drop, .delete in App Insights queries.',
    tags: ['Azure', 'KQL', 'safety', 'read-only'],
  },
  {
    id: 'sec-2', category: 'Security', title: 'JWT Security & Token Handling',
    description: 'Token storage (sessionStorage vs localStorage), refresh token flow, MSAL acquireTokenSilent, and session expiry handling.',
    tags: ['JWT', 'auth', 'MSAL', 'security'],
  },
]

const CATEGORIES: KnowledgeCategory[] = ['All', 'Runbooks', 'Architecture', 'DevOps', 'Best Practices', 'Onboarding', 'Tooling', 'Security']

const STORAGE_KEY = 'prodvista_knowledge_custom'

function loadCustomArticles(): KnowledgeArticle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveCustomArticles(articles: KnowledgeArticle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles))
}

// ---------------------------------------------------------------------------
// Add Article Modal
// ---------------------------------------------------------------------------

const BLANK_FORM = { title: '', description: '', category: 'Best Practices' as KnowledgeCategory, tags: '', url: '' }

function AddArticleModal({ onSave, onClose }: { onSave: (a: KnowledgeArticle) => void; onClose: () => void }) {
  const [form, setForm] = useState(BLANK_FORM)

  const handleSave = () => {
    if (!form.title.trim()) return
    const article: KnowledgeArticle = {
      id: `custom-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      url: form.url.trim() || undefined,
      isCustom: true,
    }
    onSave(article)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Add Knowledge Article</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Article title"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Brief description of the article"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as KnowledgeCategory }))}
              >
                {CATEGORIES.filter(c => c !== 'All').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma separated)</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="tag1, tag2"
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Link (optional)</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="https://..."
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Article
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Article Card
// ---------------------------------------------------------------------------

function ArticleCard({ article, onDelete }: { article: KnowledgeArticle; onDelete?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const colorClass = CATEGORY_COLORS[article.category] || 'bg-gray-100 text-gray-700'

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
              {article.category}
            </span>
            {article.isCustom && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Custom</span>
            )}
          </div>
          <h3 className="font-semibold text-gray-800 text-sm leading-tight">{article.title}</h3>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onDelete && (
            <button onClick={onDelete} className="text-gray-300 hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <button onClick={() => setExpanded(e => !e)} className="text-gray-300 hover:text-gray-500">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <>
          <p className="text-xs text-gray-500 leading-relaxed">{article.description}</p>
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {article.tags.map(tag => (
                <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-50 text-gray-400 border border-gray-100 rounded">
                  #{tag}
                </span>
              ))}
            </div>
          )}
          {article.author && <p className="text-xs text-gray-400">By {article.author}</p>}
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Open resource
            </a>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function KnowledgeCenterPage() {
  const [customArticles, setCustomArticles] = useState<KnowledgeArticle[]>(() => loadCustomArticles())
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<KnowledgeCategory>('All')
  const [showAddModal, setShowAddModal] = useState(false)

  const allArticles = useMemo(() => [...BUILT_IN_ARTICLES, ...customArticles], [customArticles])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return allArticles.filter(a => {
      const matchCat = activeCategory === 'All' || a.category === activeCategory
      const matchSearch = !q || a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))
      return matchCat && matchSearch
    })
  }, [allArticles, search, activeCategory])

  const handleAddArticle = (article: KnowledgeArticle) => {
    const updated = [...customArticles, article]
    setCustomArticles(updated)
    saveCustomArticles(updated)
  }

  const handleDeleteCustom = (id: string) => {
    const updated = customArticles.filter(a => a.id !== id)
    setCustomArticles(updated)
    saveCustomArticles(updated)
  }

  const countByCategory = useMemo(() => {
    const map: Partial<Record<KnowledgeCategory, number>> = {}
    for (const cat of CATEGORIES) {
      map[cat] = cat === 'All' ? allArticles.length : allArticles.filter(a => a.category === cat).length
    }
    return map
  }, [allArticles])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              Knowledge Center
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Team runbooks, architecture docs, and best practices</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Article
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            placeholder="Search articles, tags, descriptions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {ICONS[cat]}
              {cat}
              <span className={`ml-1 text-xs px-1 py-0.5 rounded ${activeCategory === cat ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                {countByCategory[cat] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No articles found</p>
            {search && <p className="text-xs mt-1">Try a different search term</p>}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(a => (
                <ArticleCard
                  key={a.id}
                  article={a}
                  onDelete={a.isCustom ? () => handleDeleteCustom(a.id) : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {showAddModal && (
        <AddArticleModal
          onSave={handleAddArticle}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
