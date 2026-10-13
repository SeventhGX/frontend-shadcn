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

export async function newArticleByStream(url: string) {
  return fetcher(
    `/articles/v1/url_stream?url=${encodeURIComponent(url)}`,
    { method: 'POST' }
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

export async function searchByStream(body: {}) {
  return fetcher(
    `/articles/v1/search_stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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