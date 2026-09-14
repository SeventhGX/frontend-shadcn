"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Upload,
  CodeXml,
  X,
} from "lucide-react"

import {
  TAG_NAME_MAX_LENGTH,
  TAG_SELECT_MAX_COUNT,
  type KnowledgeFile,
  type KnowledgeTag,
} from "@/features/knowledge/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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

/** 列表可见范围筛选 */
type ScopeFilter = "all" | "mine" | "public"

const SCOPE_OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: "all", label: "全部文件" },
  { value: "mine", label: "个人文件" },
  { value: "public", label: "公共文件" },
]

interface KnowledgeDataTableProps {
  data: KnowledgeFile[]
  /** 当前用户的标签库 */
  tags?: KnowledgeTag[]
  /** 当前登录用户名，用于判断公共文件是否由本人发布 */
  currentUserName?: string
  loading?: boolean
  /** 正在上传文件 */
  uploading?: boolean
  /** 正在编码文件 */
  embedding?: boolean
  /** 正在公开 / 取消公开文件 */
  publishing?: boolean
  onRefresh?: () => void
  onUpload?: (files: File[]) => void
  onEmbed?: (fileIds: string[]) => void
  onDelete?: (fileIds: string[]) => void
  /** 公开已编码的个人文件 */
  onPublish?: (fileIds: string[]) => void
  /** 取消公开由本人发布的公共文件 */
  onUnpublish?: (fileIds: string[]) => void
  /** 保存文档标签（覆盖式），tagIds 来自标签库，newTags 为手动输入的新标签名 */
  onSaveTags?: (
    fileId: string,
    tagIds: string[],
    newTags: string[]
  ) => Promise<void> | void
  /** AI 自动打标，返回该文档打标后的完整标签列表 */
  onAutoTag?: (
    fileId: string,
    options: AutoTagOptions
  ) => Promise<KnowledgeTag[] | undefined>
}

/** AI 自动打标的可调参数 */
export interface AutoTagOptions {
  maxTags: number
  allowNewTags: boolean
}

function formatDate(value?: string) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return format(date, "yyyy-MM-dd HH:mm")
}

/** 标签单元格：默认折叠展示，悬浮后展开全部标签 */
function TagCell({ tags }: { tags?: KnowledgeTag[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex w-fit max-w-full cursor-default items-center gap-1">
          <Badge variant="secondary" className="min-w-0 truncate">
            {tags[0].name}
          </Badge>
          {tags.length > 1 && (
            <Badge variant="outline" className="shrink-0">
              +{tags.length - 1}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag.id}
              className="bg-background/20 rounded px-1.5 py-0.5"
            >
              {tag.name}
            </span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

/** 标签编辑弹窗：支持标签库搜索选择、手动输入、AI 自动生成 */
function TagEditorDialog({
  file,
  allTags,
  onClose,
  onSave,
  onAutoTag,
}: {
  file: KnowledgeFile
  allTags: KnowledgeTag[]
  onClose: () => void
  onSave?: (
    fileId: string,
    tagIds: string[],
    newTags: string[]
  ) => Promise<void> | void
  onAutoTag?: (
    fileId: string,
    options: AutoTagOptions
  ) => Promise<KnowledgeTag[] | undefined>
}) {
  const [selectedIds, setSelectedIds] = React.useState<string[]>(
    () => file.tags?.map((tag) => tag.id) ?? []
  )
  const [newTags, setNewTags] = React.useState<string[]>([])
  // AI 自动打标可能返回标签库中尚未同步的新标签
  const [extraTags, setExtraTags] = React.useState<KnowledgeTag[]>(
    () => file.tags ?? []
  )
  const [keyword, setKeyword] = React.useState("")
  const [maxTagsInput, setMaxTagsInput] = React.useState("5")
  const [allowNewTags, setAllowNewTags] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [autoTagging, setAutoTagging] = React.useState(false)

  const maxTags = Math.min(
    TAG_SELECT_MAX_COUNT,
    Math.max(1, Number(maxTagsInput) || 1)
  )

  const tagMap = React.useMemo(() => {
    const map = new Map<string, KnowledgeTag>()
    ;[...extraTags, ...allTags].forEach((tag) => map.set(tag.id, tag))
    return map
  }, [allTags, extraTags])

  const trimmedKeyword = keyword.trim()
  const lowerKeyword = trimmedKeyword.toLowerCase()

  const filteredTags = React.useMemo(() => {
    if (!lowerKeyword) return allTags
    return allTags.filter((tag) =>
      tag.name.toLowerCase().includes(lowerKeyword)
    )
  }, [allTags, lowerKeyword])

  const canCreate =
    trimmedKeyword.length > 0 &&
    trimmedKeyword.length <= TAG_NAME_MAX_LENGTH &&
    !allTags.some((tag) => tag.name.toLowerCase() === lowerKeyword) &&
    !newTags.some((name) => name.toLowerCase() === lowerKeyword)

  const toggleTag = (tagId: string) => {
    setSelectedIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : prev.length >= TAG_SELECT_MAX_COUNT
          ? prev
          : [...prev, tagId]
    )
  }

  const addNewTag = () => {
    if (!canCreate || newTags.length >= TAG_SELECT_MAX_COUNT) return
    setNewTags((prev) => [...prev, trimmedKeyword])
    setKeyword("")
  }

  const handleAutoTag = async () => {
    if (!onAutoTag) return
    try {
      setAutoTagging(true)
      const tags = await onAutoTag(file.file_id, { maxTags, allowNewTags })
      if (!tags || tags.length === 0) return
      setExtraTags((prev) => {
        const map = new Map(prev.map((tag) => [tag.id, tag]))
        tags.forEach((tag) => map.set(tag.id, tag))
        return Array.from(map.values())
      })
      setSelectedIds((prev) =>
        Array.from(new Set([...prev, ...tags.map((tag) => tag.id)]))
      )
    } finally {
      setAutoTagging(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await onSave?.(file.file_id, selectedIds, newTags)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const totalSelected = selectedIds.length + newTags.length
  const busy = saving || autoTagging

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="min-w-0">
          <DialogTitle>添加标签</DialogTitle>
          <DialogDescription className="min-w-0">
            <span className="block truncate" title={file.filename}>
              为「{file.filename}」设置标签
            </span>
            <span>保存后将覆盖该文档的现有标签。</span>
          </DialogDescription>
        </DialogHeader>

        {/* 已选标签 */}
        <div className="min-h-9 min-w-0 rounded-md border p-2">
          {totalSelected === 0 ? (
            <span className="text-muted-foreground text-sm">暂未选择标签</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedIds.map((id) => (
                <Badge key={id} variant="secondary" className="gap-1">
                  <span className="max-w-32 truncate">
                    {tagMap.get(id)?.name ?? id}
                  </span>
                  <button
                    type="button"
                    aria-label="移除标签"
                    onClick={() =>
                      setSelectedIds((prev) =>
                        prev.filter((item) => item !== id)
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
              {newTags.map((name) => (
                <Badge key={`new-${name}`} variant="outline" className="gap-1">
                  <span className="max-w-32 truncate">{name}</span>
                  <button
                    type="button"
                    aria-label="移除标签"
                    onClick={() =>
                      setNewTags((prev) => prev.filter((item) => item !== name))
                    }
                  >
                    <X size={12} />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 标签库搜索 + 手动输入 */}
        <Command shouldFilter={false} className="min-w-0 rounded-md border">
          <CommandInput
            value={keyword}
            onValueChange={setKeyword}
            placeholder="搜索标签库，或输入新标签名后回车创建"
            maxLength={TAG_NAME_MAX_LENGTH}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && canCreate) {
                e.preventDefault()
                addNewTag()
              }
            }}
          />
          <CommandList className="max-h-52">
            {canCreate && (
              <CommandGroup heading="新建标签">
                <CommandItem value={`__create__${trimmedKeyword}`} onSelect={addNewTag}>
                  <TagIcon size={16} />
                  创建「{trimmedKeyword}」
                </CommandItem>
              </CommandGroup>
            )}
            {filteredTags.length === 0 ? (
              !canCreate && <CommandEmpty>标签库为空</CommandEmpty>
            ) : (
              <CommandGroup heading="标签库">
                {filteredTags.map((tag) => {
                  const checked = selectedIds.includes(tag.id)
                  return (
                    <CommandItem
                      key={tag.id}
                      value={tag.id}
                      onSelect={() => toggleTag(tag.id)}
                    >
                      <Checkbox checked={checked} className="pointer-events-none" />
                      <span className="truncate">{tag.name}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>

        {/* AI 自动生成 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoTag}
            disabled={busy || !onAutoTag}
          >
            {autoTagging ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {autoTagging ? "AI 生成中..." : "AI 自动生成"}
          </Button>
          <label className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">最多生成</span>
            <Input
              type="number"
              min={1}
              max={TAG_SELECT_MAX_COUNT}
              step={1}
              value={maxTagsInput}
              disabled={busy}
              onChange={(e) => setMaxTagsInput(e.target.value)}
              onBlur={() => setMaxTagsInput(String(maxTags))}
              className="h-7 w-16 px-2 py-0 text-xs tabular-nums"
            />
            <span className="text-muted-foreground">个</span>
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <Switch
              checked={allowNewTags}
              disabled={busy}
              onCheckedChange={setAllowNewTags}
            />
            <span className="text-muted-foreground">允许新建标签</span>
          </label>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={busy}>
              取消
            </Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={busy}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function KnowledgeDataTable({
  data,
  tags = [],
  currentUserName,
  loading = false,
  uploading = false,
  embedding = false,
  publishing = false,
  onRefresh,
  onUpload,
  onEmbed,
  onDelete,
  onPublish,
  onUnpublish,
  onSaveTags,
  onAutoTag,
}: KnowledgeDataTableProps) {
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<ScopeFilter>("all")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(10)
  // 待删除确认的文件 ID（null 表示未打开确认弹窗）
  const [deleteTargetIds, setDeleteTargetIds] = React.useState<string[] | null>(
    null
  )
  // 待编辑标签的文件 ID
  const [tagTargetId, setTagTargetId] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // 公共文件只能由原发布者取消公开，其余写操作一律禁用
  const canUnpublishFile = React.useCallback(
    (item: KnowledgeFile) =>
      !!item.is_public && !!currentUserName && item.source === currentUserName,
    [currentUserName]
  )

  // 根据可见范围和文件名过滤
  const filteredData = React.useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return data.filter((item) => {
      if (scope === "mine" && item.is_public) return false
      if (scope === "public" && !item.is_public) return false
      if (keyword && !item.filename.toLowerCase().includes(keyword)) return false
      return true
    })
  }, [data, query, scope])

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

  // 仅允许勾选可执行批量操作的文件
  const isSelectable = React.useCallback(
    (item: KnowledgeFile) => !item.is_public || canUnpublishFile(item),
    [canUnpublishFile]
  )

  const selectablePagedData = React.useMemo(
    () => pagedData.filter(isSelectable),
    [pagedData, isSelectable]
  )

  // 当前页是否全选
  const allPageSelected =
    selectablePagedData.length > 0 &&
    selectablePagedData.every((item) => selectedIds.has(item.file_id))
  const somePageSelected = selectablePagedData.some((item) =>
    selectedIds.has(item.file_id)
  )

  const toggleAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      selectablePagedData.forEach((item) => {
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

  const selectedFiles = React.useMemo(
    () => data.filter((item) => selectedIds.has(item.file_id)),
    [data, selectedIds]
  )

  // 公共文件不参与编码、删除等写操作
  const ownedSelectedIds = React.useMemo(
    () =>
      selectedFiles.filter((item) => !item.is_public).map((item) => item.file_id),
    [selectedFiles]
  )

  const publishableIds = React.useMemo(
    () =>
      selectedFiles
        .filter((item) => !item.is_public && item.is_embedded)
        .map((item) => item.file_id),
    [selectedFiles]
  )

  const unpublishableIds = React.useMemo(
    () => selectedFiles.filter(canUnpublishFile).map((item) => item.file_id),
    [selectedFiles, canUnpublishFile]
  )

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

  const tagTargetFile = React.useMemo(
    () => data.find((item) => item.file_id === tagTargetId) ?? null,
    [data, tagTargetId]
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

      {/* 标签编辑弹窗 */}
      {tagTargetFile && (
        <TagEditorDialog
          key={tagTargetFile.file_id}
          file={tagTargetFile}
          allTags={tags}
          onClose={() => setTagTargetId(null)}
          onSave={onSaveTags}
          onAutoTag={onAutoTag}
        />
      )}

      {/* 工具栏 */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
          <Select
            value={scope}
            onValueChange={(value) => {
              setScope(value as ScopeFilter)
              setPage(1)
            }}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            onClick={() => onEmbed?.(ownedSelectedIds)}
            disabled={ownedSelectedIds.length === 0 || embedding}
          >
            <CodeXml size={16} />
            编码选中
            {ownedSelectedIds.length > 0 ? ` (${ownedSelectedIds.length})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPublish?.(publishableIds)}
            disabled={publishableIds.length === 0 || publishing}
          >
            <Globe size={16} />
            公开{publishableIds.length > 0 ? ` (${publishableIds.length})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnpublish?.(unpublishableIds)}
            disabled={unpublishableIds.length === 0 || publishing}
          >
            <Lock size={16} />
            取消公开
            {unpublishableIds.length > 0 ? ` (${unpublishableIds.length})` : ""}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => requestDelete(ownedSelectedIds)}
            disabled={ownedSelectedIds.length === 0}
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
        {/* 固定表格布局：其余列定宽，剩余宽度全部留给文件名列 */}
        <Table className="table-fixed">
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
              <TableHead className="min-w-40">文件名</TableHead>
              <TableHead className="w-24 whitespace-nowrap">来源</TableHead>
              <TableHead className="w-28 whitespace-nowrap">标签</TableHead>
              <TableHead className="w-36 whitespace-nowrap">上传日期</TableHead>
              <TableHead className="w-24 whitespace-nowrap">编码状态</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  加载中...
                </TableCell>
              </TableRow>
            ) : pagedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground h-24 text-center"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((item) => {
                const checked = selectedIds.has(item.file_id)
                const isPublic = !!item.is_public
                const canUnpublish = canUnpublishFile(item)
                return (
                  <TableRow
                    key={item.file_id}
                    data-state={checked ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        disabled={!isSelectable(item)}
                        onCheckedChange={(value) =>
                          toggleRow(item.file_id, !!value)
                        }
                        aria-label="选择行"
                      />
                    </TableCell>
                    <TableCell
                      className="truncate font-medium"
                      title={item.filename}
                    >
                      {item.filename}
                    </TableCell>
                    <TableCell>
                      {isPublic ? (
                        <Badge variant="outline" className="max-w-full gap-1">
                          <Globe size={12} className="shrink-0" />
                          <span className="truncate" title={item.source}>
                            {item.source ?? "公共"}
                          </span>
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          私人
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TagCell tags={item.tags} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(item.create_time)}
                    </TableCell>
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
                          {!isPublic && (
                            <>
                              <DropdownMenuItem
                                disabled={item.is_embedded || embedding}
                                onClick={() => onEmbed?.([item.file_id])}
                              >
                                <CodeXml size={16} />
                                编码
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setTagTargetId(item.file_id)}
                              >
                                <TagIcon size={16} />
                                添加标签
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!item.is_embedded || publishing}
                                onClick={() => onPublish?.([item.file_id])}
                              >
                                <Globe size={16} />
                                公开
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => requestDelete([item.file_id])}
                              >
                                <Trash2 size={16} />
                                删除
                              </DropdownMenuItem>
                            </>
                          )}
                          {isPublic && canUnpublish && (
                            <DropdownMenuItem
                              disabled={publishing}
                              onClick={() => onUnpublish?.([item.file_id])}
                            >
                              <Lock size={16} />
                              取消公开
                            </DropdownMenuItem>
                          )}
                          {isPublic && !canUnpublish && (
                            <DropdownMenuItem disabled>
                              公共文件仅可查看与检索
                            </DropdownMenuItem>
                          )}
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
