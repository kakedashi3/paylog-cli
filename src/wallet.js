"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveWallet = resolveWallet;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
function tryReadJson(filePath, field) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return null;
    try {
        const data = JSON.parse((0, node_fs_1.readFileSync)(filePath, 'utf8'));
        const val = data[field];
        if (typeof val === 'string' && /^0x[0-9a-fA-F]{40}$/.test(val))
            return val.toLowerCase();
    }
    catch {
        // ignore
    }
    return null;
}
function tryReadToml(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return null;
    try {
        const text = (0, node_fs_1.readFileSync)(filePath, 'utf8');
        const match = text.match(/wallet_address\s*=\s*["']?(0x[0-9a-fA-F]{40})["']?/);
        if (match)
            return match[1].toLowerCase();
    }
    catch {
        // ignore
    }
    return null;
}
function resolveWallet(explicit) {
    if (explicit) {
        if (!/^0x[0-9a-fA-F]{40}$/.test(explicit)) {
            throw new Error(`Invalid wallet address: ${explicit}`);
        }
        return explicit.toLowerCase();
    }
    const home = (0, node_os_1.homedir)();
    // 1. ~/.agentcash/wallet.json
    const agentcash = tryReadJson((0, node_path_1.join)(home, '.agentcash', 'wallet.json'), 'address');
    if (agentcash)
        return agentcash;
    // 2. ~/.mppx/wallet.json
    const mppx = tryReadJson((0, node_path_1.join)(home, '.mppx', 'wallet.json'), 'address');
    if (mppx)
        return mppx;
    // 3. ~/.tempo/wallet/keys.toml
    const tempo = tryReadToml((0, node_path_1.join)(home, '.tempo', 'wallet', 'keys.toml'));
    if (tempo)
        return tempo;
    return null;
}
