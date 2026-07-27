export async function getTotalFeesCollected(indexerUrl: string, chainId: number = 114): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/fees/total?chainId=${chainId}`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.totalFeesWei || '0'
  } catch {
    return '0'
  }
}

export async function getInsuranceFundBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/insurance-fund?chainId=${chainId}`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.balanceWei || '0'
  } catch {
    return '0'
  }
}

export async function getProtocolTreasuryBalance(indexerUrl: string, chainId: number = 114): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/treasury?chainId=${chainId}`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.balanceWei || '0'
  } catch {
    return '0'
  }
}
