"use client"

import { AuthGuard } from "@/components/common/auth-guard"
import { useState, useEffect } from "react"
import { ArticleCard } from "@/components/common/article"
import { getArticleByBody } from "@/features/article/api"

export default function DataPage() {
  const [articles, setArticles] = useState<any[]>([])

  useEffect(() => {
    async function fetchArticles() {
      const fetchedArticles = await getArticleByBody({
        title: "首个人形机器人与具身智能标准体系发布",
        url: "https://www.news.cn/tech/20260302/3d0ff411d1d94995b4f0277d29e58e19/c.html"
      })
      console.log("Fetched articles:", fetchedArticles)
      setArticles(fetchedArticles.data || [])
    }
    fetchArticles()
  }, [])

  return (
    <AuthGuard>
      <div className="h-full flex flex-col gap-2 p-4 overflow-hidden">
        {articles.map((article, index) => (
          <ArticleCard
            key={index}
            title={article.title}
            key_words={article.key_words}
            summary={article.summary}
            url={article.url}
            publish_time={article.publish_time}
            mail_date={article.mail_date}
            real_mail_date={article.real_mail_date}
          />
        ))}
      </div>
    </AuthGuard >
  )
}