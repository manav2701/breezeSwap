# BreezeSwap demo script

A 15 minute walkthrough for an audience that has never seen this before. Every page is
introduced by what it is *for* before anything is clicked, because a page nobody has been
told the purpose of is just a screen with numbers on it.

Timings are cumulative. If you fall behind, §7 and §8 are the cuttable ones.

Everything runs on the hosted site: **https://breeze-swap-web-74qh-coral.vercel.app**

---

## 0. Before the clock starts

### Two wallets, two browsers

Two, because a classic market needs somebody on each side. One wallet can technically take
both sides, but it looks like you playing chess against yourself. Two browsers rather than
two accounts in one, so you never sit through a MetaMask account switch on camera.

| | Wallet | Browser | Holds |
|---|---|---|---|
| **A** | `0xE9D7…4503` | Chrome | ~5 C2FLR, ~10M bUSDT |
| **B** | `0x4925…CE3a` | Brave or Firefox | 2 C2FLR, 1,000 bUSDT |

Both on **Flare Coston2**, chain 114.

### Two tokens, and do not mix them up on stage

- **C2FLR** is gas. Free from a faucet, worthless, pays transaction fees. Same role as ETH
  on Ethereum. The "C2" is Coston2, Flare's test network.
- **bUSDT** is the collateral you actually trade with. A demo ERC-20 the deployment minted,
  also worthless, standing in for the real stablecoin a production deployment would use.

If somebody asks "is this real money", the answer is no, and say it plainly.

### Wake the backend

Render's free tier sleeps. A cold first request takes 30 to 60 seconds, and while it hangs
the UI falls back to sample data, which is the worst possible thing to happen live.

```bash
curl -s https://breezeswap.onrender.com/api/health
```

Expect `{"status":"ok","lastIndexedBlock":<recent>}`. Then load the site once so Vercel's
edge cache is warm.

### Tabs to have open

1. The site, on `/`
2. Second browser, Wallet B connected, on `/portfolio`
3. The whitepaper PDF, already scrolled to **page 9**

### Your three markets

| Address | Type | State | What it is for |
|---|---|---|---|
| `0x822e0637…` | BINARY, ≥40 mm | open | The one you trade live |
| `0x4ca03a9c…` | CAPPED 50–100 mm | **expired** | The one you settle live |
| `0x8f28bb89…` | CAPPED | open, 6 days | Spare |

The expired one is the important one. It means the settlement beat needs no waiting.

---

## 1. The problem (0:00 – 1:30)

**Page: `/about`. What it is for:** the only page on the site written for someone who has
never heard of a weather derivative. No jargon, no addresses.

Open it and stay on the four stat tiles.

> "Weather decides whether a huge number of people earn a living, and almost none of them
> can insure against it.
>
> In 2025 there was **$424 billion** of natural catastrophe loss with no insurance behind
> it. **51%** of all disaster losses were uninsured, and that was the best-covered year
> Swiss Re has ever recorded. **60%** of the world's crop production has no cover at all.
>
> And there are exactly **13 cities on Earth** with a liquid, exchange-traded weather
> market. That is not a map of where weather risk lives. It is a map of where the paperwork
> was easiest."

Scroll to the three "why it is broken" cards and land one line on each:

> "Cover pays after an assessor visits and agrees, which takes months. A farmer who cannot
> buy seed this season does not need the money next season.
>
> Because a person decides whether your damage counts, a person can decide it does not.
>
> And for most of the planet, the instrument simply does not exist."

Scroll once more to the four people: rice farmer, ski resort, solar operator, events
company.

> "These are all real, ordinary businesses whose revenue already moves with the weather.
> They are carrying that risk right now. The only question is whether they carry it alone."

**Say the trade-off out loud here.** It is on the page and it will be the first thing a
sharp person asks:

> "One honest caveat. You are covered against the *weather*, not against your *loss*. If
> the drought comes and your field survives, you are still paid. If your field fails for
> some other reason, you are not. That is the price of getting paid in days without an
> assessor."

---

## 2. The mechanism, from the whitepaper (1:30 – 2:30)

**Page: `/whitepaper`. What it is for:** the technical argument, typeset, downloadable. You
are in here for **under a minute**. Three page turns.

### ① Page 9, Figure 1 — "Clearing under directional demand"

> "Here is why this has not already been built. Everybody who wants drought cover in a
> region wants it in the same month, and nobody wants to sell it to them. The natural seller
> is not another farmer, it is capital.
>
> This curve is the fraction of hedgers who find a counterparty as demand gets more
> one-sided. At a mild 80% skew, a matching market clears **one hedger in four**. The flat
> line is us: a pool takes the other side, so one buyer and one pool is already a market."

### ② Page 11, Figure 3 — the pricing wedge

> "Second problem: everyone builds this as a coin flip. Tokyo, August, above 40 mm happened
> in **28 of the last 30 years**. If both sides post equal collateral, you have handed one
> side a **43 percentage point** edge per contract.
>
> We price off 30 years of history, and those probabilities are published on-chain."

### ③ Page 16, Figure 7 — capital multiplier

> "And this is how the capital works. One unit of underwriting capital backs up to **2.4
> units** of risk.
>
> Read the caption though. It says our own policy product is **less** capital-efficient than
> a plain bilateral contract. That is in our paper, about our own design. Its advantage is
> that it clears at all."

Close the PDF. That last line is worth more than the previous two combined.

---

## 3. The landing page (2:30 – 3:30)

**Page: `/`. What it is for:** the thirty-second version for someone who arrives cold.

> "Three steps and no paperwork. Pick a reading, take a side, get settled."

Point at the live counters: **open markets**, **max leverage 3×**.

Scroll to **What a trade costs**.

> "This is a real quote ladder against the Tokyo pool. A thousand dollars moves the price
> one tenth of a percent; twenty-five thousand moves it two and a half. That is the AMM
> curve, and it is visible before you trade rather than after."

> "One honest note: the *Recent activity* feed is labelled **Sample data**. Nobody has
> traded these markets yet, so rather than show an empty table we generate a plausible one
> and say so. Anything on this site that is not real says it is not real."

That admission costs you nothing and buys you the room.

---

## 4. Markets, and reading one (3:30 – 5:30)

**Page: `/markets`. What it is for:** every fixed-expiry contract, filterable by status,
region and measurement.

> "Each row is one question with a deadline. Region, what is measured, the threshold, the
> payout shape, and how long is left."

Point out the three states, because they are the whole lifecycle:

- **Open** — tradeable, time remaining
- **Awaiting settlement** — past expiry, nobody has settled it yet, anyone can
- **Settled** — resolved, redeemable

**Now open `0x822e0637…`, the binary market.** This is the page that matters most.

Walk it top to bottom:

**Payoff chart.**
> "This is the contract, drawn. Below 40 mm shorts take everything, at or above it longs
> do. Binary, so it is a cliff rather than a ramp."

**Observed readings.**
> "Real Tokyo rainfall pulled from the Open-Meteo archive and written on-chain, with the
> strike drawn across it. You can see how close to the line the weather actually runs before
> you take a side. No other weather product shows you this."

**Market statistics.** Collateral locked, long/short split, strike.

**Mint a position panel.**
> "Choose a side, choose an amount, and your deposit is your maximum loss. You get an
> ERC-1155 token back, which means the position is transferable. You can sell your hedge
> before expiry to someone else."

**Position holders.** Empty right now. It will not be in two minutes.

---

## 5. The trade, both wallets (5:30 – 8:00)

### Wallet A, the long

1. Chrome, Wallet A, on market `0x822e0637…`
2. Select **▲ Long**
3. Enter **100** bUSDT
4. **Approve** → confirm in MetaMask

> "Two transactions, and this is standard for any ERC-20. First you allow the contract to
> move your tokens, then it moves them. Nothing is custodial: the collateral goes into the
> market contract, not to us."

5. **Mint position** → confirm
6. Wait for the row to appear under **Position holders**

### Wallet B, the short

7. Switch to the second browser, Wallet B
8. Same market, select **▼ Short**, **100** bUSDT
9. Approve → Mint

### Land it

10. Refresh. Two rows under **Position holders**.

> "Two independent wallets, opposite views on the same rainfall threshold, one contract
> holding both deposits. Nobody underwrote this. Nobody approved it. There was no
> application."

Point at collateral locked: it is now 200 bUSDT, and the long/short split is 1 and 1.

---

## 6. Settlement nobody can veto (8:00 – 10:00)

This is the beat the whole demo exists for.

1. **Stay in Wallet B.** Go to `/markets` and open `0x4ca03a9c…`, the expired one.
2. Point at the amber badge: **Awaiting settlement**.

> "This market is past its expiry. Nobody has settled it. Notice the protocol is not
> hiding that or pretending it resolved itself. It is sitting there waiting for somebody,
> anybody, to push the button."

3. Press **Settle market**. Confirm in Wallet B.

> "And this is Wallet B doing it. Wallet B did not create this market, holds no admin role,
> and has no special permission. Settlement is permissionless.
>
> The contract just read the oracle, applied the payout formula, and wrote the result. There
> was no claim form, no assessor, nobody who could have delayed it or argued about it."

4. Refresh: badge is now **Settled**, with the final oracle reading and both payout ratios.

5. Go to `/portfolio`.

**Page: `/portfolio`. What it is for:** everything the connected wallet holds, across both
product types. It reads from the chain, not from a server-side account.

> "Portfolio value, margin posted, unrealised PnL. Perpetual positions on top, classic
> positions below."

6. Press **Redeem** on the settled position. Confirm.

> "Paid. Start to finish that was one transaction to settle and one to collect, and neither
> needed anyone's permission."

---

## 7. Perpetuals (10:00 – 12:00) · *cuttable*

**Page: `/perp-markets`. What it is for:** weather exposure with **no expiry date**, where
you can leave whenever you want. The classic markets are a bet with a deadline; these are a
position you manage.

> "The difference matters. A classic market needs someone to take the other side. A
> perpetual does not: a virtual AMM quotes both sides continuously against pooled capital,
> so you can open a position at 3am in a month when no insurer is writing business."

Open the Tokyo market.

**Mark price chart.**
> "Flat at $25, and that is correct rather than broken. A vAMM's price is computed from its
> reserves, and reserves only move when somebody trades. Nobody has traded this market yet,
> so the price is exactly where it was deployed. It is a chart of a market with no trades,
> not a broken chart."

**Open a position panel.**
> "Margin, leverage up to 3×, and it shows you the fee, the position size, the entry price
> and the price impact **before** you commit."

Point at **price impact 0.04%**.

> "That number is why the line is flat. Trade, and it bends."

> "The funding panel below is labelled Sample data, same as before. No funding has settled
> because nobody has traded."

If you want the chart to have a real bend in it, open a small long here from Wallet A
before the demo and it will.

---

## 8. Create and Docs (12:00 – 13:30) · *cuttable*

**Page: `/create`. What it is for:** anyone can list a market. There is no listing
committee.

> "Region, what to measure, the payout shape, the strike and cap, and the expiry."

Drag the strike and let the payoff curve redraw live.

> "The curve updates as you type, so you see the instrument before you deploy it. Press the
> button and this is a contract on Flare that anybody can trade against."

Do not actually deploy unless you have time.

**Page: `/docs`. What it is for:** how to use it and how to build on it.

> "Four steps to a first position, what each payout shape is for and when to choose it, and
> an SDK section."

Scroll to the SDK code blocks.

> "This is the same TypeScript SDK the site itself runs on. Install it, read markets, open a
> position, settle, redeem. Worth using rather than calling the contracts raw because it
> handles the unit conversions weather data is full of, resolves the right addresses per
> network, and reads come from an index so listing markets is one request instead of many."

---

## 9. Close (13:30 – 15:00)

> "Everything you just saw is live on Flare Coston2. Real contracts, real weather from a
> 30-year archive, 1,080 strike probabilities published on-chain, and 569 tests passing.
>
> What it is not: it is a test network, the collateral is a demo token, and it has not been
> audited. The oracle adapters for Flare's real data feeds are written but still stubs, so
> settlement today runs on a trusted oracle.
>
> All of that is in the whitepaper's limitations section rather than left for someone to
> find. Including one result where our own simulation argues against a parameter we shipped."

Stop there.

---

## Questions you will get

**"How is this different from a prediction market?"**
> A prediction market prices opinion. We price a 30-year observational record and refuse
> deposits that push the pool away from those odds. And our perpetual has a pool taking the
> other side, so a hedger never has to wait for a gambler to show up.

**"What if the oracle lies?"**
> Today it is a trusted mock, and that is the biggest honest gap. The adapters for Flare's
> FTSO and FDC are written against a real interface and revert rather than returning
> anything fake. Nothing in the system pretends that data is verified when it is not.

**"What stops one storm bankrupting the pool?"**
> Correlated exposure caps. Weather risk is not diversified the way an insurer's portfolio
> is: one dry August triggers every drought contract in a region at once, which is why
> private crop insurance historically fails without reinsurance. There is a registry that
> caps exposure across markets sharing a peril, and a three-tier loss waterfall so protocol
> capital absorbs losses before depositors.

**"Who provides the liquidity?"**
> Either someone with the opposite exposure, or a capital pool earning premiums. Weather is
> genuinely uncorrelated with crypto, so it is one of the few risks worth holding *because*
> it has nothing to do with everything else in a portfolio.

**"Is this audited?"**
> No. Mainnet is gated on one, and the deploy script physically refuses to run against real
> collateral without a governance multisig configured.

---

## Do not do these

**Do not demo the fair-odds gate on a binary market.** It will show a confident 93.33% next
to a chart saying "0 of 41 readings landed in the payout range". Those two numbers measure
different things: the probability is for a monthly total, the settlement reads a single day.
It is written up in `KNOWN_ISSUES.md` and it is being fixed. Nobody spots it unless you
point at it.

**Do not dwell on the funding panel.** Labelled sample data, sitting under a real chart.
Confusing mix if you linger.

**Do not promise mainnet dates.** It needs an audit and the real oracle integration.

---

## If something breaks

| Symptom | Fix, live |
|---|---|
| Pages slow, panels empty | Render woke up cold. Reload once, it is fine after. |
| "Sample data" everywhere | Indexer unreachable. Hit `/api/health`, wait, reload. |
| MetaMask stuck pending | Reject, reload the page, retry. Coston2 blocks are ~2s. |
| Transaction reverts on mint | Approval did not land. Check the token allowance step ran. |
| Wrong network warning | Switch to Coston2 in the wallet; the banner tells you. |

Keep a settled market in reserve. If minting misbehaves on camera, pivot straight to the
settlement beat, which needs no new transactions.
