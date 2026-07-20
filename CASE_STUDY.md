# Case Study — Clinical Trial Screener (PhaseSignal)
### A product-thinking write-up (not a README). To run it, see [README](./README.md) / [SCOPE.md](./SCOPE.md); this is the *why*.

A transparent, live-data tool that scores a clinical trial's probability of success against published base rates — every score showing exactly which factor moved it. Live at [bakulbadwal.github.io/clinicaltrial-screener](https://bakulbadwal.github.io/clinicaltrial-screener/).

---

## The problem I was solving

Estimating a clinical trial's probability of success today is one of two bad options: **manual and expert-dependent** (a biotech analyst reading the protocol and comparing it to what they remember), or **locked behind expensive institutional terminals that don't show their work** (Evaluate Pharma, Cortellis, GlobalData). Both leave a non-specialist investor unable to form or check a view — and even the specialist can't easily audit *why* a black-box model scored something the way it did.

## Who it's for

A generalist investor or analyst evaluating a biotech name who needs a defensible first read on trial risk — and who values *seeing the reasoning* over a magic number. The tool is built for exactly the person I was: enough investing judgment to want a screen, not enough specialist infrastructure to buy a terminal.

## The sharpest decision: honesty as the wedge

The most important product move was **refusing to claim a blank market.** Institutional platforms and an AI-native competitor (Intelligencia) already exist, plus real academic ML on trial-outcome prediction. So the differentiation isn't "better AI" — it's **narrower and more honest: fully public data, zero licensing cost, and every score decomposed into the factors that moved it.** In a domain crowded with black boxes, *showing your work* is the product.

## The core model insight

**Anchor on a real, cited base rate, then adjust transparently.** Every score starts from the published BIO/Informa/QLS Clinical Development Success Rates study (2011–2020) and is adjusted by four *computed* factors — sponsor profile, trial design (enrollment vs. phase norms), timeline risk, and live competitive density (queried per trial against ClinicalTrials.gov). Nothing is fabricated: every number is either pulled live or cited to a source. That's what lets an actual investor trust it.

## Key product decisions & tradeoffs

| Decision | Why | Tradeoff accepted |
|---|---|---|
| **Base-rate + explainable factors over a black-box predictor** | An investor can only act on a score they can audit. Explainability *is* the value here, not an add-on. | Lower ceiling on raw predictive accuracy than an opaque ML model. Right call — a number you can't interrogate is useless for diligence. |
| **Public data only, zero licensing cost** | The wedge against the incumbents is access + transparency, not out-spending them on proprietary data. | No proprietary attribution/pipeline data the terminals sell. Honest scope; it's a *screen*, not a replacement for their datasets. |
| **A self-refreshing data pipeline (GitHub Actions, weekly)** | A screen on stale trial data is worse than useless. The pipeline pulls fresh records weekly with zero manual steps and only commits when data actually changed. | Engineering upfront. It's what makes the tool *live* rather than a one-time snapshot — a real systems decision. |
| **Ship the honest disclaimer in the app, not just the README** | Directional, not investment advice, not a substitute for diligence — said where the user actually sees it. | Less "authoritative" tone. Correct — overclaiming in a medical/financial context is the real risk. |

## How I'd measure success

**North-star (the real test):** *calibration* — of trials the tool scores high-probability, what share actually succeed, tracked over time as outcomes resolve? A transparent model lives or dies on whether its scores are honest predictors, not on UI.

**Supporting metrics:** analyst-time-to-a-first-read on a new name; return usage; and factor-level engagement (which of the four factors do users actually drill into — signal for what to deepen).

## What's next (roadmap — see SCOPE.md)

1. **Calibration loop** — track scored trials to resolution and tune factor weights against real outcomes (closing the loop is the whole credibility story).
2. **Broader coverage** — more therapeutic areas and phases beyond the current oncology/CV/neuro set.
3. **Richer design factors** — endpoint quality, biomarker strategy, prior-evidence strength.

## Why this write-up exists

This one sits at an intersection I have that most people building AI-for-biotech don't: real investing/screening judgment *and* enough scientific literacy to know which trial-design factors matter. The product decisions — transparency as the wedge, base-rate honesty, a live pipeline — reflect that. This document is the product-thinking layer: problem, user, the honest competitive read, the decisions, and how I'd measure and extend it. If you're reading it as a hiring signal, that's the point.

---

*Tech: vanilla HTML/CSS/JS, data/view split, ClinicalTrials.gov public API, self-refreshing via GitHub Actions. Part of a broader portfolio at [github.com/bakulbadwal](https://github.com/bakulbadwal).*
