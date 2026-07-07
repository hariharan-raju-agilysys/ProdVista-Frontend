# Azure DevOps URL Builder Utility

## Overview

Centralized URL builder for all Azure DevOps entity types (Work Items, Pull Requests, Commits, Releases, etc.). Eliminates hardcoded URL patterns across the application.

**Location:** `ProdVista-Frontend/src/utils/azure-devops-url-builder.ts`

---

## Quick Start

### Option 1: Direct Utility (Recommended for Non-React Code)

```typescript
import { AzureDevOpsUrlBuilder } from '../utils/azure-devops-url-builder';

// Build URL from any entity
const url = AzureDevOpsUrlBuilder.buildWorkItemUrl(workItem, config);

// Or auto-detect entity type
const url = AzureDevOpsUrlBuilder.build(entity, config);
```

### Option 2: Custom Hooks (Recommended for React Components)

```typescript
import { useWorkItemUrl, useAzureDevOpsConfig } from '../hooks/useAzureDevOpsUrl';

// In component
const config = useAzureDevOpsConfig();
const url = useWorkItemUrl(workItem, config);
```

---

## Configuration

### Config Object

```typescript
interface AzureDevOpsConfig {
  organizationUrl: string;  // "https://dev.azure.com/AGYS-VisualOne"
  projectName: string;      // "PMS"
}
```

### Normalize Config with Defaults

```typescript
const config = AzureDevOpsUrlBuilder.normalizeConfig({
  organizationUrl: 'https://dev.azure.com/AGYS-VisualOne',
  projectName: 'PMS',
});
// Returns normalized config with defaults
```

---

## API Reference

### Static Methods

#### `build(entity, config?): string | null`
Auto-detects entity type and builds appropriate URL.

```typescript
// Work Item
const url = AzureDevOpsUrlBuilder.build(workItem, config);

// Pull Request
const url = AzureDevOpsUrlBuilder.build(pullRequest, config);

// Commit
const url = AzureDevOpsUrlBuilder.build(commit, config);
```

#### `buildWorkItemUrl(entity, config?): string | null`
Builds URL for work items (Bug, Task, Feature, etc.)

```typescript
const url = AzureDevOpsUrlBuilder.buildWorkItemUrl(bug, config);
// Returns: https://dev.azure.com/AGYS-VisualOne/PMS/_workitems/edit/12345
```

#### `buildPullRequestUrl(entity, config?): string | null`
Builds URL for pull requests.

```typescript
const url = AzureDevOpsUrlBuilder.buildPullRequestUrl(pr, config);
// Returns: {repo.webUrl}/pullrequest/{prId}
```

#### `buildCommitUrl(entity, config?): string | null`
Builds URL for commits.

```typescript
const url = AzureDevOpsUrlBuilder.buildCommitUrl(commit, config);
// Returns: https://dev.azure.com/{org}/{project}/_git/{repo}/commit/{commitId}
```

#### `buildReleaseUrl(entity, config?): string | null`
Builds URL for releases.

```typescript
const url = AzureDevOpsUrlBuilder.buildReleaseUrl(release, config);
// Returns: https://dev.azure.com/{org}/{project}/_releaseProgress?releaseId={id}
```

#### `extractOrganization(urlOrOrg): string | null`
Extracts organization name from Azure DevOps URL or returns as-is.

```typescript
AzureDevOpsUrlBuilder.extractOrganization('https://dev.azure.com/AGYS-VisualOne/...');
// Returns: "AGYS-VisualOne"

AzureDevOpsUrlBuilder.extractOrganization('AGYS-VisualOne');
// Returns: "AGYS-VisualOne"
```

#### `normalizeConfig(config?): AzureDevOpsConfig`
Returns normalized config with defaults.

```typescript
const config = AzureDevOpsUrlBuilder.normalizeConfig();
// Returns: {
//   organizationUrl: 'https://dev.azure.com/AGYS-VisualOne',
//   projectName: 'PMS'
// }
```

#### `isValidUrl(url): boolean`
Checks if URL is valid Azure DevOps URL.

```typescript
AzureDevOpsUrlBuilder.isValidUrl('https://dev.azure.com/AGYS-VisualOne/...');
// Returns: true

AzureDevOpsUrlBuilder.isValidUrl('https://invalid.com');
// Returns: false
```

---

## URL Priority Chain

When building URLs, the utility uses a smart fallback chain:

1. **Pre-built devOpsUrl** - If entity has `devOpsUrl` field, use it
2. **Extract from entity.url** - Extract org/project from entity's existing URL
3. **Use config** - Use provided config + entity ID
4. **Fallback defaults** - Use hardcoded org/project defaults

```typescript
// Example with fallback chain
const bug = {
  id: 12345,
  // devOpsUrl empty
  // url could have org/project info
};

// Builder tries: devOpsUrl → entity.url → config → defaults
const url = AzureDevOpsUrlBuilder.buildWorkItemUrl(bug, config);
```

---

## Real-World Examples

### Example 1: Build Bug Link in DeveloperDashboardPage

```typescript
import { AzureDevOpsUrlBuilder } from '../utils/azure-devops-url-builder';

const loadBugData = useCallback(async () => {
  const bugs = await getBugs({ iterationPath: selectedIteration });

  // Enrich bugs with devOpsUrl
  const config = AzureDevOpsUrlBuilder.normalizeConfig({
    organizationUrl: 'https://dev.azure.com/AGYS-VisualOne',
    projectName: 'PMS',
  });

  const bugsWithUrls = bugs.map(bug => ({
    ...bug,
    devOpsUrl: AzureDevOpsUrlBuilder.buildWorkItemUrl(bug, config) || '',
  }));

  setMyBugs(bugsWithUrls);
}, [selectedIteration]);
```

### Example 2: Render Clickable Work Item Link

```typescript
<a 
  href={AzureDevOpsUrlBuilder.buildWorkItemUrl(workItem, config) || '#'}
  target="_blank" 
  rel="noopener noreferrer"
  className="text-blue-600 hover:underline"
>
  {workItem.title}
</a>
```

### Example 3: Build Multiple Entity Types

```typescript
const devopsUrl = AzureDevOpsUrlBuilder.build(entity, config);

// Works for:
// - Work items (Bug, Task, User Story, Feature, Epic)
// - Pull requests
// - Commits
// - Releases
// - Repositories
// - Builds
```

### Example 4: Using Custom Hooks

```typescript
import { useWorkItemUrl, useAzureDevOpsConfig } from '../hooks/useAzureDevOpsUrl';

function BugCard({ bug }) {
  const config = useAzureDevOpsConfig();
  const url = useWorkItemUrl(bug, config);

  if (!url) return <span>{bug.title}</span>;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {bug.title}
    </a>
  );
}
```

### Example 5: Enrich Array of Entities

```typescript
import { useEntityUrls } from '../hooks/useAzureDevOpsUrl';

const config = useAzureDevOpsConfig();
const bugsWithUrls = useEntityUrls(bugs, config);
// Each bug now has: { ...bug, devOpsUrl: string }
```

---

## Custom Hooks

Located in: `ProdVista-Frontend/src/hooks/useAzureDevOpsUrl.ts`

### `useAzureDevOpsConfig(custom?): AzureDevOpsConfig`
Memoized config provider with custom overrides.

### `useEntityUrl(entity, config?): string | null`
Auto-detects entity type and builds URL.

### `useWorkItemUrl(entity, config?): string | null`
Builds work item URL with memoization.

### `usePullRequestUrl(entity, config?): string | null`
Builds PR URL with memoization.

### `useCommitUrl(entity, config?): string | null`
Builds commit URL with memoization.

### `useReleaseUrl(entity, config?): string | null`
Builds release URL with memoization.

### `useEntityUrls<T>(entities, config?): (T & { devOpsUrl: string })[] | null`
Transforms array to include devOpsUrl field.

### `useIsValidAzureDevOpsUrl(url): boolean`
Validates if URL is Azure DevOps URL.

---

## Migration Guide

### Before (Hardcoded URLs)

```typescript
// ❌ Scattered throughout components
<a href={`${config?.organizationUrl}/${config?.projectName}/_workitems/edit/${wi.id}`}>
  {wi.title}
</a>

<a href={`${config.organizationUrl}/${config.projectName}/_git/${pr.repositoryName}/pullrequest/${pr.pullRequestId}`}>
  {pr.title}
</a>
```

### After (Centralized Builder)

```typescript
// ✅ Single utility, reusable everywhere
<a href={AzureDevOpsUrlBuilder.build(entity, config) || '#'}>
  {entity.title}
</a>
```

---

## Testing

### Verify URLs Generated

```typescript
const config = {
  organizationUrl: 'https://dev.azure.com/AGYS-VisualOne',
  projectName: 'PMS',
};

const bug = { id: 12345, workItemType: 'Bug' };
const url = AzureDevOpsUrlBuilder.buildWorkItemUrl(bug, config);

console.log(url);
// Expected: https://dev.azure.com/AGYS-VisualOne/PMS/_workitems/edit/12345
```

### Validate URL Format

```typescript
const isValid = AzureDevOpsUrlBuilder.isValidUrl(url);
// true if URL starts with https://dev.azure.com/
```

---

## Files Updated

1. ✅ `azure-devops-url-builder.ts` - Comprehensive utility class
2. ✅ `useAzureDevOpsUrl.ts` - Custom React hooks
3. ✅ `DeveloperDashboardPage.tsx` - Integrated URL builder
4. ✅ `DevOpsOverviewPage.tsx` - Replaced 4 hardcoded URL patterns

---

## Next Steps

### Phase 2: Complete Application Coverage

Search for remaining hardcoded URLs:

```bash
grep -r "dev.azure.com" ProdVista-Frontend/src/
```

Replace with `AzureDevOpsUrlBuilder.build(entity, config)`

### Phase 3: Backend Enhancement (Optional)

Have backend return fully populated `devOpsUrl` field:

```csharp
workItem.devOpsUrl = AzureDevOpsUrlBuilder.BuildWorkItemUrl(
  organizationUrl: "https://dev.azure.com/AGYS-VisualOne",
  projectName: "PMS",
  workItemId: workItem.id
);
```

This way frontend fallback chain always finds pre-built URL.

---

## Performance Notes

- **Memoization:** Custom hooks use `useMemo` to prevent unnecessary recalculations
- **URL Extraction:** Regex patterns are cached in utility class
- **No Dependencies:** Utility is pure TypeScript, no external dependencies

---

## Support

For questions or issues with the URL builder:

1. Check this documentation
2. Review `azure-devops-url-builder.ts` source
3. Look at examples in `DeveloperDashboardPage.tsx` and `DevOpsOverviewPage.tsx`
4. Check custom hooks in `useAzureDevOpsUrl.ts`
