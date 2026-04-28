
import pandas as pd
import numpy as np
import os
import json

# Paths
BASE_DIR = os.getcwd()
DATA_PATH = os.path.join(BASE_DIR, "hospital data analysis.csv")

print(f"Loading Data from: {DATA_PATH}")

df = pd.read_csv(DATA_PATH)

results = {}

print("\n--- RAW COST STATS PER CONDITION ---\n")

for condition in df['Condition'].unique():
    subset = df[df['Condition'] == condition]
    costs = subset['Cost']
    
    mean_val = costs.mean()
    p10_val = np.percentile(costs, 10)
    p95_val = np.percentile(costs, 95)
    
    procedure = subset['Procedure'].mode()[0]
    
    results[condition] = {
        "mean_cost": float(mean_val),
        "p10_cost": float(p10_val),
        "p95_cost": float(p95_val),
        "procedure": procedure
    }
    
    print(f"Condition: {condition}")
    print(f"  Procedure: {procedure}")
    print(f"  Cost: Mean=${mean_val:,.2f}, P10=${p10_val:,.2f}, P95=${p95_val:,.2f}")
    print("-" * 30)

with open("raw_cost_stats.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nSaved to raw_cost_stats.json")
