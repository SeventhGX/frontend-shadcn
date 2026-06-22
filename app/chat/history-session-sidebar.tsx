"use client"

import { Clock, History, LoaderCircle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ChatSession } from "@/features/chat/api"

interface HistorySessionSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: ChatSession[]
  sessionsLoading: boolean
  sessionDetailLoading: string | null
  deleteTarget: ChatSession | null
  deletingSessionId: string | null
  onSelectSession: (session: ChatSession) => void
  onDeleteTargetChange: (session: ChatSession | null) => void
  onConfirmDelete: () => void
}

export function HistorySessionSidebar({
  open,
  onOpenChange,
  sessions,
  sessionsLoading,
  sessionDetailLoading,
  deleteTarget,
  deletingSessionId,
  onSelectSession,
  onDeleteTargetChange,
  onConfirmDelete,
}: HistorySessionSidebarProps) {
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <History size={14} />
            历史会话
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 sm:max-w-xs flex flex-col gap-0 p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History size={16} />
              历史会话
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <LoaderCircle size={18} className="animate-spin mr-2" />
                <span className="text-sm">加载中...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-sm text-muted-foreground">暂无历史会话</p>
              </div>
            ) : (
              <ul className="divide-y">
                {sessions.map((session) => {
                  const isLoading = sessionDetailLoading === session.id
                  const isDeleting = deletingSessionId === session.id
                  return (
                    <li key={session.id} className="flex items-stretch gap-1 pr-2 hover:bg-muted transition-colors">
                      <button
                        onClick={() => onSelectSession(session)}
                        disabled={!!sessionDetailLoading || !!deletingSessionId}
                        className="min-w-0 flex-1 text-left px-4 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start gap-2">
                          {isLoading ? (
                            <LoaderCircle size={14} className="animate-spin mt-0.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <Clock size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{session.session_name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{session.create_time}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                            disabled={!!sessionDetailLoading || !!deletingSessionId}
                            onClick={() => onDeleteTargetChange(session)}
                            aria-label={`删除会话 ${session.session_name}`}
                          >
                            {isDeleting ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          删除会话
                        </TooltipContent>
                      </Tooltip>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={!!deleteTarget} onOpenChange={(isOpen) => !isOpen && onDeleteTargetChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除历史会话</DialogTitle>
            <DialogDescription>
              确认删除“{deleteTarget?.session_name || "未命名会话"}”吗？删除后无法从历史会话中恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onDeleteTargetChange(null)}
              disabled={!!deletingSessionId}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmDelete}
              disabled={!!deletingSessionId}
              className="gap-2"
            >
              {deletingSessionId ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}