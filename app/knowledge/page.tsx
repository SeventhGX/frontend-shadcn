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
      // TODO: 后端编码接口尚未完成，接口就绪后此处即可正常工作
      await embedKnowledgeFiles(fileIds)
      toast.success("已提交编码任务")
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("编码失败（后端接口尚未完成）")
    } finally {
      setEmbedding(false)
    }
  }

  const handleDelete = async (fileIds: string[]) => {
    if (fileIds.length === 0) return
    try {
      // TODO: 后端删除接口尚未完成，接口就绪后此处即可正常工作
      await deleteKnowledgeFiles(fileIds)
      toast.success("删除成功")
      await fetchFiles()
    } catch (error) {
      console.error(error)
      toast.error("删除失败（后端接口尚未完成）")
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

          {/* 右侧：AI 对话区域（待后续开发） */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-4">
              <span className="text-lg font-medium">AI 对话区域</span>
              {/* TODO: 待知识库问答对话设计完成后在此实现 */}
              <span className="text-sm">敬请期待</span>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </AuthGuard>
  )
}