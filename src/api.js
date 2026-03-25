const BASE_URL = 'https://paylog.dev';
export async function fetchReport(wallet, from, to, resolve = false) {
    const params = new URLSearchParams({ wallet, from, to });
    if (resolve)
        params.set('resolve', 'true');
    const url = `${BASE_URL}/api/v1/report?${params}`;
    const res = await fetch(url);
    if (res.status === 402) {
        throw new Error('Payment required (402). This API costs $0.001 USDC per call.\n' +
            'Make sure your Tempo wallet is funded and the mppx client is configured.');
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
    }
    return res.json();
}
