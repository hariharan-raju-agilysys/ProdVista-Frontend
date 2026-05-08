# Azure AD Admin Consent Setup Guide

## Overview

When users sign into ProdVista and try to access Azure DevOps, Release Management, or other integrated features, they may see an "Approval required" dialog box:

```
ProdVista-Dashboard
This app requires your admin's approval to:

Have full access to Visual Studio Team Services REST APIs
Allow the application full access to the REST APIs provided by Visual Studio Team Services on behalf of the signed-in user
```

This is normal and expected. It means the Azure AD administrator needs to grant consent for the application to access these APIs.

## Why This Happens

ProdVista integrates with several enterprise services:
- **Azure DevOps** - Pull requests, build pipelines, release management
- **Microsoft Graph** - Calendar, meetings, user profile data
- **Azure Resource Manager** - Cloud resource discovery and management

These integrations require specific API permissions in Azure AD. The first time a user tries to access these features, Azure AD requires an administrator to review and approve the requested permissions.

## Solution: Grant Admin Consent (One-Time Setup)

This is a **one-time setup** done by your Azure AD administrator. After approval is granted, all users can use ProdVista without further prompts.

### Step-by-Step Instructions for Azure AD Admin

1. **Sign in to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with admin credentials

2. **Navigate to Enterprise Applications**
   - Click **Azure Active Directory** in the left sidebar
   - Select **Enterprise Applications**
   - Search for **"ProdVista-Dashboard"** (or the app name configured in your tenant)

3. **Grant Admin Consent**
   - Click on the **ProdVista-Dashboard** app
   - Go to the **Permissions** tab
   - Click **Grant admin consent for [Organization]**
   - Click **Yes** to confirm

4. **Verify Success**
   - You should see green checkmarks next to the permissions
   - The message will change to show when consent was granted

### After Consent is Granted

- All users in your organization can now sign into ProdVista
- They will NOT see the approval prompt again
- All integrated features (DevOps, calendar, etc.) will work seamlessly

## Required Permissions

When granting admin consent, ProdVista requests the following permissions:

### Azure DevOps REST API
- **Scope**: `Azure DevOps` / `VSTS.ReadWrite_Code`
- **Purpose**: Read pull requests, build pipelines, work items

### Microsoft Graph
- **Scope**: `User.Read`, `Calendars.Read`, `OnlineMeetings.Read`
- **Purpose**: View user profiles and calendar events

### Azure Management
- **Scope**: `Management.Read` (Azure Resource Manager)
- **Purpose**: Discover Azure subscriptions and resources

## Troubleshooting

### I granted consent but users still see the prompt

**Solution:** 
- Consent may take 5-15 minutes to propagate across Azure AD
- Ask users to **sign out and sign back in**
- Clear browser cache if needed

### I see "The user cannot consent" error

**Solution:**
- Your Azure AD policies may require specific admin roles
- Ensure the person granting consent is:
  - **Cloud Application Administrator**, OR
  - **Application Administrator**, OR
  - **Global Administrator**

### I don't see "ProdVista-Dashboard" in Enterprise Applications

**Solution:**
- The app might be registered under a different name (check with your IT team)
- Search for the exact **Application Name** (not display name) used in your tenant
- Alternatively, in **App Registrations**, you can grant consent from there

### Permission errors still occur after granting consent

**Solution:**
- Verify the app registration has the correct API permissions assigned
- Ensure the **Grant admin consent** button was actually clicked and confirmed
- Check Azure AD audit logs for any errors during consent grant

## For Users: If You See the Approval Dialog

If users encounter the approval dialog after your admin has granted consent, it usually means:

1. **Cache issue** - Sign out completely and sign back in
2. **New permission added** - A new feature was deployed requiring new permissions. Wait for your admin to approve, then try again
3. **Different user session** - The consent is per-tenant, all users should benefit

### Immediate Workaround for Users

If you need to access ProdVista immediately:

1. Click "Cancel" on the approval dialog
2. You can still use ProdVista's core features (dashboard, bug tracking, pull requests summaries)
3. Azure DevOps detailed views may not load, but will work after admin grants consent

## Configuration for IT/DevOps Teams

If you're configuring ProdVista for your organization:

### VITE Environment Variables
```
VITE_AZURE_CLIENT_ID=<your-app-client-id>
VITE_AZURE_TENANT_ID=<your-tenant-id>
VITE_REDIRECT_URI=https://your-domain/prodvista (or /your-path)
```

### Backend Configuration (appsettings.json)
```json
{
  "Azure": {
    "Authority": "https://login.microsoftonline.com/{tenant-id}",
    "ClientId": "{client-id}",
    "TenantId": "{tenant-id}"
  }
}
```

### API Permissions in Azure App Registration

In **Azure Portal → App Registrations → ProdVista-Dashboard → API Permissions**, ensure these are configured:

| API | Permission | Type | Admin Consent Required |
|-----|-----------|------|----------------------|
| Azure DevOps | `VSTS.ReadWrite_Code` | Delegated | ✅ Yes |
| Microsoft Graph | `User.Read` | Delegated | ❌ No |
| Microsoft Graph | `Calendars.Read` | Delegated | ❌ No |
| Microsoft Graph | `OnlineMeetings.Read` | Delegated | ❌ No |
| Azure Management | `user_impersonation` | Delegated | ⚠️ May require |

### Grant Admin Consent via PowerShell (Alternative)

If you prefer to automate the consent process:

```powershell
# Connect to Azure AD
Connect-AzureAD

# Grant admin consent for all users
$app = Get-AzureADApplication -Filter "displayName eq 'ProdVista-Dashboard'"
New-AzureADServiceAppRoleAssignment -ObjectId <service-principal-id> -PrincipalId <tenant-id> -Id <role-id>
```

## Support

If you encounter issues with admin consent:

1. **Check Azure AD audit logs** - Look for failed consent events
2. **Verify role assignments** - Ensure the person granting consent has appropriate Azure AD roles
3. **Review conditional access policies** - Some policies may block token acquisition
4. **Contact Microsoft Support** - For permission-related Azure AD issues

## Related Documentation

- [Microsoft Admin Consent Workflow](https://learn.microsoft.com/en-us/azure/active-directory/manage-apps/configure-user-consent)
- [Azure DevOps API Permissions](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth)
- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
