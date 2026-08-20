"use client"

import * as React from "react"
import { toast } from "sonner"

import { AuthGuard } from "@/components/common/auth-guard"
import { useAuth } from "@/app/providers"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  autoTagKnowledgeFile,
  deleteKnowledgeFiles,
  embedKnowledgeFiles,
  getAllKnowledgeFiles,
  getKnowledgeTags,
  publishKnowledgeFiles,
  setKnowledgeTags,
  unpublishKnowledgeFiles,
  uploadKnowledgeFile,
  type KnowledgeFile,
  type KnowledgeTag,
} from "@/features/knowledge/api"
import { KnowledgeDataTable, type AutoTagOptions } from "./data-table"
import { KnowledgeChatPanel } from "./chat-panel"

/** AI 打标请求超时后，按此节奏轮询后台生成结果 */
const AUTO_TAG_POLL_INTERVAL_MS = 5000
const AUTO_TAG_POLL_MAX_ATTEMPTS = 60

export default function KnowledgePage() {
  const { user } = useAuth()
  const [files, setFiles] = React.useState<KnowledgeFile[]>([])
  const [tags, setTags] = React.useState<KnowledgeTag[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [embedding, setEmbedding] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)

  const fetchFiles = React.useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await getAllKnowledgeFiles()
      const list = Array.isArray(res?.data) ? res.data : []
      setFiles(list)
      return list
    } catch (error) {
      console.error(error)
      toast.error("获取知识库文件列表失败")
      return []
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const fetchTags = React.useCallback(async () => {
    try {
      const res = await getKnowledgeTags()
      setTags(Array.isArray(res?.data) ? res.data : [])
    } catch (error) {
      console.error(error)
      toast.error("获取标签列表失败")
    }
  }, [])

  React.useEffect(() => {
    fetchFiles()
    fetchTags()
  }, [fetchFiles, fetchTags])

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return
    try {
      setUploading(true)
      const results = await Promise.allSettled(
        files.map((file) => uploadKnowledgeFile(file))
      )
      const succeeded = results.filter((r) => r.status === "fulfilled").length
      const failed = results.length - succeeded

      if (succeeded > 0) {
        toast.success(`成功上传 ${succeeded} 个文件`)
      }
      if (failed > 0) {
        toast.error(`${failed} 个文件上传失败`)
      }
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("文件上传失败")
    } finally {
      setUploading(false)
    }
  }

  const handleEmbed = async (fileIds: string[]) => {
    if (fileIds.length === 0) return
    try {
      setEmbedding(true)
      const res = await embedKnowledgeFiles(fileIds)
      const results = res?.data ?? []
      const totalChunks = results.reduce(
        (sum, item) => sum + (item.chunk_count ?? 0),
        0
      )
      if (results.length > 0) {
        toast.success(
          `已完成 ${results.length} 个文件编码，共生成 ${totalChunks} 个片段`
        )
      } else {
        toast.info("所选文件均已编码，无需重复处理")
      }
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("编码失败，请稍后重试")
    } finally {
      setEmbedding(false)
    }
  }

  const handleDelete = async (fileIds: string[]) => {
    if (fileIds.length === 0) return
    try {
      const res = await deleteKnowledgeFiles(fileIds)
      const deletedCount = res?.data?.deleted_count ?? 0
      if (deletedCount === 0) {
        toast.error("删除失败，未删除任何文件")
      } else if (deletedCount < fileIds.length) {
        toast.warning(
          `已删除 ${deletedCount} 个文件，部分文件未删除（可能不存在或无权限）`
        )
      } else {
        toast.success(`已删除 ${deletedCount} 个文件`)
      }
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("删除失败，请稍后重试")
    }
  }

  const handlePublish = async (fileIds: string[]) => {
    if (fileIds.length === 0) return
    try {
      setPublishing(true)
      const res = await publishKnowledgeFiles(fileIds)
      toast.success(`已公开 ${res?.data?.count ?? fileIds.length} 个文件`)
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("公开失败，请确认所选文件均已完成编码")
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async (fileIds: string[]) => {
    if (fileIds.length === 0) return
    try {
      setPublishing(true)
      const res = await unpublishKnowledgeFiles(fileIds)
      toast.success(`已取消公开 ${res?.data?.count ?? fileIds.length} 个文件`)
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("取消公开失败，仅原发布者可以取消公开")
    } finally {
      setPublishing(false)
    }
  }

  const handleSaveTags = async (
    fileId: string,
    tagIds: string[],
    newTags: string[]
  ) => {
    try {
      await setKnowledgeTags({
        file_id: fileId,
        tag_ids: tagIds,
        new_tags: newTags,
      })
      toast.success("标签已保存")
      await Promise.all([fetchFiles(), fetchTags()])
    } catch (error) {
      console.error(error)
      toast.error("保存标签失败，请稍后重试")
    }
  }

  // 请求超时但后端仍在生成时，轮询文件列表直到标签发生变化
  const pollAutoTagResult = React.useCallback(
    async (fileId: string, beforeCount: number) => {
      for (let i = 0; i < AUTO_TAG_POLL_MAX_ATTEMPTS; i += 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, AUTO_TAG_POLL_INTERVAL_MS)
        )
        const list = await fetchFiles(true)
        const tags = list.find((item) => item.file_id === fileId)?.tags
        if (tags && tags.length > beforeCount) return tags
      }
      return undefined
    },
    [fetchFiles]
  )

  const handleAutoTag = async (fileId: string, options: AutoTagOptions) => {
    const beforeCount =
      files.find((item) => item.file_id === fileId)?.tags?.length ?? 0

    try {
      await autoTagKnowledgeFile({
        file_id: fileId,
        max_tags: options.maxTags,
        allow_new_tags: options.allowNewTags,
      })
    } catch (error) {
      console.error(error)
      toast.warning("AI 打标耗时较长，正在等待后台生成结果...")
      const tags = await pollAutoTagResult(fileId, beforeCount)
      if (!tags) {
        toast.error("AI 自动打标未在预期时间内完成，请稍后刷新查看")
        return undefined
      }
      await fetchTags()
      toast.success(`AI 打标完成，当前共 ${tags.length} 个标签`)
      return tags
    }

    // 以刷新后的文件数据为准，避免依赖打标接口的返回结构
    const [list] = await Promise.all([fetchFiles(), fetchTags()])
    const tags = list.find((item) => item.file_id === fileId)?.tags ?? []
    toast.success(`AI 打标完成，当前共 ${tags.length} 个标签`)
    return tags
  }

  return (
    <AuthGuard>
      <div className="h-full p-4">
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg border"
        >
          {/* 左侧：知识库文件管理 */}
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="flex h-full flex-col gap-3 p-4">
              <h1 className="text-xl font-bold">知识库文件</h1>
              <div className="min-h-0 flex-1">
                <KnowledgeDataTable
                  data={files}
                  tags={tags}
                  currentUserName={user?.user_name}
                  loading={loading}
                  uploading={uploading}
                  embedding={embedding}
                  publishing={publishing}
                  onRefresh={() => fetchFiles()}
                  onUpload={handleUpload}
                  onEmbed={handleEmbed}
                  onDelete={handleDelete}
                  onPublish={handlePublish}
                  onUnpublish={handleUnpublish}
                  onSaveTags={handleSaveTags}
                  onAutoTag={handleAutoTag}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 右侧：知识库 RAG 问答 */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="flex h-full flex-col gap-3 p-4">
              <h1 className="text-xl font-bold">知识库问答</h1>
              <div className="min-h-0 flex-1">
                <KnowledgeChatPanel files={files} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </AuthGuard>
  )
}