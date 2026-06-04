import { NextRequest } from 'next/server'

// 图像编辑请求/响应体可能包含较大 base64，使用 Node.js 运行时并允许长耗时
export const runtime = 'nodejs'
export const maxDuration = 600

export async function POST(request: NextRequest) {
  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:8000'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const auth = request.headers.get('authorization')
  if (auth) {
    headers['Authorization'] = auth
  }

  // 直接将请求体流式转发，避免在内存中缓存完整字符串
  const backendRes = await fetch(`${backendBase}/ai/v2/image_edit`, {
    method: 'POST',
    headers,
    body: request.body,
    // Node fetch 流式发送 body 时必须显式声明 duplex
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })

  // 同样以流的方式回传给浏览器
  return new Response(backendRes.body, {
    status: backendRes.status,
    headers: {
      'Content-Type':
        backendRes.headers.get('content-type') || 'application/json',
    },
  })
}
