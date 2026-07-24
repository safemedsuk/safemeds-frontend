'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react'

interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  width?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  pageSize?: number
  onRowClick?: (row: T) => void
}

type SortDirection = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1)
  const [sortKey, setSortKey] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Filter data
  const filteredData = useMemo(() => {
    let result = data

    // Apply search
    if (searchQuery) {
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key]
          return String(value).toLowerCase().includes(searchQuery.toLowerCase())
        })
      )
    }

    // Apply column filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => {
          const rowValue = row[key as keyof T]
          return String(rowValue).toLowerCase().includes(value.toLowerCase())
        })
      }
    })

    return result
  }, [data, searchQuery, filters, columns])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return filteredData

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortKey]
      const bValue = b[sortKey]

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredData, sortKey, sortDirection])

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize)

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortKey(null)
        setSortDirection(null)
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }))
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setFilters({})
    setSearchQuery('')
    setSortKey(null)
    setSortDirection(null)
    setCurrentPage(1)
  }

  const getSortIcon = (key: keyof T) => {
    if (sortKey !== key) return <ChevronUp className="h-4 w-4 opacity-30" />
    if (sortDirection === 'asc') return <ChevronUp className="h-4 w-4" />
    return <ChevronDown className="h-4 w-4" />
  }

  const hasActiveFilters = searchQuery || Object.values(filters).some(v => v)

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search table..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value)
              setCurrentPage(1)
            }}
            className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
          />
        </div>

        {/* Filter & Clear Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 rounded-lg border border-status-error/30 bg-status-error/5 px-3 py-2 text-sm font-medium text-status-error hover:bg-status-error/10 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {columns.map(col => {
              if (!col.filterable) return null
              return (
                <div key={String(col.key)}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {col.label}
                  </label>
                  <input
                    type="text"
                    placeholder={`Filter ${col.label}...`}
                    value={filters[String(col.key)] || ''}
                    onChange={e => handleFilterChange(String(col.key), e.target.value)}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-safemeds-teal"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  style={{ width: col.width }}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-2 hover:text-foreground transition-colors"
                    >
                      {col.label}
                      {getSortIcon(col.key)}
                    </button>
                  ) : (
                    <span>{col.label}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No data found
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={idx}
                  onClick={() => onRowClick?.(row)}
                  className={`border-b border-border transition-colors ${onRowClick ? 'hover:bg-muted/50 cursor-pointer' : ''}`}
                >
                  {columns.map(col => (
                    <td key={String(col.key)} className="px-4 py-3 text-sm text-foreground">
                      {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Showing {startIndex + 1} to {Math.min(startIndex + pageSize, sortedData.length)} of{' '}
            {sortedData.length} results
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-input bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`rounded px-2 py-1 text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-safemeds-teal text-white'
                        : 'border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              {totalPages > 5 && <span className="text-muted-foreground">...</span>}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-input bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
