from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import base64
from io import BytesIO
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn import tree

from sklearn.model_selection import train_test_split, KFold, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import lightgbm as lgb

from imblearn.over_sampling import RandomOverSampler
from pymongo import MongoClient
from scipy.stats import f_oneway

app = Flask(__name__)
CORS(app)

# ===============================
# MongoDB
# ===============================
client = MongoClient("mongodb://localhost:27017/")
db = client["ml_project"]
collection = db["results"]

@app.route("/")
def home():
    return "ML Backend Running ✅"

# ===============================
# LOAD DATA
# ===============================
def load_data():
    dataset_path = os.path.join(
        os.path.dirname(__file__),
        "..",
        "dataset",
        "eopen_final_strict_genderwise_country_dataset.csv"
    )

    df = pd.read_csv(dataset_path)

    df["Gender"] = df["Gender"].map({"Male": 0, "Female": 1})
    df["Country"] = df["Country"].astype("category").cat.codes
    df["Academic_Degree"] = df["Academic_Degree"].astype("category").cat.codes

    X = df.drop("Gender", axis=1)
    y = df["Gender"]

    scaler = StandardScaler()
    X = scaler.fit_transform(X)

    ros = RandomOverSampler(random_state=42)
    X, y = ros.fit_resample(X, y)

    return X, y, df.columns[:-1]

# ===============================
# RUN MODEL
# ===============================
@app.route("/run-model", methods=["POST"])
def run_model():
    try:
        data = request.get_json()
        model_name = data["model"]

        X, y, feature_names = load_data()

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, stratify=y, random_state=42
        )

        tree_image = None

        # ================= MODEL SELECT =================
        if model_name == "Decision Tree":
            model = DecisionTreeClassifier(max_depth=4, random_state=42)

        elif model_name == "Random Forest":
            model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)

        elif model_name == "LGBM":
            model = lgb.LGBMClassifier(n_estimators=80, max_depth=4)
        
        elif model_name == "1D CNN":
            import tensorflow as tf

            cnn_model = tf.keras.models.load_model("cnn_model.h5")

            # reshape for CNN
            X_train_cnn = X_train.reshape(X_train.shape[0], X_train.shape[1], 1)
            X_test_cnn = X_test.reshape(X_test.shape[0], X_test.shape[1], 1)

            train_acc = cnn_model.evaluate(X_train_cnn, y_train, verbose=0)[1]
            test_acc = cnn_model.evaluate(X_test_cnn, y_test, verbose=0)[1]

            return jsonify({
                "training_accuracy": round(train_acc, 4),
                "testing_accuracy": round(test_acc, 4),
                "cv_mean": 0,
                "cv_std": 0,
                "cv_scores": [],
                "anova_models": [],
                "top_features": [],
                "tree_image": None
            })

        else:
            return jsonify({"error": "Invalid model"})

        # ================= TRAIN =================
        model.fit(X_train, y_train)

        train_accuracy = model.score(X_train, y_train)
        test_accuracy = model.score(X_test, y_test)

        # ================= 🔥 CROSS VALIDATION =================
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

        kf_scores = cross_val_score(model, X, y, cv=kf)
        skf_scores = cross_val_score(model, X, y, cv=skf)

        # 👉 STORE BOTH TYPES (IMPORTANT)
        anova_models = [
            {
                "cv_type": "Traditional K-Fold",
                "model": model_name,
                "mean": float(kf_scores.mean()),
                "std": float(kf_scores.std())
            },
            {
                "cv_type": "Stratified K-Fold",
                "model": model_name,
                "mean": float(skf_scores.mean()),
                "std": float(skf_scores.std())
            }
        ]

        # ================= FEATURE IMPORTANCE =================
        importances = model.feature_importances_
        top_features = sorted(
            list(zip(feature_names, importances)),
            key=lambda x: x[1],
            reverse=True
        )[:5]

        # ================= TREE VISUAL =================
        fig = plt.figure(figsize=(12, 8))

        if model_name == "Decision Tree":
            tree.plot_tree(model, feature_names=feature_names, filled=True)
        elif model_name == "Random Forest":
            tree.plot_tree(model.estimators_[0], feature_names=feature_names, filled=True)
        else:
            lgb.plot_tree(model, tree_index=0)

        buf = BytesIO()
        plt.savefig(buf, format="png")
        plt.close(fig)
        buf.seek(0)
        tree_image = base64.b64encode(buf.getvalue()).decode("utf-8")

        result = {
            "model": model_name,
            "training_accuracy": float(train_accuracy),
            "testing_accuracy": float(test_accuracy),
            "kf_mean": float(kf_scores.mean()),
            "kf_std": float(kf_scores.std()),
            "skf_mean": float(skf_scores.mean()),
            "skf_std": float(skf_scores.std()),
            "timestamp": datetime.now()
        }

        collection.insert_one(result)

        # ================= RESPONSE =================
        return jsonify({
            "training_accuracy": round(train_accuracy, 4),
            "testing_accuracy": round(test_accuracy, 4),
            "cv_mean": round(kf_scores.mean(), 4),
            "cv_std": round(kf_scores.std(), 4),
            "cv_scores": kf_scores.tolist(),
            "anova_models": anova_models,
            "top_features": [(f, float(v)) for f, v in top_features],
            "tree_image": tree_image
        })

    except Exception as e:
        print("❌ ERROR:", str(e))
        return jsonify({"error": str(e)})

@app.route("/anova", methods=["GET"])
def anova_test():
    try:
        X, y, _ = load_data()

        models = {
            "Decision Tree": DecisionTreeClassifier(max_depth=4),
            "Random Forest": RandomForestClassifier(n_estimators=100),
            "LGBM": lgb.LGBMClassifier()
        }

        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

        results = []

        # store separately
        kf_dict = {}
        skf_dict = {}

        # ================= RUN MODELS =================
        for name, model in models.items():
            kf_scores = cross_val_score(model, X, y, cv=kf)
            skf_scores = cross_val_score(model, X, y, cv=skf)

            # store scores for ANOVA
            kf_dict[name] = kf_scores
            skf_dict[name] = skf_scores

            # store table results
            results.append({
                "cv_type": "Traditional K-Fold",
                "model": name,
                "mean": float(kf_scores.mean()),
                "std": float(kf_scores.std())
            })

            results.append({
                "cv_type": "Stratified K-Fold",
                "model": name,
                "mean": float(skf_scores.mean()),
                "std": float(skf_scores.std())
            })

        # ================= 🔥 ANOVA SEPARATE =================

        # K-FOLD ANOVA
        f_kf, p_kf = f_oneway(
            kf_dict["Decision Tree"],
            kf_dict["Random Forest"],
            kf_dict["LGBM"]
        )

        # STRATIFIED ANOVA
        f_skf, p_skf = f_oneway(
            skf_dict["Decision Tree"],
            skf_dict["Random Forest"],
            skf_dict["LGBM"]
        )

        return jsonify({
            "results": results,

            "anova": {
                "kfold": {
                    "f": round(f_kf, 3),
                    "p": round(p_kf, 3),
                    "df": 2
                },
                "stratified": {
                    "f": round(f_skf, 3),
                    "p": round(p_skf, 3),
                    "df": 3
                }
            }
        })

    except Exception as e:
        print("❌ ANOVA ERROR:", str(e))
        return jsonify({"error": str(e)})
# ===============================
# CLEAR
# ===============================
@app.route("/clear-results", methods=["DELETE"])
def clear_results():
    collection.delete_many({})
    return jsonify({"message": "Cleared"})
# ===============================
# 🔥 HYBRID MODEL ONLY
# ===============================

from flask import  jsonify
import numpy as np
import joblib
import tensorflow as tf

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score



# ===============================
# LOAD DATA (your existing function)
# ===============================
X, y, _ = load_data()

_, X_test, _, y_test = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42
)

# ===============================
# LOAD MODELS (ONCE)
# ===============================
dt = joblib.load("dt_model.pkl")
rf = joblib.load("rf_model.pkl")
lgbm = joblib.load("lgbm_model.pkl")
cnn = tf.keras.models.load_model("cnn_model.h5")

# ===============================
# HYBRID API
# ===============================
@app.route("/hybrid-results", methods=["GET"])
def hybrid_results():
    try:
        dt_pred = dt.predict(X_test)
        rf_pred = rf.predict(X_test)
        lgb_pred = lgbm.predict(X_test)
        cnn_pred = (cnn.predict(X_test) > 0.5).astype(int).flatten()

        hybrid_pred = (
            (0.4 * rf_pred) +
            (0.3 * lgb_pred) +
            (0.3 * cnn_pred)
        ) > 0.5

        hybrid_pred = hybrid_pred.astype(int)

        acc = accuracy_score(y_test, hybrid_pred)

        return jsonify({
            "final_accuracy": round(acc * 100, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)