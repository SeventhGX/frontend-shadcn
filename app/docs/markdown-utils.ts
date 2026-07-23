/** 文档目录中的标题条目 */
export interface HeadingItem {
  id: string
  text: string
  /** 标题级别 1~6 */
  level: number
}

/**
 * 将标题文本转换为锚点 id。
 * 保留中文、字母、数字，其余替换为连字符，保证正文标题与目录锚点一致。
 */
export function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      // 保留中文、字母、数字、空格与连字符
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  )
}

/**
 * 从 Markdown 正文中提取标题，用于生成右侧目录。
 * 会先剔除围栏代码块，避免把代码里的 # 误当作标题。
 */
export function extractHeadings(markdown: string): HeadingItem[] {
  if (!markdown) return []

  // 去掉 ``` 围栏代码块
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, "")

  const headings: HeadingItem[] = []
  const seen = new Map<string, number>()

  for (const line of withoutCode.split("\n")) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) continue

    const level = match[1].length
    // 去掉可能的行内 Markdown 标记（**、`、[]() 等）
    const text = match[2]
      .replace(/\*\*|__|`|~~/g, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .trim()

    if (!text) continue

    let id = slugify(text)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    if (count > 0) id = `${id}-${count}`

    headings.push({ id, text, level })
  }

  return headings
}
