"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  Upload,
} from "lucide-react"

import {
  deleteFileV2,
  downloadFileV2,
  embedFilesV2,
  getAllMetadata,
  getDatabases,
  getMyFilesV2,
  getRequirements,
  getTagsV2,
  isDuplicateFileError,
  replaceFileContentV2,
  setFileTagsV2,
  uploadFileV2,
  autoTagV2,
  type KnowledgeDatabase,
  type KnowledgeFileV2,
  type KnowledgeRequirement,
  type KnowledgeTagV2,
  type MetadataOption,
  type UploadFileParams,
} from "@/features/knowledge-v2/api"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { FileUploadForm } from "./file-upload-form"

const PAGE_SIZE = 20

function formatTime(value?: string) {
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

/** 标签单元格：默认折叠展示，悬浮后展开全部标签 */
function TagCell({ tags }: { tags?: KnowledgeTagV2[] }) {
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

/** 管理文件的行操作确认对话框 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  loading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button onClick={onConfirm} disabled={loading}>
            {loading && <LoaderCircle size={16} className="animate-spin" />}
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function KnowledgeWorkbench() {
  // 元数据
  const [databases, setDatabases] = React.useState<KnowledgeDatabase[]>([])
  const [metadataOptions, setMetadataOptions] = React.useState<MetadataOption[]>(
    []
  )
  const [tags, setTags] = React.useState<KnowledgeTagV2[]>([])

  // 缺口
  const [requirements, setRequirements] = React.useState<KnowledgeRequirement[]>(
    []
  )
  const [requirementsLoading, setRequirementsLoading] = React.useState(false)

  // 上传
  const [uploadSubmitting, setUploadSubmitting] = React.useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
  const [uploadTarget, setUploadTarget] = React.useState<KnowledgeRequirement | null>(null)

  // 我的文件
  const [myFiles, setMyFiles] = React.useState<KnowledgeFileV2[]>([])
  const [myFilesLoading, setMyFilesLoading] = React.useState(false)
  const [myFilesPage, setMyFilesPage] = React.useState(1)
  const [myFilesPages, setMyFilesPages] = React.useState(1)
  const [filenameQuery, setFilenameQuery] = React.useState("")

  // 编辑/删除/嵌入状态
  const [editFile, setEditFile] = React.useState<KnowledgeFileV2 | null>(null)
  const [editSubmitting, setEditSubmitting] = React.useState(false)
  const [deleteFile, setDeleteFile] = React.useState<KnowledgeFileV2 | null>(
    null
  )
  const [deleteSubmitting, setDeleteSubmitting] = React.useState(false)
  const [embedFile, setEmbedFile] = React.useState<KnowledgeFileV2 | null>(null)
  const [embedSubmitting, setEmbedSubmitting] = React.useState(false)

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
        if (!cancelled) toast.error("加载元数据失败")
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const loadRequirements = React.useCallback(async () => {
    try {
      setRequirementsLoading(true)
      const res = await getRequirements({ page: 1, page_size: 50, status: "open" })
      setRequirements(res?.data?.items ?? [])
    } catch (error) {
      console.error(error)
      toast.error("加载知识库缺口失败")
    } finally {
      setRequirementsLoading(false)
    }
  }, [])

  const loadMyFiles = React.useCallback(
    async (page: number, filename: string) => {
      try {
        setMyFilesLoading(true)
        const res = await getMyFilesV2({
          page,
          page_size: PAGE_SIZE,
          filename: filename.trim() || undefined,
        })
        setMyFiles(res?.data?.items ?? [])
        setMyFilesPage(res?.data?.page ?? page)
        setMyFilesPages(res?.data?.pages ?? 1)
      } catch (error) {
        console.error(error)
        toast.error("加载文件列表失败")
      } finally {
        setMyFilesLoading(false)
      }
    },
    []
  )

  React.useEffect(() => {
    loadRequirements()
    loadMyFiles(1, "")
  }, [loadRequirements, loadMyFiles])

  const handleUpload = async (params: UploadFileParams) => {
    try {
      setUploadSubmitting(true)
      await uploadFileV2(params)
      toast.success("上传成功，文件已完成切片与编码")
      setUploadDialogOpen(false)
      setUploadTarget(null)
      loadRequirements()
      loadMyFiles(1, filenameQuery)
    } catch (error) {
      console.error(error)
      if (isDuplicateFileError(error)) {
        toast.error("上传失败：内容已存在（MD5 全局去重）")
      } else {
        toast.error("上传失败，请稍后重试")
      }
    } finally {
      setUploadSubmitting(false)
    }
  }

  const openUploadDialog = (req: KnowledgeRequirement | null) => {
    setUploadTarget(req)
    setUploadDialogOpen(true)
  }

  const handleEditSubmit = async (params: UploadFileParams) => {
    if (!editFile) return
    try {
      setEditSubmitting(true)
      await replaceFileContentV2(editFile.id, {
        ...params,
        requirementIds: params.requirementIds,
      })
      toast.success("文件已更新")
      setEditFile(null)
      loadMyFiles(myFilesPage, filenameQuery)
    } catch (error) {
      console.error(error)
      if (isDuplicateFileError(error)) {
        toast.error("更新失败：新内容与已有文件重复")
      } else {
        toast.error("更新失败，请稍后重试")
      }
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteFile) return
    try {
      setDeleteSubmitting(true)
      await deleteFileV2(deleteFile.id)
      toast.success("已删除")
      setDeleteFile(null)
      loadMyFiles(myFilesPage, filenameQuery)
    } catch (error) {
      console.error(error)
      toast.error("删除失败")
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const handleEmbed = async () => {
    if (!embedFile) return
    try {
      setEmbedSubmitting(true)
      await embedFilesV2([embedFile.id])
      toast.success("已重新编码")
      setEmbedFile(null)
    } catch (error) {
      console.error(error)
      toast.error("重新编码失败")
    } finally {
      setEmbedSubmitting(false)
    }
  }

  const handleAutoTag = async (file: KnowledgeFileV2) => {
    try {
      const res = await autoTagV2({ knowledge_id: file.id })
      const names = res?.data?.map((t) => t.name) ?? []
      if (names.length > 0) {
        await setFileTagsV2({
          knowledge_id: file.id,
          tag_ids: [],
          new_tags: names,
        })
        toast.success(`已自动打标：${names.join("、")}`)
        loadMyFiles(myFilesPage, filenameQuery)
      }
    } catch (error) {
      console.error(error)
      toast.error("自动打标失败")
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <Tabs defaultValue="upload" className="flex h-full flex-col gap-3">
        <TabsList>
          <TabsTrigger value="upload">上传文件</TabsTrigger>
          <TabsTrigger value="manage">我的文件</TabsTrigger>
        </TabsList>

        {/* 上传 */}
        <TabsContent
          value="upload"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
        >
          {/* 缺口表格 */}
          <div className="flex flex-col gap-2 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">知识库缺口</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={requirementsLoading}
                  onClick={loadRequirements}
                >
                  <RefreshCw
                    size={13}
                    className={requirementsLoading ? "animate-spin" : ""}
                  />
                  刷新
                </Button>
                <Button size="sm" onClick={() => openUploadDialog(null)}>
                  <Upload size={13} />
                  上传文件
                </Button>
              </div>
            </div>
            {requirementsLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <LoaderCircle size={16} className="animate-spin" />
                加载中...
              </div>
            ) : requirements.length === 0 ? (
              <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
                暂无开放的知识库缺口，可点击右上角直接上传文件
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>缺口描述</TableHead>
                      <TableHead className="w-20">状态</TableHead>
                      <TableHead className="w-20">已关联</TableHead>
                      <TableHead className="w-24">创建时间</TableHead>
                      <TableHead className="w-16 text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirements.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <p className="line-clamp-1 text-xs font-medium">
                            {req.requirement || req.question || "（未描述）"}
                          </p>
                          {req.requirement && req.question && (
                            <p className="text-muted-foreground line-clamp-1 text-xs">
                              原问题：{req.question}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "open" ? "default" : "secondary"
                            }
                          >
                            {req.status === "open" ? "开放中" : "已关闭"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {req.related_knowledgev2_ids?.length ?? 0} 个
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatTime(req.create_time)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={req.status !== "open"}
                            onClick={() => openUploadDialog(req)}
                          >
                            <Upload size={13} />
                            上传
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* 我的文件 */}
        <TabsContent
          value="manage"
          className="mt-0 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
        >
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search
                size={14}
                className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
              />
              <Input
                value={filenameQuery}
                onChange={(e) => setFilenameQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadMyFiles(1, filenameQuery)
                }}
                placeholder="按文件名搜索"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={myFilesLoading}
              onClick={() => loadMyFiles(1, filenameQuery)}
            >
              <Search size={13} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={myFilesLoading}
              onClick={() => loadMyFiles(myFilesPage, filenameQuery)}
            >
              <RefreshCw
                size={13}
                className={myFilesLoading ? "animate-spin" : ""}
              />
              刷新
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            {myFilesLoading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
                <LoaderCircle size={16} className="animate-spin" />
                加载中...
              </div>
            ) : myFiles.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                暂无上传记录
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead className="w-28">分库</TableHead>
                    <TableHead className="w-50">标签</TableHead>
                    <TableHead className="w-24">大小</TableHead>
                    <TableHead className="w-24">上传时间</TableHead>
                    <TableHead className="w-36 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <FileText
                            size={13}
                            className="text-muted-foreground shrink-0"
                          />
                          <span
                            className="block max-w-40 truncate text-xs font-medium"
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
                          {file.databases?.slice(0, 2).map((db) => (
                            <Badge
                              key={db.id}
                              variant="secondary"
                              className="px-1 py-0 text-[10px]"
                            >
                              {db.database_desc || db.database_name}
                            </Badge>
                          ))}
                          {(file.databases?.length ?? 0) > 2 && (
                            <Badge
                              variant="secondary"
                              className="px-1 py-0 text-[10px]"
                            >
                              +{file.databases!.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TagCell tags={file.tags} />
                        {/* <div className="flex flex-wrap gap-0.5">
                          {file.tags?.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag.id}
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              {tag.name}
                            </Badge>
                          ))}
                          {(file.tags?.length ?? 0) > 2 && (
                            <Badge
                              variant="outline"
                              className="px-1 py-0 text-[10px]"
                            >
                              +{file.tags!.length - 2}
                            </Badge>
                          )}
                        </div> */}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {file.file_size ? `${(file.file_size / 1024).toFixed(2)} KB` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatTime(file.create_time)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <button
                            type="button"
                            title="下载"
                            aria-label={`下载 ${file.filename}`}
                            onClick={async () => {
                              try {
                                const res = await downloadFileV2(
                                  file.id
                                )
                                const blob = await res.blob()
                                await saveBlob(blob, file.filename)
                              } catch (error) {
                                console.error(error)
                                toast.error("下载失败")
                              }
                            }}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            type="button"
                            title="编辑（重传内容/元数据）"
                            aria-label={`编辑 ${file.filename}`}
                            onClick={() => setEditFile(file)}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                          >
                            <SquarePen size={13} />
                          </button>
                          <button
                            type="button"
                            title="重新编码"
                            aria-label={`重新编码 ${file.filename}`}
                            onClick={() => setEmbedFile(file)}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                          >
                            <RotateCcw size={13} />
                          </button>
                          <button
                            type="button"
                            title="AI 自动打标"
                            aria-label={`AI 自动打标 ${file.filename}`}
                            onClick={() => handleAutoTag(file)}
                            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                          >
                            <Sparkles size={13} />
                          </button>
                          <button
                            type="button"
                            title="删除"
                            aria-label={`删除 ${file.filename}`}
                            onClick={() => setDeleteFile(file)}
                            className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs tabular-nums">
              第 {myFilesPage} / {myFilesPages} 页
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={myFilesLoading || myFilesPage <= 1}
                onClick={() => loadMyFiles(myFilesPage - 1, filenameQuery)}
              >
                <ChevronLeft size={13} />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={myFilesLoading || myFilesPage >= myFilesPages}
                onClick={() => loadMyFiles(myFilesPage + 1, filenameQuery)}
              >
                下一页
                <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 上传文件弹窗 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {uploadTarget ? "上传并关联缺口" : "上传文件"}
            </DialogTitle>
            <DialogDescription>
              {uploadTarget
                ? `将文件关联到缺口：${uploadTarget.requirement || uploadTarget.question}`
                : "上传文件到公开知识库，支持多选分库与标签。"}
            </DialogDescription>
          </DialogHeader>
          <FileUploadForm
            databases={databases}
            metadataOptions={metadataOptions}
            tags={tags}
            initialRequirementIds={uploadTarget ? [uploadTarget.id] : []}
            submitting={uploadSubmitting}
            onSubmit={handleUpload}
            submitLabel={uploadTarget ? "上传并关联缺口" : "上传文件"}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑文件对话框 */}
      <Dialog open={!!editFile} onOpenChange={(open) => !open && setEditFile(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑文件</DialogTitle>
            <DialogDescription>
              重新选择文件内容，元数据、分库和标签将以本次提交值完整替换。
            </DialogDescription>
          </DialogHeader>
          <FileUploadForm
            databases={databases}
            metadataOptions={metadataOptions}
            tags={tags}
            initialRequirementIds={editFile?.requirement_ids ?? []}
            submitting={editSubmitting}
            onSubmit={handleEditSubmit}
            submitLabel="确认更新"
          />
        </DialogContent>
      </Dialog>

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleteFile}
        onOpenChange={(open) => !open && setDeleteFile(null)}
        title="删除文件"
        description={`确认删除「${deleteFile?.filename}」吗？将同步删除对应的切片与向量，且不可恢复。`}
        onConfirm={handleDelete}
        loading={deleteSubmitting}
      />

      {/* 重新编码确认 */}
      <ConfirmDialog
        open={!!embedFile}
        onOpenChange={(open) => !open && setEmbedFile(null)}
        title="重新编码"
        description={`确认对「${embedFile?.filename}」重新进行文本提取与向量编码吗？`}
        onConfirm={handleEmbed}
        loading={embedSubmitting}
      />
    </div>
  )
}
