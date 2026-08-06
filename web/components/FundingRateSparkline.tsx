'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from 'recharts'
import { getFundingHistory, type FundingHistoryItem } from '@breezeswap/sdk'
import { useBreezeSDK } from '../lib/hooks/useBreezeSDK'
import { useBreezeNetwork } from '../lib/hooks/useNetwork'
import { CHART, axisProps, tooltipProps } from '../lib/chartTheme'
import { ChartCard, LegendKey } from './charts/ChartCard'
import { DemoBadge } from './DemoBadge'
import { demoFunding } from '../lib/demoData'

/**
 * Settled funding rate per period.
 *
 * This is a *diverging* measure — the sign is the message, because it says
 * which side is paying. Bars anchored to a zero baseline with two poles read
 * that directly; the previous version drew them off an auto domain with no
 * zero line, so a run of positive rates looked identical to a run of negative
 * ones.
 */
export function FundingRateSparkline({
  marketAddress,
  height = 150,
}: {
  marketAddress: string
  height?: number
}) {
  const { indexerUrl } = useBreezeSDK()
  const { chainId } = useBreezeNetwork()
  const [history, setHistory] = useState<FundingHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await getFundingHistory(indexerUrl, marketAddress, chainId)
        if (cancelled) return
        if (data && data.length > 0) {
          setHistory(data)
          setIsDemo(false)
        } else {
          setHistory(demoFunding(marketAddress) as unknown as FundingHistoryItem[])
          setIsDemo(true)
        }
      } catch {
        if (cancelled) return
        setHistory(demoFunding(marketAddress) as unknown as FundingHistoryItem[])
        setIsDemo(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [indexerUrl, marketAddress, chainId])

  const data = useMemo(
    () =>
      history
        .slice(0, 24)
        .reverse()
        .map((item) => ({
          time: item.settledAt
            ? new Date(item.settledAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          // Indexer reports basis points; 1 bp = 0.01%.
          rate: Number(item.fundingRate || 0) / 100,
        })),
    [history]
  )

  /*
    Symmetric domain, so a +0.4% bar and a −0.4% bar are visually equal and the
    zero line lands in the middle.

    The domain is padded a step wider than the labelled ticks: a tick sitting
    exactly on the domain edge renders its text half outside the plot area,
    where Recharts clips it — which is why the negative half of the axis looked
    unlabelled.
  */
  const { tick, axisBound } = useMemo(() => {
    const max = Math.max(0.01, ...data.map((d) => Math.abs(d.rate)))
    const rounded = Math.ceil(max * 100) / 100
    return { tick: rounded, axisBound: rounded * 1.25 }
  }, [data])

  const paidByLongs = data.filter((d) => d.rate > 0).length

  return (
    <ChartCard
      title="Funding settlements"
      subtitle="Rate applied each 15-minute period. Positive means longs pay shorts."
      height={height}
      loading={loading}
      empty={!loading && data.length === 0}
      emptyLabel="No funding periods have settled for this market yet."
      actions={isDemo ? <DemoBadge /> : undefined}
      footer={
        data.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <LegendKey color={CHART.short} label="Longs pay" />
            <LegendKey color={CHART.long} label="Shorts pay" />
            <span className="text-xs text-ink-faint">
              <span className="numeric text-ink-muted">{paidByLongs}</span> of{' '}
              <span className="numeric text-ink-muted">{data.length}</span> periods charged longs
            </span>
          </div>
        ) : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -12 }} barCategoryGap="22%">
          <XAxis {...axisProps} dataKey="time" hide />
          <YAxis
            {...axisProps}
            type="number"
            domain={[-axisBound, axisBound]}
            width={52}
            tickFormatter={(v) => `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}%`}
            ticks={[-tick, 0, tick]}
          />

          <ReferenceLine y={0} stroke={CHART.reference} strokeWidth={1} />

          <Tooltip
            {...tooltipProps}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            formatter={(v: number) => [
              `${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(4)}%`,
              Number(v) > 0 ? 'Longs pay' : 'Shorts pay',
            ]}
          />

          <Bar dataKey="rate" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.rate > 0 ? CHART.short : entry.rate < 0 ? CHART.long : CHART.neutral}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
