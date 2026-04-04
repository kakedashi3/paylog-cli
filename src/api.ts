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

export interface X402ReportBase {
  chain: 'base'
  wallet: string
  total_spent_usd: number
  by_service: ServiceSummary[]
  other: { total_usd: number; txns: number; addresses: { address: string; total_usd: number; txns: number }[] }
  daily_breakdown: DailyBreakdown[]
}

export interface X402ReportAll {
  chain: 'all'
  wallet: string
  total_spent_usd: number
  by_service: ServiceSummary[]
  base: {
    total_spent_usd: number
    by_service: ServiceSummary[]
    other: X402ReportBase['other']
    daily_breakdown: DailyBreakdown[]
  }
  tempo: {
    total_spent_usd: number
    by_service: ServiceSummary[]
    session_deposits: { deposited_usd: number; txns: number; note: string }
    network_fees: { total_usd: number; txns: number }
    other: { total_usd: number; txns: number }
    daily_breakdown: DailyBreakdown[]
  }
}

export type X402ReportResponse = X402ReportBase | X402ReportAll

export interface CostOptimizationInsight {
  type: 'cost_optimization'
  service: string
  current_spend: number
  txns: number
  message: string
  alternative: string
  alternative_price: number
  potential_saving: number
}

export interface UsagePatternInsight {
  type: 'usage_pattern'
  message: string
}

export interface TopServiceInsight {
  type: 'top_service'
  service: string
  spend: number
  txns: number
  message: string
}

export type Insight = CostOptimizationInsight | UsagePatternInsight | TopServiceInsight

export interface InsightsResponse {
  wallet: string
  period: { from: string; to: string }
  insights: Insight[]
}

export async function fetchInsights(
  wallet: string,
  from: string,
  to: string,
): Promise<InsightsResponse> {
  const params = new URLSearchParams({ wallet, from, to })
  const url = `${BASE_URL}/api/v1/insights?${params}`

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

  return JSON.parse(output) as InsightsResponse
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

export async function fetchX402Report(
  wallet: string,
  chain: 'base' | 'all',
  privateKey: string,
): Promise<X402ReportResponse> {
  const { wrapFetchWithPayment } = await import('@x402/fetch')
  const { privateKeyToAccount } = await import('viem/accounts')
  const { registerExactEvmScheme } = await import('@x402/evm/exact/client')
  const { x402Client } = await import('@x402/core/client')

  const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  const account = privateKeyToAccount(key as `0x${string}`)

  const client = new x402Client()
  registerExactEvmScheme(client, { signer: account })
  const fetchWithPayment = wrapFetchWithPayment(fetch, client)

  const params = new URLSearchParams({ wallet, chain })
  const url = `${BASE_URL}/api/v1/x402/report?${params}`

  const res = await fetchWithPayment(url)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`x402 report failed (${res.status}): ${body}`)
  }

  return res.json() as Promise<X402ReportResponse>
}
