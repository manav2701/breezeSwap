# BreezeSwap Extractable Components

## Navbar
- Source: `web/components/Navbar.tsx`
- Category: layout
- Description: Sticky header with brand logo, nav items, network switcher, and wallet connect button.
- Extractable props: activeTab (string, default: "home"), isMainnet (boolean, default: false)
- Hardcoded: Logo SVG, menu labels, route paths

## PerpStatsHeader
- Source: `web/components/PerpStatsHeader.tsx`
- Category: basic
- Description: vAMM stats panel displaying mark price, oracle price, funding rate, next funding countdown, 24h volume, and open interest ratio bar.
- Extractable props: marketAddress (string)

## TradeHistoryTable
- Source: `web/components/TradeHistoryTable.tsx`
- Category: basic
- Description: Feed table displaying time, trader, type, side, size, price, PnL, and transaction link.
- Extractable props: marketAddress (string), isGlobal (boolean, default: false), limit (number, default: 20)

## DepthLadder
- Source: `web/components/DepthLadder.tsx`
- Category: basic
- Description: vAMM depth ladder previewing entry prices and slippage % across $500–$25k trade size tiers.
- Extractable props: tradingFeeBps (number, default: 10)
