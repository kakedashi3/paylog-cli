import type { ReportResponse, ServiceSummary } from './api.js'
import { readLocalHistory, type HistoryEntry } from './history.js'
import locusPricingRaw from './locus-pricing.json'

// Locus gateway address (all Locus MPP services share this)
const LOCUS_RECIPIENT = '0x060b0fb0be9d90557577b3aee480711067149ff0'

// ---------------------------------------------------------------------------
// locus-pricing.json — 402チャレンジで取得した最新単価データ
// ---------------------------------------------------------------------------

interface LocusPricingEntry {
  url: string
  price_per_call: number | null
  probed_at: string
  strategy: string
}
type LocusPricing = Record<string, LocusPricingEntry>

const LOCUS_PRICING = locusPricingRaw as LocusPricing

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Confidence = 'high' | 'medium' | 'low'

export interface PriceCandidate {
  service: string
  serviceUrl: string
  price: number
  confidence: 'high' | 'medium'
}

export interface EnrichedLocusPayment {
  timestamp: number      // unix seconds (estimated from block)
  amount: number         // USDC
  service: string        // matched service name
  serviceUrl: string     // e.g. brave.mpp.paywithlocus.com
  confidence: Confidence
  matchMethod: 'time' | 'price' | 'time+price'
  candidates?: PriceCandidate[]  // 価格ヒューリスティックで複数候補がある場合
}

export interface EnrichResult {
  total_usd: number
  txns: number
  matched: EnrichedLocusPayment[]
  unmatched_txns: number
  unmatched_usd: number
}

// ---------------------------------------------------------------------------
// Confidence rules (time-based)
//  high:   |Δt| ≤ 30s
//  medium: |Δt| ≤ 60s  AND price within 0.5% of history entry
// ---------------------------------------------------------------------------

function calcConfidence(deltaSec: number, priceMatch: boolean): Confidence | null {
  const absDelta = Math.abs(deltaSec)
  if (absDelta <= 30) return 'high'
  if (absDelta <= 60 && priceMatch) return 'medium'
  return null
}

// ---------------------------------------------------------------------------
// Price-based heuristic using locus-pricing.json
//  完全一致 (epsilon < 0.000001) → confidence: high
//  ±10%以内                       → confidence: medium
//  複数候補は confidence 優先、次に価格差が小さい順にソート
// ---------------------------------------------------------------------------

function matchByPrice(amount: number): PriceCandidate[] {
  const candidates: PriceCandidate[] = []
  for (const [name, entry] of Object.entries(LOCUS_PRICING)) {
    if (entry.price_per_call === null) continue
    const price = entry.price_per_call
    const diff = Math.abs(price - amount)
    const relDiff = amount > 0 ? diff / amount : Infinity
    if (diff < 0.000001) {
      candidates.push({ service: name, serviceUrl: entry.url, price, confidence: 'high' })
    } else if (relDiff <= 0.1) {
      candidates.push({ service: name, serviceUrl: entry.url, price, confidence: 'medium' })
    }
  }
  return candidates.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1
    return Math.abs(a.price - amount) - Math.abs(b.price - amount)
  })
}

// ---------------------------------------------------------------------------
// In-memory "Locus payment" extraction from the report
// ---------------------------------------------------------------------------

interface LocusTxStub {
  date: string       // YYYY-MM-DD
  amount: number     // USDC per tx (approximated as avg)
  txns: number
}

function extractLocusTxStubs(report: ReportResponse): LocusTxStub[] {
  const stubs: LocusTxStub[] = []
  for (const day of report.daily_breakdown) {
    const locusEntry = day.by_service.find(
      s => s.name.toLowerCase().includes('locus') || s.url.includes('paywithlocus'),
    )
    if (!locusEntry || locusEntry.txns === 0) continue
    stubs.push({
      date: day.date,
      amount: locusEntry.spent / locusEntry.txns,  // avg per tx
      txns: locusEntry.txns,
    })
  }
  return stubs
}

/** Date string YYYY-MM-DD → approximate unix timestamp (noon UTC) */
function dateToNoonUtc(date: string): number {
  return Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 1000)
}

// ---------------------------------------------------------------------------
// Main enrichment: time-matching → 失敗時に価格ヒューリスティックで補完
// ---------------------------------------------------------------------------

export function enrichLocusPayments(report: ReportResponse): EnrichResult {
  const locusService = report.by_service.find(
    s => s.name.toLowerCase().includes('locus') || s.url.includes('paywithlocus'),
  )
  if (!locusService || locusService.txns === 0) {
    return { total_usd: 0, txns: 0, matched: [], unmatched_txns: 0, unmatched_usd: 0 }
  }

  const history = readLocalHistory()
  const stubs = extractLocusTxStubs(report)

  const matched: EnrichedLocusPayment[] = []
  let matchedTxns = 0

  for (const stub of stubs) {
    const dayStart = Math.floor(new Date(`${stub.date}T00:00:00Z`).getTime() / 1000)
    const dayEnd   = Math.floor(new Date(`${stub.date}T23:59:59Z`).getTime() / 1000)
    const noonApprox = dateToNoonUtc(stub.date)

    // 1. 時刻マッチング: このdayのhistoryエントリを探す（±1日バッファ）
    const dayEntries = history.filter(
      h => h.timestamp > 0 && h.timestamp >= dayStart - 86400 && h.timestamp <= dayEnd + 86400,
    )

    const serviceHits = new Map<string, HistoryEntry[]>()
    for (const entry of dayEntries) {
      if (!serviceHits.has(entry.service)) serviceHits.set(entry.service, [])
      serviceHits.get(entry.service)!.push(entry)
    }

    let remainingTxns = stub.txns

    for (const [service, entries] of serviceHits) {
      if (remainingTxns <= 0) break

      const closest = entries.reduce((best, e) => {
        return Math.abs(e.timestamp - noonApprox) < Math.abs(best.timestamp - noonApprox) ? e : best
      })

      const delta = closest.timestamp - noonApprox
      const confidence = calcConfidence(delta, true)
      if (!confidence) continue

      const serviceUrl = (() => {
        try { return new URL(closest.url).hostname } catch { return closest.url }
      })()

      // 時刻マッチング成功 → 価格候補も付加して matchMethod を記録
      const priceCandidates = matchByPrice(stub.amount)
      const priceAlsoMatches = priceCandidates.some(c => c.service === service)

      matched.push({
        timestamp: closest.timestamp,
        amount: stub.amount,
        service,
        serviceUrl,
        confidence,
        matchMethod: priceAlsoMatches ? 'time+price' : 'time',
      })
      matchedTxns++
      remainingTxns--
    }

    // 2. 時刻マッチング不足分 → 価格ヒューリスティックで補完
    if (remainingTxns > 0) {
      const candidates = matchByPrice(stub.amount)
      if (candidates.length > 0) {
        const best = candidates[0]
        const txsToAdd = remainingTxns

        for (let i = 0; i < txsToAdd; i++) {
          matched.push({
            timestamp: 0,  // 時刻不明
            amount: stub.amount,
            service: best.service,
            serviceUrl: best.serviceUrl,
            confidence: best.confidence,
            matchMethod: 'price',
            candidates: candidates.length > 1 ? candidates : undefined,
          })
          matchedTxns++
          remainingTxns--
        }
      }
    }
  }

  const unmatchedTxns = locusService.txns - matchedTxns
  const unmatchedUsd = unmatchedTxns > 0
    ? (locusService.spent / locusService.txns) * unmatchedTxns
    : 0

  return {
    total_usd: locusService.spent,
    txns: locusService.txns,
    matched,
    unmatched_txns: Math.max(0, unmatchedTxns),
    unmatched_usd: Math.max(0, unmatchedUsd),
  }
}
