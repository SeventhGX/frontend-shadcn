"use client"

import type { ComponentProps, ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { crawlerOptions, type CrawlerType } from "@/features/article/api"

interface CrawlerSplitButtonProps {
  crawlerType: CrawlerType
  onCrawlerTypeChange: (value: CrawlerType) => void
  onClick: () => void
  disabled?: boolean // 仅作用于左侧主按钮，下拉框始终可用
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
  className?: string // 作用于左侧主按钮
  menuLabel?: string
  children: ReactNode
}

/**
 * 按钮 + 下拉框组合：左侧按钮以当前选中的方式直接调用接口，右侧下拉框切换豆包 / DeepSeek。
 * 下拉框只切换方式，不会触发调用，因此不受 disabled 影响，始终可以切换（切换只影响下一次调用）。
 */
export function CrawlerSplitButton({
  crawlerType,
  onCrawlerTypeChange,
  onClick,
  disabled,
  variant,
  size,
  className,
  menuLabel = "选择方式",
  children,
}: CrawlerSplitButtonProps) {
  const currentLabel = crawlerOptions.find(option => option.value === crawlerType)?.label

  return (
    <div className="inline-flex">
      <Button
        variant={variant}
        size={size}
        className={cn("rounded-r-none", className)}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={variant}
            size={size}
            // 去掉与主按钮相邻一侧的圆角和边框，组合成一个整体
            className={cn("rounded-l-none gap-1", variant === "outline" ? "border-l-0" : "border-l border-l-primary-foreground/30")}
            aria-label={menuLabel}
          >
            {currentLabel}
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{menuLabel}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={crawlerType}
            onValueChange={(value) => onCrawlerTypeChange(value as CrawlerType)}
          >
            {crawlerOptions.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
