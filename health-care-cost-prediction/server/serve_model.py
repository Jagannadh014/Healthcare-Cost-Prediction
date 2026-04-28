import sys, json, traceback, os
import numpy as np
import pandas as pd
import joblib
from catboost import CatBoostRegressor, Pool
import time

# silence warnings/logs
os.environ["PYTHONWARNINGS"] = "ignore"

# ---------------- PATHS ----------------
BASE = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(os.path.dirname(BASE), "model_artifacts")

MODEL_PATH = os.path.join(ARTIFACTS_DIR, "catboost_model.cbm")
SCALER_PATH = os.path.join(ARTIFACTS_DIR, "scaler.joblib")

TRAIN_X_PATH = os.path.join(ARTIFACTS_DIR, "train_X_lime.npy")
LIME_PROXY_PATH = os.path.join(ARTIFACTS_DIR, "lime_proxy.joblib")

# ---------------- FEATURE DEFINITIONS ----------------
NUM_COLS = ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age"]
CAT_COLS = ["sex", "smoker", "region", "age_band", "bmi_cat"]
ALL_COLS = NUM_COLS + CAT_COLS
CAT_INDEXES = [ALL_COLS.index(c) for c in CAT_COLS]

# human-readable explanations
FEATURE_EXPLANATIONS = {
    "age": "your age",
    "bmi": "your body weight (BMI)",
    "children": "number of dependents",
    "smoker": "smoking habit",
    "region": "your region",
    "age_smoker": "the combined effect of age and smoking",
    "bmi_smoker": "the combined effect of body weight and smoking",
    "bmi_age": "the combined effect of body weight and age",
    "age_band": "your age group",
    "bmi_cat": "your BMI category",
}

# ---------------- LOAD MODELS (ONCE) ----------------
start_time = time.time()

# Mean prediction model (Log-Space trained)
model = CatBoostRegressor(verbose=False)
model.load_model(MODEL_PATH)
print(f"Main model loaded in {time.time() - start_time:.2f}s", file=sys.stderr)

# Bucketed Residuals for Uncertainty
try:
    import os
    quantile_start = time.time()
    
    with open(os.path.join(ARTIFACTS_DIR, "bucket_residuals.json"), "r") as f:
        bucket_residuals = json.load(f)

    bucket_quantile_map = bucket_residuals["buckets"]
    global_quantile_map = bucket_residuals["global"]
    
    quantile_models_loaded = True
    print(f"Bucketed residuals loaded in {time.time() - quantile_start:.2f}s", file=sys.stderr)
except Exception as e:
    quantile_models_loaded = False
    bucket_quantile_map = {}
    global_quantile_map = {}
    print(f"Warning: Bucketed residuals not loaded: {e}", file=sys.stderr)

scaler = joblib.load(SCALER_PATH)

# ---------------- SHAP ----------------
try:
    shap_start = time.time()
    import shap
    shap_explainer = shap.TreeExplainer(model)
    print(f"SHAP explainer loaded in {time.time() - shap_start:.2f}s", file=sys.stderr)
except Exception as e:
    shap_explainer = None
    print(f"SHAP not available: {e}", file=sys.stderr)

# ---------------- LIME ----------------
try:
    lime_start = time.time()
    from lime.lime_tabular import LimeTabularExplainer

    lime_train_X = np.load(TRAIN_X_PATH)
    lime_proxy = joblib.load(LIME_PROXY_PATH)

    lime_explainer = LimeTabularExplainer(
        lime_train_X,
        feature_names=NUM_COLS,
        mode="regression"
    )
    print(f"LIME explainer loaded in {time.time() - lime_start:.2f}s", file=sys.stderr)
except Exception as e:
    lime_explainer = None
    print(f"LIME not available: {e}", file=sys.stderr)

print(f"Total model loading time: {time.time() - start_time:.2f}s", file=sys.stderr)


# ---------------- PREPROCESS ----------------
def preprocess(inp):
    df = pd.DataFrame([inp])

    # Basic cleaning / type conversion if needed
    # smoker: yes/no
    df["smoker_bin"] = (df["smoker"] == "yes").astype(int)
    df["age_smoker"] = df["age"] * df["smoker_bin"]
    df["bmi_smoker"] = df["bmi"] * df["smoker_bin"]
    df["bmi_age"] = df["bmi"] * df["age"]

    # We need to recreate the categorical columns exactly as in training
    # Training uses pd.cut with specific bins.
    
    # Age band: [0, 25, 35, 50, 120] -> ["18-25", "26-35", "36-50", "50+"]
    # (Note: train_models.py used 120, serve_model.py used 200, consistent enough)
    df["age_band"] = pd.cut(
        df["age"],
        bins=[0, 25, 35, 50, 200],
        labels=["18-25", "26-35", "36-50", "50+"],
        include_lowest=True
    )

    # BMI Category
    df["bmi_cat"] = pd.cut(
        df["bmi"],
        bins=[0, 18.5, 25, 30, 1000],
        labels=["underweight", "normal", "overweight", "obese"],
        include_lowest=True
    )

    # Scale numeric columns - REMOVED for CatBoost (trained on RAW)
    # df[NUM_COLS] = scaler.transform(df[NUM_COLS])
    
    # Return all columns in correct order
    return df[ALL_COLS]



# ---------------- SHAP & EXPLANATION LOGIC ----------------

# Grouping Definition
# Map raw features to human concepts
FEATURE_GROUPS = {
    "Age Factors": ["age", "age_band", "age_smoker"], 
    # Note: age_smoker is an interaction, but often dominated by age in non-smokers? 
    # Actually, for a smoker, we should attribute the *excess* risk to smoking.
    # Let's adjust: "Smoker" gets "smoker", "bmi_smoker", "age_smoker".
    # "Age" gets "age", "age_band", "bmi_age" (Age part of deterioration).
    # "BMI" gets "bmi", "bmi_cat".
}

# Revised mapping for clarity
GROUP_MAPPING = {
    "age": "Age & Maturity",
    "age_band": "Age & Maturity",
    "bmi_age": "Age & Maturity", # Joint effect, attribute to Age progression
    
    "bmi": "BMI & Health Status",
    "bmi_cat": "BMI & Health Status",
    
    "smoker": "Smoking Status",
    "bmi_smoker": "Smoking Status", # Interaction driven by smoking
    "age_smoker": "Smoking Status", # Interaction driven by smoking
    
    "children": "Family Size",
    
    "region": "Location",
    "sex": "Demographics" 
}

def get_shap_breakdown(shap_values, base_value_log, prediction_inr, feature_names):
    """
    Convert Log-Space SHAP values to Additive Rupee contributions.
    Method: Generalized Rescaling.
    Contrib_INR = Log_Shap * (Pred_INR - Base_INR) / (Pred_Log - Base_Log)
    """
    
    # 1. Aggregate Log-SHAP by Group
    group_log_shap = {}
    
    for feat, val in zip(feature_names, shap_values):
        group = GROUP_MAPPING.get(feat, "Other Factors")
        group_log_shap[group] = group_log_shap.get(group, 0.0) + val
        
    # 2. Calculate Scaling Factor
    base_inr = np.exp(base_value_log)
    
    # Calculate predicted log from components to be consistent with SHAP additivity
    # (Do not use the model's prediction output directly if it differs slightly from SHAP sum)
    # shap_sum_log = sum(shap_values)
    # pred_log_shap = base_value_log + shap_sum_log
    # pred_inr_shap = np.exp(pred_log_shap)
    
    # We use the Model's actual prediction for "Pred_INR" to align with what the user sees.
    # But usually exp(base + sum(shap)) IS the prediction for TreeExplainer.
    
    pred_log_shap = base_value_log + sum(shap_values)
    pred_inr_shap = np.exp(pred_log_shap) 
    
    total_diff_log = pred_log_shap - base_value_log
    total_diff_inr = pred_inr_shap - base_inr
    
    if abs(total_diff_log) < 1e-9:
        # If prediction is basically baseline, use derivative at x (Scaling = Base)
        scaling_factor = base_inr
    else:
        scaling_factor = total_diff_inr / total_diff_log
        
    # 3. Convert to INR
    breakdown = []
    
    # Base
    breakdown.append({
        "label": "Base Medical Cost",
        "amount": round(base_inr, 2)
    })
    
    # Groups
    sorted_groups = sorted(group_log_shap.items(), key=lambda x: abs(x[1]), reverse=True)
    
    current_sum = base_inr
    
    for group, log_val in sorted_groups:
        inr_val = log_val * scaling_factor
        current_sum += inr_val
        breakdown.append({
            "label": group,
            "amount": round(inr_val, 2)
        })
        
    # 4. Final Adjustment (Floating Point Error)
    # The sum calculated this way: Base + Sum(Log * Scale) 
    # = Base + Scale * Sum(Log) = Base + (Diff_Inr/Diff_Log) * Diff_Log 
    # = Base + Diff_Inr = Base + (Pred - Base) = Pred.
    # So it sums exactly to pred_inr_shap.
    
    # We might have rounding errors for display.
    # We won't force-fix rounding on individual items, but standard round is fine.
    
    return breakdown

def shap_to_sentence(shap_values, feature_names):
    # Find most impactful GROUP
    group_log_shap = {}
    for feat, val in zip(feature_names, shap_values):
        group = GROUP_MAPPING.get(feat, "Other Factors")
        group_log_shap[group] = group_log_shap.get(group, 0.0) + abs(val) # Use Magnitude for importance
        
    if not group_log_shap:
        return None
        
    top_group = max(group_log_shap.items(), key=lambda x: x[1])[0]
    
    return (
        f"In general, healthcare costs are most influenced by your {top_group}. "
        f"This plays a major role in your cost calculation."
    )

def lime_to_sentence(lime_list, is_smoker):
    if not lime_list:
        return None
        
    # Rule 1: If smoker is 'yes', that is ALWAYS the main factor.
    if is_smoker:
        return (
            "Because you are a smoker, this is the single most dominant factor driving your costs higher, "
            "potentially increasing them by 3x-4x compared to non-smokers."
        )

    # Rule 2: If non-smoker, check the most important feature among BMI, Age, Children
    # lime_list is sorted by absolute weight by default.
    # We iterate and find the first one that matches our target keywords.
    
    found_driver = None
    
    for rule, weight in lime_list:
        # rule string example: "bmi > 30" or "age < 25"
        if "bmi" in rule:
            found_driver = "your Body Mass Index (BMI)"
            break
        elif "age" in rule:
            found_driver = "your age"
            break
        elif "children" in rule:
            found_driver = "number of dependents"
            break
            
    if not found_driver:
        # Fallback if none of the top features are the ones we want specific text for
        # (Though usually age/bmi are always top).
        mapped_group = "Personal Factors"
        raw_rule = lime_list[0][0]
        for feat, group in GROUP_MAPPING.items():
            if feat in raw_rule:
                mapped_group = group
                break
        
        return (
            f"For this specific profile, analyzing strictly local factors, "
            f"{mapped_group} is the primary driver."
        )
    
    return (
        f"For you specifically, {found_driver} is the most significant local factor "
        "influencing this prediction."
    )


# ---------------- REQUEST HANDLING ----------------
try:
    data = json.loads(sys.stdin.read())

    # hard validation
    if (
        data.get("age", 0) < 0
        or data.get("bmi", 0) < 0
        or data.get("children", 0) < 0
    ):
        print(json.dumps({
            "error": "Invalid input: negative values are not allowed"
        }), flush=True)
        sys.exit(0)

    # Check if explanations are requested (default: True for backward compatibility)
    include_explanations = data.get("include_explanations", True)

    X = preprocess(data)
    pool = Pool(X, cat_features=CAT_INDEXES)

    # Prediction is in log space now!
    log_prediction = float(model.predict(pool)[0])
    prediction = float(np.exp(log_prediction)) # Convert to linear space

    response = {
        "prediction": round(prediction, 2),
        "expected_cost": round(prediction, 2),
        "model": "catboost_log",
        "model_version": "catboost_log_v2"
    }

    # ---------------- DISTRIBUTIONAL PREDICTION (BUCKETED RESIDUALS) ----------------
    if quantile_models_loaded:
        try:
            # Re-derive categories from raw input to be safe for bucket lookup
            raw_smoker = str(data.get("smoker", "no")).strip().lower() # yes/no
            raw_bmi = float(data.get("bmi", 25))
            raw_age = float(data.get("age", 30))
            
            # Age Band
            if raw_age <= 25: age_s = "18-25"
            elif raw_age <= 35: age_s = "26-35"
            elif raw_age <= 50: age_s = "36-50"
            else: age_s = "50+"

            # BMI Cat
            if raw_bmi < 18.5: bmi_s = "underweight"
            elif raw_bmi < 25: bmi_s = "normal"
            elif raw_bmi < 30: bmi_s = "overweight"
            else: bmi_s = "obese"
            
            # Key
            bucket_key = f"{raw_smoker}_{bmi_s}_{age_s}"
            
            # Retrieve residuals or fallback
            if bucket_key in bucket_quantile_map:
                res = bucket_quantile_map[bucket_key]
                found_bucket = True
            else:
                res = global_quantile_map
                found_bucket = False
                
            # Log-Quantiles
            # res['p10'] is (log_true - log_pred). So log_true = log_pred + res
            log_p10 = log_prediction + res["p10"]
            log_p90 = log_prediction + res["p90"]
            log_p95 = log_prediction + res["p95"]
            
            # Transform back to linear
            pred_p10 = np.exp(log_p10)
            pred_p90 = np.exp(log_p90)
            pred_p95 = np.exp(log_p95)
            
            # ---------------- HARD MONOTONIC & LOGICAL GUARANTEE ----------------
            # Key Requirements:
            # 1. P10 < Mean < P90 < P95
            # 2. Prevent lower bound equaling prediction
            # 3. Worst-case must always exceed 80% upper bound
            
            epsilon = 0.01 * prediction  # Minimal margin (1%) to ensure strict inequality
            
            # 1. Enforce P10 < Mean
            # If data suggests P10 > Mean (underprediction pattern), we must clamp it for UI logic.
            # But "Uncertainty" usually implies a range AROUND the mean. 
            # If P10 residual is positive, the lower bound is > mean. We force it down.
            if pred_p10 >= prediction - epsilon:
                pred_p10 = prediction - epsilon

            # 2. Enforce P90 > Mean
            if pred_p90 <= prediction + epsilon:
                pred_p90 = prediction + epsilon

            # 3. Enforce P95 > P90
            if pred_p95 <= pred_p90 + epsilon:
                pred_p95 = pred_p90 + epsilon
            
            # 80% Range: [P10, P90]
            range_80 = [round(pred_p10, 2), round(pred_p90, 2)]
            
            # 95% Worst-Case: [P10, P95] (Frontend usually expects a range, P95 is the "Worst Case" upper bound)
            range_95 = [round(pred_p10, 2), round(pred_p95, 2)]
            
            # ---------------- UNCERTAINTY LEVEL ----------------
            # Defined by relative width: (P90 - P10) / Mean
            width = pred_p90 - pred_p10
            # Avoid division by zero
            ratio = width / prediction if prediction > 1e-6 else 0
            
            # User Specified Thresholds:
            # LOW < 0.6
            # MODERATE 0.6 - 1.2
            # HIGH > 1.2
            
            if ratio < 0.6:
                uncertainty_level = "low"
                interpretation = "High confidence (Low Variance). Predictable cost profile."
            elif ratio <= 1.2:
                uncertainty_level = "moderate"
                interpretation = "Moderate uncertainty. Some variability in potential costs."
            else:
                uncertainty_level = "high"
                interpretation = "High uncertainty. Significant risk of unexpected costs."
            
            response["range_80"] = range_80
            response["range_95"] = range_95
            response["uncertainty_level"] = uncertainty_level
            response["uncertainty_interpretation"] = interpretation
            response["debug_bucket"] = bucket_key if found_bucket else "global_fallback"
            
        except Exception as e:
            print(f"Warning: Distributional prediction failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

    # ---------------- SHAP (OPTIONAL) ----------------
    if include_explanations and shap_explainer is not None:
        try:
            shap_vals = shap_explainer.shap_values(X, check_additivity=False)[0]
            base_value_log = float(shap_explainer.expected_value)

            # Using new grouping and scaling logic for accurate money breakdown
            response["shap_money"] = get_shap_breakdown(
                shap_vals,
                base_value_log,
                prediction,
                ALL_COLS
            )
            response["shap_text"] = shap_to_sentence(shap_vals, ALL_COLS)
        except Exception as e:
            print(f"Warning: SHAP calculation failed: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc(file=sys.stderr)

    # ---------------- LIME (OPTIONAL) ----------------
    if include_explanations and lime_explainer is not None:
        try:
            def lime_predict_fn(arr):
                df = pd.DataFrame(arr, columns=NUM_COLS)
                return lime_proxy.predict(df)

            lime_exp = lime_explainer.explain_instance(
                X[NUM_COLS].iloc[0].values,
                lime_predict_fn,
                num_features=6
            )

            # Determine simple smoker status for rule logic
            is_smoker_bool = (str(data.get("smoker", "no")).strip().lower() == "yes")
            response["lime_text"] = lime_to_sentence(lime_exp.as_list(), is_smoker_bool)
        except Exception as e:
            print(f"Warning: LIME calculation failed: {e}", file=sys.stderr)

    print(json.dumps(response), flush=True)

except Exception:
    sys.stderr.write(traceback.format_exc())
    print(json.dumps({
        "error": "Prediction failed. Please try again with valid inputs."
    }), flush=True)
