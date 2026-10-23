import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/state-feedback"
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type DataTableSortDirection = "asc" | "desc"

type DataTableSorting = {
  columnId: string
  direction: DataTableSortDirection
}

type DataTableSortValue = Date | boolean | number | string | null | undefined

type DataTableColumn<TData> = {
  id: string
  header: ReactNode
  cell: (row: TData) => ReactNode
  sortValue?: (row: TData) => DataTableSortValue
  sortable?: boolean
  searchableValue?: (row: TData) => string
  width?: string
  align?: "left" | "center" | "right"
  className?: string
  headerClassName?: string
}

type DataTablePaginationConfig = {
  pageSize?: number
  pageSizeOptions?: readonly number[]
  variant?: "compact" | "default"
}

type DataTableRowSelectionConfig<TData> = {
  selectedRowIds?: readonly string[]
  defaultSelectedRowIds?: readonly string[]
  isRowSelectable?: (row: TData) => boolean
  onSelectionChange?: (selectedRowIds: string[], selectedRows: TData[]) => void
}

type DataTableToolbarContext<TData> = {
  clearSelection: () => void
  filteredRowCount: number
  selectedRowCount: number
  selectedRows: TData[]
  totalRowCount: number
}

type DataTableLabels = {
  actions: string
  clearSort: string
  goToNextPage: string
  goToPreviousPage: string
  loading: string
  page: string
  rowsPerPage: string
  selectAllRows: string
  selectRow: (rowLabel: string) => string
  showingRows: (from: number, to: number, total: number) => string
  sortAscending: string
  sortDescending: string
}

type DataTableProps<TData> = {
  actionsColumnWidth?: string
  activeRowId?: string
  caption: string
  className?: string
  columns: readonly DataTableColumn<TData>[]
  data: readonly TData[]
  defaultSorting?: DataTableSorting | null
  emptyState?: ReactNode
  error?: boolean
  errorState?: ReactNode
  filterFn?: (row: TData) => boolean
  getRowId: (row: TData) => string
  getRowLabel?: (row: TData) => string
  globalFilter?: string
  isLoading?: boolean
  labels?: Partial<DataTableLabels>
  onRetry?: () => void
  onRowClick?: (row: TData) => void
  onSortingChange?: (sorting: DataTableSorting | null) => void
  pagination?: false | DataTablePaginationConfig
  rowActions?: (row: TData) => ReactNode
  rowSelection?: DataTableRowSelectionConfig<TData>
  sorting?: DataTableSorting | null
  tableClassName?: string
  toolbar?: ReactNode | ((context: DataTableToolbarContext<TData>) => ReactNode)
  showActionsHeader?: boolean
}

const defaultLabels: DataTableLabels = {
  actions: "Thao tác",
  clearSort: "Bỏ sắp xếp",
  goToNextPage: "Trang sau",
  goToPreviousPage: "Trang trước",
  loading: "Đang tải dữ liệu…",
  page: "trang",
  rowsPerPage: "Số dòng mỗi trang",
  selectAllRows: "Chọn tất cả dòng trên trang này",
  selectRow: (rowLabel) => `Chọn ${rowLabel}`,
  showingRows: (from, to, total) => `${from}–${to} / ${total}`,
  sortAscending: "Sắp xếp tăng dần",
  sortDescending: "Sắp xếp giảm dần",
}

const alignmentClasses = {
  center: "text-center",
  left: "text-left",
  right: "text-right",
} as const

function compareSortValues(left: DataTableSortValue, right: DataTableSortValue) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1

  const normalizedLeft = left instanceof Date ? left.getTime() : left
  const normalizedRight = right instanceof Date ? right.getTime() : right

  if (typeof normalizedLeft === "number" && typeof normalizedRight === "number") {
    return normalizedLeft - normalizedRight
  }

  if (typeof normalizedLeft === "boolean" && typeof normalizedRight === "boolean") {
    return Number(normalizedLeft) - Number(normalizedRight)
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), "vi", {
    numeric: true,
    sensitivity: "base",
  })
}

function DataTableCheckbox({
  checked,
  disabled = false,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  indeterminate?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <label
      className="inline-flex size-7 items-center justify-center rounded focus-within:ring-2 focus-within:ring-ring/35 focus-within:ring-offset-2 focus-within:ring-offset-surface"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 rounded border-input accent-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
      />
      <span className="sr-only">{label}</span>
    </label>
  )
}

function DataTable<TData>({
  actionsColumnWidth,
  activeRowId,
  caption,
  className,
  columns,
  data,
  defaultSorting = null,
  emptyState,
  error = false,
  errorState,
  filterFn,
  getRowId,
  getRowLabel = getRowId,
  globalFilter = "",
  isLoading = false,
  labels: labelOverrides,
  onRetry,
  onRowClick,
  onSortingChange,
  pagination = false,
  rowActions,
  rowSelection,
  sorting,
  tableClassName,
  toolbar,
  showActionsHeader = false,
}: DataTableProps<TData>) {
  const labels = { ...defaultLabels, ...labelOverrides }
  const [internalSorting, setInternalSorting] = useState<DataTableSorting | null>(defaultSorting)
  const [internalSelectedRowIds, setInternalSelectedRowIds] = useState<string[]>(
    () => [...(rowSelection?.defaultSelectedRowIds ?? [])],
  )
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(pagination === false ? data.length || 1 : pagination.pageSize ?? 10)
  const resolvedSorting = sorting === undefined ? internalSorting : sorting
  const selectedRowIds = rowSelection?.selectedRowIds ?? internalSelectedRowIds
  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds])
  const normalizedQuery = globalFilter.trim().toLocaleLowerCase("vi")

  const filteredRows = useMemo(
    () =>
      data.filter((row) => {
        if (filterFn && !filterFn(row)) return false
        if (!normalizedQuery) return true

        const searchableText = columns
          .map((column) => column.searchableValue?.(row) ?? "")
          .join(" ")
          .toLocaleLowerCase("vi")

        return searchableText.includes(normalizedQuery)
      }),
    [columns, data, filterFn, normalizedQuery],
  )

  const sortedRows = useMemo(() => {
    if (!resolvedSorting) return filteredRows
    const column = columns.find((item) => item.id === resolvedSorting.columnId)
    if (!column?.sortValue) return filteredRows

    const direction = resolvedSorting.direction === "asc" ? 1 : -1
    return [...filteredRows].sort(
      (left, right) => compareSortValues(column.sortValue?.(left), column.sortValue?.(right)) * direction,
    )
  }, [columns, filteredRows, resolvedSorting])

  const paginationEnabled = pagination !== false
  const pageCount = paginationEnabled ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1
  const visibleRows = paginationEnabled
    ? sortedRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize)
    : sortedRows

  useEffect(() => {
    setPageIndex(0)
  }, [filterFn, normalizedQuery, pageSize, resolvedSorting])

  useEffect(() => {
    setPageIndex((current) => Math.min(current, pageCount - 1))
  }, [pageCount])

  function updateSorting(column: DataTableColumn<TData>) {
    if (!column.sortValue) return

    let nextSorting: DataTableSorting | null
    if (resolvedSorting?.columnId !== column.id) {
      nextSorting = { columnId: column.id, direction: "asc" }
    } else if (resolvedSorting.direction === "asc") {
      nextSorting = { columnId: column.id, direction: "desc" }
    } else {
      nextSorting = null
    }

    if (sorting === undefined) setInternalSorting(nextSorting)
    onSortingChange?.(nextSorting)
  }

  function updateSelection(nextSelectedRowIds: string[]) {
    if (rowSelection?.selectedRowIds === undefined) setInternalSelectedRowIds(nextSelectedRowIds)
    const nextIdSet = new Set(nextSelectedRowIds)
    rowSelection?.onSelectionChange?.(
      nextSelectedRowIds,
      data.filter((row) => nextIdSet.has(getRowId(row))),
    )
  }

  const selectableVisibleRows = visibleRows.filter((row) => rowSelection?.isRowSelectable?.(row) !== false)
  const allVisibleRowsSelected =
    selectableVisibleRows.length > 0 && selectableVisibleRows.every((row) => selectedRowIdSet.has(getRowId(row)))
  const someVisibleRowsSelected = selectableVisibleRows.some((row) => selectedRowIdSet.has(getRowId(row)))
  const selectedRows = data.filter((row) => selectedRowIdSet.has(getRowId(row)))

  function toggleVisibleRows(checked: boolean) {
    const nextIds = new Set(selectedRowIds)
    selectableVisibleRows.forEach((row) => {
      const rowId = getRowId(row)
      if (checked) nextIds.add(rowId)
      else nextIds.delete(rowId)
    })
    updateSelection([...nextIds])
  }

  function toggleRow(row: TData, checked: boolean) {
    const nextIds = new Set(selectedRowIds)
    const rowId = getRowId(row)
    if (checked) nextIds.add(rowId)
    else nextIds.delete(rowId)
    updateSelection([...nextIds])
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: TData) {
    if (!onRowClick || (event.key !== "Enter" && event.key !== " ")) return
    event.preventDefault()
    onRowClick(row)
  }

  const toolbarContext: DataTableToolbarContext<TData> = {
    clearSelection: () => updateSelection([]),
    filteredRowCount: filteredRows.length,
    selectedRowCount: selectedRows.length,
    selectedRows,
    totalRowCount: data.length,
  }
  const columnCount = columns.length + (rowSelection ? 1 : 0) + (rowActions ? 1 : 0)
  const pageStart = sortedRows.length === 0 ? 0 : pageIndex * pageSize + 1
  const pageEnd = paginationEnabled
    ? Math.min((pageIndex + 1) * pageSize, sortedRows.length)
    : sortedRows.length
  const hasFullWidthState = error || (!isLoading && visibleRows.length === 0)
  const compactPagination = paginationEnabled && pagination.variant === "compact"

  return (
    <div className={cn("space-y-3", className)}>
      {toolbar && (typeof toolbar === "function" ? toolbar(toolbarContext) : toolbar)}

      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-panel">
        {isLoading && (
          <p role="status" aria-live="polite" className="sr-only">
            {labels.loading}
          </p>
        )}
        <TableContainer className="overscroll-x-contain">
          <Table
            className={cn(
              "table-fixed",
              hasFullWidthState ? "min-w-full" : "min-w-[760px]",
              tableClassName,
            )}
          >
            <caption className="sr-only">{caption}</caption>
            <colgroup>
              {rowSelection && <col className="w-10" />}
              {columns.map((column) => (
                <col key={column.id} style={column.width ? { width: column.width } : undefined} />
              ))}
              {rowActions && (
                <col
                  className={actionsColumnWidth ? undefined : "w-12"}
                  style={actionsColumnWidth ? { width: actionsColumnWidth } : undefined}
                />
              )}
            </colgroup>
            <TableHeader>
              <tr>
                {rowSelection && (
                  <TableHead className="px-3 text-center">
                    <DataTableCheckbox
                      checked={allVisibleRowsSelected}
                      indeterminate={!allVisibleRowsSelected && someVisibleRowsSelected}
                      label={labels.selectAllRows}
                      onChange={toggleVisibleRows}
                    />
                  </TableHead>
                )}
                {columns.map((column) => {
                  const canSort = Boolean(column.sortValue && column.sortable !== false)
                  const isSorted = resolvedSorting?.columnId === column.id
                  const ariaSort = !isSorted
                    ? "none"
                    : resolvedSorting.direction === "asc"
                      ? "ascending"
                      : "descending"

                  return (
                    <TableHead
                      key={column.id}
                      aria-sort={canSort ? ariaSort : undefined}
                      className={cn(alignmentClasses[column.align ?? "left"], column.headerClassName)}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => updateSorting(column)}
                          className={cn(
                            "-mx-1 inline-flex h-7 max-w-full items-center gap-1 rounded px-1 text-left transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                            column.align === "right" && "ml-auto",
                          )}
                          title={
                            isSorted && resolvedSorting.direction === "desc"
                              ? labels.clearSort
                              : !isSorted
                                ? labels.sortAscending
                                : labels.sortDescending
                          }
                        >
                          <span className="truncate">{column.header}</span>
                          {isSorted ? (
                            resolvedSorting.direction === "asc" ? (
                              <ArrowUp aria-hidden="true" className="size-3.5 shrink-0 text-accent-strong" />
                            ) : (
                              <ArrowDown aria-hidden="true" className="size-3.5 shrink-0 text-accent-strong" />
                            )
                          ) : (
                            <ArrowUpDown aria-hidden="true" className="size-3.5 shrink-0 opacity-45" />
                          )}
                          <span className="sr-only">
                            {isSorted && resolvedSorting.direction === "desc"
                              ? labels.clearSort
                              : !isSorted || resolvedSorting.direction === "desc"
                                ? labels.sortAscending
                                : labels.sortDescending}
                          </span>
                        </button>
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  )
                })}
                {rowActions && (
                  <TableHead className="px-2 text-right">
                    <span className={showActionsHeader ? undefined : "sr-only"}>{labels.actions}</span>
                  </TableHead>
                )}
              </tr>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }, (_, rowIndex) => (
                  <TableRow key={`loading-${rowIndex}`}>
                    {Array.from({ length: columnCount }, (_, columnIndex) => (
                      <TableCell key={`loading-${rowIndex}-${columnIndex}`}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="p-0">
                    {errorState ?? <ErrorState onRetry={onRetry} />}
                  </TableCell>
                </TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columnCount} className="p-0">
                    {emptyState ?? <EmptyState />}
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((row) => {
                  const rowId = getRowId(row)
                  const isSelected = selectedRowIdSet.has(rowId)
                  const isActive = activeRowId === rowId
                  const canSelect = rowSelection?.isRowSelectable?.(row) !== false

                  return (
                    <TableRow
                      key={rowId}
                      selected={isSelected || isActive}
                      aria-current={isActive ? "true" : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                      className={cn(
                        onRowClick && "cursor-pointer focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                        isActive && "shadow-[inset_2px_0_0_var(--accent)]",
                      )}
                    >
                      {rowSelection && (
                        <TableCell className="px-3 text-center">
                          <DataTableCheckbox
                            checked={isSelected}
                            disabled={!canSelect}
                            label={labels.selectRow(getRowLabel(row))}
                            onChange={(checked) => toggleRow(row, checked)}
                          />
                          {!canSelect && <span className="sr-only">Không thể chọn dòng này</span>}
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell
                          key={`${rowId}-${column.id}`}
                          className={cn(alignmentClasses[column.align ?? "left"], column.className)}
                        >
                          {column.cell(row)}
                        </TableCell>
                      ))}
                      {rowActions && (
                        <TableCell
                          className="px-2 text-right"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {rowActions(row)}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {paginationEnabled && !isLoading && !error && sortedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-background/45 px-3 py-2 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {labels.showingRows(pageStart, pageEnd, sortedRows.length)}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {!compactPagination && (
                <label className="flex items-center gap-2">
                  <span className="sr-only">{labels.rowsPerPage}</span>
                  <select
                    aria-label={labels.rowsPerPage}
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                    className="h-8 rounded-md border border-input bg-surface px-2 text-xs text-foreground focus:border-primary/45 focus:outline-none focus:ring-2 focus:ring-ring/15"
                  >
                    {(pagination.pageSizeOptions ?? [10, 25, 50]).map((option) => (
                      <option key={option} value={option}>
                        {option} / {labels.page}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={labels.goToPreviousPage}
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              {compactPagination ? (
                <span
                  aria-current="page"
                  className="grid size-8 place-items-center rounded-md border border-accent bg-surface font-semibold tabular-nums text-accent-strong"
                >
                  {pageIndex + 1}
                </span>
              ) : (
                <span className="min-w-14 text-center font-medium tabular-nums text-foreground">
                  {pageIndex + 1} / {pageCount}
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={labels.goToNextPage}
                disabled={pageIndex >= pageCount - 1}
                onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { DataTable }
export type {
  DataTableColumn,
  DataTableLabels,
  DataTablePaginationConfig,
  DataTableRowSelectionConfig,
  DataTableSorting,
  DataTableToolbarContext,
}
