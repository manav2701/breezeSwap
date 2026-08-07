import { Request, Response } from 'express'
import { supabase } from '../../db/client'
import { publicClient } from '../../utils/chainClient'
import { fail } from '../respond'

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
    if (error) return fail(res, 'total fees query', error)

    const total = (data || []).reduce((acc, row) => acc + BigInt(row.fee_amount || 0), 0n)
    return res.json({ totalFeesWei: total.toString() })
  } catch (err) {
    return fail(res, 'total fees query', err)
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

    if (error) return fail(res, 'recent fees query', error)
    return res.json({ fees: data || [] })
  } catch (err) {
    return fail(res, 'recent fees query', err)
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
  } catch (err) {
    return fail(res, 'insurance fund balance read', err)
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
  } catch (err) {
    return fail(res, 'treasury balance read', err)
  }
}

export async function getGlobalTradeHistory(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const { data: positions, error } = await supabase
      .from('perp_positions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(limit)

    if (error) return fail(res, 'global trade history query', error)

    const trades: any[] = []
    for (const pos of positions || []) {
      trades.push({
        id: `${pos.position_id}-open`,
        marketAddress: pos.market_address,
        type: 'OPEN',
        timestamp: pos.opened_at,
        trader: pos.trader_address,
        side: pos.is_long ? 'LONG' : 'SHORT',
        size: (Number(pos.collateral || 0) * Number(pos.leverage || 1)).toString(),
        price: pos.entry_mark_price ? (Number(pos.entry_mark_price) / 1e18).toFixed(2) : '0.00',
        pnl: null,
        txHash: pos.open_tx_hash
      })

      if (pos.closed_at) {
        trades.push({
          id: `${pos.position_id}-close`,
          marketAddress: pos.market_address,
          type: pos.was_liquidated ? 'LIQUIDATION' : 'CLOSE',
          timestamp: pos.closed_at,
          trader: pos.trader_address,
          side: pos.is_long ? 'LONG' : 'SHORT',
          size: (Number(pos.collateral || 0) * Number(pos.leverage || 1)).toString(),
          price: pos.entry_mark_price ? (Number(pos.entry_mark_price) / 1e18).toFixed(2) : '0.00',
          pnl: pos.realized_pnl ? (Number(pos.realized_pnl) / 1e18).toFixed(2) : '0.00',
          txHash: pos.close_tx_hash
        })
      }
    }

    trades.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return res.json({ trades: trades.slice(0, limit) })
  } catch (err) {
    return fail(res, 'global trade history query', err)
  }
}
