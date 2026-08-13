# BreezeSwap whitepaper

`breezeswap-whitepaper.tex` builds to a 23-page PDF. Ten figures, six tables, eighteen
references, no external image assets: every chart is pgfplots or TikZ compiled from data
embedded in the source.

## Build

Any modern TeX distribution works. The lightest option is [Tectonic](https://tectonic-typesetting.github.io/),
a single binary that fetches the packages it needs on first run:

```bash
tectonic -X compile breezeswap-whitepaper.tex
```

With TeX Live or MiKTeX:

```bash
latexmk -xelatex breezeswap-whitepaper.tex
```

XeLaTeX or LuaLaTeX is required, not pdfLaTeX: `newtxtext` pulls in `fontspec`.

Package order matters in the preamble. `amsmath` and `amssymb` must load **before**
`newtxmath`, otherwise `\Bbbk` is defined twice and the build fails.

## Where the numbers come from

Nothing in the paper is quoted from documentation. Each figure traces to a command you can
re-run.

| Figure or table | Source |
|---|---|
| Fig. 4, 5, 6 (climatology) | `weather-seed/climatology.json`, 1996-2025 Open-Meteo archive, 1,080 strikes |
| Fig. 9 (waterfall arms) | `forge test --match-contract WaterfallMonteCarloTest -vv` |
| Fig. 10, Table 4 (reserve sweep) | `forge test --match-contract ReserveMonteCarloTest -vv` |
| Table 6 (suite results) | `forge test --summary` |
| Fig. 7, Section 6.2 (capital multiplier) | Derived from `BreezeLiquidityVault` and `BreezePerpMarket` constants |
| Fig. 1, 3 (analytic) | Closed form, derivations in the text |

The reserve sweep numbers were measured at the commit the paper describes. They differ from
the figures in the repository README, which are stale: the current run shows one shortfall
event at the shipped 50% coverage ratio, not zero. Section 8.2 reports the discrepancy
rather than smoothing it over.

## Editing conventions

- No em-dashes anywhere in rendered text. En-dashes appear only in bibliography page ranges.
  Verify with the check in `Regenerating the numbers` below.
- Every empirical claim carries the command that produces it.
- Limitations live in Section 12 and are stated without hedging.

## Regenerating the numbers

```bash
cd ../../contracts && forge test --match-contract "WaterfallMonteCarloTest|ReserveMonteCarloTest" -vv
```

To confirm the em-dash constraint still holds after edits:

```bash
python -c "import pypdfium2 as p; d=p.PdfDocument('breezeswap-whitepaper.pdf'); print(sum(d[i].get_textpage().get_text_range().count(chr(0x2014)) for i in range(len(d))))"
```
