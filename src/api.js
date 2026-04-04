"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchInsights = fetchInsights;
exports.fetchReport = fetchReport;
exports.fetchX402Report = fetchX402Report;
const node_child_process_1 = require("node:child_process");
const BASE_URL = 'https://paylog.dev';
async function fetchInsights(wallet, from, to) {
    const params = new URLSearchParams({ wallet, from, to });
    const url = `${BASE_URL}/api/v1/insights?${params}`;
    let output;
    try {
        output = (0, node_child_process_1.execSync)(`tempo request -t -L -X GET "${url}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error('Tempo CLI not found. Install: curl -L https://tempo.xyz/install | bash');
        }
        const combined = (err.stdout ?? '') + (err.stderr ?? '');
        throw new Error(`tempo request failed:\n${combined || err.message}`);
    }
    return JSON.parse(output);
}
async function fetchReport(wallet, from, to, resolve = false) {
    const params = new URLSearchParams({ wallet, from, to });
    if (resolve)
        params.set('resolve', 'true');
    const url = `${BASE_URL}/api/v1/report?${params}`;
    let output;
    try {
        output = (0, node_child_process_1.execSync)(`tempo request -t -L -X GET "${url}"`, {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            throw new Error('Tempo CLI not found. Install: curl -L https://tempo.xyz/install | bash');
        }
        const combined = (err.stdout ?? '') + (err.stderr ?? '');
        throw new Error(`tempo request failed:\n${combined || err.message}`);
    }
    return JSON.parse(output);
}
async function fetchX402Report(wallet, chain, privateKey) {
    const { wrapFetchWithPayment } = await import('@x402/fetch');
    const { privateKeyToAccount } = await import('viem/accounts');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
    const { x402Client } = await import('@x402/core/client');
    const key = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
    const account = privateKeyToAccount(key);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer: account });
    const fetchWithPayment = wrapFetchWithPayment(fetch, client);
    const params = new URLSearchParams({ wallet, chain });
    const url = `${BASE_URL}/api/v1/x402/report?${params}`;
    const res = await fetchWithPayment(url);
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`x402 report failed (${res.status}): ${body}`);
    }
    return res.json();
}
