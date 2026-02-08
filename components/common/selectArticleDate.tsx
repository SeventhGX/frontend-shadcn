"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function SelectArticleDate({ date, setDate }: { date: Date | undefined, setDate: (date: Date) => void }) {
  const [open, setOpen] = React.useState(false)

  // 获取指定周的周五
  const getFridayOfWeek = (weeksAgo: number): Date => {
    const today = new Date()
    const currentDay = today.getDay() // 0 (周日) 到 6 (周六)
    const daysToFriday = currentDay <= 5 ? 5 - currentDay : -(currentDay - 5)
    const thisFriday = addDays(today, daysToFriday)
    return addDays(thisFriday, weeksAgo * 7)
  }

  // 获取指定日期的周五
  const getFridayFromDate = (inputDate: Date | undefined): Date => {
    if (!inputDate) {
      inputDate = new Date()
    }
    const day = inputDate.getDay()
    const daysToFriday = day <= 5 ? 5 - day : -(day - 5)
    return addDays(inputDate, daysToFriday)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-70 justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>选择文章日期</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-auto flex-col space-y-2 p-2">
        <Select
          onValueChange={(value) => {
            const weeksAgo = parseInt(value)
            setDate(getFridayOfWeek(weeksAgo))
            setOpen(false) // 选择后关闭 Popover
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择文章日期" />
          </SelectTrigger>
          <SelectContent position="popper">
            <SelectItem value="0">本周</SelectItem>
            <SelectItem value="-1">上周</SelectItem>
            <SelectItem value="-2">上上周</SelectItem>
          </SelectContent>
        </Select>
        <div className="rounded-md border">
          <Calendar mode="single" selected={date} onSelect={(newDate) => {
            setDate(getFridayFromDate(newDate))
            setOpen(false) // 选择后关闭 Popover
          }} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
