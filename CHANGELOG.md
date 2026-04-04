# Changelog

## [0.3.0] - 2026-04-04

### Added
- `--chain` option for `paylog report`: `tempo` (default), `base`, `all`
- `--chain base` / `--chain all` use x402 payment (EIP-3009 / Base mainnet) instead of MPP
- `--private-key` option and `EVM_PRIVATE_KEY` env var for x402 signing
- `chain=all` returns a combined Tempo MPP + Base x402 report in one call

### Dependencies
- Added `@x402/core`, `@x402/evm`, `@x402/fetch`, `viem` for x402 support

## [0.2.1] - 2026-04-04

- --enrich の精度向上：locus-pricing.json による金額ヒューリスティック追加
- matchMethod フィールド追加（time / price / time+price）
- 37サービスの単価データ同梱

## [0.2.0] - 2026-04-01

### Changed
- Bump version to reflect paylog.dev API improvements

### API Improvements (paylog.dev)
- **Session refund tracking**: `/api/v1/report` now returns `session_deposits.refunded_usd` and `net_usd` (actual spend = deposited − refunded). Previously only deposit amounts were tracked.
- **Insights accuracy**: `/api/v1/insights` now includes:
  - `session_efficiency` — alerts when refund rate ≥30%, suggests lowering deposit amount
  - `other_spend` — alerts when unresolved addresses exceed 5% of spend, suggests `resolve=true`
  - `high_frequency` — detects services called 100+ times and suggests client-side caching
  - `usage_pattern` (daily) — detects burst usage and idle periods from daily breaking data
- **RPC reliability**: Tempo RPC calls now retry up to 3 times with exponential backoff (500ms → 1s → 2s)

## [0.1.5] - 2026-03-28

### Added
- x402 payment support (Base USDC) alongside MPP

## [0.1.1] - 2026-03-21

### Fixed
- Load SERVICE_META prices dynamically from services.json

## [0.1.0] - 2026-03-20

### Added
- Initial release
- `paylog report` command — fetch spending report by wallet and date range
- `paylog insights` command — fetch cost optimization insights
- MPP payment via Tempo chain
