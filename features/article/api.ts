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
    `/articles/v1/url_stream?url=${url}`,
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