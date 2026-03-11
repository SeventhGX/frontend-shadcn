"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export function ArticleCardWithSelect({ title, key_words, summary, isSelected, setIsSelected }: { title: string, key_words: string, summary: string, isSelected: boolean, setIsSelected: React.Dispatch<React.SetStateAction<boolean>> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex">
            <Switch id={`switch-${title}`} className="mr-2" checked={isSelected} onCheckedChange={setIsSelected} />
            <Label htmlFor={`switch-${title}`} className="font-bold text-sm">{title}</Label>
          </div>
        </CardTitle>
        <CardDescription>{key_words}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{summary}</p>
      </CardContent>
      {/* <CardFooter>
        <p>卡片页脚</p>
      </CardFooter> */}
    </Card>
  )
}

interface ArticleCardProps {
  title: string
  url: string
  publish_time?: string | null
  key_words?: string | null
  summary?: string | null
  content?: string | null
  mail_date?: string | null
  real_mail_date?: string | null
}

export function ArticleCard(articleProps: ArticleCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{articleProps.title}</CardTitle>
        <CardDescription>{articleProps.key_words}</CardDescription>
      </CardHeader>
      <CardContent>
        <p>{articleProps.summary}</p>
      </CardContent>
      <CardFooter>
        <div className="flex flex-col">
          {articleProps.publish_time ? ` 发布时间: ${articleProps.publish_time}` : null}
          {articleProps.mail_date ? ` 邮件发送时间: ${articleProps.mail_date} ` : null}
          <Link href={articleProps.url} target="_blank" className="text-blue-500">查看原文</Link>
        </div>
      </CardFooter>
    </Card>
  )
}