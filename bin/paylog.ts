#!/usr/bin/env node
import { Command } from 'commander'
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveWallet } from '../src/wallet.js'
import { fetchReport, fetchInsights } from '../src/api.js'
import { enrichLocusPayments } from '../src/enrich.js'
import { printReport, printInsights, printWallet, printError } from '../src/format.js'

const program = new Command()

program
  .name('paylog')
  .description('View your MPP spending history from paylog.dev')
  .version('0.1.0')

// ---------------------------------------------------------------------------
// paylog report
// ---------------------------------------------------------------------------
program
  .command('report')
  .description('Show spending report for your Tempo wallet')
  .option('-d, --days <n>', 'Number of past days to include', '7')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('--wallet <address>', 'Wallet address (overrides auto-detection)')
  .option('--enrich', 'Enrich Locus payments using local shell/Claude history', false)
  .action(async (opts) => {
    // Resolve wallet
    let wallet: string | null
    try {
      wallet = resolveWallet(opts.wallet as string | undefined)
    } catch (err: unknown) {
      printError((err as Error).message)
      process.exit(1)
    }
    if (!wallet) {
      printError(
        'No wallet found. Provide one via --wallet, or set up a Tempo/mppx/agentcash wallet.',
      )
      process.exit(1)
    }

    // Resolve date range
    const toDate = (opts.to as string | undefined) ?? new Date().toISOString().slice(0, 10)
    let fromDate: string
    if (opts.from) {
      fromDate = opts.from as string
    } else {
      const days = parseInt(opts.days as string, 10)
      if (isNaN(days) || days < 1) {
        printError('--days must be a positive integer')
        process.exit(1)
      }
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - days)
      fromDate = d.toISOString().slice(0, 10)
    }

    // Fetch report
    let report
    try {
      report = await fetchReport(wallet, fromDate, toDate, opts.enrich as boolean)
    } catch (err: unknown) {
      printError((err as Error).message)
      process.exit(1)
    }

    // Optionally enrich Locus payments
    const enrich = (opts.enrich as boolean) ? enrichLocusPayments(report) : undefined

    printReport(report, enrich)
  })

// ---------------------------------------------------------------------------
// paylog insights
// ---------------------------------------------------------------------------
program
  .command('insights')
  .description('Show spending insights and cost optimization tips for your Tempo wallet')
  .option('-d, --days <n>', 'Number of past days to include', '7')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--wallet <address>', 'Wallet address (overrides auto-detection)')
  .action(async (opts) => {
    let wallet: string | null
    try {
      wallet = resolveWallet(opts.wallet as string | undefined)
    } catch (err: unknown) {
      printError((err as Error).message)
      process.exit(1)
    }
    if (!wallet) {
      printError(
        'No wallet found. Provide one via --wallet, or set up a Tempo/mppx/agentcash wallet.',
      )
      process.exit(1)
    }

    const toDate = new Date().toISOString().slice(0, 10)
    let fromDate: string
    if (opts.from) {
      fromDate = opts.from as string
    } else {
      const days = parseInt(opts.days as string, 10)
      if (isNaN(days) || days < 1) {
        printError('--days must be a positive integer')
        process.exit(1)
      }
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - days)
      fromDate = d.toISOString().slice(0, 10)
    }

    let response
    try {
      response = await fetchInsights(wallet, fromDate, toDate)
    } catch (err: unknown) {
      printError((err as Error).message)
      process.exit(1)
    }

    printInsights(response)
  })

// ---------------------------------------------------------------------------
// paylog wallet
// ---------------------------------------------------------------------------
program
  .command('wallet')
  .description('Show the detected wallet address')
  .option('--wallet <address>', 'Wallet address (overrides auto-detection)')
  .action((opts) => {
    const home = homedir()
    const sources = [
      { path: join(home, '.agentcash', 'wallet.json'), label: '~/.agentcash/wallet.json' },
      { path: join(home, '.mppx', 'wallet.json'),      label: '~/.mppx/wallet.json' },
      { path: join(home, '.tempo', 'wallet', 'keys.toml'), label: '~/.tempo/wallet/keys.toml' },
    ]

    if (opts.wallet) {
      try {
        const addr = resolveWallet(opts.wallet as string)
        printWallet(addr!, '--wallet option')
      } catch (err: unknown) {
        printError((err as Error).message)
        process.exit(1)
      }
      return
    }

    let foundSource = 'auto-detected'
    for (const src of sources) {
      if (existsSync(src.path)) {
        foundSource = src.label
        break
      }
    }

    const wallet = resolveWallet()
    if (wallet) {
      printWallet(wallet, foundSource)
      return
    }

    printError(
      'No wallet found. Try:\n' +
      '  ~/.agentcash/wallet.json   { "address": "0x..." }\n' +
      '  ~/.mppx/wallet.json        { "address": "0x..." }\n' +
      '  ~/.tempo/wallet/keys.toml  wallet_address = "0x..."\n' +
      '  paylog wallet --wallet 0x...',
    )
    process.exit(1)
  })

// ---------------------------------------------------------------------------
// paylog balance
// ---------------------------------------------------------------------------
program
  .command('balance')
  .description('Show Tempo wallet balance (requires tempo CLI)')
  .action(() => {
    const result = spawnSync('tempo', ['wallet', 'whoami'], { stdio: 'inherit' })
    if (result.error) {
      printError('Could not run `tempo wallet whoami`. Is the tempo CLI installed?')
      process.exit(1)
    }
    process.exit(result.status ?? 0)
  })

program.parse()
