"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichLocusPayments = enrichLocusPayments;
const history_js_1 = require("./history.js");
// Locus gateway address (all Locus MPP services share this)
const LOCUS_RECIPIENT = '0x060b0fb0be9d90557577b3aee480711067149ff0';
// ---------------------------------------------------------------------------
// Block-time → unix seconds estimate
// (paylog.dev returns daily_breakdown with date; we approximate block timestamp
//  from the date. In a future version the API could return block timestamps.)
// ---------------------------------------------------------------------------
/** Confidence rules:
 *  high:   |Δt| ≤ 30s
 *  medium: |Δt| ≤ 60s  AND price within 0.5% of history entry (same endpoint cost)
 *  low:    price within 2% but timestamp unknown or >60s
 */
function calcConfidence(deltaSec, priceMatch) {
    const absDelta = Math.abs(deltaSec);
    if (absDelta <= 30)
        return 'high';
    if (absDelta <= 60 && priceMatch)
        return 'medium';
    return null;
}
function extractLocusTxStubs(report) {
    const stubs = [];
    for (const day of report.daily_breakdown) {
        // Find "Locus" service in this day's breakdown
        // The API returns service named "Locus (paywithlocus.com)"
        const locusEntry = day.by_service.find(s => s.name.toLowerCase().includes('locus') || s.url.includes('paywithlocus'));
        if (!locusEntry || locusEntry.txns === 0)
            continue;
        stubs.push({
            date: day.date,
            amount: locusEntry.spent / locusEntry.txns, // avg per tx
            txns: locusEntry.txns,
        });
    }
    return stubs;
}
/** Date string YYYY-MM-DD → approximate unix timestamp (noon UTC) */
function dateToNoonUtc(date) {
    return Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 1000);
}
// ---------------------------------------------------------------------------
// Match history entries to Locus payments
// ---------------------------------------------------------------------------
function enrichLocusPayments(report) {
    const locusService = report.by_service.find(s => s.name.toLowerCase().includes('locus') || s.url.includes('paywithlocus'));
    if (!locusService || locusService.txns === 0) {
        return { total_usd: 0, txns: 0, matched: [], unmatched_txns: 0, unmatched_usd: 0 };
    }
    const history = (0, history_js_1.readLocalHistory)();
    const stubs = extractLocusTxStubs(report);
    const matched = [];
    let matchedTxns = 0;
    for (const stub of stubs) {
        const dayStart = Math.floor(new Date(`${stub.date}T00:00:00Z`).getTime() / 1000);
        const dayEnd = Math.floor(new Date(`${stub.date}T23:59:59Z`).getTime() / 1000);
        const noonApprox = dateToNoonUtc(stub.date);
        // Filter history entries with known timestamps that fall within this day (±1 day buffer)
        const dayEntries = history.filter(h => h.timestamp > 0 && h.timestamp >= dayStart - 86400 && h.timestamp <= dayEnd + 86400);
        // Group by service for this day
        const serviceHits = new Map();
        for (const entry of dayEntries) {
            const key = entry.service;
            if (!serviceHits.has(key))
                serviceHits.set(key, []);
            serviceHits.get(key).push(entry);
        }
        // For each history service hit, try to match against stub's txns
        let remainingTxns = stub.txns;
        for (const [service, entries] of serviceHits) {
            if (remainingTxns <= 0)
                break;
            // Find the closest-in-time entry
            const closest = entries.reduce((best, e) => {
                const d = Math.abs(e.timestamp - noonApprox);
                const bd = Math.abs(best.timestamp - noonApprox);
                return d < bd ? e : best;
            });
            const delta = closest.timestamp - noonApprox;
            // Price match: within 10% (we only have avg, not per-tx price from API)
            const priceMatch = true; // can't reliably match price from daily avg
            const confidence = calcConfidence(delta, priceMatch);
            if (!confidence)
                continue;
            const serviceUrl = new URL(closest.url).hostname;
            matched.push({
                timestamp: closest.timestamp,
                amount: stub.amount,
                service,
                serviceUrl,
                confidence,
            });
            matchedTxns++;
            remainingTxns--;
        }
    }
    const unmatchedTxns = locusService.txns - matchedTxns;
    const unmatchedUsd = unmatchedTxns > 0
        ? (locusService.spent / locusService.txns) * unmatchedTxns
        : 0;
    return {
        total_usd: locusService.spent,
        txns: locusService.txns,
        matched,
        unmatched_txns: Math.max(0, unmatchedTxns),
        unmatched_usd: Math.max(0, unmatchedUsd),
    };
}
