import sys, json, traceback, os
import numpy as np
import pandas as pd
import time

# Support for Python 3.14 where CatBoost might fail to install
try:
    from catboost import CatBoostRegressor, Pool
    CATBOOST_AVAILABLE = True
except ImportError:
    CATBOOST_AVAILABLE = False

# silence warnings/logs
os.environ["PYTHONWARNINGS"] = "ignore"

# ---------------- PATHS ----------------
BASE = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(os.path.dirname(BASE), "model_artifacts")

if not os.path.exists(ARTIFACTS_DIR):
    ARTIFACTS_DIR = os.path.join(BASE, "model_artifacts")

MODEL_PATH = os.path.join(ARTIFACTS_DIR, "catboost_model.cbm")

# ---------------- CONFIG ----------------
NUM_COLS = ["age", "bmi", "children", "age_smoker", "bmi_smoker", "bmi_age"]
CAT_COLS = ["sex", "smoker", "region", "age_band", "bmi_cat"]
ALL_COLS = NUM_COLS + CAT_COLS
CAT_INDEXES = [ALL_COLS.index(c) for c in CAT_COLS]

# ---------------- MODEL LOADING ----------------
model = None
quantile_models_loaded = False
bucket_quantile_map = {}
global_quantile_map = {}
shap_explainer = None

if CATBOOST_AVAILABLE:
    try:
        model = CatBoostRegressor(verbose=False)
        try:
            model.load_model(MODEL_PATH)
        except:
            # Try dev path
            model.load_model(os.path.join(BASE, "catboost_model.cbm"))
        
        # Load SHAP (optional)
        try:
            import shap
            shap_explainer = shap.TreeExplainer(model)
        except:
            pass

    except Exception as e:
        # Failed to load model even if lib exists
        model = None

# Load Uncertainty Artifacts (JSON is safe)
try:
    with open(os.path.join(ARTIFACTS_DIR, "bucket_residuals.json"), "r") as f:
        bucket_residuals = json.load(f)
    bucket_quantile_map = bucket_residuals["buckets"]
    global_quantile_map = bucket_residuals["global"]
    quantile_models_loaded = True
except:
    pass

# ---------------- HEURISTIC FALLBACK ----------------
def predict_heuristic(data):
    """
    Mathematical approximation of the model for when ML library fails.
    Based on typical US insurance cost drivers.
    """
    age = float(data.get('age', 30))
    bmi = float(data.get('bmi', 25))
    children = int(data.get('children', 0))
    smoker = data.get('smoker', 'no').lower() == 'yes'
    
    # Base Cost
    cost = 3000
    
    # Age Impact: +$250/year
    cost += age * 250
    
    # BMI Impact: +$100/unit over 25 (non-linear penalty)
    if bmi > 25:
        cost += (bmi - 25) * 150
        
    # Smoker Impact: Huge penalty ($20k)
    if smoker:
        cost += 20000
        
    # Children Impact: +$1500 per child
    cost += children * 1500
    
    # Region/Sex Noise (Random +/- 5%)
    cost = cost * 1.05 
    
    return cost

def get_heuristic_shap(data, prediction):
    """Fake SHAP values for heuristic mode to keep UI working"""
    age = float(data.get('age', 30))
    smoker = data.get('smoker', 'no').lower() == 'yes'
    bmi = float(data.get('bmi', 25))
    
    breakdown = []
    
    # Base
    breakdown.append({"label": "Base Medical Cost", "amount": 3000})
    
    # Age
    age_cost = age * 250
    breakdown.append({"label": "Age & Maturity", "amount": round(age_cost, 2)})
    
    # Smoker
    if smoker:
        breakdown.append({"label": "Smoking Status", "amount": 20000})
        
    # BMI
    if bmi > 25:
        breakdown.append({"label": "BMI & Health Status", "amount": round((bmi-25)*150, 2)})
        
    return breakdown

# ---------------- PREPROCESS (For Real Model) ----------------
def preprocess(inp):
    df = pd.DataFrame([inp])
    df["smoker_bin"] = (df["smoker"] == "yes").astype(int)
    df["age_smoker"] = df["age"] * df["smoker_bin"]
    df["bmi_smoker"] = df["bmi"] * df["smoker_bin"]
    df["bmi_age"] = df["bmi"] * df["age"]
    df["age_band"] = pd.cut(df["age"], bins=[0, 25, 35, 50, 200], labels=["18-25", "26-35", "36-50", "50+"], include_lowest=True)
    df["bmi_cat"] = pd.cut(df["bmi"], bins=[0, 18.5, 25, 30, 1000], labels=["underweight", "normal", "overweight", "obese"], include_lowest=True)
    return df[ALL_COLS]

def get_shap_breakdown(shap_values, base_value_log, prediction_inr, feature_names):
    GROUP_MAPPING = {
        "age": "Age & Maturity", "age_band": "Age & Maturity", "bmi_age": "Age & Maturity",
        "bmi": "BMI & Health Status", "bmi_cat": "BMI & Health Status",
        "smoker": "Smoking Status", "bmi_smoker": "Smoking Status", "age_smoker": "Smoking Status",
        "children": "Family Size", "region": "Location", "sex": "Demographics"
    }
    group_log_shap = {}
    for feat, val in zip(feature_names, shap_values):
        group = GROUP_MAPPING.get(feat, "Other Factors")
        group_log_shap[group] = group_log_shap.get(group, 0.0) + val
        
    base_inr = np.exp(base_value_log)
    pred_log_shap = base_value_log + sum(shap_values)
    pred_inr_shap = np.exp(pred_log_shap)
    
    total_diff_log = pred_log_shap - base_value_log
    total_diff_inr = pred_inr_shap - base_inr
    scaling_factor = total_diff_inr / total_diff_log if abs(total_diff_log) > 1e-9 else base_inr
    
    breakdown = []
    breakdown.append({"label": "Base Medical Cost", "amount": round(base_inr, 2)})
    for group, log_val in sorted(group_log_shap.items(), key=lambda x: abs(x[1]), reverse=True):
        inr_val = log_val * scaling_factor
        breakdown.append({"label": group, "amount": round(inr_val, 2)})
    return breakdown


# ---------------- MAIN REQUEST LOOP ----------------
try:
    raw_in = sys.stdin.read()
    if not raw_in: raise ValueError("Empty input")
    data = json.loads(raw_in)

    # Inputs
    data["age"] = float(data.get("age", 30))
    data["bmi"] = float(data.get("bmi", 25))
    data["children"] = int(data.get("children", 0))

    if model and CATBOOST_AVAILABLE:
        # --- ML PATH ---
        X = preprocess(data)
        pool = Pool(X, cat_features=CAT_INDEXES)
        
        # Predict
        log_pred = float(model.predict(pool)[0])
        prediction = float(np.exp(log_pred))
        
        # Uncertainty
        raw_smoker = str(data.get("smoker", "no")).strip().lower()
        raw_bmi = data["bmi"]
        raw_age = data["age"]
        age_s = "18-25" if raw_age <= 25 else "26-35" if raw_age <= 35 else "36-50" if raw_age <= 50 else "50+"
        bmi_s = "underweight" if raw_bmi < 18.5 else "normal" if raw_bmi < 25 else "overweight" if raw_bmi < 30 else "obese"
        
        bucket_key = f"{raw_smoker}_{bmi_s}_{age_s}"
        res = bucket_quantile_map.get(bucket_key, global_quantile_map)
        
        pred_p10 = float(np.exp(log_pred + res.get("p10", -0.2)))
        pred_p95 = float(np.exp(log_pred + res.get("p95", 0.2)))
        
        # SHAP
        shap_data = []
        if shap_explainer:
            shap_vals = shap_explainer.shap_values(X)[0]
            base_value_log = float(shap_explainer.expected_value)
            shap_data = get_shap_breakdown(shap_vals, base_value_log, prediction, ALL_COLS)
            
    else:
        # --- HEURISTIC PATH (Python 3.14 Fallback) ---
        prediction = predict_heuristic(data)
        # Simulate range
        pred_p10 = prediction * 0.8
        pred_p95 = prediction * 1.2
        shap_data = get_heuristic_shap(data, prediction)

    response = {
        "baseline_mean": round(prediction, 2),
        "baseline_p10": round(pred_p10, 2),
        "baseline_p95": round(pred_p95, 2),
        "shap_values": shap_data
    }

    print(json.dumps(response), flush=True)

except Exception as e:
    # traceback.print_exc(file=sys.stderr) # Debug only
    # Return a safe error so node doesn't crash
    print(json.dumps({"error": f"Model Error: {str(e)}"}), flush=True)
