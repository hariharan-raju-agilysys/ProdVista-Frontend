import { useState, useEffect } from 'react'
import { GitBranch, Plus, Trash2, AlertTriangle, CheckCircle2, HelpCircle, Save, X, Loader2 } from 'lucide-react'
import {
  getReleaseBranches,
  upsertReleaseBranch,
  deleteReleaseBranch,
  reportBranchUnavailable,
  markBranchAvailable,
  type ReleaseBranch,
  type UpsertReleaseBranchRequest,
} from '../services/releaseBranchService'
import { useAuth } from '../context/AuthContext'

const branchTypeColors: Record<string, string> = {
  Main: 'bg-blue-100 text-blue-800',
  Hotfix: 'bg-orange-100 text-orange-800',
  Custom: 'bg-purple-100 text-purple-800',
}

const availabilityIcons: Record<string, JSX.Element> = {
  Available: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  Unavailable: <AlertTriangle className="w-4 h-4 text-red-500" />,
  Unknown: <HelpCircle className="w-4 h-4 text-gray-400" />,
}

const emptyForm: UpsertReleaseBranchRequest = {
  name: '',
  branchType: 'Main',
  branchName: '',
  version: '',
  description: '',
  sortOrder: 0,
}

export default function ReleaseBranchSetupPage() {
  const { isManager } = useAuth()
  const [branches, setBranches] = useState<ReleaseBranch[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UpsertReleaseBranchRequest>({ ...emptyForm })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  const loadBranches = async () => {
    setLoading(true)
    try {
      const data = await getReleaseBranches()
      setBranches(data)
    } catch {
      setToast({ message: 'Failed to load branch configurations', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.branchName.trim()) {
      setToast({ message: 'Name and Branch Name are required', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const saved = await upsertReleaseBranch({
        ...form,
        id: editingId || undefined,
        sortOrder: form.sortOrder || branches.length,
      })
      if (editingId) {
        setBranches(prev => prev.map(b => b.id === editingId ? saved : b))
      } else {
        setBranches(prev => [...prev, saved])
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ ...emptyForm })
      setToast({ message: editingId ? 'Branch config updated' : 'Branch config created', type: 'success' })
    } catch {
      setToast({ message: 'Failed to save branch configuration', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this branch configuration?')) return
    try {
      await deleteReleaseBranch(id)
      setBranches(prev => prev.filter(b => b.id !== id))
      setToast({ message: 'Branch config removed', type: 'success' })
    } catch {
      setToast({ message: 'Failed to remove branch', type: 'error' })
    }
  }

  const handleReportUnavailable = async (id: string) => {
    try {
      const result = await reportBranchUnavailable(id)
      setBranches(prev => prev.map(b => b.id === id ? { ...b, availability: 'Unavailable' as const } : b))
      setToast({ message: result.message, type: 'success' })
    } catch {
      setToast({ message: 'Failed to report branch', type: 'error' })
    }
  }

  const handleMarkAvailable = async (id: string) => {
    try {
      await markBranchAvailable(id)
      setBranches(prev => prev.map(b => b.id === id ? { ...b, availability: 'Available' as const, reportedByUser: undefined } : b))
      setToast({ message: 'Branch marked as available', type: 'success' })
    } catch {
      setToast({ message: 'Failed to update branch', type: 'error' })
    }
  }

  const startEdit = (branch: ReleaseBranch) => {
    setForm({
      name: branch.name,
      branchType: branch.branchType,
      branchName: branch.branchName,
      version: branch.version || '',
      description: branch.description || '',
      sortOrder: branch.sortOrder,
    })
    setEditingId(branch.id)
    setShowForm(true)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-blue-600" />
            Release Branch Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure release branches for the current release cycle. Users can report unavailable branches to notify managers.
          </p>
        </div>
        {isManager && (
          <button
            onClick={() => { setForm({ ...emptyForm }); setEditingId(null); setShowForm(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">
                {editingId ? 'Edit Branch Config' : 'Add Branch Config'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Main Release, Hotfix 26.2.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Type</label>
                <select
                  value={form.branchType}
                  onChange={e => setForm(f => ({ ...f, branchType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Main">Main</option>
                  <option value="Hotfix">Hotfix</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch Name *</label>
                <input
                  value={form.branchName}
                  onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))}
                  placeholder="e.g., Develop, Release 26.2.1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <input
                    value={form.version || ''}
                    onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                    placeholder="26.2.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  value={form.description || ''}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., Kalahari_WB customer hotfix"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading branch configurations...</p>
        </div>
      ) : branches.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <GitBranch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 font-medium">No Release Branches Configured</p>
          <p className="text-sm text-gray-400 mt-1">
            {isManager ? 'Add your first release branch configuration to get started.' : 'Ask a manager to set up release branches.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map(branch => (
            <div key={branch.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GitBranch className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{branch.name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${branchTypeColors[branch.branchType] || 'bg-gray-100 text-gray-600'}`}>
                        {branch.branchType}
                      </span>
                      {availabilityIcons[branch.availability]}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-sm text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono">{branch.branchName}</code>
                      {branch.version && <span className="text-xs text-gray-500">v{branch.version}</span>}
                      {branch.description && <span className="text-xs text-gray-400">— {branch.description}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Report Unavailable / Mark Available buttons */}
                  {branch.availability !== 'Unavailable' ? (
                    <button
                      onClick={() => handleReportUnavailable(branch.id)}
                      className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      title="Report this branch as not available in the repo"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Not Available
                    </button>
                  ) : (
                    <>
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                        Reported by {branch.reportedByUser}
                      </span>
                      {isManager && (
                        <button
                          onClick={() => handleMarkAvailable(branch.id)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Mark Available
                        </button>
                      )}
                    </>
                  )}

                  {/* Edit / Delete (manager only) */}
                  {isManager && (
                    <>
                      <button
                        onClick={() => startEdit(branch)}
                        className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(branch.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 pl-8">
                <span>Created by {branch.createdByDisplayName}</span>
                <span>{new Date(branch.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
