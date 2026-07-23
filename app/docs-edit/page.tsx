"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { DocsEditView } from "./docs-edit-view"

export default function DocsEditPage() {
  return (
    <AuthGuard>
      <DocsEditView />
    </AuthGuard>
  )
}
