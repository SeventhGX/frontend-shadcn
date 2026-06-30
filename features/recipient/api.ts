import { fetcher } from '@/lib/fetcher'

export async function getAllRecipients() {
  return fetcher(
    `/recipients/v1/get_all`,
    { method: 'POST' }
  )
}

export interface recipientData {
  id?: string | null
  email: string
  name: string
}

export async function addRecipient(body: recipientData) {
  return fetcher(
    `/recipients/v1/add`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
}