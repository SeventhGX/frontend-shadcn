"use client"

import * as React from "react"
import { CloudUpload, LoaderCircle, X } from "lucide-react"
import { toast } from "sonner"

import type {
  KnowledgeDatabase,
  KnowledgeTagV2,
  MetadataOption,
  UploadFileParams,
} from "@/features/knowledge-v2/api"

/** 供上传区域展示的文件大小格式化 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Section({
  title,
  desc,
  children,
}: {
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="text-muted-foreground mt-0.5 text-xs">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

/** 工作台通用的文件选择 + 参数配置表单 */
export function FileUploadForm({
  databases,
  metadataOptions,
  tags,
  requirements,
  initialRequirementIds,
  submitting,
  onSubmit,
  submitLabel,
}: {
  databases: KnowledgeDatabase[]
  metadataOptions: MetadataOption[]
  tags: KnowledgeTagV2[]
  /** 开放的缺口请求（用于选择关联） */
  requirements: Array<{
    id: string
    requirement?: string | null
    question?: string | null
  }>
  initialRequirementIds?: string[]
  submitting?: boolean
  onSubmit: (params: UploadFileParams) => void
  submitLabel: string
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [dbNames, setDbNames] = React.useState<string[]>([])
  const [metadata, setMetadata] = React.useState<Record<string, string>>({})
  const [tagNames, setTagNames] = React.useState<string[]>([])
  const [newTagInput, setNewTagInput] = React.useState("")
  const [requirementIds, setRequirementIds] = React.useState<string[]>(
    initialRequirementIds ?? []
  )

  React.useEffect(() => {
    setRequirementIds(initialRequirementIds ?? [])
  }, [initialRequirementIds])

  // 所选分库模板的并集
  const templateFields = React.useMemo(() => {
    const fields = new Set<string>()
    databases
      .filter((db) => dbNames.includes(db.database_name))
      .forEach((db) => db.meta_data_template?.forEach((f) => fields.add(f)))
    return Array.from(fields)
  }, [databases, dbNames])

  // 分库变化时清理不再可用的元数据字段
  React.useEffect(() => {
    setMetadata((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => templateFields.includes(key))
      )
    )
  }, [templateFields])

  const addNewTag = () => {
    const name = newTagInput.trim()
    if (!name) return
    if (!tagNames.includes(name)) setTagNames((prev) => [...prev, name])
    setNewTagInput("")
  }

  const handleSubmit = () => {
    if (!file) {
      toast.error("请选择文件")
      return
    }
    if (dbNames.length === 0) {
      toast.error("请至少选择一个分库")
      return
    }
    onSubmit({
      file,
      databaseNames: dbNames,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
      requirementIds: requirementIds.length > 0 ? requirementIds : undefined,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <Section title="文件" desc="支持 txt、md、docx，上传后立即完成切片与编码">
        <label className="border-input hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-4 py-6 transition-colors">
          <CloudUpload size={20} className="text-muted-foreground shrink-0" />
          {file ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {formatFileSize(file.size)}
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <p className="text-sm">点击选择文件</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                或拖拽文件到此处
              </p>
            </div>
          )}
          <input
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Section>

      <Section title="所属分库" desc="至少选择一个，可多选">
        <div className="flex flex-wrap gap-2">
          {databases.map((db) => {
            const active = dbNames.includes(db.database_name)
            return (
              <button
                key={db.id}
                type="button"
                onClick={() =>
                  setDbNames((prev) =>
                    active
                      ? prev.filter((n) => n !== db.database_name)
                      : [...prev, db.database_name]
                  )
                }
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {db.database_desc || db.database_name}
              </button>
            )
          })}
        </div>
      </Section>

      {templateFields.length > 0 && (
        <Section title="元数据" desc="字段与取值由所选分库模板决定">
          <div className="space-y-3">
            {templateFields.map((field) => {
              const options = metadataOptions.filter(
                (o) => o.field_name === field
              )
              const fieldDesc = options[0]?.field_desc || field
              return (
                <div key={field} className="flex items-start gap-3">
                  <span className="text-muted-foreground w-24 shrink-0 pt-1 text-xs">
                    {fieldDesc}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                      const active = metadata[field] === option.value
                      return (
                        <button
                          key={option.id}
                          type="button"
                          title={option.desc}
                          onClick={() =>
                            setMetadata((prev) => {
                              const next = { ...prev }
                              if (active) delete next[field]
                              else next[field] = option.value
                              return next
                            })
                          }
                          className={`rounded border px-2 py-1 text-xs transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-transparent"
                              : "text-muted-foreground hover:bg-accent"
                          }`}
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
        </Section>
      )}

      <Section title="公开标签" desc="最多 20 个，可复用已有标签或新建">
        {tagNames.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tagNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  setTagNames((prev) => prev.filter((n) => n !== name))
                }
                className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded px-2 py-0.5 text-xs"
              >
                {name}
                <X size={10} />
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {tags
            .filter((t) => !tagNames.includes(t.name))
            .slice(0, 12)
            .map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => setTagNames((prev) => [...prev, tag.name])}
                className="text-muted-foreground hover:bg-accent rounded border px-2 py-1 text-xs transition-colors"
              >
                {tag.name}
              </button>
            ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addNewTag()
              }
            }}
            placeholder="输入新标签名后回车"
            className="border-input focus-visible:ring-ring h-8 flex-1 rounded-md border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-1"
          />
          <button
            type="button"
            onClick={addNewTag}
            className="hover:bg-accent rounded-md border px-3 text-sm"
          >
            添加
          </button>
        </div>
      </Section>

      {/* {requirements.length > 0 && (
        <Section title="关联知识库缺口" desc="可选，上传后文件将自动关联到所选缺口">
          <div className="max-h-32 space-y-1.5 overflow-y-auto">
            {requirements.map((req) => {
              const active = requirementIds.includes(req.id)
              return (
                <label
                  key={req.id}
                  className="hover:bg-accent/50 flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) =>
                      setRequirementIds((prev) =>
                        e.target.checked
                          ? [...prev, req.id]
                          : prev.filter((id) => id !== req.id)
                      )
                    }
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {req.requirement || req.question || "（未描述）"}
                    </span>
                    {req.requirement && req.question && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {req.question}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </div>
        </Section>
      )} */}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
      >
        {submitting && <LoaderCircle size={16} className="animate-spin" />}
        {submitLabel}
      </button>
    </div>
  )
}
