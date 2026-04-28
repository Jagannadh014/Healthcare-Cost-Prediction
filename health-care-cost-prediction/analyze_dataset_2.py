
import pandas as pd
import numpy as np
from catboost import CatBoostRegressor, Pool
import os
import json

# Paths
BASE_DIR = os.getcwd()
DATA_PATH = os.path.join(BASE_DIR, "hospital data analysis.csv")
MODEL_PATH = os.path.join(BASE_DIR, "server", "model_artifacts", "catboost_model.cbm")
# Check local or parallel folder structure
if not os.path.exists(MODEL_PATH):
    # Try alternate path structure if running from root vs server
    MODEL_PATH = os.path.join(BASE_DIR, "model_artifacts", "catboost_model.cbm")

print(f"Loading Data from: {DATA_PATH}")
print(f"Loading Model from: {MODEL_PATH}")

# Load Data
df = pd.read_csv(DATA_PATH)

# Load Model
model = CatBoostRegressor()
model.load_model(MODEL_PATH)

# Features expected by Baseline Model
# ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age"] + ["sex", "smoker", "region", "age_band", "bmi_cat"]

# Prepare Proxy Data
# We use REAL Age/Gender, and PROXY others (Average/Mode)
proxy_df = df.copy()

# 1. Map Gender to sex (lowercase)
proxy_df['sex'] = proxy_df['Gender'].str.lower()

# 2. Impute Missing Defaults
proxy_df['bmi'] = 30.6  # Average BMI in US/Insurance dataset
proxy_df['children'] = 1 # Median
proxy_df['smoker'] = "no" # Most conservative baseline
proxy_df['region'] = "southeast" # Common region

# 3. Feature Engineering (Same as serve_model.py)
proxy_df['smoker_bin'] = (proxy_df['smoker'] == 'yes').astype(int)
proxy_df['age_smoker'] = proxy_df['Age'] * proxy_df['smoker_bin']
proxy_df['bmi_smoker'] = proxy_df['bmi'] * proxy_df['smoker_bin']
proxy_df['bmi_age'] = proxy_df['bmi'] * proxy_df['Age']

# Age Band
def get_age_band(age):
    if age <= 25: return "18-25"
    if age <= 35: return "26-35"
    if age <= 50: return "36-50"
    return "50+"

proxy_df['age_band'] = proxy_df['Age'].apply(get_age_band)

# BMI Category
def get_bmi_cat(bmi):
    if bmi < 18.5: return "underweight"
    if bmi < 25: return "normal"
    if bmi < 30: return "overweight"
    return "obese"

proxy_df['bmi_cat'] = proxy_df['bmi'].apply(get_bmi_cat)

# Select Columns in Order
# Indices for CatBoost: sex, smoker, region, age_band, bmi_cat
# Numerical: age, bmi, children, age_smoker, bmi_smoker, bmi_age
# Total: 11 features? Let's check serve_model.py again.
# serve_model.py uses Pool(X, cat_features=CAT_INDEXES)
# We need to construct the DataFrame with ALL_COLS in correct order if we want to be safe, 
# or just match the feature names model expects.

# features from train_models.py
# num_features = ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age"]
# cat_features = ["sex", "smoker", "region", "age_band", "bmi_cat"]
ALL_COLS = ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age", 
            "sex", "smoker", "region", "age_band", "bmi_cat"]

# Rename 'Age' to 'age'
proxy_df = proxy_df.rename(columns={'Age': 'age'})

final_X = proxy_df[ALL_COLS]
cat_features_indices = [ALL_COLS.index(c) for c in ["sex", "smoker", "region", "age_band", "bmi_cat"]]

# Predict Baseline
print("Predicting Baselines...")
log_preds = model.predict(Pool(final_X, cat_features=cat_features_indices))
baseline_costs = np.exp(log_preds)

# Calculate Adjustment Factors
# Factor = Real_Cost / Baseline_Cost
proxy_df['real_cost'] = df['Cost'] # Assuming 'Cost' column exists
proxy_df['baseline_cost'] = baseline_costs
proxy_df['adjustment_factor'] = proxy_df['real_cost'] / proxy_df['baseline_cost']

# Group by Condition
results = {}

print("\n--- DERIVED ADJUSTMENT FACTORS ---\n")

for condition in proxy_df['Condition'].unique():
    subset = proxy_df[proxy_df['Condition'] == condition]
    factors = subset['adjustment_factor']
    
    # Calculate Stats
    mean_val = factors.mean()
    p10_val = np.percentile(factors, 10)
    p95_val = np.percentile(factors, 95)
    
    # Get Canonical Procedure (Mode)
    procedure = subset['Procedure'].mode()[0]
    
    results[condition] = {
        "mean": round(mean_val, 2),
        "p10": round(p10_val, 2),
        "p95": round(p95_val, 2),
        "procedure": procedure,
        "count": len(subset)
    }
    
    print(f"Condition: {condition}")
    print(f"  Procedure: {procedure}")
    print(f"  Factor: Mean={mean_val:.2f}, P10={p10_val:.2f}, P95={p95_val:.2f}")
    print("-" * 30)

# Save to JSON for easy copy-paste
with open("derived_factors.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nSaved to derived_factors.json")
