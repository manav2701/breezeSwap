import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { publicClient } from '../../utils/chainClient'
import { logger } from '../../utils/logger'

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const

const MOCK_USDT_ADDRESS = '0x639b6b2a0195271557e543F51c0FA417265B2FAC' as `0x${string}`
const INSURANCE_FUND_ADDRESS = '0x96952FC0fBe43AA72E1D08B11daD5cA56c12a36f' as `0x${string}`
const TREASURY_ADDRESS = '0xecB7Ff4dA80532F5C7803392761643bA4dDe5058' as `0x${string}`

export async function getTotalFees(req: Request, res: Response) {
  try {
    const { data, error } = await supabase.from('fee_events').select('fee_amount')
    if (error) throw error

    const total = (data || []).reduce((acc, row) => acc + BigInt(row.fee_amount || 0), 0n)
    return res.json({ totalFeesWei: total.toString() })
  } catch (err: any) {
    logger.error('getTotalFees error:', err)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getRecentFees(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit) || 20
    const { data, error } = await supabase
      .from('fee_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return res.json({ fees: data || [] })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getInsuranceFundBalance(req: Request, res: Response) {
  try {
    const bal = await publicClient.readContract({
      address: MOCK_USDT_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [INSURANCE_FUND_ADDRESS]
    })
    return res.json({ balanceWei: bal.toString() })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}

export async function getTreasuryBalance(req: Request, res: Response) {
  try {
    const bal = await publicClient.readContract({
      address: MOCK_USDT_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [TREASURY_ADDRESS]
    })
    return res.json({ balanceWei: bal.toString() })
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
