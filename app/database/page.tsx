"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { useState } from "react"
import { ArticleCard } from "@/components/common/article"

export default function DataPage() {
  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        <ArticleCard
          title="示例文章"
          key_words="示例, 文章, 关键词"
          summary="这是一个示例文章的摘要，用于展示文章卡片组件的使用。"
          url="https://example.com/article"
          publish_time="2024-06-01"
          mail_date="2024-06-05"
          real_mail_date="2024-06-04"
        />
      </div>

    </AuthGuard>
  )
}