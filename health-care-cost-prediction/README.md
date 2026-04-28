# AI-Based Transparent Healthcare Cost Prediction System

![System Status](https://img.shields.io/badge/Status-Active-success) ![Node Version](https://img.shields.io/badge/Node-v16%2B-green) ![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue) ![License](https://img.shields.io/badge/License-MIT-orange)

##  Project Overview

The **Healthcare Cost Prediction System** is a production-ready, full-stack Artificial Intelligence application designed to estimate future medical expenses with high accuracy, transparency, and honesty. 

In an industry where "black box" algorithms often dictate pricing without explanation, this system stands out by prioritizing **Explainable AI (XAI)** and **Uncertainty Quantification**. It doesn't just give you a number; it tells you *why* that number was predicted, *how sure* the model is, and *what* you can do to lower it.

###  Why This Matters?
*   **For Patients:** Plan finances better and understand how lifestyle choices impact wallet.
*   **For Insurers:** Assess risk with granular confidence intervals.
*   **For Providers:** Increase trust by transparently verifying cost estimates.

---

##  Key Features

### 1. Advanced AI Prediction (CatBoost)
*   **Algorithm:** Uses **CatBoost Regressor**, a state-of-the-art Gradient Boosting algorithm known for handling categorical data (Smoker, Region) exceptionally well.
*   **Log-Space Optimization:** The model trains on log-transformed targets ($log(y)$) to effectively handle the right-skewed nature of healthcare costs (where a few expensive treatments drive up distinct averages).

### 2. Cohort-Aware Uncertainty Quantification
*   **Beyond Point Estimates:** Most models only output a mean. Our system provides a full probability distribution.
*   **Dynamic Confidence Intervals:**
    *   **Low Risk (Healthy):** Narrow range (e.g., $4,000 - $5,000).
    *   **High Risk (Smoker/Obese):** Wide range (e.g., $20,000 - $45,000) reflecting true volatility.
*   **Methodology:** Identified risk cohorts (Age × BMI × Smoker) and applied **Residual Bucketing** to calculate P10 and P90 error bounds specific to each group.

### 3.  Explainable AI (XAI)
*   **SHAP (SHapley Additive exPlanations):** Breaks down the final prediction into dollar amounts.
    *   *Example:* "Being a smoker added +$12,000 to your estimate."
*   **LIME (Local Interpretable Model-agnostic Explanations):** providing simple, logic-based rules for the prediction.

### 4.  Interactive "What-If" Simulator
*   **Counterfactual Analysis:** A powerful tool enabling users to simulate health changes.
*   **Instant Feedback:**
    *   "What if I quit smoking?" → **Save $23,400/year**.
    *   "What if I reduce my BMI to 24?" → **Save $5,200/year**.
*   **Goal Setting:** Encourages preventative healthcare through financial incentives.

### 5.  Enterprise-Grade Admin Portal
*   **Role-Based Access Control (RBAC):** Secure admin login and protected routes.
*   **Real-Time Analytics Dashboard**:
    *   **Bias Monitoring**: Automatically detects if the model is underpredicting for specific ages, genders, or BMI groups.
    *   **Feedback Loop**: Compares `Predicted` vs. `Actual` costs from user feedback to track model drift.
    *   **Data Export**: Download verified feedback data as CSV for model retraining.

---

##  System Architecture

### High-Level Design
The system follows a microservices-inspired architecture:

```mermaid
graph TD
    User[Clients (Browser)] -->|HTTP/JSON| FE[React + Vite Frontend]
    FE -->|REST API| BE[Node.js + Express Backend]
    
    subgraph "Application Server"
        BE -->|Auth & Data| DB[(MongoDB)]
        BE -->|Spawn Process| Py[Python Inference Engine]
    end
    
    subgraph "ML Core"
        Py -->|Load| Model[CatBoost .cbm]
        Py -->|Load| Scalers[Joblib Artifacts]
        Py -->|Compute| SHAP[SHAP Explainer]
    end
    
    Py -->|Prediction + Uncertainty| BE
    BE -->|Response| FE
```

### Technology Stack
*   **Frontend:** React 18, TailwindCSS, Chart.js, Framer Motion.
*   **Backend:** Node.js, Express, Mongoose (MongoDB ODM), JSON Web Tokens (JWT).
*   **Data Science:** Python 3.9, Pandas, NumPy, Scikit-learn, CatBoost, SHAP.
*   **DevOps:** Concurrently (to run full stack), ESLint.

---

##  Installation & Setup

### Prerequisites
*   **Node.js** (v16.14.0 or higher)
*   **Python** (v3.8 or higher)
*   **MongoDB** (Local instance or Atlas URI)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/healthcare-cost-prediction.git
cd healthcare_app_v2
```

### 2. Backend Setup
The backend orchestrates the application and manages the database connection.

```bash
cd backend

# Install dependencies
npm install

# Start the server (runs on port 5000)
node server.js
```
> **Note:** Ensure MongoDB is running locally on `mongodb://localhost:27017/newDB` or update the connection string in `server.js`.

### 3. Python Environment Setup
The backend spawns a Python process for inference. You need to install the ML dependencies.

```bash
# From the project root or backend folder
pip install pandas numpy scikit-learn catboost joblib shull shap
```
*Verify that `model_artifacts/` contains `catboost_model.cbm` and relevant `.joblib` files.*

### 4. Frontend Setup
The frontend provides the user interface.

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

##  API Documentation

### Authentication
*   `POST /auth/register`: Create a new user account.
*   `POST /auth/login`: Authenticate and receive a JWT.

### Predictions
*   `POST /predict`: Submit patient data and receive cost estimate + uncertainty + explanations.
    *   *Headers:* `Authorization: Bearer <token>`
    *   *Body:* `{ age, sex, bmi, children, smoker, region }`
*   `GET /predictions/my`: Retrieve history of past predictions for the logged-in user.

### Simulation
*   `POST /what-if`: Submit baseline and modified inputs to calculate potential savings.

### Admin & Analytics (Admin Role Only)
*   `GET /admin/users`: List all registered users.
*   `GET /analytics/errors`: Get aggregated error metrics (MAE, MAPE).
*   `GET /analytics/bias`: Get bias reports grouped by demographic.
*   `GET /export/training-data`: Download feedback data as CSV.

---

##  Future Roadmap

### Short Term (Q1 2026)
- [ ] **Automated Retraining Pipeline:** specific cron jobs to retrain the model nightly using exported feedback data.
- [ ] **PDF Report Generation:** Generate signed, downloadable PDF estimates for insurance pre-approval.

---

