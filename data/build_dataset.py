"""
Builds data.json from real ClinicalTrials.gov API pulls + a cited published base-rate table.
Run: python3 build_dataset.py
Fetches fresh trial data itself (no separate curl step needed) and saves the raw pulls to
raw_*.json for reproducibility. This is the single script the GitHub Actions workflow
(.github/workflows/refresh-data.yml) runs on a schedule to keep the live site current.
"""
import json
import urllib.request
import urllib.parse
from datetime import date, datetime

AREA_QUERIES = {
    "Oncology": {"cond": "cancer", "pageSize": 15, "rawFile": "raw_oncology.json"},
    "Cardiovascular": {"cond": "cardiovascular disease", "pageSize": 10, "rawFile": "raw_cardio.json"},
    "Neurology": {"cond": "alzheimer disease", "pageSize": 8, "rawFile": "raw_neuro.json"},
}

# Real, cited published base rates. Sources:
# - "Clinical Development Success Rates and Contributing Factors, 2011-2020" — BIO, Informa
#   Pharma Intelligence, QLS Advisors (Feb 2021). Phase 1->2 average across all indications: 52.0%.
#   Overall Phase-1-to-approval likelihood: small molecule 5.7%, biologic 9.1%, vaccine 9.7%.
# - BMT/BIO Phase II/III transition study: oncology Phase2->3 ~28.3%, non-oncology ~34.8%;
#   cardiovascular Phase2->3 ~24%; oncology Phase3->approval ~37%, non-oncology ~54%,
#   cardiovascular Phase3->NDA filing ~45%.
BASE_RATES = {
    "Oncology":       {"PHASE1": 0.409, "PHASE2": 0.283, "PHASE3": 0.37, "source": "BIO/Informa/QLS 2011-2020; BMT/BIO oncology-specific Phase II/III study"},
    "Cardiovascular": {"PHASE1": 0.52,  "PHASE2": 0.24,  "PHASE3": 0.45, "source": "BIO/Informa/QLS 2011-2020 (Phase 1 avg); BMT/BIO cardiovascular-specific study"},
    "Neurology":      {"PHASE1": 0.52,  "PHASE2": 0.348, "PHASE3": 0.54, "source": "BIO/Informa/QLS 2011-2020 average; BMT/BIO non-oncology general rates (neurology-specific rate not separately cited)"},
}

ENROLLMENT_BENCHMARKS = {
    "PHASE1": (20, 80), "PHASE2": (100, 300), "PHASE3": (300, 3000),
}

ACADEMIC_MARKERS = ["university", "hospital", "institute", "medical center", "foundation", "clinic", "nhs", "college"]


def classify_sponsor(name):
    n = (name or "").lower()
    if any(m in n for m in ACADEMIC_MARKERS):
        return {"tier": "Academic/Institutional", "score": 3, "note": "Academic or hospital-sponsored — often well-designed but slower to scale multi-site enrollment."}
    return {"tier": "Industry (biotech/pharma)", "score": 4, "note": "Industry-sponsored — typically better-resourced for multi-site execution; track record varies by company, not separately verified here."}


def enrollment_signal(phase, count):
    lo, hi = ENROLLMENT_BENCHMARKS.get(phase, (50, 500))
    phase_label = phase.replace("PHASE", "Phase ")
    if count is None:
        return {"score": 3, "note": "Enrollment target not reported."}
    if count < lo * 0.5:
        return {"score": 2, "note": f"Enrollment target ({count}) is notably small for {phase_label} — may limit statistical power."}
    if count > hi * 1.5:
        return {"score": 5, "note": f"Enrollment target ({count}) is large for {phase_label} — typically signals higher confidence investment."}
    return {"score": 4, "note": f"Enrollment target ({count}) is within the typical range for {phase_label}."}


def timeline_signal(start_date, completion_date):
    try:
        s = datetime.strptime(start_date[:7], "%Y-%m")
        c = datetime.strptime(completion_date[:7], "%Y-%m")
        months = (c.year - s.year) * 12 + (c.month - s.month)
    except Exception:
        return {"score": 3, "note": "Timeline data incomplete."}
    if months <= 0:
        return {"score": 2, "note": "Completion date is not after start date as reported — worth checking the listing directly."}
    if months > 60:
        return {"score": 2, "note": f"Planned duration (~{months} months) is unusually long — longer timelines carry more execution risk."}
    return {"score": 4, "note": f"Planned duration (~{months} months) is within a normal range for this phase."}


def competitive_density(condition):
    try:
        url = f"https://clinicaltrials.gov/api/v2/studies?query.cond={urllib.parse.quote(condition)}&filter.overallStatus=RECRUITING&countTotal=true&pageSize=1"
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read())
            total = data.get("totalCount", None)
    except Exception:
        total = None
    if total is None:
        return {"count": None, "score": 3, "note": "Could not fetch live competitive count."}
    if total > 200:
        return {"count": total, "score": 2, "note": f"{total} actively recruiting trials exist for this condition — a crowded field."}
    if total > 50:
        return {"count": total, "score": 3, "note": f"{total} actively recruiting trials exist for this condition — moderately competitive."}
    return {"count": total, "score": 4, "note": f"Only {total} actively recruiting trials exist for this condition — relatively uncrowded."}


def fetch_studies(condition, page_size):
    params = urllib.parse.urlencode({
        "query.cond": condition,
        "filter.overallStatus": "RECRUITING",
        "filter.advanced": "AREA[Phase](PHASE1 OR PHASE2 OR PHASE3)",
        "pageSize": page_size,
        "fields": "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,Condition,EnrollmentCount,StartDate,PrimaryCompletionDate,StudyType",
    })
    url = f"https://clinicaltrials.gov/api/v2/studies?{params}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read())


def process_area(area_label, query_info):
    raw = fetch_studies(query_info["cond"], query_info["pageSize"])
    with open(query_info["rawFile"], "w") as f:
        json.dump(raw, f, indent=2)
    trials = []
    for study in raw["studies"]:
        ps = study["protocolSection"]
        ident = ps.get("identificationModule", {})
        status = ps.get("statusModule", {})
        sponsor = ps.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {})
        conditions = ps.get("conditionsModule", {}).get("conditions", [])
        design = ps.get("designModule", {})
        phases = design.get("phases", ["PHASE2"])
        phase = phases[-1] if phases else "PHASE2"  # use furthest phase listed
        enrollment = design.get("enrollmentInfo", {}).get("count")
        start = status.get("startDateStruct", {}).get("date", "")
        completion = status.get("primaryCompletionDateStruct", {}).get("date", "")
        primary_condition = conditions[0] if conditions else area_label

        base_rate = BASE_RATES[area_label].get(phase, BASE_RATES[area_label]["PHASE2"])
        sponsor_info = classify_sponsor(sponsor.get("name", ""))
        enroll_info = enrollment_signal(phase, enrollment)
        timeline_info = timeline_signal(start, completion)
        comp_info = competitive_density(primary_condition)

        factor_scores = {
            "sponsorProfile": sponsor_info["score"],
            "trialDesign": enroll_info["score"],
            "timeline": timeline_info["score"],
            "competitiveDensity": comp_info["score"],
        }
        avg_factor = sum(factor_scores.values()) / len(factor_scores)
        adjustment = (avg_factor - 3) * 0.03  # each point above/below neutral (3) shifts rate +/-3pp
        adjusted_probability = max(0.01, min(0.95, base_rate + adjustment))

        trials.append({
            "nctId": ident.get("nctId"),
            "title": ident.get("briefTitle"),
            "therapeuticArea": area_label,
            "condition": primary_condition,
            "phase": phase.replace("PHASE", "Phase "),
            "sponsor": sponsor.get("name", "Unknown"),
            "sponsorTier": sponsor_info["tier"],
            "enrollment": enrollment,
            "startDate": start,
            "primaryCompletionDate": completion,
            "baseRate": base_rate,
            "baseRateSource": BASE_RATES[area_label]["source"],
            "factorScores": factor_scores,
            "factorNotes": {
                "sponsorProfile": sponsor_info["note"],
                "trialDesign": enroll_info["note"],
                "timeline": timeline_info["note"],
                "competitiveDensity": comp_info["note"],
            },
            "competitiveTrialCount": comp_info["count"],
            "adjustedProbability": round(adjusted_probability, 3),
        })
    return trials


def main():
    all_trials = []
    for area, query_info in AREA_QUERIES.items():
        print(f"Fetching and processing {area}...")
        all_trials.extend(process_area(area, query_info))

    output = {
        "meta": {
            "title": "PhaseSignal",
            "subtitle": "Public-data trial success screening — every score shows its work",
            "asOf": "July 2026",
            "disclaimer": "Directional and illustrative only. Built entirely on public ClinicalTrials.gov data and published historical base rates (cited per trial). Not investment advice, not a substitute for real diligence, and not affiliated with or reflective of any employer's actual models or holdings.",
        },
        "framework": {
            "criteria": [
                {"key": "baseRate", "label": "Historical Base Rate", "short": "Base Rate", "description": "The published, cited phase-transition probability for this therapeutic area and phase — the anchor before any trial-specific adjustment."},
                {"key": "sponsorProfile", "label": "Sponsor Profile", "short": "Sponsor", "description": "Academic/institutional vs. industry sponsorship — a real signal, though not a substitute for a true sponsor track-record analysis (a harder v2 build)."},
                {"key": "trialDesign", "label": "Trial Design (Enrollment)", "short": "Design", "description": "Whether the enrollment target is typical, small, or large for this phase — computed from the live trial record, not estimated."},
                {"key": "timeline", "label": "Timeline Risk", "short": "Timeline", "description": "Whether the planned trial duration falls within a normal range, computed from actual start and completion dates."},
                {"key": "competitiveDensity", "label": "Competitive Density", "short": "Density", "description": "How many other actively recruiting trials exist for the same condition right now, queried live against ClinicalTrials.gov."},
            ]
        },
        "therapeuticAreas": list(AREA_QUERIES.keys()),
        "trials": all_trials,
    }

    with open("../data.json", "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {len(all_trials)} real trials to data.json")


if __name__ == "__main__":
    main()
