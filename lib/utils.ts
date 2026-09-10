import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 生成唯一 id。crypto.randomUUID 仅在安全上下文（HTTPS / localhost）可用，
 * 非 HTTPS 部署时会是 undefined，这里做降级兼容。
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 复制文本到剪贴板。navigator.clipboard 仅在安全上下文（HTTPS / localhost）可用，
 * 非 HTTPS 部署时会是 undefined，这里降级到 document.execCommand("copy")。
 *
 * anchor：触发复制的元素（如按钮）。Radix Dialog 等组件会用 FocusScope 做焦点陷阱，
 * 若降级方案里的临时 textarea 挂到 document.body（陷阱之外），select() 触发的聚焦会被
 * 焦点陷阱立刻抢回，导致复制失败或复制到空内容；因此优先把 textarea 挂在 anchor 的父节点下，
 * 确保它仍在陷阱范围内。
 */
export async function copyToClipboard(text: string, anchor?: HTMLElement | null): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 继续尝试降级方案
    }
  }

  if (typeof document === "undefined") return false

  const container = anchor?.parentElement ?? document.body
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.top = "-9999px"
  container.appendChild(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand("copy")
  } catch {
    ok = false
  }
  container.removeChild(textarea)
  return ok
}