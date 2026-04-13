import { LogIn, Clock, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SessionExpiredModalProps {
  isOpen: boolean
  onClose?: () => void
  message?: string
}

/**
 * Modal shown when user's session has expired
 * Provides a clean re-login experience without jarring redirect
 */
export function SessionExpiredModal({ 
  isOpen, 
  onClose,
  message = 'Your session has expired. Please log in again to continue.'
}: SessionExpiredModalProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleLogin = () => {
    onClose?.()
    navigate('/login', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop — no dismiss on click; user must click Log In Again */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-8 text-center">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Session Expired</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg mb-6">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {message}
            </p>
          </div>

          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            For your security, sessions expire after a period of inactivity. 
            Your work has been saved automatically.
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
          >
            <LogIn className="w-5 h-5" />
            Log In Again
          </button>
        </div>
      </div>
    </div>
  )
}

export default SessionExpiredModal
