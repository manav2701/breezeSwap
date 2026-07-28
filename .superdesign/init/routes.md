# BreezeSwap Routes & Navigation Structure

## Routes Mapping

| URL Path | Component File Path | Layout Used | Description |
|---|---|---|---|
| `/` | `web/app/page.tsx` | RootLayout | Landing hero, live stats, protocol trade activity feed, multi-market cards |
| `/markets` | `web/app/markets/page.tsx` | RootLayout | Classic Options Markets discovery, status & region filtering |
| `/markets/[address]` | `web/app/markets/[address]/page.tsx` | RootLayout | Classic Market Detail: Payoff curve chart, minting terminal, settlement |
| `/perp-markets` | `web/app/perp-markets/page.tsx` | RootLayout | vAMM Perpetual Markets directory |
| `/perp-markets/[address]` | `web/app/perp-markets/[address]/page.tsx` | RootLayout | Perp Market Detail: Stats header, funding sparkline, mark price chart, depth ladder, trade form, trade history table |
| `/portfolio` | `web/app/portfolio/page.tsx` | RootLayout | Portfolio dashboard: Total value, unrealized PnL, liquidation risk gauge, close position modal |
| `/create` | `web/app/create/page.tsx` | RootLayout | Permissioned Market Creation form |
| `/admin` | `web/app/admin/page.tsx` | RootLayout | Administrative control panel: Emergency pause matrix, role grants, fee config |
| `/docs` | `web/app/docs/page.tsx` | RootLayout | Protocol documentation, multi-chain contract registry tables, SDK integration guide |
