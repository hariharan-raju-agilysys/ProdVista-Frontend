# ProdVista Frontend — Engineering Command Center UI

## Product Overview

ProdVista is a **multi-tenant Engineering Command Center** that gives software teams a single, real-time view across their entire delivery pipeline — from sprint planning and code quality through CI/CD, cloud infrastructure, and customer deployments. The frontend is a modern React application that serves as the interactive layer for all ProdVista capabilities.

Built at **Agilysys** for the VisualOne PMS engineering organization, the frontend delivers a polished, dark-mode-first experience with drag-and-drop dashboards, AI-powered assistants, and deep integrations with Azure DevOps, Jenkins, Application Insights, Salesforce, and more.

## Purpose

Engineering managers and individual contributors both need different views of the same underlying data. ProdVista's frontend solves this with:

- **Role-aware dashboards** — Managers see team efficiency, release readiness, and cross-project metrics; developers see their open work items, PRs, and build status
- **Dynamic page builder** — Create custom dashboard pages with configurable widgets, shareable via slug-based URLs
- **Real-time updates** — SignalR connections keep every widget current without manual refresh
- **AI chat & query** — Ask natural language questions about your bugs, infrastructure, or codebase and get instant answers
- **Azure AD SSO** — One-click sign-in via Microsoft identity with automatic token refresh

## Current Release — v3.0

### Dashboard System
- Fully customizable drag-and-drop dashboard pages with grid-based widget layout
- Slug-routed dynamic pages — each team can have their own URL (`/p/team-alpha`)
- Pre-built widget templates for common engineering metrics
- Widget configuration editor with live preview
- Dashboard template gallery for quick page creation
- Menu management — admins can customize sidebar navigation per tenant

### Engineering & Quality
- Quality dashboard with 5 tabs — Overview, My Items, Sprints, Team, Search
- Work item detail modal with 4 tabs — Details, Commits, Images, Related
- Team tab with expandable developer rows showing individual work items
- Right-click context menu on work items — Copy as HTML, Copy as CSV, Open in DevOps
- Sprint progress tracking with burndown visualization
- Pull request dashboard with review status and merge timelines
- Developer productivity metrics — commits, PRs, review turnaround

### Release & DevOps
- Release notes generator — auto-populates from Azure DevOps work items into DOCX templates
- Release branch management with visual pipeline status
- Jenkins pipeline monitoring — view builds, trigger jobs, track history
- DevOps overview with connection management (PAT or SSO based)

### Observability
- Azure Application Insights query interface with validated KQL execution
- Exception analysis with correlation and root-cause grouping
- Log dashboard with structured search and filtering
- Azure resource explorer with health status visualization

### AI Features
- AI Chat page with streaming responses via SignalR
- AI Query Assistant — type natural language, get SQL results from your databases
- AI-powered data predictions and trend analysis
- Per-tenant LLM provider configuration (Azure OpenAI, Ollama, Anthropic)

### Integrations & Admin
- Salesforce CRM sync and customer data display
- HR Portal with employee and department management
- Database query widgets — connect to any SQL Server, write queries, display results on dashboards
- MCP Tools page — registry and execution of Model Context Protocol tools
- Automation jobs — schedule and monitor recurring background tasks
- Tenant admin panel with feature flags, branding, and user management
- User profile with settings, preferences, and theme customization

### UX & Platform
- Dark mode with branded splash screen and theme persistence
- Azure AD SSO (MSAL) with automatic silent token refresh
- Session-aware auth with expired session modal and graceful re-login
- Command palette for keyboard-driven navigation
- Lazy-loaded routes for fast initial page load
- Responsive TailwindCSS design across desktop and tablet

## Upcoming Features

- **GitHub Integration Views** — Repository activity, Actions pipeline status, and PR reviews from GitHub alongside Azure DevOps
- **Embedded AI Notebooks** — Interactive markdown + code cells inside dashboards for ad-hoc data exploration
- **Custom Alert Configuration UI** — Visual alert builder with threshold rules and notification channel selection
- **Dashboard Sharing & Export** — Public/internal share links, PDF export, and scheduled email delivery of dashboard snapshots
- **Widget Plugin SDK** — Third-party and internal teams can build custom widgets that plug into the dashboard system
- **Mobile-Responsive Layouts** — Optimized grid layouts and touch interactions for phone and tablet use
- **Onboarding Wizard** — Guided first-run experience to connect data sources and set up initial dashboards

## Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | React 18 with TypeScript |
| Build | Vite 5 (dev server + production bundler) |
| Styling | TailwindCSS 3.3 with dark mode |
| State | React Context (Auth, Azure, Chat) + Zustand (settings) |
| Routing | React Router 6 with lazy-loaded routes and role guards |
| HTTP | Axios with JWT interceptors and 401 auto-refresh |
| Real-time | @microsoft/signalr 10.0 (7 hub connections) |
| Auth | @azure/msal-react 3.0 (Azure AD SSO) |
| Charts | Chart.js 4.4 + ECharts 5.4 |
| Grid | react-grid-layout 1.4 (drag-and-drop widgets) |
| Icons | lucide-react 0.294 |
| Animation | framer-motion 11.0 |
| Server State | React Context + custom hooks |

## Project Structure

```
ProdVista-Frontend/
├── package.json                           # Dependencies and scripts
├── vite.config.ts                         # Vite config (proxy /api → backend, /hubs → WebSocket)
├── tailwind.config.js                     # TailwindCSS theme and dark mode
├── tsconfig.json                          # TypeScript configuration
├── index.html                             # HTML entry point
├── Dockerfile                             # Multi-stage build (Node → Nginx)
├── nginx.conf                             # Production Nginx config
├── Jenkinsfile                            # CI/CD pipeline definition
├── AKS-Deployment/
│   ├── prodvistaui-configmap.yml          # Kubernetes ConfigMap
│   └── prodvistaui-deployment.yml         # Kubernetes Deployment + Service
└── src/
    ├── main.tsx                           # React DOM entry + MSAL provider
    ├── App.tsx                            # Router, AuthGate, lazy routes, guards
    ├── index.css                          # Global styles + Tailwind imports
    ├── pages/                             # 46 page components (lazy-loaded)
    │   ├── LoginPage.tsx                  # Tenant login + Azure AD SSO
    │   ├── OverviewPage.tsx               # Home dashboard
    │   ├── DynamicDashboardPage.tsx       # Drag-and-drop dashboard builder
    │   ├── QualityDashboardV2.tsx         # Quality metrics (5 tabs, work item modal)
    │   ├── EngineeringDashboardV2.tsx     # Engineering metrics
    │   ├── AIChatPage.tsx                 # AI chat with streaming
    │   ├── AiQueryAssistantPage.tsx       # Natural language → SQL
    │   ├── ObservabilityQueryPage.tsx     # KQL query interface
    │   ├── JenkinsPipelinePage.tsx        # Jenkins CI/CD monitoring
    │   ├── DevOpsOverviewPage.tsx         # Azure DevOps connection & overview
    │   └── ...                            # 36 more pages
    ├── components/                        # 60+ reusable components
    │   ├── Layout.tsx                     # App shell — sidebar, header, content area
    │   ├── BrandedSplash.tsx              # Animated splash screen
    │   ├── CommandPalette.tsx             # Keyboard-driven navigation (Ctrl+K)
    │   ├── ProfileSetupModal.tsx          # User profile editor
    │   ├── SessionExpiredModal.tsx        # Auth session recovery
    │   ├── widgets/                       # Dashboard widget components
    │   ├── builder/                       # Dashboard builder components
    │   ├── dynamic/                       # Dynamic rendering components
    │   ├── guards/                        # Route guard components
    │   ├── shared/                        # Common UI primitives
    │   └── ui/                            # Design system components
    ├── services/                          # 41 typed API service files
    │   ├── api.ts                         # Shared Axios instance + interceptors
    │   ├── qualityService.ts              # Quality endpoints + DTOs
    │   ├── engineeringService.ts          # Engineering endpoints + DTOs
    │   ├── devopsService.ts               # Azure DevOps endpoints
    │   ├── jenkinsService.ts              # Jenkins endpoints
    │   ├── aiService.ts                   # AI/LLM endpoints
    │   ├── aiQueryService.ts              # NL→SQL endpoints
    │   └── ...                            # 34 more service files
    ├── context/                           # React context providers
    │   ├── AuthContext.tsx                 # JWT auth, user, tenant, roles
    │   ├── AzureAuthContext.tsx            # MSAL tokens (ARM, DevOps, Graph)
    │   └── PersistentChatContext.tsx       # Cross-page AI chat history
    ├── stores/
    │   └── settingsStore.ts               # Zustand store (theme, sidebar, prefs)
    ├── config/                            # MSAL config, app constants
    ├── hooks/                             # Custom React hooks
    ├── types/                             # Shared TypeScript type definitions
    └── utils/                             # Helper functions
```
