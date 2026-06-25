"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { ChevronsUpDown, Plus, UserPlus, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"

interface Contact {
  mail: string
  name: string
}

const recipientData: Contact[] = [
  {
    mail: "lixin02@ronbaymat.com",
    name: "李鑫",
  },
  {
    mail: "lumiao@ronbaymat.com",
    name: "陆淼",
  },
]

function toggleInSet(
  setSet: Dispatch<SetStateAction<Set<string>>>,
  mail: string
) {
  setSet((prev) => {
    const next = new Set(prev)
    if (next.has(mail)) {
      next.delete(mail)
    } else {
      next.add(mail)
    }
    return next
  })
}

/**
 * 收件人 / 抄送人共用的「功能区 + 显示区」选择器。
 * 左侧为下拉触发按钮（功能区），右侧为已选人员标签（显示区）。
 */
function ContactSelector({
  label,
  contacts,
  selected,
  onToggle,
  onAddContact,
}: {
  label: string
  contacts: Contact[]
  selected: Set<string>
  onToggle: (mail: string) => void
  onAddContact: (name: string, mail: string) => void
}) {
  const [newName, setNewName] = useState("")
  const [newMail, setNewMail] = useState("")

  return (
    <div className="flex h-8 w-full items-center gap-2 rounded-md border bg-card px-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs font-medium"
          >
            <UserPlus size={12} />
            {label}
            <ChevronsUpDown size={12} className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="grid gap-2">
            {contacts.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                暂无可选联系人
              </p>
            ) : (
              contacts.map((contact) => {
                const id = `${label}-${contact.mail}`
                return (
                  <div key={contact.mail} className="flex items-center space-x-2">
                    <Checkbox
                      id={id}
                      checked={selected.has(contact.mail)}
                      onCheckedChange={() => onToggle(contact.mail)}
                    />
                    <div className="grid gap-1 leading-none">
                      <Label className="font-bold" htmlFor={id}>
                        {contact.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {contact.mail}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          <Separator className="my-2" />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full" variant="ghost" size="sm">
                <Plus className="h-4 w-4" />
                新增联系人
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-106">
              <DialogHeader>
                <DialogTitle>新增{label}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`name-${label}`} className="text-center">
                    姓名
                  </Label>
                  <Input
                    id={`name-${label}`}
                    className="col-span-3"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor={`mail-${label}`} className="text-center">
                    邮箱
                  </Label>
                  <Input
                    id={`mail-${label}`}
                    className="col-span-3"
                    value={newMail}
                    onChange={(e) => setNewMail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="submit"
                    disabled={!newName.trim() || !newMail.trim()}
                    onClick={() => {
                      onAddContact(newName.trim(), newMail.trim())
                      setNewName("")
                      setNewMail("")
                    }}
                  >
                    保存
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>

      <Separator orientation="vertical" className="h-5!" />

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {selected.size === 0 ? (
          <span className="text-xs text-muted-foreground">请选择{label}</span>
        ) : (
          contacts
            .filter((c) => selected.has(c.mail))
            .map((c) => (
              <Tooltip key={c.mail}>
                <TooltipTrigger asChild>
                  <div className="group flex h-6 shrink-0 items-center gap-1 rounded border bg-background px-1.5 text-xs">
                    <span className="max-w-35 truncate" title={c.name}>
                      {c.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`移除 ${c.name}`}
                      onClick={() => onToggle(c.mail)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">{c.mail}</TooltipContent>
              </Tooltip>
            ))
        )}
      </div>
    </div>
  )
}

export function Recipient() {
  const [contacts, setContacts] = useState<Contact[]>(
    recipientData.map((c) => ({ ...c }))
  )
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(
    new Set()
  )
  const [selectedCc, setSelectedCc] = useState<Set<string>>(new Set())
  const [sender, setSender] = useState("MOM新闻小助手")
  const [mailTitle, setMailTitle] = useState("本周新闻速览")

  const addContact = (name: string, mail: string) => {
    setContacts((prev) => [...prev, { mail, name }])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {/* 邮件标题：功能区为纯文本，显示区为输入框 */}
        <div className="flex h-8 min-w-0 flex-3 items-center gap-2 rounded-md border bg-card px-1.5">
          <span className="shrink-0 px-2 text-xs font-medium">邮件标题</span>
          <Separator orientation="vertical" className="h-5!" />
          <Input
            className="h-7 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-0"
            value={mailTitle}
            onChange={(e) => setMailTitle(e.target.value)}
            placeholder="请输入邮件标题"
          />
        </div>
        {/* 发件人：功能区为纯文本，显示区为输入框 */}
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-1.5">
          <span className="shrink-0 px-2 text-xs font-medium">发件人</span>
          <Separator orientation="vertical" className="h-5!" />
          <Input
            className="h-7 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:border-0"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            placeholder="请输入发件人名称"
          />
        </div>
      </div>

      {/* 收件人：功能区为下拉，显示区为已选标签 */}
      <ContactSelector
        label="收件人"
        contacts={contacts}
        selected={selectedRecipients}
        onToggle={(mail) => toggleInSet(setSelectedRecipients, mail)}
        onAddContact={addContact}
      />

      {/* 抄送人：功能区为下拉，显示区为已选标签 */}
      <ContactSelector
        label="抄送人"
        contacts={contacts}
        selected={selectedCc}
        onToggle={(mail) => toggleInSet(setSelectedCc, mail)}
        onAddContact={addContact}
      />
    </div>
  )
}