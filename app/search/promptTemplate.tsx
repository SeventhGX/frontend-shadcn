"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BookmarkPlus, ChevronsUpDown, Loader2, Pencil, Trash2, User } from "lucide-react"
import {
  createSearchPromptTemplate,
  deleteSearchPromptTemplate,
  getSearchPromptTemplates,
  type SearchPromptTemplate,
} from "@/features/article/api"
import { ApiError } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type TemplateField = "template_name" | "description" | "system_prompt"
type FieldErrors = Partial<Record<TemplateField, string>>

interface TemplateForm {
  template_name: string
  description: string
  system_prompt: string
}

/** 模版弹窗状态：新建（保存当前提示词为模版）或修改自己的模版（删除后重新创建） */
type DialogState =
  | { mode: "create" }
  | { mode: "edit"; template: SearchPromptTemplate }
  | null

/** 从后端错误中提取 detail 文本；422 时按字段拆分，便于表单字段级提示 */
function parseApiError(error: unknown): { message: string; fieldErrors: FieldErrors } {
  if (!(error instanceof ApiError)) {
    return { message: "请求失败，请稍后重试", fieldErrors: {} }
  }
  const detail = (error.data as { detail?: unknown } | null)?.detail
  if (error.status === 422 && Array.isArray(detail)) {
    const fieldErrors: FieldErrors = {}
    for (const item of detail as { loc?: unknown[]; msg?: string }[]) {
      const field = item.loc?.[item.loc.length - 1] as TemplateField | undefined
      if (field && !fieldErrors[field]) fieldErrors[field] = item.msg ?? "参数不合法"
    }
    return { message: "参数校验失败", fieldErrors }
  }
  if (typeof detail === "string") return { message: detail, fieldErrors: {} }
  if (error.status === 401) return { message: "登录已过期，请重新登录", fieldErrors: {} }
  return { message: "请求失败，请稍后重试", fieldErrors: {} }
}

/** 与后端一致：首尾空白去除后再校验长度 */
function validateForm(form: TemplateForm): FieldErrors {
  const errors: FieldErrors = {}
  const name = form.template_name.trim()
  if (!name) errors.template_name = "请输入模版名称"
  else if (name.length > 100) errors.template_name = "模版名称不能超过 100 个字符"
  if (!form.system_prompt.trim()) errors.system_prompt = "请输入模版内容"
  return errors
}

/**
 * 搜索页的提示词模版工具栏：加载模版后直接填入搜索框，也可把搜索框内容保存为模版，删除和修改自己的模版。
 * 模版对所有已登录用户公开，仅创建者可删除；修改通过「删除后重新创建」实现。
 */
export function PromptTemplateToolbar({
  content,
  onContentChange,
}: {
  /** 搜索框当前内容 */
  content: string
  onContentChange: (value: string) => void
}) {
  const [templates, setTemplates] = useState<SearchPromptTemplate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [dialog, setDialog] = useState<DialogState>(null)
  const [form, setForm] = useState<TemplateForm>({ template_name: "", description: "", system_prompt: "" })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isSaving, setIsSaving] = useState(false)

  const selected = templates.find(t => t.id === selectedId) ?? null
  const isModified = selected !== null && selected.system_prompt !== content

  const loadTemplates = async () => {
    setIsLoading(true)
    try {
      const res = await getSearchPromptTemplates()
      setTemplates(res.data ?? [])
    } catch (error) {
      toast.error("获取模版列表失败：" + parseApiError(error).message)
    } finally {
      setIsLoading(false)
    }
  }

  // 进入搜索页时拉取模版列表
  useEffect(() => {
    loadTemplates()
  }, [])

  const handlePickerOpenChange = (open: boolean) => {
    setPickerOpen(open)
    // 每次展开都刷新一次，以便看到其他用户新建的模版
    if (open) loadTemplates()
  }

  const handleApply = (template: SearchPromptTemplate) => {
    // 搜索框已有其它内容时，覆盖前先确认
    if (content.trim() && content !== template.system_prompt
      && !window.confirm(`加载模版「${template.template_name}」将覆盖搜索框中的当前内容，是否继续？`)) {
      return
    }
    setSelectedId(template.id)
    onContentChange(template.system_prompt)
    setPickerOpen(false)
  }

  const handleDelete = async (template: SearchPromptTemplate) => {
    if (!window.confirm(`确定删除模版「${template.template_name}」？`)) return
    setDeletingId(template.id)
    try {
      await deleteSearchPromptTemplate(template.id)
      toast.success("模版已删除")
      setTemplates(prev => prev.filter(t => t.id !== template.id))
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) {
        toast.error("删除失败：" + parseApiError(error).message)
        return
      }
      // 模版已被删除，直接刷新列表
      toast.info("模版已不存在，已刷新列表")
      loadTemplates()
    } finally {
      setDeletingId(null)
    }
    // 删除当前选中的模版时只取消选中，保留搜索框中的内容
    if (selectedId === template.id) setSelectedId(null)
  }

  const openCreateDialog = () => {
    setForm({ template_name: "", description: "", system_prompt: content })
    setFieldErrors({})
    setDialog({ mode: "create" })
  }

  const openEditDialog = (template: SearchPromptTemplate) => {
    setForm({
      template_name: template.template_name,
      description: template.description ?? "",
      system_prompt: template.system_prompt,
    })
    setFieldErrors({})
    setPickerOpen(false)
    setDialog({ mode: "edit", template })
  }

  const handleSave = async () => {
    if (!dialog) return
    const errors = validateForm(form)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSaving(true)
    try {
      // 后端暂不支持编辑：修改时先创建新模版，成功后再删除旧模版，避免创建失败导致原模版丢失
      const res = await createSearchPromptTemplate({
        template_name: form.template_name.trim(),
        description: form.description.trim() || null,
        system_prompt: form.system_prompt.trim(),
      })
      const created = res.data

      if (dialog.mode === "edit") {
        try {
          await deleteSearchPromptTemplate(dialog.template.id)
        } catch (error) {
          // 404 说明旧模版已被删除，视为成功；其它错误时提示用户手动清理
          if (!(error instanceof ApiError && error.status === 404)) {
            toast.warning("新模版已保存，但旧模版删除失败：" + parseApiError(error).message)
          }
        }
      }

      const replacedId = dialog.mode === "edit" ? dialog.template.id : null
      setTemplates(prev => [created, ...prev.filter(t => t.id !== replacedId)])
      setSelectedId(created.id)
      onContentChange(created.system_prompt)
      setDialog(null)
      toast.success(dialog.mode === "edit" ? "模版已修改" : "模版已保存")
    } catch (error) {
      const parsed = parseApiError(error)
      setFieldErrors(parsed.fieldErrors)
      toast.error("保存失败：" + parsed.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={handlePickerOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" role="combobox" aria-expanded={pickerOpen} className="max-w-64 justify-between">
              <span className="truncate">
                {selected ? selected.template_name : "加载模版"}
                {isModified && <span className="text-muted-foreground">（已修改）</span>}
              </span>
              <ChevronsUpDown className="opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[28rem] p-0" align="start">
            <Command>
              <CommandInput placeholder="按名称、描述或创建者筛选..." />
              <CommandList className="max-h-80">
                <CommandEmpty>
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-1">
                      <Loader2 size={14} className="animate-spin" />
                      加载中...
                    </span>
                  ) : "暂无模版"}
                </CommandEmpty>
                <CommandGroup heading={isLoading && templates.length > 0 ? "刷新中..." : `共 ${templates.length} 个模版`}>
                  {templates.map(template => (
                    <CommandItem
                      key={template.id}
                      value={template.id}
                      keywords={[template.template_name, template.description ?? "", template.user_name ?? ""]}
                      onSelect={() => handleApply(template)}
                      className="items-start"
                    >
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{template.template_name}</span>
                          <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                            <User className="size-3" />
                            {template.is_owner ? "我" : template.user_name ?? "未知用户"}
                          </span>
                        </div>
                        {template.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                        )}
                      </div>
                      {template.is_owner && (
                        <div className="flex shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label="修改模版"
                            title="修改模版"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(template)
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            aria-label="删除模版"
                            title="删除模版"
                            disabled={deletingId === template.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(template)
                            }}
                          >
                            {deletingId === template.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                          </Button>
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button variant="outline" size="sm" onClick={openCreateDialog} disabled={!content.trim()} title="将搜索框中的内容保存为模版">
          <BookmarkPlus />
          保存为模版
        </Button>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && !isSaving && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "修改模版" : "保存为模版"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? "保存后将以新模版替换原模版（删除后重新创建）。"
                : "模版对所有用户公开，其他人可以查看和使用，仅你本人可以删除。"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="template-name">模版名称</Label>
              <Input
                id="template-name"
                value={form.template_name}
                maxLength={100}
                onChange={(e) => setForm(prev => ({ ...prev, template_name: e.target.value }))}
                placeholder="例如：科技新闻分析"
                aria-invalid={!!fieldErrors.template_name}
              />
              {fieldErrors.template_name && <p className="text-xs text-destructive">{fieldErrors.template_name}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-description">描述（可选）</Label>
              <Input
                id="template-description"
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="简要说明模版用途"
                aria-invalid={!!fieldErrors.description}
              />
              {fieldErrors.description && <p className="text-xs text-destructive">{fieldErrors.description}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="template-prompt">模版内容</Label>
              <Textarea
                id="template-prompt"
                value={form.system_prompt}
                onChange={(e) => setForm(prev => ({ ...prev, system_prompt: e.target.value }))}
                className="min-h-32 max-h-80 overflow-auto"
                aria-invalid={!!fieldErrors.system_prompt}
              />
              {fieldErrors.system_prompt && <p className="text-xs text-destructive">{fieldErrors.system_prompt}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isSaving}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
