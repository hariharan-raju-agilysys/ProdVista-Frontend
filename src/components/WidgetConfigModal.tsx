import { useState, useEffect, useMemo } from 'react';
import { X, Search, Sparkles, Save, RotateCcw, Calendar, Building } from 'lucide-react';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface WidgetConfig {
  key: string;
  title: string;
  icon: string;
  column: number;
  order: number;
  enabled: boolean;
  size: 'normal' | 'large';
  subtitle?: string;
  fieldMappings?: Record<string, string>;
}

interface WidgetConfigModalProps {
  isOpen: boolean;
  widget: WidgetConfig | null;
  onClose: () => void;
  onSave: (widget: WidgetConfig) => void;
  onAiSuggest?: (widget: WidgetConfig) => Promise<Partial<WidgetConfig>>;
}

// ─────────────────────────────────────────
// Icon Categories with Common Emojis
// ─────────────────────────────────────────

const ICON_CATEGORIES = {
  'People & Birthdays': ['🎂', '🎉', '🎈', '🎁', '👤', '👥', '👨‍💼', '👩‍💼', '🧑‍💻', '👶', '🎊', '🥳', '🍰', '🕯️', '📅'],
  'Development': ['💻', '🔧', '⚙️', '🛠️', '🔨', '📊', '📈', '📉', '🔀', '🔃', '🔄', '🚀', '⚡', '🐛', '🐞', '✅', '❌', '⚠️', '🧪', '📦'],
  'Business': ['📋', '📁', '📂', '📄', '📑', '🗂️', '💼', '🏢', '🏭', '💰', '💵', '💳', '📊', '📈', '🎯', '🏆', '⭐', '🌟'],
  'Communication': ['📧', '📨', '📩', '📬', '📭', '📮', '💬', '💭', '🗨️', '📞', '📱', '☎️', '📣', '📢', '🔔', '🔕'],
  'Status': ['✅', '❌', '⚠️', '❓', '❗', '💡', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚪', '⚫', '🔒', '🔓', '🔑'],
  'Time & Calendar': ['📅', '📆', '🗓️', '⏰', '⏱️', '⏲️', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '📍', '🗺️', '🌍'],
  'Misc': ['🔍', '🔎', '🔗', '📌', '📍', '🏷️', '🎨', '🖼️', '📷', '🎬', '🎵', '🎮', '💎', '🧩', '🌈', '☀️', '🌙', '⭐'],
};

// ─────────────────────────────────────────
// Field Mapping Options (for widgets like Birthdays)
// ─────────────────────────────────────────

const FIELD_MAPPING_OPTIONS: Record<string, { label: string; icon: React.ReactNode; fields: { key: string; label: string; description: string }[] }> = {
  birthdays: {
    label: 'Birthday Widget Fields',
    icon: <Calendar className="w-4 h-4" />,
    fields: [
      { key: 'dateOfBirth', label: 'Date of Birth', description: 'The birthday date field' },
      { key: 'name', label: 'Name', description: 'Person\'s display name' },
      { key: 'department', label: 'Department', description: 'Their department/team' },
      { key: 'role', label: 'Role/Title', description: 'Job title or role' },
      { key: 'email', label: 'Email', description: 'Contact email' },
    ],
  },
  customers: {
    label: 'Customer Widget Fields',
    icon: <Building className="w-4 h-4" />,
    fields: [
      { key: 'customerName', label: 'Customer Name', description: 'Company or customer name' },
      { key: 'contractDate', label: 'Contract Date', description: 'When contract started' },
      { key: 'status', label: 'Status', description: 'Active/Inactive status' },
    ],
  },
};

// ─────────────────────────────────────────
// AI Suggestions (mock - can connect to backend)
// ─────────────────────────────────────────

const getAiSuggestions = async (widget: WidgetConfig): Promise<Partial<WidgetConfig>> => {
  // Simulated AI suggestions based on widget key
  const suggestions: Record<string, Partial<WidgetConfig>> = {
    birthdays: { 
      title: 'Team Birthdays 🎉', 
      subtitle: 'Upcoming celebrations',
      icon: '🎂' 
    },
    branches: { 
      title: 'Active Branches', 
      subtitle: 'Current development branches',
      icon: '🔀' 
    },
    prs: { 
      title: 'Pull Requests', 
      subtitle: 'Open PRs awaiting review',
      icon: '🔄' 
    },
    commits: { 
      title: 'Recent Commits', 
      subtitle: 'Team commit activity',
      icon: '📊' 
    },
    jenkinsBuilds: { 
      title: 'Jenkins Pipelines', 
      subtitle: 'Build status & history',
      icon: '🔧' 
    },
    knowledge: { 
      title: 'Knowledge Base', 
      subtitle: 'Shared resources & docs',
      icon: '📚' 
    },
    customers: { 
      title: 'Customer Portfolio', 
      subtitle: 'Active deployments',
      icon: '🏢' 
    },
    support: { 
      title: 'Support Tickets', 
      subtitle: 'Open issues & requests',
      icon: '🎫' 
    },
    builds: { 
      title: 'Today\'s Builds', 
      subtitle: 'CI/CD pipeline status',
      icon: '🏗️' 
    },
  };
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return suggestions[widget.key] || { 
    title: `${widget.key.charAt(0).toUpperCase() + widget.key.slice(1)} Widget`,
    icon: '📊' 
  };
};

// ─────────────────────────────────────────
// Icon Picker Component
// ─────────────────────────────────────────

function IconPicker({ 
  selectedIcon, 
  onSelect,
  isOpen,
  onToggle 
}: { 
  selectedIcon: string; 
  onSelect: (icon: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('People & Birthdays');

  const filteredIcons = useMemo(() => {
    if (!search) return ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES] || [];
    
    // Search across all categories
    const allIcons = Object.values(ICON_CATEGORIES).flat();
    return allIcons.filter(icon => icon.includes(search));
  }, [search, activeCategory]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <span className="text-2xl">{selectedIcon}</span>
        <span className="text-xs text-gray-500">Change Icon</span>
      </button>
    );
  }

  return (
    <div className="absolute top-0 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Select Icon</h4>
        <button onClick={onToggle} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>
      
      {/* Search */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search icons..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      {/* Categories */}
      {!search && (
        <div className="flex flex-wrap gap-1 mb-3">
          {Object.keys(ICON_CATEGORIES).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Icons Grid */}
      <div className="grid grid-cols-10 gap-1 max-h-40 overflow-y-auto">
        {filteredIcons.map((icon, i) => (
          <button
            key={`${icon}-${i}`}
            onClick={() => {
              onSelect(icon);
              onToggle();
            }}
            className={`text-xl p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              selectedIcon === icon ? 'bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Modal Component
// ─────────────────────────────────────────

export function WidgetConfigModal({ isOpen, widget, onClose, onSave, onAiSuggest }: WidgetConfigModalProps) {
  const [editedWidget, setEditedWidget] = useState<WidgetConfig | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize edited widget when modal opens
  useEffect(() => {
    if (widget) {
      setEditedWidget({ ...widget });
      setHasChanges(false);
    }
  }, [widget]);

  if (!isOpen || !editedWidget) return null;

  const updateField = (field: keyof WidgetConfig, value: unknown) => {
    setEditedWidget(prev => prev ? { ...prev, [field]: value } : null);
    setHasChanges(true);
  };

  const handleAiSuggest = async () => {
    if (!editedWidget) return;
    setAiLoading(true);
    try {
      const suggestions = onAiSuggest 
        ? await onAiSuggest(editedWidget)
        : await getAiSuggestions(editedWidget);
      
      setEditedWidget(prev => prev ? { ...prev, ...suggestions } : null);
      setHasChanges(true);
    } catch (error) {
      console.error('AI suggestion failed:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = () => {
    if (editedWidget) {
      onSave(editedWidget);
      onClose();
    }
  };

  const handleReset = () => {
    if (widget) {
      setEditedWidget({ ...widget });
      setHasChanges(false);
    }
  };

  const fieldMappingConfig = FIELD_MAPPING_OPTIONS[editedWidget.key];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{editedWidget.icon}</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configure Widget</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{editedWidget.key}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* AI Suggest Button */}
          <button
            onClick={handleAiSuggest}
            disabled={aiLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 transition-all"
          >
            <Sparkles className={`w-4 h-4 ${aiLoading ? 'animate-spin' : ''}`} />
            {aiLoading ? 'Getting AI Suggestions...' : '✨ Auto-fill with AI Suggestions'}
          </button>

          {/* Icon Picker */}
          <div className="relative">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Widget Icon</label>
            <IconPicker
              selectedIcon={editedWidget.icon}
              onSelect={(icon) => updateField('icon', icon)}
              isOpen={showIconPicker}
              onToggle={() => setShowIconPicker(!showIconPicker)}
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={editedWidget.title}
              onChange={e => updateField('title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Widget title..."
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Subtitle (optional)</label>
            <input
              type="text"
              value={editedWidget.subtitle || ''}
              onChange={e => updateField('subtitle', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Brief description..."
            />
          </div>

          {/* Size */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Widget Size</label>
            <div className="flex gap-2">
              {(['normal', 'large'] as const).map(size => (
                <button
                  key={size}
                  onClick={() => updateField('size', size)}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                    editedWidget.size === size
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Field Mappings (for specific widgets) */}
          {fieldMappingConfig && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                {fieldMappingConfig.icon}
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{fieldMappingConfig.label}</label>
              </div>
              <div className="space-y-2">
                {fieldMappingConfig.fields.map(field => (
                  <div key={field.key} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">{field.label}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{field.description}</p>
                    </div>
                    <select
                      value={editedWidget.fieldMappings?.[field.key] || field.key}
                      onChange={e => {
                        const mappings = { ...editedWidget.fieldMappings, [field.key]: e.target.value };
                        updateField('fieldMappings', mappings);
                      }}
                      className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value={field.key}>{field.key}</option>
                      <option value="dob">dob</option>
                      <option value="birthday">birthday</option>
                      <option value="birthDate">birthDate</option>
                      <option value="dateOfBirth">dateOfBirth</option>
                      <option value="displayName">displayName</option>
                      <option value="fullName">fullName</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column & Order */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Column</label>
              <select
                value={editedWidget.column}
                onChange={e => updateField('column', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={0}>Left</option>
                <option value={1}>Right</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Order</label>
              <input
                type="number"
                value={editedWidget.order}
                onChange={e => updateField('order', parseInt(e.target.value) || 0)}
                min={0}
                max={20}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WidgetConfigModal;
