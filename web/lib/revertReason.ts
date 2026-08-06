/**
 * Turn a contract revert into something a trader can act on.
 *
 * Viem surfaces an unrecognised custom error as its raw four-byte selector —
 * `The contract function "openPosition" reverted with the following signature:
 * 0xfb8f41b2`. That is unreadable, and it hid a real bug for as long as it was
 * shown: the selector meant "you never approved the collateral token", and
 * nothing in the UI said so.
 *
 * Selectors are `keccak256(errorSignature).slice(0, 10)` and are stable, so
 * mapping them is safe. Anything unmapped falls through to the original
 * message rather than being swallowed.
 */

const SELECTORS: Record<string, string> = {
  // ERC-20 (OpenZeppelin v5)
  '0xfb8f41b2':
    'The market is not approved to move your collateral. Approve the token and try again.',
  '0xe450d38c': 'Your balance is lower than the amount you are trying to post.',
  '0x5274afe7': 'The collateral token rejected the transfer.',

  // BreezePerpMarket
  '0x7fd13972': 'Leverage must be between 1× and 3×.',
  '0xb95b820e': 'That margin is below this market’s minimum.',
  '0x6f6c5e9e':
    'This trade would push the book past its long/short skew cap. Try the other side, or a smaller size.',
  '0x684d1627':
    'This trade exceeds the market’s notional capacity — the backing pool cannot support more exposure on this side right now.',
  '0x16ab7eab': 'The backing vault cannot reserve enough capital for this trade.',
  '0x7acf14e8': 'This market has reached its open-position limit.',
  '0x94e88a21': 'That position is already closed.',
  '0x6415f959': 'That position is not liquidatable.',
  '0xe648be3e': 'The oracle has not reported a usable price for this market yet.',
  '0x5c427cd9': 'Your wallet is not authorised to call this.',
  '0x613970e0': 'One of the parameters is outside its permitted range.',
  '0xd92e233d': 'A required address was zero.',

  // VirtualAMM
  '0xbb55fd27': 'The pool does not have enough virtual liquidity for a trade this size.',
  '0x7b9c8916': 'The market’s reserves are in an invalid state.',

  // OpenZeppelin
  '0xd93c0665': 'This market is paused.',
  '0x3ee5aeb5': 'Reentrant call rejected.',
  '0xe2517d3f': 'Your wallet does not hold the role required for this action.',
}

/** Common wallet-level failures that are not contract reverts. */
function walletLevel(message: string): string | null {
  const m = message.toLowerCase()
  if (m.includes('user rejected') || m.includes('user denied')) {
    return 'You rejected the transaction in your wallet.'
  }
  if (m.includes('insufficient funds')) {
    return 'Not enough C2FLR to pay for gas. Top up at the Coston2 faucet.'
  }
  if (m.includes('chain mismatch') || m.includes('does not match the target chain')) {
    return 'Your wallet is on the wrong network. Switch to Coston2 and try again.'
  }
  return null
}

export function explainRevert(err: unknown): string {
  const raw =
    (err as { shortMessage?: string })?.shortMessage ||
    (err as { message?: string })?.message ||
    'Transaction failed.'

  const wallet = walletLevel(raw)
  if (wallet) return wallet

  const selector = raw.match(/0x[0-9a-fA-F]{8}\b/)?.[0]?.toLowerCase()
  if (selector && SELECTORS[selector]) {
    return SELECTORS[selector]
  }

  // Keep the raw text, but drop viem's multi-paragraph tail so the panel does
  // not become a wall of text inside a trade form.
  return raw.split('\n')[0].slice(0, 220)
}
