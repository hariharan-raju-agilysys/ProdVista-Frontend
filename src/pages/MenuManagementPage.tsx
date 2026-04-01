import { useState, useEffect, useCallback } from 'react'
import { Reorder } from 'framer-motion'
import {
  GripVertical, Pencil, Eye, EyeOff, Plus, Check, X, Loader2,
  LayoutDashboard, Code2, Package, Bug, Server, Users, FileText, Settings, GitBranch,
  Activity, Brain, Cloud, Shield, Zap, BarChart3, Terminal, Palette, Globe, Cpu
} from 'lucide-react'
import { useMenuStore, type SideMenuItemDto } from '../store/menuStore'

// ==========================================
// Icon Registry
// ==========================================

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Code2, Package, Bug, Server, Users, FileText, Settings, GitBranch,
  Activity, Brain, Cloud, Shield, Zap, BarChart3, Terminal, Palette, Globe, Cpu, GripVertical,
}

const AVAILABLE_ICONS = Object.keys(ICON_MAP)

function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name] || LayoutDashboard
  return <Icon className={className} />
}

// ==========================================
// Main Component
// ==========================================

export default function MenuManagementPage() {
  const { menuItems, loadNavigation, updateMenuItem, createMenuItem, isLoading } = useMenuStore()
  const [items, setItems] = useState<SideMenuItemDto[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (menuItems.length === 0) {
      loadNavigation()
    }
  }, [loadNavigation, menuItems.length])

  useEffect(() => {
    setItems([...menuItems].sort((a, b) => a.displayOrder - b.displayOrder))
  }, [menuItems])

  const handleReorder = useCallback(async (reordered: SideMenuItemDto[]) => {
    setItems(reordered)
    setSaving(true)
    try {
      // Update display order for each item based on new position
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].displayOrder !== i) {
          await updateMenuItem(reordered[i].id, { displayOrder: i })
        }
      }
    } catch {
      // Revert on error
      setItems([...menuItems].sort((a, b) => a.displayOrder - b.displayOrder))
    } finally {
      setSaving(false)
    }
  }, [menuItems, updateMenuItem])

  const handleToggleVisibility = async (item: SideMenuItemDto) => {
    await updateMenuItem(item.id, { isActive: !item.isActive })
    await loadNavigation()
  }

  const handleSaveEdit = async (id: string, updates: Partial<SideMenuItemDto>) => {
    await updateMenuItem(id, updates)
    setEditingId(null)
    await loadNavigation()
  }

  const handleAddItem = async (newItem: Partial<SideMenuItemDto>) => {
    await createMenuItem({
      name: newItem.name || 'New Item',
      href: newItem.href || '/new',
      icon: newItem.icon || 'LayoutDashboard',
      displayOrder: items.length,
      category: newItem.category || 'main',
      requiredRole: newItem.requiredRole || 'user',
      description: '',
    })
    setShowAdd(false)
    await loadNavigation()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Menu Management</h1>
          <p className="text-slate-400 text-sm mt-1">Drag to reorder, click to edit, toggle visibility</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-blue-400 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>}
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* Add Item Form */}
      {showAdd && (
        <AddItemForm onAdd={handleAddItem} onCancel={() => setShowAdd(false)} />
      )}

      {/* Reorderable List */}
      <Reorder.Group axis="y" values={items} onReorder={handleReorder} className="space-y-1.5">
        {items.map(item => (
          <Reorder.Item key={item.id} value={item}>
            {editingId === item.id ? (
              <EditableMenuItem
                item={item}
                onSave={(updates) => handleSaveEdit(item.id, updates)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                item.isActive
                  ? 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/50'
                  : 'bg-slate-900/30 border-slate-800/30 opacity-50'
              }`}>
                <GripVertical className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <div className={`p-1.5 rounded-md ${item.isActive ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}>
                  <MenuIcon name={item.icon} className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${item.isActive ? 'text-white' : 'text-slate-500'}`}>{item.name}</span>
                  <span className="text-xs text-slate-600 ml-2">{item.href}</span>
                </div>
                <div className="flex items-center gap-1">
                  {item.isSystemDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500">System</span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500">{item.category}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingId(item.id) }}
                    className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleVisibility(item) }}
                    className="p-1.5 rounded hover:bg-slate-700/50 text-slate-500 hover:text-white transition-colors"
                    title={item.isActive ? 'Hide' : 'Show'}
                  >
                    {item.isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </Reorder.Item>
        ))}
      </Reorder.Group>

      {items.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No menu items configured</p>
          <button onClick={() => setShowAdd(true)} className="mt-2 text-blue-400 hover:text-blue-300 text-sm">
            Add your first menu item
          </button>
        </div>
      )}
    </div>
  )
}

// ==========================================
// Editable Menu Item
// ==========================================

function EditableMenuItem({ item, onSave, onCancel }: {
  item: SideMenuItemDto
  onSave: (updates: Partial<SideMenuItemDto>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(item.name)
  const [icon, setIcon] = useState(item.icon)
  const [category, setCategory] = useState(item.category)
  const [requiredRole, setRequiredRole] = useState(item.requiredRole)
  const [showIconPicker, setShowIconPicker] = useState(false)

  return (
    <div className="bg-slate-800 border border-blue-500/50 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Icon Picker */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="p-2 rounded-md bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            <MenuIcon name={icon} className="w-4 h-4" />
          </button>
          {showIconPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-xl grid grid-cols-5 gap-1 w-56">
              {AVAILABLE_ICONS.map(iconName => (
                <button
                  key={iconName}
                  onClick={() => { setIcon(iconName); setShowIconPicker(false) }}
                  className={`p-2 rounded hover:bg-slate-700 transition-colors ${icon === iconName ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400'}`}
                  title={iconName}
                >
                  <MenuIcon name={iconName} className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          autoFocus
        />

        {/* Category */}
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="main">Main</option>
          <option value="manager">Manager</option>
          <option value="tools">Tools</option>
        </select>

        {/* Role */}
        <select
          value={requiredRole}
          onChange={e => setRequiredRole(e.target.value)}
          className="bg-slate-900/50 border border-slate-600/50 rounded px-2 py-1.5 text-xs text-white focus:outline-none"
        >
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>

        {/* Actions */}
        <button onClick={() => onSave({ name, icon, category, requiredRole })} className="p-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={onCancel} className="p-1.5 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ==========================================
// Add Item Form
// ==========================================

function AddItemForm({ onAdd, onCancel }: {
  onAdd: (item: Partial<SideMenuItemDto>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [href, setHref] = useState('/')
  const [icon, setIcon] = useState('LayoutDashboard')
  const [category, setCategory] = useState('main')

  return (
    <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-4 mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Menu item name"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Path</label>
          <input value={href} onChange={e => setHref(e.target.value)} placeholder="/path"
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Icon</label>
          <select value={icon} onChange={e => setIcon(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none">
            {AVAILABLE_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-600/50 rounded px-3 py-2 text-sm text-white focus:outline-none">
            <option value="main">Main</option>
            <option value="manager">Manager</option>
            <option value="tools">Tools</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-slate-400 text-sm hover:text-white">Cancel</button>
        <button onClick={() => onAdd({ name, href, icon, category })} disabled={!name}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50">
          Add Item
        </button>
      </div>
    </div>
  )
}
