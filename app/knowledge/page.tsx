"use client"

import * as React from "react"
import { toast } from "sonner"

import { AuthGuard } from "@/components/common/auth-guard"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  deleteKnowledgeFiles,
  embedKnowledgeFiles,
  getAllKnowledgeFiles,
  uploadKnowledgeFile,
  type KnowledgeFile,
} from "@/features/knowledge/api"
import { KnowledgeDataTable } from "./data-table"
import { KnowledgeChatPanel } from "./chat-panel"

export default function KnowledgePage() {
  const [files, setFiles] = React.useState<KnowledgeFile[]>([])
  const [loading, setLoading] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [embedding, setEmbedding] = React.useState(false)

  const fetchFiles = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await getAllKnowledgeFiles()
      setFiles(res?.data ?? [])
    } catch (error) {
      console.error(error)
      toast.error("获取知识库文件列表失败")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

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
                  loading={loading}
                  uploading={uploading}
                  embedding={embedding}
                  onRefresh={fetchFiles}
                  onUpload={handleUpload}
                  onEmbed={handleEmbed}
                  onDelete={handleDelete}
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