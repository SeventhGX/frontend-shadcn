"use client"

import * as React from "react"
import { fetchDocImageObjectUrl } from "@/features/docs/api"

/**
 * 携带认证信息拉取图片并返回可用于 <img src> 的地址。
 * 图片接口需要 Bearer Token，浏览器直接用 <img src> 无法带上请求头，
 * 因此统一走鉴权 fetch 取 Blob 再转 ObjectURL，并在卸载/切换时释放。
 */
export function useAuthObjectUrl(src?: string) {
  const [url, setUrl] = React.useState("")
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!src) {
      setUrl("")
      setError(false)
      return
    }

    let cancelled = false
    let created = ""

    setError(false)
    setUrl("")

    fetchDocImageObjectUrl(src)
      .then((result) => {
        if (cancelled) {
          if (result.startsWith("blob:")) URL.revokeObjectURL(result)
          return
        }
        created = result
        setUrl(result)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
      if (created.startsWith("blob:")) URL.revokeObjectURL(created)
    }
  }, [src])

  return { url, error }
}
