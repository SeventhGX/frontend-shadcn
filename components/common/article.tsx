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

export default function ArticleCard({ title, key_words, summary, isSelected, setIsSelected }: { title: string, key_words: string, summary: string, isSelected: boolean, setIsSelected: React.Dispatch<React.SetStateAction<boolean>> }) {
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