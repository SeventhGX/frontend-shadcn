"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react"

import { type KnowledgeFile } from "@/features/knowledge/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const PAGE_SIZE_OPTIONS = [10, 20, 50]

interface KnowledgeDataTableProps {
  data: KnowledgeFile[]
  loading?: boolean
  /** 正在上传文件 */
  uploading?: boolean
  /** 正在编码文件 */
  embedding?: boolean
  onRefresh?: () => void
  onUpload?: (files: File[]) => void
  onEmbed?: (fileIds: string[]) => void
  onDelete?: (fileIds: string[]) => void
}

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, "yyyy-MM-dd HH:mm")
}

export function KnowledgeDataTable({
  data,
  loading = false,
  uploading = false,
  embedding = false,
  onRefresh,
  onUpload,
  onEmbed,
  onDelete,
}: KnowledgeDataTableProps) {
  const [query, setQuery] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  // 待删除确认的文件 ID（null 表示未打开确认弹窗）
  const [deleteTargetIds, setDeleteTargetIds] = React.useState<string[] | null>(
    null
  )
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 根据文件名过滤
  const filteredData = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return data
    return data.filter((item) =>
      item.filename.toLowerCase().includes(keyword)
    )
  }, [data, query])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))

  // 当过滤结果或分页大小变化导致当前页越界时，回退到有效页
  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const pagedData = React.useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredData.slice(start, start + pageSize)
  }, [filteredData, page, pageSize])

  // 当前页是否全选
  const allPageSelected =
    pagedData.length > 0 && pagedData.every((item) => selectedIds.has(item.file_id))
  const somePageSelected = pagedData.some((item) => selectedIds.has(item.file_id))

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      pagedData.forEach((item) => {
        if (checked) next.add(item.file_id)
        else next.delete(item.file_id)
      })
      return next
    })
  }

  const toggleRow = (fileId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(fileId)
      else next.delete(fileId)
      return next
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : []
    if (files.length > 0) {
      onUpload?.(files)
    }
    // 重置 input 以便同名文件可再次触发 change
    e.target.value = ""
  }

  const selectedCount = selectedIds.size

  // 打开删除确认弹窗
  const requestDelete = (fileIds: string[]) => {
    if (fileIds.length > 0) {
      setDeleteTargetIds(fileIds)
    }
  }

  // 待删除文件对应的条目（用于弹窗展示文件名）
  const deleteTargetFiles = React.useMemo(
    () =>
      deleteTargetIds
        ? data.filter((item) => deleteTargetIds.includes(item.file_id))
        : [],
    [data, deleteTargetIds]
  )

  // 确认删除
  const confirmDelete = () => {
    if (!deleteTargetIds) return
    const ids = deleteTargetIds
    onDelete?.(ids)
    // 乐观地从选择集中移除已删除项
    setSelectedIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    setDeleteTargetIds(null)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 隐藏的文件上传输入 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 删除确认弹窗 */}
      <Dialog
        open={deleteTargetIds !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetIds(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除文件</DialogTitle>
            <DialogDescription>
              确认删除以下 {deleteTargetFiles.length} 个文件吗？已编码的文件会同步删除其切片与向量内容，操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto rounded-md border">
            <ul className="divide-y text-sm">
              {deleteTargetFiles.map((file) => (
                <li
                  key={file.file_id}
                  className="truncate px-3 py-1.5"
                  title={file.filename}
                >
                  {file.filename}
                </li>
              ))}
            </ul>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 size={16} />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="搜索文件名..."
            className="pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "animate-spin" : undefined}
              size={16}
            />
            刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEmbed?.(Array.from(selectedIds))}
            disabled={selectedCount === 0 || embedding}
          >
            <Sparkles size={16} />
            编码选中{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestDelete(Array.from(selectedIds))}
            disabled={selectedCount === 0}
          >
            <Trash2 size={16} />
            删除选中
          </Button>
          <Button size="sm" onClick={handleUploadClick} disabled={uploading}>
            <Upload size={16} />
            {uploading ? "上传中..." : "上传文件"}
          </Button>
        </div>
      </div>

      {/* 数据表 */}
      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allPageSelected
                      ? true
                      : somePageSelected
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={(checked) => toggleAllOnPage(!!checked)}
                  aria-label="全选当前页"
                />
              </TableHead>
              <TableHead>文件名</TableHead>
              <TableHead className="w-44">上传日期</TableHead>
              <TableHead className="w-32">是否完成编码</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : pagedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground h-24 text-center"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((item) => {
                const checked = selectedIds.has(item.file_id)
                return (
                  <TableRow
                    key={item.file_id}
                    data-state={checked ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleRow(item.file_id, !!value)
                        }
                        aria-label="选择行"
                      />
                    </TableCell>
                    <TableCell
                      className="max-w-0 truncate font-medium"
                      title={item.filename}
                    >
                      {item.filename}
                    </TableCell>
                    <TableCell>{formatDate(item.create_time)}</TableCell>
                    <TableCell>
                      {item.is_embedded ? (
                        <Badge>已编码</Badge>
                      ) : (
                        <Badge variant="secondary">未编码</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                          >
                            <MoreHorizontal size={16} />
                            <span className="sr-only">操作</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={item.is_embedded || embedding}
                            onClick={() => onEmbed?.([item.file_id])}
                          >
                            <Sparkles size={16} />
                            编码
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => requestDelete([item.file_id])}
                          >
                            <Trash2 size={16} />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-sm">
          已选择 {selectedCount} / {filteredData.length} 项
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">每页</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value))
                setPage(1)
              }}
            >
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">
              第 {page} / {totalPages} 页
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft size={16} />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
