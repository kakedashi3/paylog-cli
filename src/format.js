// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
function usd(n) {
    return `$${n.toFixed(3)}`;
}
// ---------------------------------------------------------------------------
// Report display
// ---------------------------------------------------------------------------
export function printReport(report, enrich) {
    const { wallet, period, total_spent_usd, by_service, session_deposits, network_fees, other } = report;
    console.log();
    console.log(bold('MPP Spending Report'));
    console.log(dim(`Wallet: ${wallet}`));
    console.log(dim(`Period: ${period.from} → ${period.to}`));
    console.log();
    // Total summary
    console.log(`${bold('Total spent')}     ${bold(usd(total_spent_usd))}`);
    if (session_deposits.txns > 0) {
        console.log(`  Session deposits ${usd(session_deposits.deposited_usd).padStart(8)}  ${dim(`(${session_deposits.txns} txns — ${session_deposits.note})`)}`);
    }
    if (network_fees.txns > 0) {
        console.log(`  Network fees     ${usd(network_fees.total_usd).padStart(8)}  ${dim(`(${network_fees.txns} txns)`)}`);
    }
    console.log();
    // By service
    if (by_service.length > 0) {
        console.log(bold('By service:'));
        const maxName = Math.max(...by_service.map(s => s.name.length), 10);
        for (const svc of by_service) {
            const isLocus = svc.name.toLowerCase().includes('locus') || svc.url.includes('paywithlocus');
            const namePad = svc.name.padEnd(maxName + 2);
            const line = `  ${cyan(namePad)}${usd(svc.spent).padStart(10)}  ${dim(`${svc.txns} txns`)}`;
            console.log(line);
            // If this is Locus and we have enrich data, show the breakdown
            if (isLocus && enrich && (enrich.matched.length > 0 || enrich.unmatched_txns > 0)) {
                printEnrichBreakdown(enrich);
            }
        }
    }
    if (other.txns > 0) {
        console.log(`  ${'Other'.padEnd(20)}${usd(other.total_usd).padStart(10)}  ${dim(`${other.txns} txns`)}`);
    }
    console.log();
}
function printEnrichBreakdown(enrich) {
    console.log(dim(`      ┌─ Locus内訳 (ローカル履歴より推定) ─────────────────`));
    // Group matched by service
    const byService = new Map();
    for (const m of enrich.matched) {
        const key = m.service;
        const existing = byService.get(key);
        if (existing) {
            existing.amount += m.amount;
            existing.count++;
        }
        else {
            byService.set(key, { amount: m.amount, count: 1, confidence: m.confidence });
        }
    }
    for (const [service, { amount, count, confidence }] of byService) {
        const marker = confidence === 'high' ? green('✓') : confidence === 'medium' ? yellow('?') : dim('?');
        const confLabel = confidence === 'high' ? green('高') : confidence === 'medium' ? yellow('中') : dim('低');
        const line = `      │ ${marker} ${service.padEnd(16)} ${usd(amount).padStart(8)}  ${dim(`${count}件  信頼度：`)}${confLabel}`;
        console.log(line);
    }
    if (enrich.unmatched_txns > 0) {
        console.log(dim(`      │ ? 未照合              ${usd(enrich.unmatched_usd).padStart(8)}  ${enrich.unmatched_txns}件`));
    }
    console.log(dim(`      └─ ※ ローカル履歴との照合による推定 ──────────────`));
}
// ---------------------------------------------------------------------------
// Wallet display
// ---------------------------------------------------------------------------
export function printWallet(wallet, source) {
    console.log();
    console.log(bold('Wallet'));
    console.log(`  Address  ${cyan(wallet)}`);
    console.log(dim(`  Source   ${source}`));
    console.log();
}
// ---------------------------------------------------------------------------
// Error display
// ---------------------------------------------------------------------------
export function printError(msg) {
    console.error(`\x1b[31mError:\x1b[0m ${msg}`);
}
