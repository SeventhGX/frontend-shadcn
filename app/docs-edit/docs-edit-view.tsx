"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  buildImageDownloadUrl,
  createDoc,
  createImage,
  deleteDoc,
  deleteImage,
  getDoc,
  getDocList,
  getImageList,
  updateDoc,
  type DocImage,
  type DocItem,
} from "@/features/docs/api"
import { DocListPanel } from "./doc-list-panel"
import { EditorPanel } from "./editor-panel"
import { ImageBedPanel } from "./image-bed-panel"

type EditorMode = "source" | "preview"

interface FormSnapshot {
  name: string
  desc: string
  content: string
}

/** 去掉 data:image/*;base64, 前缀，返回纯 Base64 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function DocsEditView() {
  const [docs, setDocs] = React.useState<DocItem[]>([])
  const [loadingDocs, setLoadingDocs] = React.useState(true)
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null)

  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [docName, setDocName] = React.useState("")
  const [docDesc, setDocDesc] = React.useState("")
  const [content, setContent] = React.useState("")
  const [mode, setMode] = React.useState<EditorMode>("source")
  const [saving, setSaving] = React.useState(false)

  const [images, setImages] = React.useState<DocImage[]>([])
  const [loadingImages, setLoadingImages] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)
  const [deletingImageId, setDeletingImageId] = React.useState<string | null>(null)

  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const snapshotRef = React.useRef<FormSnapshot>({ name: "", desc: "", content: "" })

  const dirty =
    docName !== snapshotRef.current.name ||
    docDesc !== snapshotRef.current.desc ||
    content !== snapshotRef.current.content

  // ==================== 数据加载 ====================

  const fetchDocs = React.useCallback(async () => {
    try {
      setLoadingDocs(true)
      const res = await getDocList()
      setDocs(res?.data ?? [])
    } catch (error) {
      console.error(error)
      toast.error("获取教程列表失败")
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  const fetchImages = React.useCallback(async () => {
    try {
      setLoadingImages(true)
      const res = await getImageList()
      setImages(res?.data ?? [])
    } catch (error) {
      console.error(error)
      toast.error("获取图片列表失败")
    } finally {
      setLoadingImages(false)
    }
  }, [])

  React.useEffect(() => {
    fetchDocs()
    fetchImages()
  }, [fetchDocs, fetchImages])

  // ==================== 表单/文档操作 ====================

  const applyForm = (snapshot: FormSnapshot, id: string | null) => {
    setActiveId(id)
    setDocName(snapshot.name)
    setDocDesc(snapshot.desc)
    setContent(snapshot.content)
    snapshotRef.current = snapshot
    setMode("source")
  }

  const confirmDiscard = () => {
    if (!dirty) return true
    return window.confirm("当前有未保存的修改，确定要放弃并切换吗？")
  }

  const handleSelectDoc = async (id: string) => {
    if (id === activeId && !dirty) return
    if (!confirmDiscard()) return
    try {
      const res = await getDoc(id)
      const doc = res?.data
      if (!doc) {
        toast.error("加载文档失败")
        return
      }
      applyForm(
        { name: doc.docs_name, desc: doc.docs_desc ?? "", content: doc.content ?? "" },
        doc.id
      )
    } catch (error) {
      console.error(error)
      toast.error("加载文档失败")
    }
  }

  const handleNewDoc = () => {
    if (!confirmDiscard()) return
    applyForm({ name: "", desc: "", content: "" }, null)
  }

  const handleSave = async () => {
    if (!docName.trim()) {
      toast.error("请填写文档名称")
      return
    }
    if (!content.trim()) {
      toast.error("文档内容不能为空")
      return
    }
    const desc = docDesc.trim() ? docDesc.trim() : null
    try {
      setSaving(true)
      if (activeId) {
        await updateDoc(activeId, { docs_name: docName.trim(), docs_desc: desc, content })
        toast.success("已保存")
      } else {
        const res = await createDoc({ docs_name: docName.trim(), docs_desc: desc, content })
        const created = res?.data
        if (created) {
          setActiveId(created.id)
          toast.success("已创建教程")
        }
      }
      snapshotRef.current = { name: docName, desc: docDesc, content }
      await fetchDocs()
    } catch (error) {
      console.error(error)
      toast.error("保存失败，请稍后重试")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDoc = async (doc: DocItem) => {
    if (!window.confirm(`确定删除教程「${doc.docs_name}」？其关联图片也会一并删除。`)) {
      return
    }
    try {
      setDeletingDocId(doc.id)
      await deleteDoc(doc.id)
      toast.success("已删除")
      if (doc.id === activeId) {
        applyForm({ name: "", desc: "", content: "" }, null)
      }
      await Promise.all([fetchDocs(), fetchImages()])
    } catch (error) {
      console.error(error)
      toast.error("删除失败，请稍后重试")
    } finally {
      setDeletingDocId(null)
    }
  }

  // ==================== 图片操作 ====================

  const handleUploadImage = async (file: File, attach: boolean) => {
    try {
      setUploading(true)
      const base64 = await fileToBase64(file)
      await createImage({
        docs_id: attach && activeId ? activeId : null,
        image_name: file.name,
        image_desc: null,
        image_data: base64,
      })
      toast.success("图片已上传")
      await fetchImages()
    } catch (error) {
      console.error(error)
      toast.error("图片上传失败")
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteImage = async (image: DocImage) => {
    if (!window.confirm(`确定删除图片「${image.image_name}」？`)) return
    try {
      setDeletingImageId(image.id)
      await deleteImage(image.id)
      toast.success("图片已删除")
      await fetchImages()
    } catch (error) {
      console.error(error)
      toast.error("图片删除失败")
    } finally {
      setDeletingImageId(null)
    }
  }

  const handleInsertImage = (image: DocImage) => {
    const markdown = `![${image.image_name}](${buildImageDownloadUrl(image.id)})`
    // 预览模式下 textarea 未挂载，先切回源码
    setMode("source")
    const insert = () => {
      const textarea = textareaRef.current
      const start = textarea?.selectionStart ?? content.length
      const end = textarea?.selectionEnd ?? content.length
      setContent((prev) => prev.slice(0, start) + markdown + prev.slice(end))
      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus()
          const pos = start + markdown.length
          textarea.setSelectionRange(pos, pos)
        }
      })
    }
    requestAnimationFrame(insert)
  }

  return (
    <div className="h-full p-4">
      <ResizablePanelGroup direction="horizontal" className="rounded-lg border">
        {/* 左侧：教程清单 */}
        <ResizablePanel defaultSize={20} minSize={14}>
          <DocListPanel
            docs={docs}
            loading={loadingDocs}
            activeId={activeId}
            deletingId={deletingDocId}
            onSelect={handleSelectDoc}
            onNew={handleNewDoc}
            onDelete={handleDeleteDoc}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 中间：Markdown 编辑区 */}
        <ResizablePanel defaultSize={52} minSize={35}>
          <EditorPanel
            docName={docName}
            docDesc={docDesc}
            content={content}
            mode={mode}
            isNew={activeId === null}
            dirty={dirty}
            saving={saving}
            textareaRef={textareaRef}
            onDocNameChange={setDocName}
            onDocDescChange={setDocDesc}
            onContentChange={setContent}
            onModeChange={setMode}
            onSave={handleSave}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：图床管理 */}
        <ResizablePanel defaultSize={28} minSize={18}>
          <ImageBedPanel
            images={images}
            docs={docs}
            activeDocId={activeId}
            loading={loadingImages}
            uploading={uploading}
            deletingId={deletingImageId}
            onUpload={handleUploadImage}
            onDelete={handleDeleteImage}
            onInsert={handleInsertImage}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
