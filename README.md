# paylog
CLI tool to view your **MPP** and **x402** spending history, powered by **paylog.dev**.

## Usage

```
npx @kakedashi/paylog report --days 7
npx @kakedashi/paylog report --days 30 --enrich
npx @kakedashi/paylog report --chain base
npx @kakedashi/paylog report --chain all
npx @kakedashi/paylog wallet
npx @kakedashi/paylog balance
```

## Commands

### `paylog report`
Show a spending report for your wallet.

```
Options:
  -d, --days <n>          Past N days (default: 7)
  --from <date>           Start date YYYY-MM-DD
  --to <date>             End date YYYY-MM-DD
  --wallet <address>      Override auto-detected wallet
  --chain <chain>         Chain: tempo (default), base, or all
  --private-key <key>     EVM private key for x402 payment (base/all)
  --enrich                Enrich Locus payments using local history (tempo only)
```

#### `--chain` values

| Value | Protocol | Endpoint | Cost |
|---|---|---|---|
| `tempo` (default) | MPP | `/api/v1/report` | $0.001 USDC / Tempo |
| `base` | x402 | `/api/v1/x402/report?chain=base` | $0.01 USDC / Base |
| `all` | x402 | `/api/v1/x402/report?chain=all` | $0.01 USDC / Base |

`--chain all` combines MPP (Tempo) + x402 (Base) into a single report.

#### x402 payment (`--chain base` or `--chain all`)

x402 payment requires an EVM private key on Base mainnet:

```bash
# via environment variable
EVM_PRIVATE_KEY=0x... npx @kakedashi/paylog report --chain base

# via option
npx @kakedashi/paylog report --chain base --private-key 0x...
```

The wallet address is derived automatically from the private key.
Use `--wallet 0x...` to query a different address while signing with your key.

The `--enrich` flag reads your shell history and Claude Code chat logs to identify which Locus MPP services you used, since all Locus services share a single on-chain recipient address.

### `paylog wallet`
Display the auto-detected wallet address and its source.

### `paylog balance`
Run `tempo wallet whoami` (requires the **Tempo CLI**).

## Wallet Auto-Detection
For Tempo (MPP) reports, the wallet address is resolved in this order:
1. `~/.tempo/wallet/keys.toml` → `wallet_address` field
2. `~/.agentcash/wallet.json` → `address` field
3. `~/.mppx/wallet.json` → `address` field
4. `--wallet 0x...` option

For x402 (Base) reports, the wallet is derived from `EVM_PRIVATE_KEY` or `--private-key`.

## `--enrich` Details
Locus routes 40+ services through a single on-chain recipient (`0x060b0fb0...`), making them indistinguishable from on-chain data alone. The `--enrich` flag uses local history to estimate which service was used:

**History sources scanned:**
- `~/.zsh_history` (with timestamps)
- `~/.bash_history`
- `~/.local/share/fish/fish_history`
- `~/.claude/projects/*/chat.jsonl`

**Matching logic:**

| Confidence | Condition |
|---|---|
| High | Timestamp matches within ±30 seconds |
| Medium | Timestamp matches within ±60 seconds + price match |
| Low | Price match only |

**Example output:**
```
  Locus (paywithlocus.com)    $0.048   4 txns
      ┌─ Estimated breakdown (from local history) ──────────
      │ ✓ Brave Search      $0.010  1 txn   confidence: high
      │ ✓ Perplexity        $0.010  1 txn   confidence: high
      │ ? DeepSeek          $0.020  1 txn   confidence: medium
      └─ * estimated via local history correlation ─────────
```

## Cost
| Chain | Cost |
|---|---|
| Tempo (MPP) | $0.001 USDC per call |
| Base (x402) | $0.01 USDC per call |

## License
MIT
