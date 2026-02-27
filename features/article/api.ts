import { fetcher } from '@/lib/fetcher'
import { format } from "date-fns"

export async function getArticleByDate(date: Date | string) {
  const formattedDate = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
  return fetcher(
    `http://127.0.0.1:8000/articles/v1/get_by_mail_date?mail_date=${formattedDate}`,
    { method: 'POST' }
  )
}

export async function maToHtml(mdStr: string) {
  return fetcher(
    `http://127.0.0.1:8000/articles/v1/md_to_html`,
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
    `http://127.0.0.1:8000/articles/v1/url_stream?url=${url}`,
    { method: 'POST' }
  )
}