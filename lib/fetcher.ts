export async function fetcher(
  path: string,
  options?: RequestInit
) {
  const res = await fetch(
    path,
    {
      credentials: 'include',
      ...options,
    }
  )

  if (!res.ok) {
    throw new Error('API Error')
  }

  return res.json()
}
