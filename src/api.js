import { execSync } from 'node:child_process';
const BASE_URL = 'https://paylog.dev';
export async function fetchReport(wallet, from, to, resolve = false) {
    const params = new URLSearchParams({ wallet, from, to });
    if (resolve)
        params.set('resolve', 'true');
    const url = `${BASE_URL}/api/v1/report?${params}`;
    let output;
    try {
        output = execSync(`tempo request -t -L -X GET "${url}"`, {
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
