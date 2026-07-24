import type { Position } from '../types'

export async function getUserPositions(
  indexerUrl: string,
  walletAddress: string
): Promise<Position[]> {
  const res = await fetch(`${indexerUrl}/api/users/${walletAddress.toLowerCase()}/positions`)
  if (!res.ok) throw new Error(`Failed to fetch positions for user: ${walletAddress}`)
  const data = await res.json()
  return data.positions || []
}
