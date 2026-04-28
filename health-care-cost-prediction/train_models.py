#!/usr/bin/env python3
"""
train_models.py

Usage:
  python train_models.py
"""

import os
import json
import joblib
from pathlib import Path
from pprint import pprint
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, KFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.impute import SimpleImputer
from tqdm import tqdm

# ===================== CONFIG =====================
DATA_PATH = Path(r"C:\Users\yeshw\OneDrive\Documents\Final Yr Project\insurance.csv")
OUT_DIR = Path.cwd() / "model_artifacts"           # primary local artifacts folder
MNT_DIR = Path("/mnt/data")                        # optional compatibility folder
RANDOM_STATE = 42
TEST_SIZE = 0.15
VAL_SIZE_FROM_TRAIN = 0.1764705882  # ~ 15% of full -> results in 70/15/15
N_FOLDS = 5
# ==================================================

OUT_DIR.mkdir(parents=True, exist_ok=True)
if MNT_DIR.exists():
    MNT_DIR.mkdir(parents=True, exist_ok=True)

print(f"Loading dataset from: {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
print("Initial shape:", df.shape)

# ---------- Basic cleaning ----------
# strip whitespace in categorical columns if present
for c in ["sex", "smoker", "region"]:
    if c in df.columns and df[c].dtype == object:
        df[c] = df[c].str.strip()

# Remove exact duplicates
df = df.drop_duplicates()

# Filter impossible values
conds = []
if "age" in df.columns:
    conds.append(df["age"].between(0, 120))
if "bmi" in df.columns:
    conds.append(df["bmi"].between(10, 70))
if "charges" in df.columns:
    conds.append(df["charges"] >= 0)
if conds:
    mask = np.logical_and.reduce(conds)
    removed = (~mask).sum()
    if removed > 0:
        print(f"Removed {removed} rows with impossible values.")
    df = df[mask].copy()

print("Shape after cleaning:", df.shape)

# ---------- Feature engineering ----------
cdf = df.copy()

# Age band
if "age" in cdf.columns:
    bins = [0, 25, 35, 50, 120]
    labels = ["18-25", "26-35", "36-50", "50+"]
    cdf["age_band"] = pd.cut(cdf["age"], bins=bins, labels=labels, include_lowest=True)

# BMI category
if "bmi" in cdf.columns:
    def bmi_cat(x):
        if x < 18.5:
            return "underweight"
        if x < 25:
            return "normal"
        if x < 30:
            return "overweight"
        return "obese"
    cdf["bmi_cat"] = cdf["bmi"].apply(bmi_cat)

# Interaction features
if set(["age", "bmi", "smoker"]).issubset(cdf.columns):
    cdf["smoker_bin"] = cdf["smoker"].map(lambda x: 1 if str(x).lower().startswith("y") else 0)
    cdf["age_smoker"] = cdf["age"] * cdf["smoker_bin"]
    cdf["bmi_smoker"] = cdf["bmi"] * cdf["smoker_bin"]
    cdf["bmi_age"] = cdf["bmi"] * cdf["age"]

# --------- Define features and target ----------
target = "charges"
num_features = [c for c in ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age"] if c in cdf.columns]
cat_features = [c for c in ["sex", "smoker", "region", "age_band", "bmi_cat"] if c in cdf.columns]

print("Numeric features:", num_features)
print("Categorical features:", cat_features)

# ---------- Train / Val / Test split ----------
stratify_col = "smoker" if "smoker" in cdf.columns else None
train_val_df, test_df = train_test_split(cdf, test_size=TEST_SIZE, random_state=RANDOM_STATE,
                                         stratify=cdf[stratify_col] if stratify_col is not None else None)
train_df, val_df = train_test_split(train_val_df, test_size=VAL_SIZE_FROM_TRAIN, random_state=RANDOM_STATE,
                                    stratify=train_val_df[stratify_col] if stratify_col is not None else None)

print("Split sizes -> train:", train_df.shape, "val:", val_df.shape, "test:", test_df.shape)

# ---------- Prepare one-hot pipeline for tree boosters (XGB/LGB) ----------
full_cat_cols = cat_features.copy()
# Create baseline one-hot columns from full data to guarantee consistent columns later
X_full = pd.get_dummies(cdf[num_features + full_cat_cols], columns=full_cat_cols, drop_first=False, dummy_na=False)
oh_columns = X_full.columns.tolist()

# Fit scaler on numeric columns using train only (for linear/nn or to standardize before xgb if you like)
scaler = StandardScaler()
if num_features:
    scaler.fit(train_df[num_features])
else:
    scaler = None

def prepare_matrix(df_):
    # numeric scaled
    X_num = pd.DataFrame(scaler.transform(df_[num_features]), columns=num_features, index=df_.index) if scaler is not None else pd.DataFrame(index=df_.index)
    X_cat = pd.get_dummies(df_[full_cat_cols], columns=full_cat_cols, drop_first=False)
    X_all = pd.concat([X_num, X_cat], axis=1).reindex(columns=oh_columns, fill_value=0)
    return X_all

X_train = prepare_matrix(train_df)
X_val = prepare_matrix(val_df)
X_test = prepare_matrix(test_df)

y_train = train_df[target].values
y_val = val_df[target].values
y_test = test_df[target].values

# Save scaffolding artifacts (scaler and oh_columns)
joblib.dump(oh_columns, OUT_DIR / "oh_columns.joblib")
if scaler is not None:
    joblib.dump(scaler, OUT_DIR / "scaler.joblib")
print("Saved preprocessing artifacts in:", OUT_DIR)

# Also copy artifacts to /mnt/data for compatibility if possible
try:
    if MNT_DIR.exists():
        joblib.dump(oh_columns, MNT_DIR / "oh_columns.joblib")
        if scaler is not None:
            joblib.dump(scaler, MNT_DIR / "scaler.joblib")
        print("Also saved artifacts to /mnt/data for app compatibility.")
except Exception as e:
    print("Warning copying artifacts to /mnt/data:", e)

# ============================
# Train & evaluate models
# ============================
results = {}

# Helper
from math import sqrt
from sklearn.metrics import mean_absolute_error

def eval_preds(y_true, y_pred):
    try:
        # mean_squared_error without using `squared=` flag to avoid version issues
        mse = mean_squared_error(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)
        rmse = float(sqrt(mse))
        r2 = float(r2_score(y_true, y_pred))
        return {"mae": float(mae), "mse": float(mse), "rmse": rmse, "r2": r2}
    except Exception as e:
        print("eval_preds failed:", str(e))
        # return very conservative result so script can continue
        return {"mae": None, "mse": None, "rmse": None, "r2": None}

# -------- XGBoost ----------
try:
    import xgboost as xgb
    print("\nTraining XGBoost...")
    dtrain = xgb.DMatrix(X_train, label=y_train)
    dval = xgb.DMatrix(X_val, label=y_val)
    dtest = xgb.DMatrix(X_test, label=y_test)
    params = {
        "objective": "reg:squarederror",
        "eta": 0.05,
        "max_depth": 6,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "seed": RANDOM_STATE,
        "eval_metric": "rmse",
    }
    evallist = [(dval, "eval"), (dtrain, "train")]
    model_xgb = xgb.train(params, dtrain, num_boost_round=2000, evals=evallist,
                          early_stopping_rounds=100, verbose_eval=100)
    preds_xgb = model_xgb.predict(dtest)
    results["xgboost"] = eval_preds(y_test, preds_xgb)
    # Save
    model_path = OUT_DIR / "xgboost_model.json"
    model_xgb.save_model(str(model_path))
    if MNT_DIR.exists():
        model_xgb.save_model(str(MNT_DIR / "xgboost_model.json"))
    print("XGBoost done. Metrics:", results["xgboost"])
except Exception as e:
    print("Skipping XGBoost: ", str(e))

# -------- LightGBM ----------
try:
    import lightgbm as lgb
    print("\nTraining LightGBM...")

    train_set = lgb.Dataset(X_train, label=y_train)
    val_set = lgb.Dataset(X_val, label=y_val)

    lgb_params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "seed": RANDOM_STATE,
        "verbosity": -1
    }

    # Train without early stopping (supported everywhere)
    model_lgb = lgb.train(
        params=lgb_params,
        train_set=train_set,
        num_boost_round=500,  # fixed rounds since no early stopping
        valid_sets=[val_set],  # still logs eval metric
    )

    preds_lgb = model_lgb.predict(X_test)
    results["lightgbm"] = eval_preds(y_test, preds_lgb)

    model_path = OUT_DIR / "lightgbm_model.txt"
    model_lgb.save_model(str(model_path))

    if MNT_DIR.exists():
        model_lgb.save_model(str(MNT_DIR / "lightgbm_model.txt"))

    print("LightGBM done. Metrics:", results["lightgbm"])

except Exception as e:
    print("Skipping LightGBM: ", str(e))


# -------- CatBoost (Mean Model in LOG SPACE) ----------
try:
    from catboost import CatBoostRegressor, Pool
    print("\nTraining CatBoost (Log-Space Mean Model)...")
    
    # Transform target to log-space
    y_train_log = np.log(y_train)
    y_val_log = np.log(y_val)
    y_test_log = np.log(y_test)

    # For CatBoost we pass raw categorical columns
    # Build X matrices for CatBoost: ensure columns in order
    X_cols_cat = [c for c in num_features if c in num_features] + [c for c in cat_features if c in df.columns]
    
    # build Pools with LOG target
    train_pool_log = Pool(train_df[num_features + cat_features], y_train_log, cat_features=[i for i, c in enumerate(num_features + cat_features) if c in cat_features])
    val_pool_log = Pool(val_df[num_features + cat_features], y_val_log, cat_features=[i for i, c in enumerate(num_features + cat_features) if c in cat_features])
    
    # Train Mean Model (RMSE objective, but on log-targets)
    model_cb = CatBoostRegressor(
        iterations=2000, 
        learning_rate=0.05, 
        depth=6, 
        l2_leaf_reg=3, 
        random_seed=RANDOM_STATE, 
        verbose=100,
        loss_function='RMSE' # minimizing RMSE in log-space is good for relative error
    )
    model_cb.fit(train_pool_log, eval_set=val_pool_log, early_stopping_rounds=100, use_best_model=True)
    
    # Eval on Test (transforming back to linear space for metrics)
    preds_cb_log = model_cb.predict(test_df[num_features + cat_features])
    preds_cb = np.exp(preds_cb_log)
    results["catboost"] = eval_preds(y_test, preds_cb)
    
    model_cb.save_model(str(OUT_DIR / "catboost_model.cbm"))
    if MNT_DIR.exists():
        model_cb.save_model(str(MNT_DIR / "catboost_model.cbm"))
    print("CatBoost (Log-Space) done. Metrics (Linear Scale):", results["catboost"])
    
    # ---------------- BUCKETED RESIDUALS FOR UNCERTAINTY ----------------
    print("\nCalculating Bucketed Residuals for Uncertainty...")
    
    # Predict on Validation set (in log space)
    val_preds_log = model_cb.predict(val_df[num_features + cat_features])
    
    # Calculate Residuals: log(True) - log(Pred)
    # Positive residual => True > Pred (Underprediction)
    # Negative residual => True < Pred (Overprediction)
    residuals = y_val_log - val_preds_log
    
    # Create a temporary DF for grouping
    res_df = val_df.copy()
    res_df["residual"] = residuals
    
    # Bucket definitions matches what we have in clean step
    # We group by: smoker, bmi_cat, age_band
    # Note: 'smoker' column in val_df might be 'yes'/'no' string or mapped. 
    # Check cleaning step: line 44 "df[c] = df[c].str.strip()" -> it is string.
    
    group_cols = ["smoker", "bmi_cat", "age_band"]
    
    # Compute quantiles per group
    # We need P10, P50 (median), P90, P95
    def get_quantiles(g):
        return pd.Series({
            "p10": np.percentile(g, 10),
            "p50": np.percentile(g, 50),
            "p90": np.percentile(g, 90),
            "p95": np.percentile(g, 95),
            "count": len(g)
        })

    bucket_stats = res_df.groupby(group_cols)["residual"].apply(get_quantiles).unstack()
    
    # Global residuals as fallback
    global_quantiles = {
        "p10": float(np.percentile(residuals, 10)),
        "p50": float(np.percentile(residuals, 50)),
        "p90": float(np.percentile(residuals, 90)),
        "p95": float(np.percentile(residuals, 95))
    }
    
    # Bayesian Smoothing for Small Buckets
    # smoothed = (n * bucket_val + m * global_val) / (n + m)
    # m = prior weight (e.g., 10 samples worth of faith in global)
    PRIOR_WEIGHT = 10.0
    
    bucket_map = {}
    
    for idx, row in bucket_stats.iterrows():
        # idx is a tuple (smoker, bmi_cat, age_band)
        key = f"{str(idx[0])}_{str(idx[1])}_{str(idx[2])}"
        
        count = int(row["count"])
        
        # Smooth each stat
        smoothed_p10 = (count * row["p10"] + PRIOR_WEIGHT * global_quantiles["p10"]) / (count + PRIOR_WEIGHT)
        smoothed_p50 = (count * row["p50"] + PRIOR_WEIGHT * global_quantiles["p50"]) / (count + PRIOR_WEIGHT)
        smoothed_p90 = (count * row["p90"] + PRIOR_WEIGHT * global_quantiles["p90"]) / (count + PRIOR_WEIGHT)
        smoothed_p95 = (count * row["p95"] + PRIOR_WEIGHT * global_quantiles["p95"]) / (count + PRIOR_WEIGHT)
        
        bucket_map[key] = {
            "p10": float(smoothed_p10),
            "p50": float(smoothed_p50),
            "p90": float(smoothed_p90),
            "p95": float(smoothed_p95),
            "count": count
        }
        
    residuals_artifact = {
        "buckets": bucket_map,
        "global": global_quantiles,
        "method": "log_residual_buckets_smoothed"
    }    
    # Fallback for empty buckets:
    # If a user falls into a bucket seen in training but not validation (unlikely with this split but possible)
    # or a totally new bucket, we should have a fallback.
    # Global residuals as fallback
    global_quantiles = {
        "p10": float(np.percentile(residuals, 10)),
        "p50": float(np.percentile(residuals, 50)),
        "p90": float(np.percentile(residuals, 90)),
        "p95": float(np.percentile(residuals, 95))
    }
    
    # Convert to dictionary for easy JSON save
    # Key format: "smoker_bmi_age" e.g. "yes_obese_50+"
    bucket_map = {}
    
    for idx, row in bucket_stats.iterrows():
        # idx is a tuple (smoker, bmi_cat, age_band)
        # Assuming they are strings. One might be NaN if categorical failed, but we cleaned.
        key = f"{str(idx[0])}_{str(idx[1])}_{str(idx[2])}"
        bucket_map[key] = {
            "p10": float(row["p10"]),
            "p50": float(row["p50"]),
            "p90": float(row["p90"]),
            "p95": float(row["p95"]),
            "count": int(row["count"])
        }
        
    residuals_artifact = {
        "buckets": bucket_map,
        "global": global_quantiles,
        "method": "log_residual_buckets"
    }
    
    # Save artifacts
    with open(OUT_DIR / "bucket_residuals.json", "w") as f:
        json.dump(residuals_artifact, f, indent=2)
        
    if MNT_DIR.exists():
        with open(MNT_DIR / "bucket_residuals.json", "w") as f:
            json.dump(residuals_artifact, f, indent=2)
            
    print("Bucketed residuals saved. Total buckets:", len(bucket_map))
    results["uncertainty"] = "bucketed_residuals_v1"

except Exception as e:
    print("Skipping CatBoost/Uncertainty: ", str(e))
    import traceback
    traceback.print_exc()


# ---------- Final evaluation summary ----------
print("\nTraining finished. Summary:")
pprint(results)

# Save training_summary.json
summary = {
    "results": results,
    "meta": {
        "num_rows": int(df.shape[0]),
        "num_features": {"numeric": len(num_features), "categorical": len(cat_features)},
        "train_shape": list(train_df.shape),
        "val_shape": list(val_df.shape),
        "test_shape": list(test_df.shape)
    }
}
with open(OUT_DIR / "training_summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print("Saved training_summary.json to", OUT_DIR / "training_summary.json")

# copy summary to /mnt/data if exists
try:
    if MNT_DIR.exists():
        with open(MNT_DIR / "training_summary.json", "w") as f:
            json.dump(summary, f, indent=2)
        print("Also wrote training_summary.json to /mnt/data/")
except Exception as e:
    print("Warning copying summary to /mnt/data:", e)

print("Artifacts saved under:", OUT_DIR)

# ============================
# SAVE NUMERIC TRAIN DATA FOR LIME
# ============================

from sklearn.linear_model import LinearRegression
import joblib
import numpy as np

NUM_COLS = ["age","bmi","children","age_smoker","bmi_smoker","bmi_age"]

# save numeric matrix for LIME
lime_train_X = train_df[NUM_COLS].values.astype(float)
np.save(
    OUT_DIR / "train_X_lime.npy",
    lime_train_X
)

# proxy model for LIME
lime_proxy = LinearRegression()
lime_proxy.fit(train_df[NUM_COLS], y_train)

joblib.dump(
    lime_proxy,
    OUT_DIR / "lime_proxy.joblib"
)

print("Saved LIME artifacts to", OUT_DIR)

