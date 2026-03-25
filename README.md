# paylog

CLI tool to view your [MPP](https://mpp.dev) spending history, powered by [paylog.dev](https://paylog.dev).

## Usage

```bash
npx paylog report --days 7
npx paylog report --days 30 --enrich
npx paylog wallet
npx paylog balance
```

## Commands

### `paylog report`

Show a spending report for your Tempo wallet.

```
Options:
  -d, --days <n>      Past N days (default: 7)
  --from <date>       Start date YYYY-MM-DD
  --to <date>         End date YYYY-MM-DD
  --wallet <address>  Override auto-detected wallet
  --enrich            Enrich Locus payments using local history
```

The `--enrich` flag reads your shell history and Claude Code chat logs to identify which Locus MPP services you used, since all Locus services share a single on-chain recipient address.

### `paylog wallet`

Display the auto-detected wallet address and its source.

### `paylog balance`

Run `tempo wallet whoami` (requires the [Tempo CLI](https://tempo.xyz)).

## Wallet Auto-Detection

The wallet address is resolved in this order:

1. `~/.agentcash/wallet.json` → `address` field
2. `~/.mppx/wallet.json` → `address` field
3. `~/.tempo/wallet/keys.toml` → `wallet_address` field
4. `--wallet 0x...` option

## `--enrich` Details

Locus routes 40+ services through a single on-chain recipient (`0x060b0fb0...`), making them indistinguishable from on-chain data alone. The `--enrich` flag uses local history to estimate which service was used:

**History sources scanned:**
- `~/.zsh_history` (with timestamps)
- `~/.bash_history`
- `~/.local/share/fish/fish_history`
- `~/.claude/projects/*/chat.jsonl`

**Matching logic:**

| Confidence | Condition |
|-----------|-----------|
| High      | Timestamp matches within ±30 seconds |
| Medium    | Timestamp matches within ±60 seconds + price match |
| Low       | Price match only |

**Example output:**
```
  Locus (paywithlocus.com)    $0.048   4 txns
      ┌─ Locus内訳 (ローカル履歴より推定) ─────────────────
      │ ✓ Brave             $0.010  1件  信頼度：高
      │ ✓ Perplexity        $0.010  1件  信頼度：高
      │ ? Deepseek          $0.020  1件  信頼度：中
      └─ ※ ローカル履歴との照合による推定 ──────────────
```

## Cost

Reports cost **$0.001 USDC** per call via MPP (Tempo chain). Your wallet must be funded.

## License

MIT
