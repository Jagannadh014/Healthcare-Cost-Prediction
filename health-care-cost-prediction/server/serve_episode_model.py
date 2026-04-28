
import sys, json, traceback, os

# ---------------- CONFIGURATION ----------------
# Factors derived from 'hospital data analysis.csv'
# Logic: Factor = 1 + (Raw_Cost / Reference_Baseline_5000)
# Uncertainty: Simulated +/- 20% for high complexity, 10% for low.

EPISODE_DATA = {
    "Heart Disease": {
        "mean_cost": 15000,
        "procedure": "Angioplasty",
        "factor_mean": 4.0,
        "factor_range": [3.2, 5.0],  # ~20-25% spread
        "impact_percent": 300 # (4.0 - 1.0) * 100
    },
    "Diabetes": {
        "mean_cost": 2000,
        "procedure": "Insulin Therapy",
        "factor_mean": 1.4,
        "factor_range": [1.2, 1.6],
        "impact_percent": 40
    },
    "Fractured Arm": {
        "mean_cost": 500,
        "procedure": "X-Ray and Splint",
        "factor_mean": 1.1,
        "factor_range": [1.05, 1.15],
        "impact_percent": 10
    },
    "Stroke": {
        "mean_cost": 10000,
        "procedure": "CT Scan and Medication",
        "factor_mean": 3.0,
        "factor_range": [2.5, 3.8],
        "impact_percent": 200
    },
    "Cancer": {
        "mean_cost": 30000,
        "procedure": "Surgery and Chemotherapy",
        "factor_mean": 7.0,
        "factor_range": [5.5, 9.0], # High variance for cancer
        "impact_percent": 600
    },
    "Hypertension": {
        "mean_cost": 500,
        "procedure": "Medication and Counseling",
        "factor_mean": 1.1,
        "factor_range": [1.05, 1.2],
        "impact_percent": 10
    },
    "Appendicitis": {
        "mean_cost": 8000,
        "procedure": "Appendectomy",
        "factor_mean": 2.6,
        "factor_range": [2.2, 3.0],
        "impact_percent": 160
    },
    "Fractured Leg": {
        "mean_cost": 3500,
        "procedure": "Cast and Physical Therapy",
        "factor_mean": 1.7,
        "factor_range": [1.5, 2.0],
        "impact_percent": 70
    },
    "Heart Attack": {
        "mean_cost": 18000,
        "procedure": "Cardiac Catheterization",
        "factor_mean": 4.6,
        "factor_range": [3.8, 5.5],
        "impact_percent": 360
    },
    "Allergic Reaction": {
        "mean_cost": 100,
        "procedure": "Epinephrine Injection",
        "factor_mean": 1.02, # Minimal
        "factor_range": [1.0, 1.05],
        "impact_percent": 2
    },
    "Respiratory Infection": {
        "mean_cost": 800,
        "procedure": "Antibiotics and Rest",
        "factor_mean": 1.16,
        "factor_range": [1.1, 1.25],
        "impact_percent": 16
    },
    "Prostate Cancer": {
        "mean_cost": 20000,
        "procedure": "Radiation Therapy",
        "factor_mean": 5.0,
        "factor_range": [4.0, 6.5],
        "impact_percent": 400
    },
    "Childbirth": {
        "mean_cost": 12000,
        "procedure": "Delivery and Postnatal Care",
        "factor_mean": 3.4,
        "factor_range": [2.8, 4.0],
        "impact_percent": 240
    },
    "Kidney Stones": {
        "mean_cost": 6000,
        "procedure": "Lithotripsy",
        "factor_mean": 2.2,
        "factor_range": [1.8, 2.6],
        "impact_percent": 120
    },
    "Osteoarthritis": {
        "mean_cost": 4000,
        "procedure": "Physical Therapy and Pain Management",
        "factor_mean": 1.8,
        "factor_range": [1.5, 2.2],
        "impact_percent": 80
    }
}

VALID_DISEASES = list(EPISODE_DATA.keys())

# ---------------- MAIN REQUEST LOOP ----------------
try:
    data = json.loads(sys.stdin.read())

    # Input: {"condition": "Heart Disease", ...other_ignored}
    condition = data.get("condition")

    if not condition:
        # Should be handled by backend, but safe fallback
        print(json.dumps({
            "adjustment_mean": 1.0,
            "adjustment_p10": 1.0,
            "adjustment_p95": 1.0,
            "resolved_procedure": "None",
            "explanation": {"impact_percent": 0, "reason": "No condition provided"}
        }), flush=True)
        sys.exit(0)

    # Validation
    if condition not in EPISODE_DATA:
        # Strict validation as per spec
        raise ValueError(f"Unknown condition: {condition}. Must be one of {VALID_DISEASES}")

    row = EPISODE_DATA[condition]

    response = {
        "adjustment_mean": row["factor_mean"],
        "adjustment_p10": row["factor_range"][0],
        "adjustment_p95": row["factor_range"][1],
        "resolved_procedure": row["procedure"],
        "explanation": {
            "impact_percent": row["impact_percent"],
            "reason": f"Adjusted for {condition} ({row['procedure']})"
        }
    }

    print(json.dumps(response), flush=True)

except Exception as e:
    sys.stderr.write(traceback.format_exc())
    print(json.dumps({"error": str(e)}), flush=True)
