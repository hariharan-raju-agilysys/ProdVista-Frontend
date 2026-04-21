import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Shield, User, Eye, Search, ChevronDown,
  ChevronLeft, ChevronRight, MoreVertical, Check,
  X, AlertCircle, UserPlus, Clock, Mail, Building,
  Briefcase, Crown, RefreshCw
} from 'lucide-react'
import { useSettingsStore, useIsManager } from '../stores/settingsStore'
import { authService } from '../services/authService'
import { useAuth } from '../context/AuthContext'
import { getProfilePictureUrl } from '../utils/gravatar'

interface AppUser {
  id: string
  azureObjectId: string
  email: string
  displayName: string
  role: 'manager' | 'user' | 'viewer'
  isActive: boolean
  firstLoginAt: string
  lastLoginAt: string
  department?: string
  jobTitle?: string
  profilePictureUrl?: string
  promotedByUserId?: string
  promotedByUserName?: string
  promotedAt?: string
}

interface UserStats {
  totalUsers: number
  activeUsers: number
  admins: number
  managers: number
  users: number
  viewers: number
  newUsersToday: number
  activeToday: number
}

const roleConfig = {
  manager: { label: 'Manager', icon: Crown, color: 'purple', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400' },
  user: { label: 'User', icon: User, color: 'blue', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400' },
  viewer: { label: 'Viewer', icon: Eye, color: 'gray', bgColor: 'bg-gray-500/20', textColor: 'text-gray-400' },
  admin: { label: 'Admin', icon: Shield, color: 'yellow', bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-400' },
}

const API_BASE = import.meta.env.VITE_API_BASE_PATH || '/api'

export function UserManagement() {
  const { user: currentUser } = useAuth()
  const isManager = useIsManager() || currentUser?.role?.toLowerCase() === 'admin' || currentUser?.role?.toLowerCase() === 'manager'
  const { setUserRole } = useSettingsStore()
  const [users, setUsers] = useState<AppUser[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null)
  const [showRoleMenu, setShowRoleMenu] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!currentUser?.id) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        pageNumber: page.toString(),
        pageSize: '10',
        ...(searchTerm && { searchTerm }),
        ...(roleFilter && { roleFilter }),
        ...(statusFilter && { isActiveFilter: statusFilter === 'active' ? 'true' : 'false' }),
      })

      const response = await fetch(`${API_BASE}/users?${params}`, {
        headers: { 
          ...authService.getAuthHeaders(),
          'X-User-Id': currentUser.id 
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setTotalPages(data.totalPages)
      } else if (response.status === 403) {
        setError('You do not have permission to view users')
      } else {
        setError('Failed to load users')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setIsLoading(false)
    }
  }, [currentUser?.id, page, searchTerm, roleFilter, statusFilter])

  const fetchStats = useCallback(async () => {
    if (!currentUser?.id) return
    
    try {
      const response = await fetch(`${API_BASE}/users/stats`, {
        headers: { 
          ...authService.getAuthHeaders(),
          'X-User-Id': currentUser.id 
        },
      })

      if (response.ok) {
        setStats(await response.json())
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [currentUser?.id])

  useEffect(() => {
    fetchUsers()
    fetchStats()
  }, [fetchUsers, fetchStats])

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!currentUser?.id) return
    
    try {
      const response = await fetch(`${API_BASE}/users/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
          'X-User-Id': currentUser.id,
        },
        body: JSON.stringify({ userId, newRole }),
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(users.map(u => u.id === userId ? updatedUser : u))
        setShowRoleMenu(null)
        
        // Update local store if current user's role changed
        if (updatedUser.id === currentUser.id) {
          setUserRole({
            role: updatedUser.role,
            permissions: updatedUser.role === 'manager' || updatedUser.role === 'admin'
              ? ['view', 'edit', 'configure'] 
              : updatedUser.role === 'user' 
                ? ['view', 'edit'] 
                : ['view']
          })
        }
        
        fetchStats()
      } else {
        const error = await response.json()
        setError(error.message || 'Failed to update role')
      }
    } catch (err) {
      setError('Failed to update role')
    }
  }

  const handleStatusChange = async (userId: string, isActive: boolean) => {
    if (!currentUser?.id) return
    
    try {
      const response = await fetch(`${API_BASE}/users/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authService.getAuthHeaders(),
          'X-User-Id': currentUser.id,
        },
        body: JSON.stringify({ userId, isActive }),
      })

      if (response.ok) {
        const updatedUser = await response.json()
        setUsers(users.map(u => u.id === userId ? updatedUser : u))
        fetchStats()
      } else {
        const error = await response.json()
        setError(error.message || 'Failed to update status')
      }
    } catch (err) {
      setError('Failed to update status')
    }
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-800 rounded-xl p-8 border border-gray-700 text-center"
          >
            <Shield className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Manager Access Required</h2>
            <p className="text-gray-400">Only managers can access user management.</p>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-400" />
                User Management
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">Manage user access and roles</p>
            </div>
            <button
              onClick={() => { fetchUsers(); fetchStats(); }}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-5 gap-4 mb-8"
          >
            {[
              { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'blue' },
              { label: 'Admins', value: stats.admins, icon: Shield, color: 'yellow' },
              { label: 'Managers', value: stats.managers, icon: Crown, color: 'purple' },
              { label: 'Active Today', value: stats.activeToday, icon: Clock, color: 'green' },
              { label: 'New Today', value: stats.newUsersToday, icon: UserPlus, color: 'emerald' },
            ].map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-lg bg-${stat.color}-500/20`}>
                    <stat.icon className={`w-6 h-6 text-${stat.color}-400`} />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email or department..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:border-purple-500 outline-none"
              />
            </div>
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:border-purple-500 outline-none"
            >
              <option value="">All Roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="user">Users</option>
              <option value="viewer">Viewers</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:border-purple-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </motion.div>

        {/* Users Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">User</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">Role</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">Last Active</th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-gray-600 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user, index) => {
                  const role = roleConfig[user.role] || roleConfig['user']
                  const RoleIcon = role.icon
                  const isCurrentUser = user.id === currentUser?.id
                  
                  return (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={getProfilePictureUrl({ 
                              profilePictureUrl: user.profilePictureUrl, 
                              email: user.email, 
                              displayName: user.displayName,
                              size: 40 
                            })}
                            alt={user.displayName}
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 hidden items-center justify-center text-purple-400 font-medium">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-gray-900 dark:text-white font-medium">{user.displayName}</p>
                              {isCurrentUser && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded">You</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </span>
                              {user.department && (
                                <span className="flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  {user.department}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="relative">
                          <button
                            onClick={() => setShowRoleMenu(showRoleMenu === user.id ? null : user.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${role.bgColor} ${role.textColor} transition-colors hover:opacity-80`}
                          >
                            <RoleIcon className="w-4 h-4" />
                            {role.label}
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          
                          <AnimatePresence>
                            {showRoleMenu === user.id && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden"
                              >
                                {Object.entries(roleConfig).map(([roleKey, config]) => {
                                  const Icon = config.icon
                                  return (
                                    <button
                                      key={roleKey}
                                      onClick={() => handleRoleChange(user.id, roleKey)}
                                      disabled={roleKey === user.role}
                                      className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                                        roleKey === user.role 
                                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed' 
                                          : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                      }`}
                                    >
                                      <Icon className={`w-4 h-4 ${config.textColor}`} />
                                      {config.label}
                                      {roleKey === user.role && <Check className="w-4 h-4 ml-auto" />}
                                    </button>
                                  )
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        
                        {user.promotedByUserName && (
                          <p className="text-xs text-gray-500 mt-1">
                            Promoted by {user.promotedByUserName}
                          </p>
                        )}
                      </td>
                      
                      <td className="px-6 py-4">
                        <button
                          onClick={() => !isCurrentUser && handleStatusChange(user.id, !user.isActive)}
                          disabled={isCurrentUser}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
                            user.isActive
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          } ${isCurrentUser ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80'}`}
                        >
                          {user.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                          {user.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900 dark:text-white">
                            {new Date(user.lastLoginAt).toLocaleDateString()}
                          </p>
                          <p className="text-gray-500">
                            {new Date(user.lastLoginAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* User Detail Modal */}
        <AnimatePresence>
          {selectedUser && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setSelectedUser(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 w-full max-w-md"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <img
                      src={getProfilePictureUrl({ 
                        profilePictureUrl: selectedUser.profilePictureUrl, 
                        email: selectedUser.email, 
                        displayName: selectedUser.displayName,
                        size: 64 
                      })}
                      alt={selectedUser.displayName}
                      className="w-16 h-16 rounded-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        e.currentTarget.nextElementSibling?.classList.remove('hidden')
                      }}
                    />
                    <div className="w-16 h-16 rounded-full bg-purple-500/20 hidden items-center justify-center text-purple-400 text-2xl font-medium">
                      {selectedUser.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{selectedUser.displayName}</h3>
                      <p className="text-gray-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-400">Role</p>
                      <p className="text-white capitalize">{selectedUser.role}</p>
                    </div>
                    <div className="p-3 bg-gray-900 rounded-lg">
                      <p className="text-sm text-gray-400">Status</p>
                      <p className={selectedUser.isActive ? 'text-green-400' : 'text-red-400'}>
                        {selectedUser.isActive ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>

                  {selectedUser.department && (
                    <div className="p-3 bg-gray-900 rounded-lg flex items-center gap-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Department</p>
                        <p className="text-white">{selectedUser.department}</p>
                      </div>
                    </div>
                  )}

                  {selectedUser.jobTitle && (
                    <div className="p-3 bg-gray-900 rounded-lg flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-400">Job Title</p>
                        <p className="text-white">{selectedUser.jobTitle}</p>
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-gray-900 rounded-lg flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-400">First Login</p>
                      <p className="text-white">
                        {new Date(selectedUser.firstLoginAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {selectedUser.promotedByUserName && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                      <p className="text-sm text-purple-400">
                        Promoted to {selectedUser.role} by {selectedUser.promotedByUserName}
                        {selectedUser.promotedAt && (
                          <span className="text-purple-300 ml-1">
                            on {new Date(selectedUser.promotedAt).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default UserManagement
