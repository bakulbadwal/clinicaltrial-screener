# Clinical Trial Screener — Full Scope & Build Spec

## 1. Data source — and the honest limitation to solve first

**ClinicalTrials.gov has a real, free, public REST API** (`clinicaltrials.gov/api/v2`) with trial metadata: phase, status, conditions, sponsor, enrollment count, start/completion dates, interventions. This is a genuine, legitimate, well-documented data source — worth building the real fetch layer against it, not synthetic data.

**The catch, to solve honestly rather than hand-wave:** the API tells you a trial *happened*, not whether it *succeeded*. There's no "approved: yes/no" field. Two real options, in order of build effort:

1. **v1 (pragmatic): anchor to published base rates, not live outcome-labeling.** Use a small, curated table of historical phase-transition probabilities by therapeutic area, sourced from real published industry studies (the standard reference class here is the **BIO / QLS Advisors / Informa "Clinical Development Success Rates" studies** — cite the actual report and year used, don't invent numbers). A given live trial gets scored against the base rate for its phase + therapeutic area, then adjusted by the explainable factors below. This is honest, buildable, and still uses real live API data for the trial-specific factors even though the base rates themselves are a static, cited table.
2. **v2 (stretch, real data science): build an actual outcome-labeling pipeline** — for older trials, check whether a later-phase trial exists for the same drug/indication (proxy for "advanced") and cross-reference **openFDA's drug approval database** for actual approvals. This is a genuine, non-trivial data engineering project on its own and should not block v1.

Ship v1 with the cited base-rate table; treat v2 as the differentiator to build later if there's appetite.

## 2. Scoring methodology — five explainable factors, not a black box

Mirrors the "Sourcing Screen" five-box pattern (a radar chart is the right visual here too — same instinct, different asset class):

1. **Base rate (phase × therapeutic area)** — from the cited published table. This is the anchor; everything else is an adjustment on top of it.
2. **Sponsor track record** — does this sponsor have prior approvals or prior late-phase failures in this class of trial? (Computable from CT.gov's sponsor field + repeat queries across their trial history.)
3. **Trial design signals** — enrollment size relative to what's typical for the phase/indication, randomization/blinding status, whether the trial has been amended multiple times (a real, known negative signal in trial-design literature — frequent protocol amendments correlate with design or recruitment trouble).
4. **Enrollment health** — actual vs. target enrollment, whether the trial is behind its original timeline (both computable from CT.gov's status history if the API exposes it, or from status + dates as a proxy).
5. **Competitive density** — how many other trials exist in the same indication/mechanism right now (a crowded field lowers the probability any single entrant captures approval-driving differentiation, and is a real factor investors weigh).

Composite score = weighted combination, shown with the same "drag to reweight, list re-ranks live" interaction as Sourcing Screen — an investor screening 20 programs cares about the same thing: which assumption is driving the ranking, and what happens if you weight it differently.

## 3. Data model

```
{
  "baseRatesTable": {
    "source": "cite the actual report + year used when built",
    "rates": [
      { "phase": "Phase 1", "therapeuticArea": "Oncology", "transitionProbability": 0.0X, "sourceNote": "..." },
      ... one row per phase x major therapeutic area, from the cited published study
    ]
  },
  "trials": [
    {
      "nctId": "fetched from CT.gov API",
      "title": "...", "phase": "...", "condition": "...", "sponsor": "...",
      "enrollmentTarget": ..., "enrollmentActual": ...,
      "startDate": "...", "estimatedCompletion": "...",
      "amendmentCount": ..., // if obtainable
      "factorScores": { "sponsorTrackRecord": 1-5, "trialDesign": 1-5, "enrollmentHealth": 1-5, "competitiveDensity": 1-5 },
      "compositeScore": ...
    }
  ]
}
```

`trials` is populated live from the API at build/refresh time (a fetch script, not hand-authored like the synthetic Sourcing Screen data) — this is a genuinely different and more technically interesting architecture than the other repos: real data pipeline, not curated fixtures.

## 4. Core user flow

1. **Search/filter:** by therapeutic area, phase, sponsor.
2. **Ranked list:** trials sorted by composite score, with the five-factor weights adjustable live (same interaction pattern as Sourcing Screen).
3. **Detail view:** radar chart of the five factors, the base rate being used and its cited source, and plain-language reasoning for each factor score.
4. **Compare mode (stretch):** select 2+ trials, compare radars side by side.

## 5. Architecture

`data.json` (or a `data/` folder if the fetched trial set gets large) + a small **fetch script** (Python or Node, run periodically or on-demand — this is the natural place for a real backend/data-pipeline component, unlike the static-data repos) + `app.js` (rendering, scoring engine, live reweighting) + `styles.css` + `index.html`. This is the one repo in the portfolio where a real (small) data pipeline is honestly part of the story — worth highlighting that distinction rather than pretending it's another static JSON app.

## 6. Explicitly out of scope for v1

- No live/automated trading or investment recommendations.
- No claim of proprietary data — everything sourced is public.
- No real-time continuous refresh required for v1 — a periodically-refreshed snapshot is honest and sufficient.
- v2 outcome-labeling pipeline (see §1) — don't attempt until v1 ships.

## 7. Build phases

1. **Phase 1:** static-but-real snapshot — fetch a curated set of ~30-50 real active trials across a few therapeutic areas via the CT.gov API once, cite a real base-rate source, build the scoring engine and UI against that snapshot (same build shape as Sourcing Screen, but with real fetched data instead of authored fictional data).
2. **Phase 2:** live refresh capability (a script that re-fetches and re-scores on demand), expand therapeutic area coverage.
3. **Phase 3 (stretch):** the v2 outcome-labeling pipeline from §1, comparison mode.
