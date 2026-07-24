'use client'

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, LayoutGrid, ListFilter, Eye, EyeOff, Download } from 'lucide-react'

export type DensityMode = 'compact' | 'normal' | 'spacious'

export interface DataTableColumn<T> {
  key: keyof T
  label: string
  width?: string
  sortable?: boolean
  filterable?: boolean
  render?: (value: any, row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
}

export interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  title?: string
  description?: string
  actions?: React.ReactNode
  onRowClick?: (row: T) => void
  density?: DensityMode
  onDensityChange?: (density: DensityMode) => void
  showDensityToggle?: boolean
  searchable?: boolean
  filterable?: boolean
  exportable?: boolean
  onExport?: () => void
  rowsPerPage?: number
}

export function DataTableV2<T extends { id: string }>({
  data,
  columns,
  title,
  description,
  actions,
  onRowClick,
  density = 'normal',
  onDensityChange,
  showDensityToggle = true,
  searchable = true,
  filterable = true,
  exportable = true,
  onExport,
  rowsPerPage = 10,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof T>>(
    new Set(columns.map(c => c.key))
  )
  const [showColumnToggle, setShowColumnToggle] = useState(false)

  // Filter data
  const filteredData = useMemo(() => {
    return data.filter(row =>
      columns.some(col => {
        const value = String(row[col.key] || '').toLowerCase()
        return value.includes(searchTerm.toLowerCase())
      })
    )
  }, [data, columns, searchTerm])

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]
      
      if (aVal === bVal) return 0
      const comparison = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage
    return sortedData.slice(start, start + rowsPerPage)
  }, [sortedData, currentPage, rowsPerPage])

  const totalPages = Math.ceil(sortedData.length / rowsPerPage)

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return
    
    if (sortColumn === column.key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column.key)
      setSortDirection('asc')
    }
  }

  const toggleColumn = (key: keyof T) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(key)) {
      newVisible.delete(key)
    } else {
      newVisible.add(key)
    }
    setVisibleColumns(newVisible)
  }

  const densityClasses = {
    compact: { tr: 'h-8', th: 'py-2 px-3 text-xs', td: 'py-2 px-3 text-xs' },
    normal: { tr: 'h-12', th: 'py-3 px-4 text-sm', td: 'py-3 px-4 text-sm' },
    spacious: { tr: 'h-16', th: 'py-4 px-6 text-base', td: 'py-4 px-6 text-base' },
  }

  const { tr, th, td } = densityClasses[density]

  return (
    <div className="space-y-4">
      {/* Header */}
      {(title || description) && (
        <div>
          {title && <h2 className="text-xl font-semibold text-[var(--text)]">{title}</h2>}
          {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-2 min-w-[250px]">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-lg pl-9 pr-3 py-2 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {actions}

          {showDensityToggle && onDensityChange && (
            <div className="flex items-center bg-[var(--surface)] border border-[var(--border)] rounded-lg">
              {(['compact', 'normal', 'spacious'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => onDensityChange(mode)}
                  className={`px-2 py-1 text-xs font-medium transition-colors ${
                    density === mode
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                  title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} density`}
                >
                  {mode.charAt(0).toUpperCase()}
                </button>
              ))}
            </div>
          )}

          {/* Column Visibility Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowColumnToggle(!showColumnToggle)}
              className="p-2 hover:bg-[var(--surface-raised)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)]"
              title="Toggle columns"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            
            {showColumnToggle && (
              <div className="absolute right-0 top-full mt-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-lg z-10 p-2 min-w-[150px]">
                {columns.map(col => (
                  <label key={String(col.key)} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--surface-raised)] rounded text-sm">
                    <input
                      type="checkbox"
                      checked={visibleColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {exportable && onExport && (
            <button
              onClick={onExport}
              className="p-2 hover:bg-[var(--surface-raised)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)]"
              title="Export data"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
              <tr>
                {columns
                  .filter(col => visibleColumns.has(col.key))
                  .map(col => (
                    <th
                      key={String(col.key)}
                      className={`${th} text-left font-semibold text-[var(--text)] border-b border-[var(--border)] ${
                        col.sortable ? 'cursor-pointer hover:bg-[var(--border)]' : ''
                      }`}
                      onClick={() => col.sortable && handleSort(col)}
                      style={{ width: col.width }}
                    >
                      <div className="flex items-center gap-2">
                        {col.label}
                        {col.sortable && sortColumn === col.key && (
                          sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4 text-[var(--primary)]" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-[var(--primary)]" />
                          )
                        )}
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.length > 0 ? (
                paginatedData.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`${tr} border-b border-[var(--border)] hover:bg-[var(--surface-raised)] transition-colors ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns
                      .filter(col => visibleColumns.has(col.key))
                      .map(col => (
                        <td
                          key={String(col.key)}
                          className={`${td} text-[var(--text)] text-${col.align || 'left'}`}
                        >
                          {col.render ? col.render(row[col.key], row) : String(row[col.key] || '')}
                        </td>
                      ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className={`${td} text-center text-[var(--text-muted)]`}>
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, sortedData.length)} to{' '}
            {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-[var(--primary)] text-white'
                      : 'text-[var(--text)] hover:bg-[var(--surface-raised)]'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
