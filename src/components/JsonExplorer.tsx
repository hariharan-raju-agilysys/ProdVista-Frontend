import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Braces, Brackets, Hash, Type, ToggleLeft, CheckCircle, Copy, Target } from 'lucide-react';
import clsx from 'clsx';

interface JsonNode {
  key: string;
  value: any;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  path: string;
  children?: JsonNode[];
  arrayLength?: number;
}

interface JsonExplorerProps {
  data: any;
  onSelectPath: (path: string, value: any, type: string) => void;
  selectedPath?: string;
  title?: string;
  maxHeight?: string;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'object': return <Braces className="w-3.5 h-3.5 text-purple-500" />;
    case 'array': return <Brackets className="w-3.5 h-3.5 text-blue-500" />;
    case 'number': return <Hash className="w-3.5 h-3.5 text-green-500" />;
    case 'string': return <Type className="w-3.5 h-3.5 text-orange-500" />;
    case 'boolean': return <ToggleLeft className="w-3.5 h-3.5 text-cyan-500" />;
    default: return <span className="w-3.5 h-3.5 text-gray-400">∅</span>;
  }
};

const getValueType = (value: any): JsonNode['type'] => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonNode['type'];
};

const buildJsonTree = (data: any, parentPath: string = '$'): JsonNode[] => {
  if (data === null || data === undefined) return [];
  
  const nodes: JsonNode[] = [];
  
  if (Array.isArray(data)) {
    data.forEach((item, index) => {
      const path = `${parentPath}[${index}]`;
      const type = getValueType(item);
      nodes.push({
        key: `[${index}]`,
        value: item,
        type,
        path,
        children: (type === 'object' || type === 'array') ? buildJsonTree(item, path) : undefined,
        arrayLength: type === 'array' ? (item as any[]).length : undefined,
      });
    });
  } else if (typeof data === 'object') {
    Object.entries(data).forEach(([key, value]) => {
      const path = `${parentPath}.${key}`;
      const type = getValueType(value);
      nodes.push({
        key,
        value,
        type,
        path,
        children: (type === 'object' || type === 'array') ? buildJsonTree(value, path) : undefined,
        arrayLength: type === 'array' ? (value as any[]).length : undefined,
      });
    });
  }
  
  return nodes;
};

const TreeNode: React.FC<{
  node: JsonNode;
  depth: number;
  expandedPaths: Set<string>;
  toggleExpand: (path: string) => void;
  onSelect: (node: JsonNode) => void;
  selectedPath?: string;
}> = ({ node, depth, expandedPaths, toggleExpand, onSelect, selectedPath }) => {
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.path;
  
  const displayValue = useMemo(() => {
    if (node.type === 'object') {
      const keys = Object.keys(node.value || {});
      return `{${keys.length} keys}`;
    }
    if (node.type === 'array') {
      return `[${node.arrayLength} items]`;
    }
    if (node.type === 'string') {
      const str = node.value as string;
      return str.length > 30 ? `"${str.substring(0, 30)}..."` : `"${str}"`;
    }
    if (node.type === 'boolean') {
      return node.value ? 'true' : 'false';
    }
    if (node.type === 'null') {
      return 'null';
    }
    return String(node.value);
  }, [node]);

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors group',
          isSelected 
            ? 'bg-blue-100 dark:bg-blue-900/40 border border-blue-300 dark:border-blue-700' 
            : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/Collapse Toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.path); }}
            className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        {/* Type Icon */}
        {getTypeIcon(node.type)}
        
        {/* Key Name */}
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300 font-medium">
          {node.key}
        </span>
        
        {/* Colon */}
        <span className="text-gray-400">:</span>
        
        {/* Value Preview */}
        <span className={clsx(
          'font-mono text-xs truncate flex-1',
          node.type === 'string' && 'text-orange-600 dark:text-orange-400',
          node.type === 'number' && 'text-green-600 dark:text-green-400',
          node.type === 'boolean' && 'text-cyan-600 dark:text-cyan-400',
          node.type === 'null' && 'text-gray-400 italic',
          (node.type === 'object' || node.type === 'array') && 'text-gray-500 dark:text-gray-400'
        )}>
          {displayValue}
        </span>
        
        {/* Select Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(node); }}
          className={clsx(
            'p-1 rounded transition-opacity',
            isSelected 
              ? 'opacity-100 text-blue-600' 
              : 'opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600'
          )}
          title="Select this path"
        >
          {isSelected ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Target className="w-4 h-4" />
          )}
        </button>
      </div>
      
      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, idx) => (
            <TreeNode
              key={`${child.path}-${idx}`}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              toggleExpand={toggleExpand}
              onSelect={onSelect}
              selectedPath={selectedPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const JsonExplorer: React.FC<JsonExplorerProps> = ({
  data,
  onSelectPath,
  selectedPath,
  title = 'JSON Explorer',
  maxHeight = '300px'
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['$']));
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  
  const tree = useMemo(() => {
    if (!data) return [];
    const rootType = getValueType(data);
    
    // Create root node
    const rootNode: JsonNode = {
      key: 'root',
      value: data,
      type: rootType,
      path: '$',
      children: buildJsonTree(data, '$'),
      arrayLength: rootType === 'array' ? data.length : undefined,
    };
    
    return [rootNode];
  }, [data]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (nodes: JsonNode[]) => {
      nodes.forEach(node => {
        allPaths.add(node.path);
        if (node.children) collectPaths(node.children);
      });
    };
    collectPaths(tree);
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['$']));
  };

  const handleSelect = (node: JsonNode) => {
    onSelectPath(node.path, node.value, node.type);
  };

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  if (!data) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
        No data to explore. Run "Test & Preview" to load data.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</h5>
        <div className="flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Expand All
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
          >
            Collapse All
          </button>
        </div>
      </div>
      
      {/* Selected Path Display */}
      {selectedPath && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
          <span className="text-xs text-blue-600 dark:text-blue-400">Selected:</span>
          <code className="flex-1 text-xs font-mono text-blue-800 dark:text-blue-300 truncate">
            {selectedPath}
          </code>
          <button
            onClick={() => copyPath(selectedPath)}
            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-800 rounded"
            title="Copy path"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          {copiedPath === selectedPath && (
            <span className="text-xs text-green-600">Copied!</span>
          )}
        </div>
      )}
      
      {/* Tree View */}
      <div 
        className="overflow-auto bg-white dark:bg-gray-900 p-1"
        style={{ maxHeight }}
      >
        {tree.map((node, idx) => (
          <TreeNode
            key={`${node.path}-${idx}`}
            node={node}
            depth={0}
            expandedPaths={expandedPaths}
            toggleExpand={toggleExpand}
            onSelect={handleSelect}
            selectedPath={selectedPath}
          />
        ))}
      </div>
    </div>
  );
};

export default JsonExplorer;
