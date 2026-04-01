import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Hash, Type, ToggleLeft, List, Braces, Copy, Check, MousePointer } from 'lucide-react';
import clsx from 'clsx';

interface JsonPathSelectorProps {
  data: unknown;
  onSelectPath: (path: string, value: unknown) => void;
  selectedPath?: string;
  maxDepth?: number;
  className?: string;
}

interface JsonNodeProps {
  name: string;
  value: unknown;
  path: string;
  depth: number;
  maxDepth: number;
  onSelect: (path: string, value: unknown) => void;
  selectedPath?: string;
  isArrayItem?: boolean;
}

// Get type icon for a value
function getTypeIcon(value: unknown) {
  if (value === null || value === undefined) return <Type className="w-3 h-3 text-gray-400" />;
  if (typeof value === 'string') return <Type className="w-3 h-3 text-green-500" />;
  if (typeof value === 'number') return <Hash className="w-3 h-3 text-blue-500" />;
  if (typeof value === 'boolean') return <ToggleLeft className="w-3 h-3 text-purple-500" />;
  if (Array.isArray(value)) return <List className="w-3 h-3 text-orange-500" />;
  if (typeof value === 'object') return <Braces className="w-3 h-3 text-cyan-500" />;
  return <Type className="w-3 h-3 text-gray-400" />;
}

// Get type label for a value
function getTypeLabel(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return `array[${value.length}]`;
  if (typeof value === 'object') return 'object';
  return typeof value;
}

// Format value for display
function formatValue(value: unknown, maxLength: number = 50): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    const truncated = value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
    return `"${truncated}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return `{${keys.length} keys}`;
  }
  return String(value);
}

// JSON Node component - renders a single node in the tree
function JsonNode({ name, value, path, depth, maxDepth, onSelect, selectedPath, isArrayItem }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const isExpandable = (typeof value === 'object' && value !== null) || Array.isArray(value);
  const isSelected = selectedPath === path;
  const isPrimitive = !isExpandable;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpandable) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(path, value);
  };

  // Render children for objects and arrays
  const renderChildren = () => {
    if (!isExpanded || depth >= maxDepth) return null;

    if (Array.isArray(value)) {
      // For arrays, show first few items with index
      const itemsToShow = value.slice(0, 10);
      return (
        <div className="ml-4 border-l border-gray-200 dark:border-gray-600 pl-2">
          {itemsToShow.map((item, index) => (
            <JsonNode
              key={index}
              name={`[${index}]`}
              value={item}
              path={`${path}[${index}]`}
              depth={depth + 1}
              maxDepth={maxDepth}
              onSelect={onSelect}
              selectedPath={selectedPath}
              isArrayItem
            />
          ))}
          {value.length > 10 && (
            <div className="text-xs text-gray-400 py-1">
              ...and {value.length - 10} more items
            </div>
          )}
        </div>
      );
    }

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      return (
        <div className="ml-4 border-l border-gray-200 dark:border-gray-600 pl-2">
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              name={key}
              value={val}
              path={`${path}.${key}`}
              depth={depth + 1}
              maxDepth={maxDepth}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="text-sm">
      <div
        className={clsx(
          'flex items-center gap-1 py-1 px-1 rounded cursor-pointer transition-colors group',
          isSelected && 'bg-blue-100 dark:bg-blue-900/50 ring-1 ring-blue-500',
          !isSelected && 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        )}
        onClick={handleSelect}
      >
        {/* Expand/Collapse button */}
        <button
          type="button"
          onClick={handleToggle}
          className={clsx(
            'w-4 h-4 flex items-center justify-center',
            !isExpandable && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </button>

        {/* Type icon */}
        {getTypeIcon(value)}

        {/* Property name */}
        <span className={clsx(
          'font-medium',
          isArrayItem ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
        )}>
          {name}
        </span>

        {/* Colon separator */}
        <span className="text-gray-400">:</span>

        {/* Value preview (for primitives) or type info */}
        {isPrimitive ? (
          <span className={clsx(
            'truncate flex-1',
            typeof value === 'string' && 'text-green-600 dark:text-green-400',
            typeof value === 'number' && 'text-blue-600 dark:text-blue-400',
            typeof value === 'boolean' && 'text-purple-600 dark:text-purple-400',
            (value === null || value === undefined) && 'text-gray-400 italic'
          )}>
            {formatValue(value)}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">
            {getTypeLabel(value)}
          </span>
        )}

        {/* Select indicator */}
        <MousePointer className={clsx(
          'w-3 h-3 ml-auto transition-opacity',
          isSelected ? 'text-blue-500 opacity-100' : 'text-gray-300 opacity-0 group-hover:opacity-100'
        )} />
      </div>

      {/* Children */}
      {renderChildren()}
    </div>
  );
}

// Main JsonPathSelector component
export function JsonPathSelector({
  data,
  onSelectPath,
  selectedPath,
  maxDepth = 6,
  className
}: JsonPathSelectorProps) {
  const [copiedPath, setCopiedPath] = useState(false);

  const handleCopyPath = useCallback(() => {
    if (selectedPath) {
      navigator.clipboard.writeText(selectedPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  }, [selectedPath]);

  // Get the value at the selected path
  const selectedValue = useMemo(() => {
    if (!selectedPath || !data) return undefined;
    return getValueAtPath(data, selectedPath);
  }, [data, selectedPath]);

  if (!data) {
    return (
      <div className={clsx('p-4 text-center text-gray-500', className)}>
        No data available. Load data first to select a path.
      </div>
    );
  }

  return (
    <div className={clsx('flex flex-col', className)}>
      {/* Selected path display */}
      {selectedPath && (
        <div className="flex items-center gap-2 p-2 mb-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Selected:</span>
          <code className="flex-1 text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded font-mono text-blue-700 dark:text-blue-300 truncate">
            {selectedPath}
          </code>
          <button
            type="button"
            onClick={handleCopyPath}
            className="p-1 text-blue-500 hover:text-blue-700 transition-colors"
            title="Copy path"
          >
            {copiedPath ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {/* Selected value preview */}
      {selectedPath && selectedValue !== undefined && (
        <div className="p-2 mb-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
          <span className="text-gray-500">Value: </span>
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {formatValue(selectedValue, 100)}
          </span>
        </div>
      )}

      {/* JSON Tree */}
      <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800 max-h-64">
        {Array.isArray(data) ? (
          // If root is array, show items directly
          data.slice(0, 5).map((item, index) => (
            <JsonNode
              key={index}
              name={`[${index}]`}
              value={item}
              path={`$[${index}]`}
              depth={0}
              maxDepth={maxDepth}
              onSelect={onSelectPath}
              selectedPath={selectedPath}
              isArrayItem
            />
          ))
        ) : typeof data === 'object' && data !== null ? (
          // If root is object, show properties
          Object.entries(data).map(([key, value]) => (
            <JsonNode
              key={key}
              name={key}
              value={value}
              path={`$.${key}`}
              depth={0}
              maxDepth={maxDepth}
              onSelect={onSelectPath}
              selectedPath={selectedPath}
            />
          ))
        ) : (
          <div className="text-gray-500 text-sm">
            Root value: {formatValue(data)}
          </div>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500 mt-2">
        Click on any property to select its path for data mapping.
      </p>
    </div>
  );
}

// Helper function to get value at a JSON path
export function getValueAtPath(data: unknown, path: string): unknown {
  if (!path || path === '$') return data;

  // Remove $ prefix and split into parts
  const cleanPath = path.replace(/^\$\.?/, '');
  if (!cleanPath) return data;

  const parts = cleanPath.match(/([^.\[\]]+|\[\d+\])/g) || [];
  let current: unknown = data;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    if (part.startsWith('[') && part.endsWith(']')) {
      // Array index
      const index = parseInt(part.slice(1, -1), 10);
      if (Array.isArray(current)) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      // Object property
      if (typeof current === 'object' && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
  }

  return current;
}

// Helper to extract all paths from JSON
export function extractAllPaths(data: unknown, basePath: string = '$', maxDepth: number = 5): string[] {
  const paths: string[] = [basePath];

  if (maxDepth <= 0) return paths;

  if (Array.isArray(data)) {
    // For arrays, extract paths from first item as template
    if (data.length > 0) {
      const itemPaths = extractAllPaths(data[0], `${basePath}[0]`, maxDepth - 1);
      paths.push(...itemPaths);
    }
  } else if (typeof data === 'object' && data !== null) {
    for (const [key, value] of Object.entries(data)) {
      const childPath = basePath === '$' ? `$.${key}` : `${basePath}.${key}`;
      const childPaths = extractAllPaths(value, childPath, maxDepth - 1);
      paths.push(...childPaths);
    }
  }

  return paths;
}

export default JsonPathSelector;
