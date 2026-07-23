"use client"

import * as React from "react"
import { ImageOff, ImagePlus, Loader2, Plus, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  buildImageThumbnailUrl,
  type DocImage,
  type DocItem,
} from "@/features/docs/api"
import { useAuthObjectUrl } from "./use-auth-object-url"

interface ImageBedPanelProps {
  images: DocImage[]
  docs: DocItem[]
  activeDocId: string | null
  loading: boolean
  uploading: boolean
  deletingId: string | null
  onUpload: (file: File, attach: boolean) => void
  onDelete: (image: DocImage) => void
  onInsert: (image: DocImage) => void
}

/** 单张图片缩略图（经接口鉴权加载） */
function Thumbnail({ imageId, alt }: { imageId: string; alt: string }) {
  const { url, error } = useAuthObjectUrl(buildImageThumbnailUrl(imageId, 160))

  if (error) {
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
        <ImageOff size={16} />
      </div>
    )
  }

  if (!url) {
    return <div className="h-14 w-14 shrink-0 animate-pulse rounded-md border bg-muted/40" />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className="h-14 w-14 shrink-0 rounded-md border object-cover"
    />
  )
}

/**
 * 编辑页右侧：图床管理。
 * 排序优先级：当前文档的图片 → 无归属图片 → 其它文档图片。
 * 支持上传（可选是否归属当前文档）、删除、插入图片到编辑区。
 */
export function ImageBedPanel({
  images,
  docs,
  activeDocId,
  loading,
  uploading,
  deletingId,
  onUpload,
  onDelete,
  onInsert,
}: ImageBedPanelProps) {
  const [attachToDoc, setAttachToDoc] = React.useState(true)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canAttach = !!activeDocId

  const docNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const doc of docs) map.set(doc.id, doc.docs_name)
    return map
  }, [docs])

  const sortedImages = React.useMemo(() => {
    const priority = (image: DocImage) => {
      if (activeDocId && image.docs_id === activeDocId) return 0
      if (!image.docs_id) return 1
      return 2
    }
    return [...images].sort((a, b) => priority(a) - priority(b))
  }, [images, activeDocId])

  const handlePick = () => fileInputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUpload(file, canAttach && attachToDoc)
    // 允许重复选择同一文件
    e.target.value = ""
  }

  const ownerLabel = (image: DocImage) => {
    if (!image.docs_id) return "未归属"
    if (image.docs_id === activeDocId) return "当前文档"
    return docNameById.get(image.docs_id) ?? "其它文档"
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ImagePlus size={16} />
        <h2 className="text-sm font-semibold">图床管理</h2>
      </div>

      {/* 上传区 */}
      <div className="space-y-2 border-b px-4 py-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={handlePick}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Upload size={14} />
          )}
          上传图片
        </Button>
        <div className="flex items-center gap-2">
          <Checkbox
            id="attach-to-doc"
            checked={canAttach && attachToDoc}
            onCheckedChange={(v) => setAttachToDoc(v === true)}
            disabled={!canAttach}
          />
          <Label
            htmlFor="attach-to-doc"
            className={cn(
              "text-xs",
              canAttach ? "text-muted-foreground" : "text-muted-foreground/50"
            )}
          >
            作为当前文档的附属图片上传
          </Label>
        </div>
        {!canAttach && (
          <p className="text-xs text-muted-foreground/70">
            当前文档未保存，图片将作为无归属图片上传
          </p>
        )}
      </div>

      {/* 图片列表 */}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-md bg-muted/60" />
            ))}
          </div>
        ) : sortedImages.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">暂无图片，请先上传</p>
        ) : (
          <ul className="space-y-1.5">
            {sortedImages.map((image) => (
              <li
                key={image.id}
                className="flex items-center gap-2 rounded-md border p-2"
              >
                <Thumbnail imageId={image.id} alt={image.image_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={image.image_name}>
                    {image.image_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {ownerLabel(image)}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => onInsert(image)}
                    >
                      <Plus size={12} />
                      插入
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => onDelete(image)}
                      disabled={deletingId === image.id}
                    >
                      {deletingId === image.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} />
                      )}
                      删除
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
