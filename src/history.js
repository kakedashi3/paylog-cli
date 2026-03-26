"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLocalHistory = readLocalHistory;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const LOCUS_PATTERN = /paywithlocus\.com/;
// ---------------------------------------------------------------------------
// zsh_history  format: ": 1742817152:0;command"
// ---------------------------------------------------------------------------
function parseZshHistory(text) {
    const entries = [];
    for (const line of text.split('\n')) {
        const m = line.match(/^:\s*(\d+):\d+;(.+)/);
        if (!m)
            continue;
        const ts = parseInt(m[1], 10);
        for (const url of extractLocusUrls(m[2])) {
            entries.push({ timestamp: ts, url, service: urlToService(url), source: 'zsh' });
        }
    }
    return entries;
}
// ---------------------------------------------------------------------------
// bash_history  (no timestamps by default)
// ---------------------------------------------------------------------------
function parseBashHistory(text) {
    const entries = [];
    for (const line of text.split('\n')) {
        for (const url of extractLocusUrls(line)) {
            entries.push({ timestamp: 0, url, service: urlToService(url), source: 'bash' });
        }
    }
    return entries;
}
// ---------------------------------------------------------------------------
// fish_history  format: "- cmd: ...\n  when: 1742817152"
// ---------------------------------------------------------------------------
function parseFishHistory(text) {
    const entries = [];
    for (const block of text.split(/^- cmd:/m).slice(1)) {
        const whenMatch = block.match(/when:\s*(\d+)/);
        const ts = whenMatch ? parseInt(whenMatch[1], 10) : 0;
        for (const url of extractLocusUrls(block.split('\n')[0])) {
            entries.push({ timestamp: ts, url, service: urlToService(url), source: 'fish' });
        }
    }
    return entries;
}
// ---------------------------------------------------------------------------
// Claude Code  ~/.claude/projects/*/chat.jsonl
// Each line is a JSON message object with optional timestamp field
// ---------------------------------------------------------------------------
function parseClaudeJsonl(text) {
    const entries = [];
    for (const line of text.split('\n')) {
        if (!line.trim() || !LOCUS_PATTERN.test(line))
            continue;
        try {
            const obj = JSON.parse(line);
            const ts = obj.timestamp
                ? Math.floor(new Date(obj.timestamp).getTime() / 1000)
                : 0;
            for (const url of extractLocusUrls(JSON.stringify(obj))) {
                entries.push({ timestamp: ts, url, service: urlToService(url), source: 'claude' });
            }
        }
        catch { /* malformed line */ }
    }
    return entries;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function extractLocusUrls(text) {
    const results = [];
    for (const m of text.matchAll(/https?:\/\/([a-z0-9-]+\.mpp\.paywithlocus\.com[^\s"'`>\]]*)/gi)) {
        results.push(m[0]);
    }
    return results;
}
function urlToService(url) {
    try {
        const hostname = new URL(url).hostname; // e.g. brave.mpp.paywithlocus.com
        const sub = hostname.split('.')[0]; // e.g. "brave"
        return sub.charAt(0).toUpperCase() + sub.slice(1);
    }
    catch {
        return 'Unknown';
    }
}
function tryRead(path) {
    if (!(0, node_fs_1.existsSync)(path))
        return null;
    try {
        return (0, node_fs_1.readFileSync)(path, 'utf8');
    }
    catch {
        return null;
    }
}
// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
function readLocalHistory() {
    const home = (0, node_os_1.homedir)();
    const entries = [];
    // zsh
    const zsh = tryRead((0, node_path_1.join)(home, '.zsh_history'));
    if (zsh)
        entries.push(...parseZshHistory(zsh));
    // bash
    const bash = tryRead((0, node_path_1.join)(home, '.bash_history'));
    if (bash)
        entries.push(...parseBashHistory(bash));
    // fish
    const fish = tryRead((0, node_path_1.join)(home, '.local', 'share', 'fish', 'fish_history'));
    if (fish)
        entries.push(...parseFishHistory(fish));
    // Claude Code chat.jsonl — scan ~/.claude/projects/*/chat.jsonl
    const claudeProjects = (0, node_path_1.join)(home, '.claude', 'projects');
    if ((0, node_fs_1.existsSync)(claudeProjects)) {
        try {
            for (const projectDir of (0, node_fs_1.readdirSync)(claudeProjects)) {
                const jsonlPath = (0, node_path_1.join)(claudeProjects, projectDir, 'chat.jsonl');
                const content = tryRead(jsonlPath);
                if (content)
                    entries.push(...parseClaudeJsonl(content));
            }
        }
        catch { /* ignore */ }
    }
    return entries;
}
