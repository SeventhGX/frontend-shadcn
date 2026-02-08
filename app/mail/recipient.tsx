"use client"

import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"


import * as React from "react"
import { useState } from "react"
import { Check, ChevronsUpDown, Mail, Plus, UserPlus } from "lucide-react"


import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@radix-ui/react-label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"



const recipientData = [
  {
    mail: "lixin02@ronbaymat.com",
    name: "李鑫",
  },
  {
    mail: "lumiao@ronbaymat.com",
    name: "陆淼",
  },
]

export function Recipient() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  const [recipients, setRecipients] = useState<any[]>(
    recipientData.map((recipient) => ({
      ...recipient,
      checked: false,
    }))
  )

  const [sender, setSender] = useState("MOM新闻小助手")
  const [newName, setNewName] = useState("")
  const [newMail, setNewMail] = useState("")

  return (
    <div className="flex items-center mb-2">
      <div className="flex items-end">
        <Label htmlFor="sender" className="mr-2 font-bold">发件人:</Label>
        <Input id="sender" className="w-50 h-10"
          value={sender} onChange={(e) => setSender(e.target.value)} placeholder="请输入发件人名称" />
      </div>
      <div className="flex items-end ml-4 mr-2 flex-1">
        <Label htmlFor="recipient" className="mr-2 font-bold">收件人:</Label>
        <div id="recipient" className="flex items-center overflow-x-auto border h-10 rounded-md shadow-xs flex-1">
          {recipients.filter(r => r.checked).length === 0 ? (
            <span className="text-muted-foreground ml-2">请选择收件人</span>
          ) : (
            recipients.filter(r => r.checked).map(r => (
              <TooltipProvider key={r.mail}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="ml-2">{r.name}</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{r.mail}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))
          )}
        </div>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-10">
            <UserPlus className="h-4 w-4" />
            选择收件人
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            {recipients.map((recipient) => (
              <div key={recipient.mail} className="flex items-center space-x-2">
                <Checkbox
                  id={recipient.mail}
                  checked={recipient.checked}
                  onCheckedChange={(checked) => {
                    setRecipients((prev) =>
                      prev.map((r) =>
                        r.mail === recipient.mail
                          ? { ...r, checked: checked === true }
                          : r
                      )
                    )
                  }}
                />
                <div className="grid gap-1 leading-none">
                  <Label className="font-bold" htmlFor={recipient.mail}>{recipient.name}</Label>
                  <p className="text-xs text-muted-foreground">
                    {recipient.mail}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Separator className="my-2" />
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full" variant="ghost">
                <Plus />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-106">
              <DialogHeader>
                <DialogTitle>新增收件人</DialogTitle>
                {/* <DialogDescription>
                Make changes to your profile here. Click save when you're done.
              </DialogDescription> */}
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-center">
                    姓名
                  </Label>
                  <Input
                    id="name"
                    className="col-span-3"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="mail" className="text-center">
                    邮箱
                  </Label>
                  <Input
                    id="mail"
                    className="col-span-3"
                    value={newMail}
                    onChange={(e) => setNewMail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="submit" onClick={() => {
                    setRecipients((prev) => [
                      ...prev,
                      { mail: newMail, name: newName, checked: false },
                    ])
                    setNewName("")
                    setNewMail("")
                  }}>保存
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>
    </div>
  )
}
