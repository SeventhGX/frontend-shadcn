"use client"

import * as React from "react"
import { Paperclip, X, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface ImageAttachmentItem {
  id: string
  name: string
  // 不含 data: 前缀的纯 base64 字符串
  base64: string
  // MIME 类型，用于拼接 data url 预览
  mimeType: string
}

export interface ImageAttachmentsHandle {
  // 通过外部调用直接添加一张图像（传入 base64，无需用户选择文件）
  addImage: (image: {
    name: string
    base64: string
    mimeType?: string
  }) => string
  clear: () => void
  getImages: () => ImageAttachmentItem[]
}

export interface ImageAttachmentsProps {
  className?: string
  // 受控/非受控均可：传入 value 则为受控
  value?: ImageAttachmentItem[]
  defaultValue?: ImageAttachmentItem[]
  onChange?: (images: ImageAttachmentItem[]) => void
  accept?: string
  disabled?: boolean
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = reader.result as string
      const commaIdx = result.indexOf(",")
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result)
    }
    reader.readAsDataURL(file)
  })
}

function genId() {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const ImageAttachments = React.forwardRef<
  ImageAttachmentsHandle,
  ImageAttachmentsProps
>(function ImageAttachments(
  {
    className,
    value,
    defaultValue,
    onChange,
    accept = "image/*",
    disabled = false,
  },
  ref
) {
  const isControlled = value !== undefined
  const [internal, setInternal] = React.useState<ImageAttachmentItem[]>(
    defaultValue ?? []
  )
  const images = isControlled ? value! : internal
  const inputRef = React.useRef<HTMLInputElement>(null)

  const update = React.useCallback(
    (next: ImageAttachmentItem[]) => {
      if (!isControlled) setInternal(next)
      onChange?.(next)
    },
    [isControlled, onChange]
  )

  // 使用 ref 始终读取最新 images，避免暴露方法捕获到旧值
  const imagesRef = React.useRef(images)
  React.useEffect(() => {
    imagesRef.current = images
  }, [images])

  React.useImperativeHandle(
    ref,
    () => ({
      addImage: ({ name, base64, mimeType }) => {
        const item: ImageAttachmentItem = {
          id: genId(),
          name,
          base64,
          mimeType: mimeType ?? "image/png",
        }
        update([...imagesRef.current, item])
        return item.id
      },
      clear: () => update([]),
      getImages: () => imagesRef.current,
    }),
    [update]
  )

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const added: ImageAttachmentItem[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      try {
        const base64 = await readFileAsBase64(file)
        added.push({
          id: genId(),
          name: file.name,
          base64,
          mimeType: file.type || "image/png",
        })
      } catch (err) {
        console.error("读取图片失败:", file.name, err)
      }
    }
    if (added.length > 0) update([...imagesRef.current, ...added])
  }

  const handleRemove = (id: string) => {
    update(imagesRef.current.filter((i) => i.id !== id))
  }

  return (
    <div
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-md border bg-card px-1.5",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files)
          // 允许重复选择同一文件
          e.target.value = ""
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 shrink-0 gap-1 px-2 text-xs"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip size={12} />
        添加图片
      </Button>

      <Separator orientation="vertical" className="!h-4" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {images.length === 0 ? (
          <span className="text-xs text-muted-foreground">未添加图片</span>
        ) : (
          images.map((img) => (
            <Tooltip key={img.id}>
              <TooltipTrigger asChild>
                <div className="group flex h-6 shrink-0 items-center gap-1 rounded border bg-background px-1.5 text-xs">
                  <ImageIcon
                    size={12}
                    className="shrink-0 text-muted-foreground"
                  />
                  <span
                    className="max-w-[140px] truncate"
                    title={img.name}
                  >
                    {img.name}
                  </span>
                  <button
                    type="button"
                    aria-label={`移除 ${img.name}`}
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(img.id)
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <X size={12} />
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-popover text-popover-foreground border p-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={img.name}
                  className="max-h-48 max-w-64 rounded object-contain"
                />
              </TooltipContent>
            </Tooltip>
          ))
        )}
      </div>
    </div>
  )
})
