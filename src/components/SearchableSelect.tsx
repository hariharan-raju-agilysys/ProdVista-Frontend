import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, ChevronDown, Check, Loader2, X } from 'lucide-react'
import clsx from 'clsx'

interface Option {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  emptyMessage?: string
  maxDisplayed?: number // For lazy loading - show only first N items initially
  onLoadMore?: () => void // Called when user scrolls to load more
  hasMore?: boolean // Whether there are more items to load
  renderOption?: (option: Option) => React.ReactNode
  groupBy?: (option: Option) => string // Group options by this function
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  loading = false,
  disabled = false,
  className,
  emptyMessage = 'No options found',
  maxDisplayed = 50,
  onLoadMore,
  hasMore = false,
  renderOption,
  groupBy,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(maxDisplayed)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Find selected option
  const selectedOption = useMemo(
    () => options.find(opt => opt.value === value),
    [options, value]
  )

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      opt.description?.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query)
    )
  }, [options, searchQuery])

  // Lazy-load displayed options
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, displayCount)
  }, [filteredOptions, displayCount])

  // Group options if groupBy is provided
  const groupedOptions = useMemo(() => {
    if (!groupBy) return null
    const groups: Record<string, Option[]> = {}
    displayedOptions.forEach(opt => {
      const group = groupBy(opt)
      if (!groups[group]) groups[group] = []
      groups[group].push(opt)
    })
    return groups
  }, [displayedOptions, groupBy])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [isOpen])

  // Handle click outside to close dropdown (including portal)
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Check if click is inside container
      if (containerRef.current?.contains(target)) {
        return
      }
      
      // Check if click is inside dropdown portal using data attribute
      if (target.closest('[data-searchable-select-dropdown="true"]')) {
        return
      }
      
      setIsOpen(false)
      setSearchQuery('')
      setDisplayCount(maxDisplayed)
    }
    
    // Use capture phase
    document.addEventListener('click', handleClickOutside, true)
    
    return () => {
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [isOpen, maxDisplayed])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle scroll for lazy loading
  const handleScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      // Near bottom - load more
      if (displayCount < filteredOptions.length) {
        setDisplayCount(prev => Math.min(prev + maxDisplayed, filteredOptions.length))
      } else if (hasMore && onLoadMore) {
        onLoadMore()
      }
    }
  }, [displayCount, filteredOptions.length, maxDisplayed, hasMore, onLoadMore])

  const handleSelect = (e: React.MouseEvent, optionValue: string) => {
    e.preventDefault()
    e.stopPropagation()
    onChange(optionValue)
    setIsOpen(false)
    setSearchQuery('')
    setDisplayCount(maxDisplayed)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchQuery('')
    }
    if (e.key === 'Enter' && displayedOptions.length === 1) {
      onChange(displayedOptions[0].value)
      setIsOpen(false)
      setSearchQuery('')
      setDisplayCount(maxDisplayed)
    }
  }

  const renderOptionContent = (option: Option) => {
    if (renderOption) return renderOption(option)
    return (
      <div className="flex items-center gap-2">
        {option.icon}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{option.label}</div>
          {option.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {option.description}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'w-full px-3 py-2 flex items-center justify-between gap-2',
          'border rounded-lg text-left transition-colors',
          'bg-white dark:bg-gray-700',
          disabled
            ? 'border-gray-200 dark:border-gray-600 text-gray-400 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
          isOpen && 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
        )}
      >
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : selectedOption ? (
            <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              {selectedOption.icon}
              <span className="truncate">{selectedOption.label}</span>
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={clsx(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Dropdown - Rendered via Portal to avoid overflow clipping */}
      {isOpen && createPortal(
        <div 
          data-searchable-select-dropdown="true"
          className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setDisplayCount(maxDisplayed) // Reset display count on new search
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto"
          >
            {loading && options.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span>Loading options...</span>
              </div>
            ) : displayedOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-500">
                {emptyMessage}
              </div>
            ) : groupedOptions ? (
              // Grouped options
              Object.entries(groupedOptions).map(([group, opts]) => (
                <div key={group}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 sticky top-0">
                    {group}
                  </div>
                  {opts.map(option => (
                    <div
                      key={option.value}
                      onClick={(e) => !option.disabled && handleSelect(e, option.value)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={clsx(
                        'w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer select-none',
                        option.value === value
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div className="flex-1 min-w-0">{renderOptionContent(option)}</div>
                      {option.value === value && (
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              ))
            ) : (
              // Flat options
              displayedOptions.map(option => (
                <div
                  key={option.value}
                  onClick={(e) => !option.disabled && handleSelect(e, option.value)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={clsx(
                    'w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer select-none',
                    option.value === value
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                    option.disabled && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex-1 min-w-0">{renderOptionContent(option)}</div>
                  {option.value === value && (
                    <Check className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                </div>
              ))
            )}

            {/* Load more indicator */}
            {displayCount < filteredOptions.length && (
              <div className="px-3 py-2 text-center text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
                Showing {displayCount} of {filteredOptions.length} • Scroll for more
              </div>
            )}
            {hasMore && displayCount >= filteredOptions.length && (
              <div className="px-3 py-2 text-center text-gray-500 border-t border-gray-200 dark:border-gray-700">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                Loading more...
              </div>
            )}
          </div>

          {/* Footer with count */}
          {filteredOptions.length > 0 && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              {searchQuery
                ? `${filteredOptions.length} matching result${filteredOptions.length !== 1 ? 's' : ''}`
                : `${options.length} option${options.length !== 1 ? 's' : ''}`
              }
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

// ============================================================================
// Multi-Select Version
// ============================================================================

interface MultiSearchableSelectProps {
  options: Option[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  className?: string
  emptyMessage?: string
  maxDisplayed?: number
  renderOption?: (option: Option) => React.ReactNode
}

export function MultiSearchableSelect({
  options,
  values,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  loading = false,
  disabled = false,
  className,
  emptyMessage = 'No options found',
  maxDisplayed = 50,
  renderOption,
}: MultiSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [displayCount, setDisplayCount] = useState(maxDisplayed)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Find selected options
  const selectedOptions = useMemo(
    () => options.filter(opt => values.includes(opt.value)),
    [options, values]
  )

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase()
    return options.filter(opt =>
      opt.label.toLowerCase().includes(query) ||
      opt.description?.toLowerCase().includes(query) ||
      opt.value.toLowerCase().includes(query)
    )
  }, [options, searchQuery])

  // Lazy-load displayed options
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, displayCount)
  }, [filteredOptions, displayCount])

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      })
    }
  }, [isOpen])

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Check if click is inside container
      if (containerRef.current?.contains(target)) {
        return
      }
      
      // Check if click is inside dropdown portal using data attribute
      if (target.closest('[data-multi-select-dropdown="true"]')) {
        return
      }
      
      setIsOpen(false)
      setSearchQuery('')
      setDisplayCount(maxDisplayed)
    }
    
    // Use capture phase to handle click before it bubbles
    document.addEventListener('click', handleClickOutside, true)
    
    return () => {
      document.removeEventListener('click', handleClickOutside, true)
    }
  }, [isOpen, maxDisplayed])

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Handle scroll for lazy loading
  const handleScroll = useCallback(() => {
    if (!listRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      if (displayCount < filteredOptions.length) {
        setDisplayCount(prev => Math.min(prev + maxDisplayed, filteredOptions.length))
      }
    }
  }, [displayCount, filteredOptions.length, maxDisplayed])

  const handleToggle = (optionValue: string) => {
    const newValues = values.includes(optionValue)
      ? values.filter(v => v !== optionValue)
      : [...values, optionValue]
    onChange(newValues)
  }

  const handleOptionClick = (e: React.MouseEvent, optionValue: string, optionDisabled?: boolean) => {
    e.preventDefault()
    e.stopPropagation()
    if (!optionDisabled) {
      handleToggle(optionValue)
    }
  }

  const handleRemove = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation()
    e.preventDefault()
    onChange(values.filter(v => v !== optionValue))
  }

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      setSearchQuery('')
    }
  }

  const renderOptionContent = (option: Option) => {
    if (renderOption) return renderOption(option)
    return (
      <div className="flex items-center gap-2">
        {option.icon}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{option.label}</div>
          {option.description && (
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {option.description}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          'w-full px-3 py-2 flex items-center justify-between gap-2',
          'border rounded-lg text-left transition-colors min-h-[42px]',
          'bg-white dark:bg-gray-700',
          disabled
            ? 'border-gray-200 dark:border-gray-600 text-gray-400 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500',
          isOpen && 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
        )}
      >
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedOptions.slice(0, 3).map(opt => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs"
                >
                  {opt.label}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, opt.value)}
                    className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedOptions.length > 3 && (
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs">
                  +{selectedOptions.length - 3} more
                </span>
              )}
            </div>
          ) : (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {values.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
              title="Clear all"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <ChevronDown className={clsx(
            'w-4 h-4 text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && createPortal(
        <div 
          data-multi-select-dropdown="true"
          className="fixed z-[100] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
          style={{
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setDisplayCount(maxDisplayed)
                }}
                onKeyDown={handleKeyDown}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>

          {/* Selected count */}
          {values.length > 0 && (
            <div className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
              {values.length} selected
            </div>
          )}

          {/* Options List */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="max-h-60 overflow-y-auto"
          >
            {loading && options.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <span>Loading options...</span>
              </div>
            ) : displayedOptions.length === 0 ? (
              <div className="px-3 py-8 text-center text-gray-500">
                {emptyMessage}
              </div>
            ) : (
              displayedOptions.map(option => {
                const isSelected = values.includes(option.value)
                return (
                  <div
                    key={option.value}
                    onClick={(e) => handleOptionClick(e, option.value, option.disabled)}
                    onMouseDown={(e) => e.preventDefault()}
                    className={clsx(
                      'w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer select-none',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                      option.disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className={clsx(
                        'w-4 h-4 flex-shrink-0 rounded border-2 flex items-center justify-center',
                        isSelected
                          ? 'bg-blue-500 border-blue-500'
                          : 'border-gray-300 dark:border-gray-600'
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">{renderOptionContent(option)}</div>
                    </div>
                  </div>
                )
              })
            )}

            {/* Load more indicator */}
            {displayCount < filteredOptions.length && (
              <div className="px-3 py-2 text-center text-xs text-gray-500 border-t border-gray-200 dark:border-gray-700">
                Showing {displayCount} of {filteredOptions.length} • Scroll for more
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredOptions.length > 0 && (
            <div className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between">
              <span>
                {searchQuery
                  ? `${filteredOptions.length} matching`
                  : `${options.length} total`
                }
              </span>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export default SearchableSelect
