# BreezeSwap Page Dependency Trees

## / (Home Page)
Entry: `web/app/page.tsx`
Dependencies:
- `web/components/Navbar.tsx`
  - `web/components/NetworkSwitcher.tsx`
  - `web/components/NetworkBanner.tsx`
- `web/components/MarketCard.tsx`
- `web/components/TradeHistoryTable.tsx`
- `web/lib/hooks/useBreezeSDK.ts`
- `web/lib/hooks/useNetwork.ts`

## /markets (Classic Options Directory)
Entry: `web/app/markets/page.tsx`
Dependencies:
- `web/components/MarketCard.tsx`

## /perp-markets/[address] (Perp Trading Terminal)
Entry: `web/app/perp-markets/[address]/page.tsx`
Dependencies:
- `web/components/PerpStatsHeader.tsx`
- `web/components/FundingRateSparkline.tsx`
- `web/components/MarkPriceChart.tsx`
- `web/components/DepthLadder.tsx`
- `web/components/TradeHistoryTable.tsx`
- `web/components/TxLink.tsx`

## /portfolio (Portfolio & Risk Engine)
Entry: `web/app/portfolio/page.tsx`
Dependencies:
- `web/components/PositionCard.tsx`
- `web/lib/perpPnl.ts`
- `web/components/TxLink.tsx`

## /docs (Protocol Documentation)
Entry: `web/app/docs/page.tsx`
Dependencies:
- `@breezeswap/sdk` constants
