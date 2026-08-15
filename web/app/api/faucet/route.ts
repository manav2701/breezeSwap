import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, createWalletClient, http, isAddress, getAddress, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createClient } from '@supabase/supabase-js'

/**
 * One-off demo collateral drip for a wallet that has never claimed.
 *
 * Server side only. The signing key never reaches the browser, and the route is the only
 * thing that can move the float.
 *
 * The demo token has no mint function, its supply was fixed at deployment, so this
 * transfers from a funded wallet. That is what makes the claim record load bearing rather
 * than cosmetic: without it one address could drain the float by calling this repeatedly.
 *
 * Uniqueness is enforced by the primary key on `faucet_claims`, not by the balance check
 * above it. Two requests racing for the same address both pass a read-then-write check;
 * only one can win an insert. The read exists to give a friendly answer in the common case,
 * the key exists to be correct in the uncommon one.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RPC = process.env.NEXT_PUBLIC_COSTON2_RPC ?? 'https://coston2-api.flare.network/ext/C/rpc'
const TOKEN = process.env.NEXT_PUBLIC_COLLATERAL_TOKEN ?? '0x8399c62f02cb1863Af24D71Db4f6F780F81c9d95'
const AMOUNT = process.env.FAUCET_AMOUNT ?? '1000'
const CHAIN_ID = 114

const coston2 = {
  id: CHAIN_ID,
  name: 'Flare Coston2',
  nativeCurrency: { name: 'Coston2 FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
} as const

const ERC20 = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

function supabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

/** GET tells the client whether to offer the drip, without spending anything. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('address')
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: 'A valid address is required.' }, { status: 400 })
  }
  const address = getAddress(raw)

  const db = supabase()
  if (!db) return NextResponse.json({ eligible: false, reason: 'unconfigured' })

  const { data } = await db
    .from('faucet_claims')
    .select('claimed_at, amount')
    .eq('wallet_address', address.toLowerCase())
    .maybeSingle()

  return NextResponse.json({
    eligible: !data,
    claimed: Boolean(data),
    amount: AMOUNT,
    claimedAt: data?.claimed_at ?? null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const raw = body?.address
    if (!raw || !isAddress(raw)) {
      return NextResponse.json({ error: 'A valid address is required.' }, { status: 400 })
    }
    const address = getAddress(raw)

    const pk = process.env.FAUCET_PRIVATE_KEY
    const db = supabase()
    if (!pk || !db) {
      return NextResponse.json(
        { error: 'The faucet is not configured on this deployment.' },
        { status: 503 }
      )
    }

    // Friendly path. The primary key below is what actually guarantees one claim.
    const { data: existing } = await db
      .from('faucet_claims')
      .select('tx_hash')
      .eq('wallet_address', address.toLowerCase())
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: 'This wallet has already claimed.', alreadyClaimed: true },
        { status: 409 }
      )
    }

    const account = privateKeyToAccount(pk as `0x${string}`)
    const publicClient = createPublicClient({ chain: coston2, transport: http(RPC) })
    const walletClient = createWalletClient({ account, chain: coston2, transport: http(RPC) })

    const decimals = (await publicClient.readContract({
      address: TOKEN as `0x${string}`,
      abi: ERC20,
      functionName: 'decimals',
    })) as number

    const amount = parseUnits(AMOUNT, decimals)

    // Refuse rather than emit a transaction that will revert, so a drained float reads as a
    // clear message instead of a failed transaction the user has to interpret.
    const float = (await publicClient.readContract({
      address: TOKEN as `0x${string}`,
      abi: ERC20,
      functionName: 'balanceOf',
      args: [account.address],
    })) as bigint

    if (float < amount) {
      return NextResponse.json({ error: 'The faucet is empty. Please try later.' }, { status: 503 })
    }

    // Claim first. A transfer recorded nowhere is worse than a record with no transfer: the
    // first lets the same wallet drain the float, the second is one wallet missing a drip.
    const { error: claimError } = await db.from('faucet_claims').insert({
      wallet_address: address.toLowerCase(),
      amount: amount.toString(),
    })

    if (claimError) {
      // Primary key violation, so another request won the race.
      return NextResponse.json(
        { error: 'This wallet has already claimed.', alreadyClaimed: true },
        { status: 409 }
      )
    }

    const hash = await walletClient.writeContract({
      address: TOKEN as `0x${string}`,
      abi: ERC20,
      functionName: 'transfer',
      args: [address, amount],
    })

    await publicClient.waitForTransactionReceipt({ hash })
    await db.from('faucet_claims').update({ tx_hash: hash }).eq('wallet_address', address.toLowerCase())

    return NextResponse.json({ ok: true, amount: AMOUNT, txHash: hash })
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.shortMessage ?? err?.message ?? 'The faucet request failed.' },
      { status: 500 }
    )
  }
}
