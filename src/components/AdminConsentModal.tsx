import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

/**
 * Global Admin Consent Required Modal
 * Displays when Azure AD requires admin approval for the app
 */
export function AdminConsentModal() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleAdminConsentRequired = () => {
      setIsOpen(true)
    }

    window.addEventListener('auth:admin-consent-required', handleAdminConsentRequired)
    return () => {
      window.removeEventListener('auth:admin-consent-required', handleAdminConsentRequired)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-red-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 flex items-start justify-between border-b border-red-100">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <h2 className="text-lg font-bold text-red-900">Admin Approval Required</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            ProdVista requires your Azure AD administrator to approve access to organizational resources.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-900 uppercase tracking-widest">Steps to Fix:</p>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Sign in to Azure Portal</li>
              <li>Go to <strong>Azure Active Directory</strong></li>
              <li>Select <strong>Enterprise Applications</strong></li>
              <li>Find <strong>ProdVista-Dashboard</strong></li>
              <li>Go to <strong>Permissions</strong> tab</li>
              <li>Click <strong>Grant admin consent</strong></li>
              <li>Confirm the approval</li>
            </ol>
          </div>

          <p className="text-xs text-gray-600">
            After approval is granted, sign out and sign back in to ProdVista.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              <strong>Need help?</strong> Contact your IT administrator with this message: "Please grant admin consent for ProdVista-Dashboard in Azure AD Enterprise Applications"
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-3 bg-gray-50 rounded-b-2xl flex gap-2 border-t border-gray-100">
          <button
            onClick={() => setIsOpen(false)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              window.location.href = 'https://portal.azure.com/#blade/Microsoft_AAD_IAM/StartboardBlade'
              setIsOpen(false)
            }}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
          >
            Open Azure Portal
          </button>
        </div>
      </div>
    </div>
  )
}
