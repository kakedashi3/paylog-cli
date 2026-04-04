import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function tryReadJson(filePath: string, field: string): string | null {
  if (!existsSync(filePath)) return null
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'))
    const val = data[field]
    if (typeof val === 'string' && /^0x[0-9a-fA-F]{40}$/.test(val)) return val.toLowerCase()
  } catch {
    // ignore
  }
  return null
}

function tryReadToml(filePath: string): string | null {
  if (!existsSync(filePath)) return null
  try {
    const text = readFileSync(filePath, 'utf8')
    const match = text.match(/wallet_address\s*=\s*["']?(0x[0-9a-fA-F]{40})["']?/)
    if (match) return match[1].toLowerCase()
  } catch {
    // ignore
  }
  return null
}

export function resolveWallet(explicit?: string): string | null {
  if (explicit) {
    if (!/^0x[0-9a-fA-F]{40}$/.test(explicit)) {
      throw new Error(`Invalid wallet address: ${explicit}`)
    }
    return explicit.toLowerCase()
  }

  const home = homedir()

  // 1. ~/.tempo/wallet/keys.toml（最も普及しているため優先）
  const tempo = tryReadToml(join(home, '.tempo', 'wallet', 'keys.toml'))
  if (tempo) return tempo

  // 2. ~/.agentcash/wallet.json
  const agentcash = tryReadJson(join(home, '.agentcash', 'wallet.json'), 'address')
  if (agentcash) return agentcash

  // 3. ~/.mppx/wallet.json
  const mppx = tryReadJson(join(home, '.mppx', 'wallet.json'), 'address')
  if (mppx) return mppx

  return null
}
