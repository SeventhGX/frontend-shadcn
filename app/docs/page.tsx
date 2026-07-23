"use client"

import { Suspense } from "react"

import { AuthGuard } from "@/components/common/auth-guard"
import { DocsView } from "./docs-view"

export default function DocsPage() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            加载中…
          </div>
        }
      >
        <DocsView />
      </Suspense>
    </AuthGuard>
  )
}
