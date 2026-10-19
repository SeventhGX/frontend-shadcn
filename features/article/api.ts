import { fetcher } from '@/lib/fetcher'
import { format } from "date-fns"

export async function getArticleByDate(date: Date | string) {
  const formattedDate = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return fetcher(
    `/articles/v1/get_by_mail_date?mail_date=${formattedDate}`,
    { method: 'POST' }
  )
}


export async function getArticleByBody(article_body: {}) {
  return fetcher(
    `/articles/v1/get_by_mail_body`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(article_body),
    }
  )
}


export async function getArticleByDateRange(date_range_body: {}) {
  return fetcher(
    `/articles/v1/get_by_date_range`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(date_range_body),
    }
  )
}


export async function maToHtml(mdStr: string) {
  return fetcher(
    `/articles/v1/md_to_html`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: mdStr }),
    }
  )
}

// ==================== 流式搜索 / 文章提取的提供商 ====================

/** search_stream 与 url_stream 支持的提供商，通过 Query 参数 crawler_type 切换，默认豆包 */
export type CrawlerType = 'doubao' | 'deepseek'

export const crawlerOptions: { value: CrawlerType; label: string }[] = [
  { value: 'doubao', label: '豆包' },
  { value: 'deepseek', label: 'DeepSeek' },
]

/** DeepSeek 搜索结果，原样保留官方 results 字段 */
export interface DeepSeekSearchItem {
  title: string
  url: string
  snippet: string
  summary: string
  content: string
  rerank_score: number // 0～3，官方将 ≥1.5 视为优质结果
  site_name: string | null
  site_icon: string | null
  date: string | null // UTC RFC 3339
  authority: number // 0～4，-1 表示未知；≥3 为极权威结果
}

/** DeepSeek 提取的文章对象 */
export interface DeepSeekArticle {
  title: string
  key_words: string
  publish_time: string | null
  content: string
  summary: string
  url: string
}

/**
 * DeepSeek 分支的 SSE 事件：每条 data 都是完整对象，不做增量拼接。
 * 收到 [DONE] 不代表成功，需以是否出现 error 事件为准。
 */
export type DeepSeekStreamEvent =
  | { type: 'progress'; provider: 'deepseek'; stage: string; message: string; query?: string }
  | { type: 'search_results'; provider: 'deepseek'; query: string; data: DeepSeekSearchItem[] }
  | { type: 'article'; provider: 'deepseek'; analysis_truncated: boolean; data: DeepSeekArticle }
  | { type: 'error'; provider: 'deepseek'; error: { code: string; message: string; status_code?: number } }

export async function newArticleByStream(url: string, crawlerType: CrawlerType = 'doubao', signal?: AbortSignal) {
  // url 本身可能含 ?、& 等字符，统一交给 URLSearchParams 编码
  const params = new URLSearchParams({ url, crawler_type: crawlerType })
  return fetcher(
    `/articles/v1/url_stream?${params}`,
    { method: 'POST', signal }
  )
}

export async function chatByStream(body: {}) {
  return fetcher(
    `/articles/v1/chat_stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}

export async function searchByStream(body: {}, crawlerType: CrawlerType = 'doubao', signal?: AbortSignal) {
  return fetcher(
    `/articles/v1/search_stream?crawler_type=${crawlerType}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    }
  )
}

// ==================== 搜索提示词模版 ====================

interface ApiResponse<T> {
  message: string
  code: number
  data: T
}

/** 搜索提示词模版，对所有已登录用户公开，仅创建者可删除 */
export interface SearchPromptTemplate {
  id: string
  template_name: string
  description: string | null
  /** 使用模版时直接作为 search_stream 的 system_prompt 传入 */
  system_prompt: string
  user_id: string
  user_name: string | null
  /** 是否为当前登录用户创建，据此控制「删除」按钮是否显示 */
  is_owner: boolean
  create_time: string
}

/** 创建模版请求体 */
export interface CreateSearchPromptTemplateBody {
  template_name: string
  description?: string | null
  system_prompt: string
}

/**
 * 获取模版列表（所有人创建的模版，按创建时间倒序）
 * @param templateName 按模版名称模糊搜索，不传返回全部
 */
export async function getSearchPromptTemplates(templateName?: string): Promise<ApiResponse<SearchPromptTemplate[]>> {
  const query = templateName ? `?template_name=${encodeURIComponent(templateName)}` : ''
  return fetcher(`/articles/v1/search_prompt_template${query}`, { method: 'GET' })
}

/**
 * 创建模版，创建者为当前登录用户
 */
export async function createSearchPromptTemplate(body: CreateSearchPromptTemplateBody): Promise<ApiResponse<SearchPromptTemplate>> {
  return fetcher(
    `/articles/v1/search_prompt_template`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}

/**
 * 删除自己创建的模版
 * @param templateId 模版 UUID
 */
export async function deleteSearchPromptTemplate(templateId: string): Promise<ApiResponse<null>> {
  return fetcher(
    `/articles/v1/search_prompt_template?template_id=${encodeURIComponent(templateId)}`,
    { method: 'DELETE' }
  )
}

export async function newArticle(article_body: {}) {
  return fetcher(
    `/articles/v1/add_by_body`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(article_body),
    }
  )
}