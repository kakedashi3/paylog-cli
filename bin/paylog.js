#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const node_fs_1 = require("node:fs");
const node_child_process_1 = require("node:child_process");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const wallet_js_1 = require("../src/wallet.js");
const api_js_1 = require("../src/api.js");
const enrich_js_1 = require("../src/enrich.js");
const format_js_1 = require("../src/format.js");
const program = new commander_1.Command();
program
    .name('paylog')
    .description('View your MPP spending history from paylog.dev')
    .version('0.1.0');
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
    let wallet;
    try {
        wallet = (0, wallet_js_1.resolveWallet)(opts.wallet);
    }
    catch (err) {
        (0, format_js_1.printError)(err.message);
        process.exit(1);
    }
    if (!wallet) {
        (0, format_js_1.printError)('No wallet found. Provide one via --wallet, or run: curl -fsSL https://tempo.xyz/install | bash');
        process.exit(1);
    }
    // Resolve date range
    const toDate = opts.to ?? new Date().toISOString().slice(0, 10);
    let fromDate;
    if (opts.from) {
        fromDate = opts.from;
    }
    else {
        const days = parseInt(opts.days, 10);
        if (isNaN(days) || days < 1) {
            (0, format_js_1.printError)('--days must be a positive integer');
            process.exit(1);
        }
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - days);
        fromDate = d.toISOString().slice(0, 10);
    }
    // Fetch report
    let report;
    try {
        report = await (0, api_js_1.fetchReport)(wallet, fromDate, toDate, opts.enrich);
    }
    catch (err) {
        (0, format_js_1.printError)(err.message);
        process.exit(1);
    }
    // Optionally enrich Locus payments
    const enrich = opts.enrich ? (0, enrich_js_1.enrichLocusPayments)(report) : undefined;
    (0, format_js_1.printReport)(report, enrich);
});
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
    let wallet;
    try {
        wallet = (0, wallet_js_1.resolveWallet)(opts.wallet);
    }
    catch (err) {
        (0, format_js_1.printError)(err.message);
        process.exit(1);
    }
    if (!wallet) {
        (0, format_js_1.printError)('No wallet found. Provide one via --wallet, or run: curl -fsSL https://tempo.xyz/install | bash');
        process.exit(1);
    }
    const toDate = new Date().toISOString().slice(0, 10);
    let fromDate;
    if (opts.from) {
        fromDate = opts.from;
    }
    else {
        const days = parseInt(opts.days, 10);
        if (isNaN(days) || days < 1) {
            (0, format_js_1.printError)('--days must be a positive integer');
            process.exit(1);
        }
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - days);
        fromDate = d.toISOString().slice(0, 10);
    }
    let response;
    try {
        response = await (0, api_js_1.fetchInsights)(wallet, fromDate, toDate);
    }
    catch (err) {
        (0, format_js_1.printError)(err.message);
        process.exit(1);
    }
    (0, format_js_1.printInsights)(response);
});
// ---------------------------------------------------------------------------
// paylog wallet
// ---------------------------------------------------------------------------
program
    .command('wallet')
    .description('Show the detected wallet address')
    .option('--wallet <address>', 'Wallet address (overrides auto-detection)')
    .action((opts) => {
    const home = (0, node_os_1.homedir)();
    const sources = [
        { path: (0, node_path_1.join)(home, '.tempo', 'wallet', 'keys.toml'), label: '~/.tempo/wallet/keys.toml' },
        { path: (0, node_path_1.join)(home, '.agentcash', 'wallet.json'), label: '~/.agentcash/wallet.json' },
        { path: (0, node_path_1.join)(home, '.mppx', 'wallet.json'), label: '~/.mppx/wallet.json' },
    ];
    if (opts.wallet) {
        try {
            const addr = (0, wallet_js_1.resolveWallet)(opts.wallet);
            (0, format_js_1.printWallet)(addr, '--wallet option');
        }
        catch (err) {
            (0, format_js_1.printError)(err.message);
            process.exit(1);
        }
        return;
    }
    let foundSource = 'auto-detected';
    for (const src of sources) {
        if ((0, node_fs_1.existsSync)(src.path)) {
            foundSource = src.label;
            break;
        }
    }
    const wallet = (0, wallet_js_1.resolveWallet)();
    if (wallet) {
        (0, format_js_1.printWallet)(wallet, foundSource);
        return;
    }
    (0, format_js_1.printError)('No wallet found. Try:\n' +
        '  Install Tempo:  curl -fsSL https://tempo.xyz/install | bash\n' +
        '  ~/.tempo/wallet/keys.toml  wallet_address = "0x..."\n' +
        '  ~/.agentcash/wallet.json   { "address": "0x..." }\n' +
        '  ~/.mppx/wallet.json        { "address": "0x..." }\n' +
        '  paylog wallet --wallet 0x...');
    process.exit(1);
});
// ---------------------------------------------------------------------------
// paylog balance
// ---------------------------------------------------------------------------
program
    .command('balance')
    .description('Show Tempo wallet balance (requires tempo CLI)')
    .action(() => {
    const result = (0, node_child_process_1.spawnSync)('tempo', ['wallet', 'whoami'], { stdio: 'inherit' });
    if (result.error) {
        (0, format_js_1.printError)('Could not run `tempo wallet whoami`. Is the tempo CLI installed?');
        process.exit(1);
    }
    process.exit(result.status ?? 0);
});
program.parse();
