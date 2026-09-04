"""
╔══════════════════════════════════════════════════════════════════════════════╗
║         ACCRAFLOOD — RANDOM FOREST FLOOD PREDICTION MODEL                  ║
║         Greater Accra Region, Ghana · 2026                                 ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Dataset  : accra_town_features.csv  (223 towns · 5 columns)               ║
║  Features : elevation_m · slope_deg · drainage_density                     ║
║  Target   : flood  (1 = flooded · 0 = not flooded)                         ║
║  Model    : Random Forest Classifier (class_weight='balanced')              ║
║  Priority : Recall — over-warn rather than miss a real flood                ║
║  Output   : flood_model.pkl  (serialised, ready to deploy)                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

DEPENDENCIES:
    pip install pandas numpy scikit-learn joblib

USAGE:
    python flood_model_train.py
"""

# ── IMPORTS ───────────────────────────────────────────────────────────────────
from pathlib import Path

import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings("ignore")

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_val_score,
    GridSearchCV
)
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    recall_score,
    precision_score,
    f1_score,
    ConfusionMatrixDisplay
)
from sklearn.preprocessing import StandardScaler
from sklearn.inspection import permutation_importance

# ── REPRODUCIBILITY ───────────────────────────────────────────────────────────
SEED = 42
np.random.seed(SEED)

print("=" * 65)
print("  ACCRAFLOOD · RANDOM FOREST FLOOD PREDICTION PIPELINE")
print("  Greater Accra Region, Ghana · 2026")
print("=" * 65)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — LOAD DATA
# ══════════════════════════════════════════════════════════════════════════════
print("\n📂  STEP 1 — Loading dataset...")

candidates = [
    #Path("accra_town_features.csv"),
    Path("accra_Features.csv")
]
CSV_PATH = next((p for p in candidates if p.exists()), candidates[0])

if not CSV_PATH.exists():
    raise FileNotFoundError(
        "No flood training CSV found. Expected one of: "
        "accra_town_features.csv or accra_Features.csv"
    )

df = pd.read_csv(CSV_PATH)

print(f"   ✓  {len(df)} towns loaded from {CSV_PATH}")
print(f"   ✓  Columns: {list(df.columns)}")
print(f"   ✓  Flooded (1): {df['flood'].sum()}  |  Not flooded (0): {(df['flood']==0).sum()}")
print(f"   ✓  Missing values: {df.isnull().sum().sum()}")

# Quick sanity check — flag if any nulls exist
if df.isnull().sum().sum() > 0:
    print("\n   ⚠️  Warning: nulls detected — dropping affected rows.")
    df = df.dropna()
    print(f"   ✓  Rows remaining after drop: {len(df)}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — EXPLORATORY SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print("\n📊  STEP 2 — Dataset summary:")
print()

summary = df.groupby('flood')[['elevation_m','slope_deg','drainage_density']].mean().round(3)
summary.index = ['Not Flooded (0)', 'Flooded (1)']
print(summary.to_string())
print()
print("   Feature ranges:")
print(df[['elevation_m','slope_deg','drainage_density']].describe().round(3).to_string())


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — DEFINE FEATURES & TARGET
# ══════════════════════════════════════════════════════════════════════════════
print("\n🔧  STEP 3 — Preparing features and target...")

FEATURES = ['elevation_m', 'slope_deg', 'drainage_density']
TARGET   = 'flood'

X = df[FEATURES]
y = df[TARGET]

print(f"   ✓  Features (X): {FEATURES}")
print(f"   ✓  Target   (y): '{TARGET}'")
print(f"   ✓  Dataset shape: {X.shape}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — TRAIN / TEST SPLIT
#   Stratified split preserves the flood / no-flood ratio in both sets
# ══════════════════════════════════════════════════════════════════════════════
print("\n✂️   STEP 4 — Train / test split (80 / 20 · stratified)...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size    = 0.20,
    random_state = SEED,
    stratify     = y          # keeps class balance in both sets
)

print(f"   ✓  Train set : {len(X_train)} towns  "
      f"(Flooded: {y_train.sum()} · Not: {(y_train==0).sum()})")
print(f"   ✓  Test set  : {len(X_test)}  towns  "
      f"(Flooded: {y_test.sum()} · Not: {(y_test==0).sum()})")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — BUILD THE MODEL
#
#   Random Forest Classifier — why these settings:
#
#   n_estimators     = 300   → more trees = more stable probability estimates
#   max_depth        = None  → trees grow fully — captures complex patterns
#   min_samples_leaf = 2     → prevents overfitting on small dataset
#   max_features     = 'sqrt'→ standard RF: random subset of features per split
#   class_weight     = 'balanced' → auto-upweights minority class (flooded=1)
#                                   this is the key lever for recall
#   random_state     = SEED  → reproducible results every run
#   n_jobs           = -1    → use all available CPU cores
# ══════════════════════════════════════════════════════════════════════════════
print("\n🌲  STEP 5 — Building Random Forest Classifier...")

model = RandomForestClassifier(
    n_estimators     = 300,
    max_depth        = None,
    min_samples_leaf = 2,
    max_features     = 'sqrt',
    class_weight     = 'balanced',   # ← KEY: maximises recall for flood class
    random_state     = SEED,
    n_jobs           = -1
)

model.fit(X_train, y_train)
print("   ✓  Model trained successfully")
print(f"   ✓  Number of trees  : {model.n_estimators}")
print(f"   ✓  Number of features: {model.n_features_in_}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — CROSS-VALIDATION
#   5-fold stratified CV — checks how well the model generalises
#   Scored on RECALL as the primary metric (not accuracy)
# ══════════════════════════════════════════════════════════════════════════════
print("\n🔁  STEP 6 — 5-Fold Stratified Cross-Validation...")

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

cv_recall    = cross_val_score(model, X, y, cv=cv, scoring='recall',    n_jobs=-1)
cv_precision = cross_val_score(model, X, y, cv=cv, scoring='precision', n_jobs=-1)
cv_f1        = cross_val_score(model, X, y, cv=cv, scoring='f1',        n_jobs=-1)
cv_roc       = cross_val_score(model, X, y, cv=cv, scoring='roc_auc',   n_jobs=-1)

print(f"\n   {'Metric':<18} {'Mean':>8}  {'Std':>8}  {'Per Fold'}")
print(f"   {'─'*70}")
print(f"   {'Recall':<18} {cv_recall.mean():>8.3f}  {cv_recall.std():>8.3f}  {np.round(cv_recall,3)}")
print(f"   {'Precision':<18} {cv_precision.mean():>8.3f}  {cv_precision.std():>8.3f}  {np.round(cv_precision,3)}")
print(f"   {'F1 Score':<18} {cv_f1.mean():>8.3f}  {cv_f1.std():>8.3f}  {np.round(cv_f1,3)}")
print(f"   {'ROC-AUC':<18} {cv_roc.mean():>8.3f}  {cv_roc.std():>8.3f}  {np.round(cv_roc,3)}")

if cv_recall.mean() >= 0.85:
    print(f"\n   ✅  Recall target met: {cv_recall.mean():.1%} ≥ 85%")
else:
    print(f"\n   ⚠️  Recall below target: {cv_recall.mean():.1%} — consider tuning")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — TEST SET EVALUATION
# ══════════════════════════════════════════════════════════════════════════════
print("\n📋  STEP 7 — Test set evaluation...")

y_pred = model.predict(X_test)
y_prob = model.predict_proba(X_test)[:, 1]   # probability of flood = 1

print("\n   Classification Report:")
print("   " + "─"*50)
report = classification_report(
    y_test, y_pred,
    target_names=['Not Flooded', 'Flooded'],
    digits=3
)
for line in report.split('\n'):
    print("   " + line)

# Confusion matrix
cm = confusion_matrix(y_test, y_pred)
TN, FP, FN, TP = cm.ravel()

print(f"\n   Confusion Matrix:")
print(f"   ┌─────────────────────────┐")
print(f"   │  TN = {TN:>3}  │  FP = {FP:>3}  │")
print(f"   │  FN = {FN:>3}  │  TP = {TP:>3}  │")
print(f"   └─────────────────────────┘")
print(f"\n   TN = True Negative  (correctly said NOT flooded)")
print(f"   FP = False Positive (wrongly warned — inconvenient but safe)")
print(f"   FN = False Negative (missed a real flood — ⚠️  dangerous)")
print(f"   TP = True Positive  (correctly identified flooded town)")

print(f"\n   Key Metrics (Test Set):")
print(f"   {'Recall':<22} {recall_score(y_test, y_pred):.3f}   ← priority metric")
print(f"   {'Precision':<22} {precision_score(y_test, y_pred):.3f}")
print(f"   {'F1 Score':<22} {f1_score(y_test, y_pred):.3f}")
print(f"   {'ROC-AUC':<22} {roc_auc_score(y_test, y_prob):.3f}")
print(f"   {'Missed Floods (FN)':<22} {FN}")
print(f"   {'False Alarms (FP)':<22} {FP}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — FEATURE IMPORTANCE
# ══════════════════════════════════════════════════════════════════════════════
print("\n📌  STEP 8 — Feature importance:")
print()

importances = pd.Series(
    model.feature_importances_,
    index=FEATURES
).sort_values(ascending=False)

for feat, score in importances.items():
    bar = '█' * int(score * 50)
    print(f"   {feat:<22} {score:.4f}  {bar}")

print(f"\n   → Most influential feature: {importances.idxmax()}")
print(f"   → Least influential feature: {importances.idxmin()}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — RISK LEVEL ASSIGNMENT
#   Maps probability scores to human-readable risk levels
# ══════════════════════════════════════════════════════════════════════════════
def assign_risk(prob):
    """
    Map flood probability (0–1) to a risk band.
    Bands:  Low      0.00 – 0.33
            Moderate 0.34 – 0.66
            High     0.67 – 1.00
    """
    if prob >= 0.67:
        return 'High'
    elif prob >= 0.34:
        return 'Moderate'
    else:
        return 'Low'

def plain_english(town, prob, elv, slope, drain):
    """
    Generate a plain-English flood risk explanation for any town.
    Written so any resident — not just technical users — can understand it.
    """
    risk  = assign_risk(prob)
    pct   = round(prob * 100)

    elv_note   = (f"{town} sits very close to sea level ({elv:.1f}m), "
                  f"meaning rainwater has nowhere to drain away."
                  if elv < 20
                  else f"The elevation here is {elv:.1f}m above sea level, "
                       f"providing some natural drainage advantage.")

    drain_note = (f"The drainage network is very dense ({drain:.3f} km/km²), "
                  f"which means drains can overflow rapidly in heavy rain."
                  if drain > 0.28
                  else f"Drainage density is relatively low ({drain:.3f} km/km²), "
                       f"so the drain network is not prone to rapid overflow.")

    slope_note = (f"The terrain is nearly flat ({slope:.1f}°), "
                  f"giving floodwater nowhere to flow."
                  if slope < 88
                  else f"The steep slope ({slope:.1f}°) helps channel "
                       f"water away from the area.")

    if risk == 'High':
        action = ("Residents should keep valuables off the floor, know their "
                  "nearest evacuation route, and monitor NADMO alerts closely "
                  "during rainy season.")
    elif risk == 'Moderate':
        action = ("Residents should stay alert during peak rainy season "
                  "(May–July and September–November) and ensure household "
                  "drainage is kept clear.")
    else:
        action = ("Flooding under normal rainfall is unlikely here. "
                  "Basic drainage maintenance remains good practice.")

    return (f"{town} has a {pct}% flood probability — {risk} Risk. "
            f"{elv_note} {drain_note} {slope_note} {action}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 10 — FULL PREDICTIONS ON ALL 223 TOWNS
# ══════════════════════════════════════════════════════════════════════════════
print("\n🏙️   STEP 10 — Generating predictions for all towns...")

all_probs = model.predict_proba(X)[:, 1]

results = df.copy()
results['flood_probability'] = np.round(all_probs, 4)
results['risk_level']        = results['flood_probability'].apply(assign_risk)
results['plain_english']     = results.apply(
    lambda r: plain_english(
        r['town'], r['flood_probability'],
        r['elevation_m'], r['slope_deg'], r['drainage_density']
    ), axis=1
)
results = results.sort_values('flood_probability', ascending=False).reset_index(drop=True)
results.index += 1

# Summary breakdown
risk_counts = results['risk_level'].value_counts()
print(f"\n   Risk Distribution across {len(results)} towns:")
for level in ['High','Moderate','Low']:
    count = risk_counts.get(level, 0)
    bar   = '█' * int(count / len(results) * 40)
    print(f"   {level:<10} {count:>4} towns  {bar}")

print(f"\n   TOP 15 HIGHEST RISK TOWNS:")
print(f"   {'#':<4} {'Town':<40} {'Prob':>6}  Risk")
print("   " + "─"*65)
for i, row in results.head(15).iterrows():
    flag = '🔴' if row.risk_level=='High' else '🟡' if row.risk_level=='Moderate' else '🟢'
    print(f"   {i:<4} {row.town:<40} {row.flood_probability:>5.1%}  {flag} {row.risk_level}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 11 — SAVE OUTPUTS
# ══════════════════════════════════════════════════════════════════════════════
print("\n💾  STEP 11 — Saving outputs...")

# Save trained model
MODEL_PATH = 'flood_model.pkl'
joblib.dump(model, MODEL_PATH)
print(f"   ✓  Model saved         → {MODEL_PATH}")

# Save full predictions CSV
PRED_PATH = 'flood_risk_predictions.csv'
results.to_csv(PRED_PATH)
print(f"   ✓  Predictions saved   → {PRED_PATH}")

# Save feature importances
IMP_PATH = 'feature_importances.csv'
importances.to_csv(IMP_PATH, header=['importance'])
print(f"   ✓  Feature importance  → {IMP_PATH}")


# ══════════════════════════════════════════════════════════════════════════════
# STEP 12 — RELOAD & VERIFY MODEL
# ══════════════════════════════════════════════════════════════════════════════
print("\n🔁  STEP 12 — Reload test (verifying saved model)...")

loaded_model = joblib.load(MODEL_PATH)

# Test on two example towns — one low, one high risk
test_cases = pd.DataFrame([
    {'elevation_m': 8.82,  'slope_deg': 89.95, 'drainage_density': 0.371,  'note': 'Low-lying coastal area'},
    {'elevation_m': 84.98, 'slope_deg': 89.98, 'drainage_density': 0.086,  'note': 'Elevated inland area'},
])

print(f"\n   {'Scenario':<30} {'P(flood)':>9}  Risk")
print("   " + "─"*55)
for _, row in test_cases.iterrows():
    features_in = pd.DataFrame([row[['elevation_m','slope_deg','drainage_density']]])
    prob        = loaded_model.predict_proba(features_in)[0][1]
    risk        = assign_risk(prob)
    flag        = '🔴' if risk=='High' else '🟡' if risk=='Moderate' else '🟢'
    print(f"   {row['note']:<30} {prob:>8.1%}  {flag} {risk}")

print("\n   ✅  Model loaded and verified successfully")


# ══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 65)
print("  PIPELINE COMPLETE — SUMMARY")
print("=" * 65)
print(f"  Dataset          : {CSV_PATH}  ({len(df)} towns)")
print(f"  Features         : {', '.join(FEATURES)}")
print(f"  Model            : Random Forest (n_estimators=300, balanced)")
print(f"  CV Recall        : {cv_recall.mean():.3f} ± {cv_recall.std():.3f}")
print(f"  CV ROC-AUC       : {cv_roc.mean():.3f} ± {cv_roc.std():.3f}")
print(f"  Test Recall      : {recall_score(y_test, y_pred):.3f}")
print(f"  Test ROC-AUC     : {roc_auc_score(y_test, y_prob):.3f}")
print(f"  Missed Floods    : {FN}")
print(f"  High Risk Towns  : {risk_counts.get('High',0)}")
print(f"  Moderate Risk    : {risk_counts.get('Moderate',0)}")
print(f"  Low Risk         : {risk_counts.get('Low',0)}")
print(f"  Model saved to   : {MODEL_PATH}")
print(f"  Predictions at   : {PRED_PATH}")
print("=" * 65)
