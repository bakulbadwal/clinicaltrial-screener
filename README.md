# Clinical Trial Screener — Biotech Trial Success-Probability Tool

**Status:** Scoped, not yet built. See [SCOPE.md](SCOPE.md) for the full technical/build spec.

## The problem

Estimating a clinical trial's probability of success is currently either manual and expert-dependent (a biotech analyst reading the protocol and comparing it to what they remember) or locked behind expensive institutional data terminals. There's no fast, transparent, public-data-only way to get a directional probability estimate and see exactly which factors are driving it.

## What it is

A screening tool for biotech/health investing that pulls real public trial data (ClinicalTrials.gov) and scores a given trial or program against published historical phase-transition base rates — adjusted for sponsor track record, indication, trial design signals, and enrollment health — with a full breakdown of what's driving the score. A sibling tool to [The Sourcing Screen](https://github.com/bakul007/dealsourcing): same instinct (make a screening framework's assumptions visible and adjustable), applied to a different asset class.

## Why this, why now, why me

This sits at the actual intersection of the two things you have that most people building AI-for-biotech tools don't: real investing/screening judgment from PE work, and enough scientific literacy to know what trial-design factors actually matter. It's not a generic "AI predicts drug approval" pitch — it's a transparent base-rate model, built on real published statistics, that an actual investor would find useful specifically because it shows its work.

## Stack

Vanilla HTML/CSS/JS, data/view split, ClinicalTrials.gov public API as the data source. Full architecture and scoring methodology in [SCOPE.md](SCOPE.md).

## Disclaimer (goes in the app itself, not just here)

Directional and illustrative only, built entirely on public data and published historical base rates — not investment advice, not a substitute for real diligence, and not affiliated with or reflective of any employer's actual models or holdings.

## License

MIT — see [LICENSE](LICENSE).
