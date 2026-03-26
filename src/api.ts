import { execSync } from 'node:child_process'

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
  by_service: ServiceSummary[]
  session_deposits: { deposited_usd: number; txns: number; note: string }
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

  let output: string
  try {
    output = execSync(`tempo request -t -L -X GET "${url}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      throw new Error(
        'Tempo CLI not found. Install: curl -L https://tempo.xyz/install | bash',
      )
    }
    const combined: string = (err.stdout ?? '') + (err.stderr ?? '')
    throw new Error(`tempo request failed:\n${combined || err.message}`)
  }

  return JSON.parse(output) as ReportResponse
}
