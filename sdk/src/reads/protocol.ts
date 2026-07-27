export async function getTotalFeesCollected(indexerUrl: string): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/fees/total`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.totalFeesWei || '0'
  } catch {
    return '0'
  }
}

export async function getInsuranceFundBalance(indexerUrl: string): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/insurance-fund`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.balanceWei || '0'
  } catch {
    return '0'
  }
}

export async function getProtocolTreasuryBalance(indexerUrl: string): Promise<string> {
  try {
    const res = await fetch(`${indexerUrl}/api/protocol/treasury`)
    if (!res.ok) return '0'
    const data = await res.json()
    return data.balanceWei || '0'
  } catch {
    return '0'
  }
}
