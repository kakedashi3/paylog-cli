const BASE_URL = 'https://paylog.dev'

export interface ServiceSummary {
  name: string
  url: string
  spent: number
  txns: number
}

export interface DailyBreakdown {
  date: string
  total_usd: number
  by_service: ServiceSummary[]
}

export interface ReportResponse {
  wallet: string
  period: { from: string; to: string }
  total_spent_usd: number
  service_spent_usd: number
  by_service: ServiceSummary[]
  session_deposits: { total_usd: number; txns: number; note: string }
  network_fees: { total_usd: number; txns: number }
  other: { total_usd: number; txns: number }
  daily_breakdown: DailyBreakdown[]
}

export async function fetchReport(
  wallet: string,
  from: string,
  to: string,
  resolve = false,
): Promise<ReportResponse> {
  const params = new URLSearchParams({ wallet, from, to })
  if (resolve) params.set('resolve', 'true')

  const url = `${BASE_URL}/api/v1/report?${params}`
  const res = await fetch(url)

  if (res.status === 402) {
    throw new Error(
      'Payment required (402). This API costs $0.001 USDC per call.\n' +
      'Make sure your Tempo wallet is funded and the mppx client is configured.',
    )
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<ReportResponse>
}
