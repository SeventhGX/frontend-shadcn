"use client"

import { useState, useEffect } from "react"
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { BrainCircuit, Settings, FileCog, Sparkles } from 'lucide-react';
import { Textarea } from "@/components/ui/textarea"
import { chatByStream } from "@/features/article/api"
import { toast } from "sonner"


export function ConclusionDialog({
  content, setContent
}: { content: string, setContent: React.Dispatch<React.SetStateAction<string>> }) {
  const [open, setOpen] = useState(false)
  const [roleCfg, setRoleCfg] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState("")
  const [accordionValue, setAccordionValue] = useState<string | undefined>("result")

  useEffect(() => {
    return () => {
      // setRoleCfg("")
      setResult("")
      setIsGenerating(false)
      setAccordionValue("result")
    }
  }, [open]) // 监听 open 状态，当对话框打开或关闭时重置状态

  async function handleGenerate() {
    setIsGenerating(true)
    setResult("")

    if (!content.trim() || !roleCfg.trim()) {
      toast.error("请完善输入内容")
      setIsGenerating(false)
      return
    }

    try {
      const response = await chatByStream({
        role_cfg: roleCfg,
        content,
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法获取流读取器')
      }

      let buffer = '' // 用于缓存不完整的行
      let hasReceivedContent = false // 用于跟踪是否已经接收到 content 数据

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        // 解码数据块
        buffer += decoder.decode(value, { stream: true })

        // 按行分割
        const lines = buffer.split('\n')

        // 保留最后一个不完整的行
        buffer = lines.pop() || ''

        // 处理每一行
        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine) {
            // 移除 SSE 格式的 "data: " 前缀
            let jsonStr = trimmedLine
            if (trimmedLine.startsWith('data: ')) {
              jsonStr = trimmedLine.substring(6)
            }

            // 检查是否为 SSE 终止标记
            if (jsonStr === '[DONE]' || jsonStr.trim() === '[DONE]') {
              console.log('SSE 流已完成')
              continue
            }

            // 跳过空字符串
            if (!jsonStr.trim()) {
              continue
            }

            try {
              const data = JSON.parse(jsonStr)

              // 根据字段类型更新对应的状态
              if (data.reasoning_content !== undefined) {
                setResult(prev => prev + data.reasoning_content)
                // console.log('Received reasoning_content:', data.reasoning_content)
              }

              if (data.content !== undefined) {
                // 只在第一次接收到 content 时切换状态
                if (!hasReceivedContent) {
                  hasReceivedContent = true
                  setResult("") // 推理完成，切换状态
                }
                setResult(prev => prev + data.content)
              }
            } catch (parseError) {
              console.warn('JSON 解析错误:', trimmedLine, parseError)
            }
          }
        }
      }

      // 处理最后剩余的缓冲区内容
      if (buffer.trim()) {
        // 移除 SSE 格式的 "data: " 前缀
        let jsonStr = buffer.trim()
        if (jsonStr.startsWith('data: ')) {
          jsonStr = jsonStr.substring(6)
        }

        // 检查是否为 SSE 终止标记
        if (jsonStr === '[DONE]' || jsonStr.trim() === '[DONE]') {
          console.log('SSE 流已完成')
        } else if (jsonStr.trim()) {
          try {
            const data = JSON.parse(jsonStr)
            if (data.reasoning_content !== undefined) {
              setResult(prev => prev + data.reasoning_content)
            }
            if (data.content !== undefined) {
              if (!hasReceivedContent) {
                hasReceivedContent = true
                setResult("") // 推理完成，切换状态
              }
              setResult(prev => prev + data.content)
            }
          } catch (parseError) {
            console.warn('JSON 解析错误:', buffer, parseError)
          }
        }
      }
    } catch (error) {
      // console.error('生成总结时出错:', error)
      toast.error('生成总结时出错:' + (error instanceof Error ? error.message : String(error)))
      setResult('生成总结时出错，请稍后再试。')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BrainCircuit className="h-4 w-4" />
          AI总结
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[90vw] max-w-[95vw] h-[90vh] flex flex-col p-6 gap-0">
        <DialogHeader>
          <DialogTitle>总结</DialogTitle>
          <DialogDescription>
            借助AI生成总结。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 rounded-md pt-4">
          <Accordion type="single" collapsible className="w-full" value={accordionValue} onValueChange={setAccordionValue}>
            <AccordionItem value="role-cfg">
              <AccordionTrigger className="font-bold">
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  AI任务设置
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid w-full gap-1.5 p-1">
                  <Textarea
                    placeholder="请输入AI任务设置"
                    id="role-cfg"
                    value={roleCfg}
                    onChange={(e) => setRoleCfg(e.target.value)}
                    className="max-h-80 overflow-auto"
                  />
                  <p className="text-sm text-muted-foreground">
                    此处的内容将作为系统消息发送给AI，指导AI如何进行总结。您可以在这里设置总结的重点、格式要求等。
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="content">
              <AccordionTrigger className="font-bold">
                <span className="flex items-center gap-2">
                  <FileCog className="h-4 w-4" />
                  待处理的内容
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid w-full gap-1.5 p-1">
                  <Textarea
                    placeholder="请输入待处理的内容"
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="max-h-80 overflow-auto"
                  />
                  <p className="text-sm text-muted-foreground">
                    此处的内容将作为用户消息发送给AI，AI将根据任务设置的内容对其进行处理。
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="result">
              <AccordionTrigger className="font-bold">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  生成的总结
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-4 bg-muted rounded-md whitespace-pre-wrap">
                  {result}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button disabled={isGenerating}>关闭</Button>
          </DialogClose>
          <Button type="submit" onClick={handleGenerate} disabled={isGenerating}>
            提交
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}