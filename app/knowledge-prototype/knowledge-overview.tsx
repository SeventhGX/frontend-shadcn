"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  X,
} from "lucide-react"

import {
  downloadFileV2,
  getDatabases,
  getFilesV2,
  getTagsV2,
  getAllMetadata,
  type KnowledgeDatabase,
  type KnowledgeFileV2,
  type KnowledgeTagV2,
  type MetadataOption,
} from "@/features/knowledge-v2/api"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 20

function formatTime(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("zh-CN", { hour12: false })
}

async function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 单个分库卡片 */
function DatabaseCard({
  db,
  active,
  onClick,
}: {
  db: KnowledgeDatabase
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "hover:bg-accent flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition-colors",
        active && "border-primary ring-primary/20 ring-2"
      )}
    >
      <span className="text-sm font-semibold">
        {db.database_desc || db.database_name}
      </span>
      <span className="text-muted-foreground line-clamp-2 text-xs">
        {db.database_desc ? db.database_name : "（无描述）"}
      </span>
      {db.meta_data_template && db.meta_data_template.length > 0 && (
        <span className="text-muted-foreground mt-auto text-xs">
          元数据字段：{db.meta_data_template.join("、")}
        </span>
      )}
    </button>
  )
}

export function KnowledgeOverview() {
  const [databases, setDatabases] = React.useState<KnowledgeDatabase[]>([])
  const [metadataOptions, setMetadataOptions] = React.useState<MetadataOption[]>(
    []
  )
  const [tags, setTags] = React.useState<KnowledgeTagV2[]>([])
  const [metaLoading, setMetaLoading] = React.useState(true)

  const [openDb, setOpenDb] = React.useState<KnowledgeDatabase | null>(null)
  const [files, setFiles] = React.useState<KnowledgeFileV2[]>([])
  const [filesLoading, setFilesLoading] = React.useState(false)
  const [page, setPage] = React.useState(1)
  const [pages, setPages] = React.useState(1)

  // 当前抽屉内的筛选条件
  const [metadataFilter, setMetadataFilter] = React.useState<
    Record<string, string>
  >({})
  const [tagFilter, setTagFilter] = React.useState<string[]>([])

  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [dbRes, metaRes, tagRes] = await Promise.all([
          getDatabases(),
          getAllMetadata(),
          getTagsV2(),
        ])
        if (cancelled) return
        setDatabases(dbRes?.data ?? [])
        setMetadataOptions(metaRes?.data ?? [])
        setTags(tagRes?.data ?? [])
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error("加载知识库信息失败")
      } finally {
        if (!cancelled) setMetaLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const loadFiles = React.useCallback(
    async (db: KnowledgeDatabase, nextPage: number) => {
      try {
        setFilesLoading(true)
        const res = await getFilesV2({
          database_name: db.database_name,
          page: nextPage,
          page_size: PAGE_SIZE,
          metadata:
            Object.keys(metadataFilter).length > 0 ? metadataFilter : undefined,
          tag_names: tagFilter.length > 0 ? tagFilter : undefined,
        })
        setFiles(res?.data?.items ?? [])
        setPage(res?.data?.page ?? nextPage)
        setPages(res?.data?.pages ?? 1)
      } catch (error) {
        console.error(error)
        toast.error("加载文件列表失败")
        setFiles([])
      } finally {
        setFilesLoading(false)
      }
    },
    [metadataFilter, tagFilter]
  )

  // 抽屉打开时加载第一页；筛选条件变化时回到第一页
  React.useEffect(() => {
    if (openDb) loadFiles(openDb, 1)
  }, [openDb, loadFiles])

  const handleDownload = async (file: KnowledgeFileV2) => {
    try {
      const res = await downloadFileV2(file.id)
      const blob = await res.blob()
      await saveBlob(blob, file.filename)
    } catch (error) {
      console.error(error)
      toast.error("下载失败")
    }
  }

  const currentDbFields = React.useMemo(
    () => openDb?.meta_data_template ?? [],
    [openDb]
  )

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      {/* 分库卡片 */}
      {metaLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
          <LoaderCircle size={16} className="animate-spin" />
          加载中...
        </div>
      ) : databases.length === 0 ? (
        <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
          暂无公开知识库
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {databases.map((db) => (
            <DatabaseCard
              key={db.id}
              db={db}
              active={openDb?.id === db.id}
              onClick={() => {
                setMetadataFilter({})
                setTagFilter([])
                setPage(1)
                setOpenDb(db)
              }}
            />
          ))}
        </div>
      )}

      {/* 对比表格 */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">指标</TableHead>
              {databases.map((db) => (
                <TableHead key={db.id}>
                  {db.database_desc || db.database_name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="text-xs font-medium">文件数</TableCell>
              {databases.map((db) => (
                <TableCell key={db.id} className="text-xs tabular-nums">
                  {db.file_count ?? "—"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-medium">片段总数</TableCell>
              {databases.map((db) => (
                <TableCell key={db.id} className="text-xs tabular-nums">
                  {db.total_chunk_count ?? "—"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-medium">最新上传</TableCell>
              {databases.map((db) => (
                <TableCell key={db.id} className="text-xs">
                  {db.latest_upload_time
                    ? formatTime(db.latest_upload_time)
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className="text-xs font-medium">元数据字段</TableCell>
              {databases.map((db) => (
                <TableCell key={db.id} className="text-xs">
                  {db.meta_data_template?.length
                    ? db.meta_data_template.join("、")
                    : "—"}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* 文件查询抽屉 */}
      <Sheet
        open={!!openDb}
        onOpenChange={(open) => !open && setOpenDb(null)}
      >
        <SheetContent
          side="bottom"
          className="h-[85vh] flex-col gap-0 p-0"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle>
              {openDb?.database_desc || openDb?.database_name}
            </SheetTitle>
            <SheetDescription>
              {openDb?.database_name} · 按元数据与标签过滤文件
            </SheetDescription>
          </SheetHeader>

          {/* 筛选区 */}
          <div className="space-y-3 border-b px-4 py-3">
            {/* 元数据筛选 */}
            {currentDbFields.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium">元数据</p>
                {currentDbFields.map((field) => {
                  const options = metadataOptions.filter(
                    (o) => o.field_name === field
                  )
                  const fieldDesc = options[0]?.field_desc || field
                  return (
                    <div key={field} className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 shrink-0 text-xs">
                        {fieldDesc}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {options.map((option) => {
                          const active = metadataFilter[field] === option.value
                          return (
                            <button
                              key={option.id}
                              type="button"
                              title={option.desc}
                              onClick={() =>
                                setMetadataFilter((prev) => {
                                  const next = { ...prev }
                                  if (active) delete next[field]
                                  else next[field] = option.value
                                  return next
                                })
                              }
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-xs transition-colors",
                                active
                                  ? "bg-primary text-primary-foreground border-transparent"
                                  : "text-muted-foreground hover:bg-accent"
                              )}
                            >
                              {option.desc || option.value}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 标签筛选 */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium">标签（同时具备全部标签）</p>
              <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
                {tags.length === 0 ? (
                  <span className="text-muted-foreground text-xs">
                    暂无公开标签
                  </span>
                ) : (
                  tags.map((tag) => {
                    const active = tagFilter.includes(tag.name)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() =>
                          setTagFilter((prev) =>
                            active
                              ? prev.filter((n) => n !== tag.name)
                              : [...prev, tag.name]
                          )
                        }
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-xs transition-colors",
                          active
                            ? "bg-primary text-primary-foreground border-transparent"
                            : "text-muted-foreground hover:bg-accent"
                        )}
                      >
                        {tag.name}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            {(Object.keys(metadataFilter).length > 0 ||
              tagFilter.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setMetadataFilter({})
                  setTagFilter([])
                }}
                className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
              >
                <X size={11} />
                清空筛选
              </button>
            )}
          </div>

          {/* 文件表格 */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {filesLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <LoaderCircle size={16} className="animate-spin" />
                查询中...
              </div>
            ) : files.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                暂无匹配文件
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">文件名</TableHead>
                    <TableHead className="w-24">标签</TableHead>
                    <TableHead className="w-24">上传时间</TableHead>
                    <TableHead className="w-12 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText
                            size={13}
                            className="text-muted-foreground shrink-0"
                          />
                          <span
                            className="block max-w-32 truncate text-xs"
                            title={file.filename}
                          >
                            {file.filename}
                          </span>
                        </div>
                        {file.meta_data &&
                          Object.keys(file.meta_data).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {Object.entries(file.meta_data).map(
                                ([key, value]) => (
                                  <Badge
                                    key={key}
                                    variant="outline"
                                    className="px-1 py-0 text-[10px]"
                                  >
                                    {key}:{value}
                                  </Badge>
                                )
                              )}
                            </div>
                          )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-0.5">
                          {file.tags?.slice(0, 3).map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="secondary"
                              className="px-1 py-0 text-[10px]"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {(file.tags?.length ?? 0) > 3 && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 text-[10px]"
                            >
                              +{file.tags!.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatTime(file.create_time)}
                      </TableCell>
                      <TableCell className="text-right">
                        <button
                          type="button"
                          title="下载"
                          aria-label={`下载 ${file.filename}`}
                          onClick={() => handleDownload(file)}
                          className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                        >
                          <Download size={13} />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* 分页 */}
          <div className="flex items-center justify-between border-t px-4 py-2.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              第 {page} / {pages} 页
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={filesLoading || page <= 1}
                onClick={() => openDb && loadFiles(openDb, page - 1)}
              >
                <ChevronLeft size={13} />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filesLoading || page >= pages}
                onClick={() => openDb && loadFiles(openDb, page + 1)}
              >
                下一页
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
