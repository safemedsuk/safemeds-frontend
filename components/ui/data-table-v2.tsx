'use client'

import React, { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search, LayoutGrid, ListFilter, Eye, EyeOff, Download, Loader2 } from 'lucide-react'

export type DensityMode = 'compact' | 'normal' | 'spacious'

/**
 * A real dataset (audit_entry is unbounded and append-only) can reach
 * thousands of pages — rendering one button per page breaks down long
 * before then. Always keeps the first and last page, a window around the
 * current page, and collapses the rest into "…" gaps.
 */
function paginationRange(current: number, total: number): (number | 'ellipsis')[] {
  const windowSize = 1
  const pages = new Set<number>([1, total, current])
  for (let offset = 1; offset <= windowSize; offset++) {
    if (current - offset >= 1) pages.add(current - offset)
    if (current + offset <= total) pages.add(current + offset)
  }
  const sorted = Array.from(pages).sort((a, b) => a - b)

  const result: (number | 'ellipsis')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      result.push('ellipsis')
    }
    result.push(sorted[i])
  }
  return result
}

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
  /**
   * Controlled/server-driven pagination — pass all four of `page`,
   * `totalPages`, `totalCount`, and `onPageChange` together to switch the
   * table from computing search/sort/pagination over the full in-memory
   * `data` array to trusting the caller: `data` is assumed to already be
   * the correct page from the server, and search/sort inputs report
   * through `onSearchChange`/`onSortChange` instead of filtering locally.
   * Omit all four (the default) to keep the original client-side behavior
   * — every existing call site keeps working unchanged.
   */
  page?: number
  totalPages?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  onSearchChange?: (search: string) => void
  onSortChange?: (column: keyof T | null, direction: 'asc' | 'desc') => void
  loading?: boolean
  /**
   * Offered choices for the rows-per-page control, shown next to the
   * "Showing X to Y of Z results" text whenever pagination is visible.
   * Defaults cover every real screen size this app uses today; pass a
   * different set for tables with unusually small or large datasets.
   */
  rowsPerPageOptions?: number[]
  /**
   * Provide this alongside server-driven `page`/`totalPages`/`totalCount`/
   * `onPageChange` to let the rows-per-page control drive a real refetch
   * at a new page size (resetting to page 1 is the caller's own
   * responsibility, same as `onSearchChange`). When omitted, the table
   * still shows the control but manages the chosen size itself against
   * the in-memory `data` array — every existing call site that never
   * passes this keeps its exact current behavior.
   */
  onRowsPerPageChange?: (rowsPerPage: number) => void
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
  page,
  totalPages: controlledTotalPages,
  totalCount,
  onPageChange,
  onSearchChange,
  onSortChange,
  loading = false,
  rowsPerPageOptions = [10, 25, 50, 100],
  onRowsPerPageChange,
}: DataTableProps<T>) {
  const isControlled = page !== undefined && controlledTotalPages !== undefined && onPageChange !== undefined
  const isRowsPerPageControlled = onRowsPerPageChange !== undefined

  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<keyof T | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [uncontrolledPage, setUncontrolledPage] = useState(1)
  const [uncontrolledRowsPerPage, setUncontrolledRowsPerPage] = useState(rowsPerPage)
  const effectiveRowsPerPage = isRowsPerPageControlled ? rowsPerPage : uncontrolledRowsPerPage
  const [visibleColumns, setVisibleColumns] = useState<Set<keyof T>>(
    new Set(columns.map(c => c.key))
  )
  const [showColumnToggle, setShowColumnToggle] = useState(false)

  // Filter data — skipped entirely in controlled mode, where `data` is
  // already the server's filtered/sorted/paginated page.
  const filteredData = useMemo(() => {
    if (isControlled) return data
    return data.filter(row =>
      columns.some(col => {
        const value = String(row[col.key] || '').toLowerCase()
        return value.includes(searchTerm.toLowerCase())
      })
    )
  }, [data, columns, searchTerm, isControlled])

  // Sort data
  const sortedData = useMemo(() => {
    if (isControlled || !sortColumn) return filteredData

    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn]
      const bVal = b[sortColumn]

      if (aVal === bVal) return 0
      const comparison = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection, isControlled])

  // Paginate data
  const paginatedData = useMemo(() => {
    if (isControlled) return sortedData
    const start = (uncontrolledPage - 1) * effectiveRowsPerPage
    return sortedData.slice(start, start + effectiveRowsPerPage)
  }, [sortedData, uncontrolledPage, effectiveRowsPerPage, isControlled])

  const currentPage = isControlled ? page! : uncontrolledPage
  const totalPages = isControlled ? controlledTotalPages! : Math.ceil(sortedData.length / effectiveRowsPerPage)
  const resultCount = isControlled ? (totalCount ?? data.length) : sortedData.length

  const goToPage = (next: number) => {
    if (isControlled) {
      onPageChange!(next)
    } else {
      setUncontrolledPage(next)
    }
  }

  const handleRowsPerPageChange = (next: number) => {
    if (isRowsPerPageControlled) {
      onRowsPerPageChange!(next)
    } else {
      setUncontrolledRowsPerPage(next)
      setUncontrolledPage(1)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    if (isControlled) {
      onSearchChange?.(value)
    } else {
      setUncontrolledPage(1)
    }
  }

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable) return

    const nextDirection: 'asc' | 'desc' = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column.key)
    setSortDirection(nextDirection)
    if (isControlled) {
      onSortChange?.(column.key, nextDirection)
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
                onChange={e => handleSearchChange(e.target.value)}
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
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-[var(--surface)] relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)]/60">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          </div>
        )}
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
            <span>
              Showing {Math.min((currentPage - 1) * effectiveRowsPerPage + 1, resultCount)} to{' '}
              {Math.min(currentPage * effectiveRowsPerPage, resultCount)} of {resultCount} results
            </span>
            <label className="flex items-center gap-1.5">
              Rows per page
              <select
                value={effectiveRowsPerPage}
                onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-sm text-[var(--text)]"
              >
                {rowsPerPageOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => goToPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg border border-[var(--border)] text-sm text-[var(--text)] hover:bg-[var(--surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {paginationRange(currentPage, totalPages).map((entry, idx) =>
                entry === 'ellipsis' ? (
                  <span key={`ellipsis-${idx}`} className="px-1.5 text-sm text-[var(--text-muted)]">
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    onClick={() => goToPage(entry)}
                    className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                      currentPage === entry
                        ? 'bg-[var(--primary)] text-white'
                        : 'text-[var(--text)] hover:bg-[var(--surface-raised)]'
                    }`}
                  >
                    {entry}
                  </button>
                ),
              )}
            </div>

            <button
              onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
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
