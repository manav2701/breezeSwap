import React from 'react'
import Link from 'next/link'
import {
  CloudRain,
  Sprout,
  Snowflake,
  Sun,
  Wind,
  ArrowRight,
  Clock,
  FileWarning,
  MapPin,
} from 'lucide-react'

export const metadata = {
  title: 'Why BreezeSwap exists',
  description:
    'Weather decides whether millions of people make a living. Almost none of them can insure against it. This is what that costs, and what we do about it.',
}

/**
 * The non-technical page.
 *
 * Everything else on this site assumes you already care about weather derivatives. This
 * page assumes you have never heard of them, and its job is to make the problem feel real
 * before any mechanism is mentioned. No contract addresses, no jargon, no payoff curves.
 *
 * Every figure is sourced and dated. A page arguing that an industry mismeasures risk
 * cannot itself wave numbers around.
 */

const STATS = [
  {
    value: '$424bn',
    label: 'Uninsured natural catastrophe losses, 2025',
    source: 'Swiss Re',
  },
  {
    value: '~70%',
    label: 'Of weather-related losses carried with no insurance at all',
    source: 'Swiss Re',
  },
  {
    value: '$76bn',
    label: 'The crop protection gap, and it grew again last year',
    source: 'Swiss Re, 2024',
  },
  {
    value: '13',
    label: 'Cities on Earth with a liquid, exchange-traded weather market',
    source: 'CME Group',
  },
]

const PEOPLE = [
  {
    icon: Sprout,
    who: 'A rice farmer outside Tokyo',
    fear: 'A dry monsoon month',
    today:
      'Carries the whole risk personally. If cover exists at all it is priced for a large estate, and a claim takes months to assess, long after the money was needed.',
    instead:
      'Buys cover on rainfall for the season. If the rain does not come, the payout arrives automatically, in days, because rainfall is measured and not argued about.',
  },
  {
    icon: Snowflake,
    who: 'A ski resort in Nagano',
    fear: 'A warm, thin winter',
    today:
      'Nothing exists at their size. Weather futures cover thirteen cities, none of them theirs, and a bank will not write a custom contract for a business this small.',
    instead:
      'Takes a position on snowfall and closes it the moment the forecast turns, rather than being locked in until spring.',
  },
  {
    icon: Sun,
    who: 'A solar operator in Dubai',
    fear: 'A cloudy quarter missing its generation forecast',
    today:
      'Hedges through a bank, which means an ISDA agreement, a credit line, and a minimum size that rules out most operators.',
    instead:
      'Takes the other side of a temperature contract directly, in whatever size actually matches the exposure.',
  },
  {
    icon: Wind,
    who: 'An outdoor events company',
    fear: 'Rain on the one weekend that pays for the year',
    today:
      'Event cancellation cover is expensive, slow, and full of argument about whether it rained enough to count.',
    instead:
      'Buys cover against a rainfall threshold. The threshold either was or was not crossed, and there is nothing left to dispute.',
  },
]

const BROKEN = [
  {
    icon: Clock,
    title: 'The money arrives too late to help',
    body:
      'Traditional cover pays after an assessor visits, files, and agrees. That can take months. A farmer who cannot buy seed this season does not need the money next season, and by then the loss has already compounded into debt.',
  },
  {
    icon: FileWarning,
    title: 'Somebody can argue with your claim',
    body:
      'Because a person decides whether the damage counts, a person can also decide that it does not. The people least able to fund a dispute are exactly the people most likely to face one.',
  },
  {
    icon: MapPin,
    title: 'It does not exist where you are',
    body:
      'The financial instruments that hedge weather properly settle against thirteen United States cities. That is not a map of where weather risk lives. It is a map of where the paperwork was easiest.',
  },
]

export default function AboutPage() {
  return (
    <div className="space-y-20 pb-12">
      {/* Hero */}
      <section className="pt-4">
        <p className="eyebrow mb-3">Why we built this</p>
        <h1 className="display-1 text-ink max-w-4xl leading-[1.05]">
          Weather decides whether millions of people make a living.
          <span className="text-accent"> Almost none of them can insure against it.</span>
        </h1>
        <p className="lede text-ink-muted mt-6 max-w-2xl">
          Not because the risk is unmeasurable. Rainfall and temperature are among the most
          carefully recorded numbers on Earth. It is because the financial products built on
          top of them were designed for large institutions in a handful of cities, and never
          reached anyone else.
        </p>
      </section>

      {/* Scale */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="panel p-5 flex flex-col gap-2">
              <span className="metric-value-lg text-accent numeric">{s.value}</span>
              <span className="text-sm text-ink-muted leading-snug">{s.label}</span>
              <span className="text-xs text-ink-faint mt-auto pt-2">{s.source}</span>
            </div>
          ))}
        </div>
        <p className="text-sm text-ink-faint mt-4 max-w-3xl leading-relaxed">
          Around 55% of the world&apos;s insurable crop value is unprotected, and in India
          close to two thirds of farmers carry no cover at all. These are not edge cases.
          This is how most agricultural weather risk on the planet is currently held: by the
          person least able to absorb it.
        </p>
      </section>

      {/* Why it is broken */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">The problem</p>
          <h2 className="display-2 text-ink">
            Insurance against weather exists. It just does not work for most people.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BROKEN.map(({ icon: Icon, title, body }) => (
            <div key={title} className="panel p-6 flex flex-col gap-3">
              <span className="w-9 h-9 rounded-lg inset flex items-center justify-center">
                <Icon className="w-4 h-4 text-accent" aria-hidden />
              </span>
              <h3 className="display-3 text-ink">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* The idea */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">The idea</p>
          <h2 className="display-2 text-ink">Pay on the weather, not on the paperwork.</h2>
        </div>

        <div className="panel p-6 sm:p-8 space-y-5 max-w-3xl">
          <p className="text-ink-muted leading-relaxed">
            Ordinary insurance pays out when somebody inspects your damage and agrees it
            counts. That step is where the delay lives, where the arguments live, and where
            most of the cost lives.
          </p>
          <p className="text-ink-muted leading-relaxed">
            BreezeSwap removes it. You agree in advance on a number that can be measured
            without opinion: <span className="text-ink">rainfall in this region, this
            month, below 40&nbsp;mm</span>. If the measurement comes in below the line, you
            are paid. If it does not, you are not. Nobody assesses anything, because there
            is nothing left to assess.
          </p>
          <p className="text-ink-muted leading-relaxed">
            That trade-off is honest and worth stating plainly: you are covered against the{' '}
            <span className="text-ink">weather</span>, not against your{' '}
            <span className="text-ink">loss</span>. If the drought comes and your field
            survives, you are still paid. If your field fails for a reason other than
            rainfall, you are not. In exchange, you get a payout in days instead of months,
            at a price that works at small size, in places no insurer will visit.
          </p>
        </div>
      </section>

      {/* Who it is for */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">Who this is for</p>
          <h2 className="display-2 text-ink">
            Anyone whose income already moves with the weather.
          </h2>
          <p className="text-sm text-ink-muted mt-3 leading-relaxed">
            They are all carrying the risk today. The only question is whether they carry it
            alone.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PEOPLE.map(({ icon: Icon, who, fear, today, instead }) => (
            <div key={who} className="panel p-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-lg inset flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-accent" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="display-3 text-ink">{who}</h3>
                  <p className="text-xs text-ink-faint mt-0.5">Worries about: {fear}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="inset p-3.5">
                  <p className="metric-label mb-1.5">Today</p>
                  <p className="text-[13px] text-ink-muted leading-relaxed">{today}</p>
                </div>
                <div className="inset p-3.5 border border-[color:var(--color-accent)]/15">
                  <p className="metric-label mb-1.5 text-accent">With BreezeSwap</p>
                  <p className="text-[13px] text-ink-muted leading-relaxed">{instead}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Where the money comes from */}
      <section className="space-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow mb-2">The part people ask about</p>
          <h2 className="display-2 text-ink">So who actually pays the farmer?</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          <div className="panel p-6 space-y-3">
            <h3 className="display-3 text-ink">Someone who wants the opposite risk</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              A dry season is bad for a farmer and good for a solar operator. A warm winter
              hurts a ski resort and helps an energy retailer who sold heating cheaply. Put
              those two together and each one&apos;s bad year is paid for by the other&apos;s
              good year.
            </p>
          </div>
          <div className="panel p-6 space-y-3">
            <h3 className="display-3 text-ink">Or a pool of capital being paid to wait</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              The opposite party does not always show up on time, so investors can fund the
              cover instead, earning the premiums in the years nothing happens. Weather has
              a useful property here: a drought in Japan has nothing to do with the stock
              market, so this is one of the few risks worth holding precisely because it is
              unrelated to everything else.
            </p>
          </div>
        </div>

        <p className="text-sm text-ink-faint max-w-3xl leading-relaxed">
          That second option is the harder engineering problem, and it is most of what we
          built. Weather risk is unusually concentrated: one dry August hits every drought
          contract in a region at the same moment, which is exactly why private crop
          insurance historically collapses without reinsurance. Handling that safely is the
          difference between a marketplace and a very slow way to lose other people&apos;s
          money.
        </p>
      </section>

      {/* Honest */}
      <section className="max-w-3xl">
        <div className="panel p-6 sm:p-8 space-y-4">
          <p className="eyebrow">Where we actually are</p>
          <p className="text-ink-muted leading-relaxed">
            BreezeSwap is running on a test network, with test money, and has not been
            audited. The weather data behind it is real, the contracts are real and publicly
            readable, and every payout rule is fixed in advance where anyone can check it.
            But this is a working prototype of a financial product, not a licensed insurer,
            and we would rather say so here than let you find out later.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link href="/markets" className="btn btn-primary">
              See live markets
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href="/docs" className="btn btn-ghost">
              How it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
