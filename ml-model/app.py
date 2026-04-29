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
client = MongoClient("mongodb://localhost:27017/")
db = client["ml_project"]
collection = db["results"]

@app.route("/")
def home():
    return "ML Backend Running ✅"
def load_data():
    dataset_path = os.path.join(
    os.path.dirname(__file__),
    "../dataset/eopen_final_strict_genderwise_country_dataset.csv"
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

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, Dense, Flatten
from sklearn.metrics import accuracy_score
import numpy as np

from sklearn.model_selection import StratifiedKFold

@app.route("/run-model", methods=["POST"])
def run_model():
    try:
        data = request.get_json()
        model_name = data["model"]

        X, y, feature_names = load_data()

        if model_name == "1D CNN":
            X_cnn = X.reshape((X.shape[0], X.shape[1], 1))
            skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            scores = []

            for train_idx, test_idx in skf.split(X, y):

                X_train, X_test = X_cnn[train_idx], X_cnn[test_idx]
                y_train, y_test = y[train_idx], y[test_idx]

                model = Sequential([
                    Conv1D(64, 3, activation='relu', input_shape=(X.shape[1], 1)),
                    Conv1D(128, 3, activation='relu'),
                    Flatten(),
                    Dense(128, activation='relu'),
                    Dense(64, activation='relu'),
                    Dense(1, activation='sigmoid')
        ])

                model.compile(
                    optimizer='adam',
                    loss='binary_crossentropy',
                    metrics=['accuracy']
        )

                model.fit(X_train, y_train, epochs=15, batch_size=16, verbose=0)

                y_pred = (model.predict(X_test) > 0.5).astype(int)
                acc = accuracy_score(y_test, y_pred)

                scores.append(acc)

            scores = np.array(scores)

            return jsonify({
                "training_accuracy": round(float(scores.max()), 4),
                "testing_accuracy": round(float(scores.mean()), 4),
                "cv_mean": round(float(scores.mean()), 4),
                "cv_std": round(float(scores.std()), 4),
                "cv_scores": list(np.round(scores, 4)),
                "tree_image": None,
                "cv_image": None,
                "anova_image": None
            })

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, stratify=y, random_state=42
        )

        if model_name == "Decision Tree":
            model = DecisionTreeClassifier(max_depth=4, random_state=42)

        elif model_name == "Random Forest":
            model = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)

        elif model_name == "LGBM":
            model = lgb.LGBMClassifier(n_estimators=100, learning_rate=0.1, random_state=42)

        else:
            return jsonify({"error": "Invalid model"})
        model.fit(X_train, y_train)

        train_accuracy = model.score(X_train, y_train)
        test_accuracy = model.score(X_test, y_test)
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X, y, cv=kf)
        tree_image = None
        try:
            fig, ax = plt.subplots(figsize=(20, 10))

            if model_name == "Decision Tree":
                tree.plot_tree(model, feature_names=feature_names, filled=True, ax=ax)

            elif model_name == "Random Forest":
                tree.plot_tree(model.estimators_[0], feature_names=feature_names, filled=True, ax=ax)

            elif model_name == "LGBM":
                lgb.plot_tree(model.booster_, tree_index=0, ax=ax)

            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            tree_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()

        except Exception as e:
            print("Tree error:", e)
        cv_image = None
        try:
            fig, ax = plt.subplots()

            ax.plot(range(1, 6), cv_scores, marker='o')
            ax.axhline(cv_scores.mean(), linestyle='--')

            ax.set_title(f"{model_name} K-Fold")
            ax.set_xlabel("Fold")
            ax.set_ylabel("Accuracy")

            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            cv_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()

        except Exception as e:
            print("CV error:", e)

        anova_image = None
        try:
            from sklearn.feature_selection import f_classif

            F, _ = f_classif(X, y)

            fig, ax = plt.subplots()
            ax.bar(range(len(F)), F)
            ax.set_title("ANOVA Feature Scores")

            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            anova_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()

        except Exception as e:
            print("ANOVA error:", e)

        return jsonify({
            "training_accuracy": round(train_accuracy, 4),
            "testing_accuracy": round(test_accuracy, 4),
            "cv_mean": round(cv_scores.mean(), 4),
            "cv_std": round(cv_scores.std(), 4),
            "cv_scores": cv_scores.tolist(),
            "tree_image": tree_image,
            "cv_image": cv_image,
            "anova_image": anova_image
        })

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"error": str(e)})
def cnn_kfold(X, y):
    from sklearn.model_selection import StratifiedKFold
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Conv1D, Dense, Flatten
    from sklearn.metrics import accuracy_score
    import numpy as np

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = []

    X_cnn = X.reshape((X.shape[0], X.shape[1], 1))

    for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
        print(f"Running CNN Fold {fold+1}")  # 🔥 DEBUG

        X_train, X_test = X_cnn[train_idx], X_cnn[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        model = Sequential([
            Conv1D(64, 3, activation='relu', input_shape=(X.shape[1], 1)),
            Flatten(),
            Dense(64, activation='relu'),
            Dense(1, activation='sigmoid')
        ])

        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        model.fit(X_train, y_train, epochs=10, batch_size=16, verbose=0)

        y_pred = (model.predict(X_test) > 0.5).astype(int)
        acc = accuracy_score(y_test, y_pred)

        print("Fold Accuracy:", acc)  # 🔥 DEBUG

        scores.append(acc)

    print("CNN Scores:", scores)  # 🔥 DEBUG

    return np.array(scores)
@app.route("/anova", methods=["GET"])
def anova_test():
    try:
        X, y, _ = load_data()

        models = {
            "Decision Tree": DecisionTreeClassifier(max_depth=5),
            "Random Forest": RandomForestClassifier(n_estimators=100),
            "LGBM": lgb.LGBMClassifier()
        }

        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

        results = []
        kf_dict = {}
        skf_dict = {}

        # ===== ML MODELS =====
        for name, model in models.items():
            kf_scores = cross_val_score(model, X, y, cv=kf)
            skf_scores = cross_val_score(model, X, y, cv=skf)

            kf_dict[name] = kf_scores
            skf_dict[name] = skf_scores

            results.append({
                "cv_type": "Traditional K-Fold",
                "model": name,
                "mean": round(kf_scores.mean(), 4),
                "std": round(kf_scores.std(), 4)
            })

            results.append({
                "cv_type": "Stratified K-Fold",
                "model": name,
                "mean": round(skf_scores.mean(), 4),
                "std": round(skf_scores.std(), 4)
            })

        # ===== CNN =====
        try:
            cnn_scores = cnn_kfold(X, y)

            kf_dict["1D CNN"] = cnn_scores
            skf_dict["1D CNN"] = cnn_scores

            results.append({
                "cv_type": "Traditional K-Fold",
                "model": "1D CNN",
                "mean": round(float(cnn_scores.mean()), 4),
                "std": round(float(cnn_scores.std()), 4)
            })

            results.append({
                "cv_type": "Stratified K-Fold",
                "model": "1D CNN",
                "mean": round(float(cnn_scores.mean()), 4),
                "std": round(float(cnn_scores.std()), 4)
            })

        except Exception as e:
            print("❌ CNN ERROR:", e)

        # ===== ANOVA =====
        f_kf, p_kf = f_oneway(*kf_dict.values())
        f_skf, p_skf = f_oneway(*skf_dict.values())

        return jsonify({
            "results": results,
            "anova": {
                "kfold": {
                    "f": round(f_kf, 3),
                    "p": round(p_kf, 3),
                    "df": len(kf_dict) - 1
                },
                "stratified": {
                    "f": round(f_skf, 3),
                    "p": round(p_skf, 3),
                    "df": len(skf_dict) - 1
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

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

X, y, _ = load_data()

_, X_test, _, y_test = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42
)

try:
    dt = joblib.load("dt_model.pkl")
    rf = joblib.load("rf_model.pkl")
    lgbm = joblib.load("lgbm_model.pkl")
except:
    dt = rf = lgbm = None

@app.route("/hybrid-results", methods=["GET"])
def hybrid_results():
    try:
        # Ensure models are loaded
        if dt is None or rf is None or lgbm is None:
            return jsonify({"error": "Models not loaded"})

        # ML predictions
        dt_pred = dt.predict(X_test)
        rf_pred = rf.predict(X_test)
        lgb_pred = lgbm.predict(X_test)

        # ================= CNN PREDICTION =================
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import Conv1D, Dense, Flatten

        X_cnn = X_test.reshape((X_test.shape[0], X_test.shape[1], 1))

        model = Sequential([
            Conv1D(64, 3, activation='relu', input_shape=(X_test.shape[1], 1)),
            Flatten(),
            Dense(64, activation='relu'),
            Dense(1, activation='sigmoid')
        ])

        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

        # ⚠️ Quick training (you can improve later)
        model.fit(X_cnn, y_test, epochs=5, batch_size=16, verbose=0)

        cnn_pred = (model.predict(X_cnn) > 0.5).astype(int).flatten()

        # ================= HYBRID =================
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
        print("❌ HYBRID ERROR:", e)
        return jsonify({"error": str(e)})
@app.route("/upload", methods=["POST"])
def upload():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]

        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400

        os.makedirs("uploads", exist_ok=True)

        filepath = os.path.join("uploads", file.filename)
        file.save(filepath)

        print("✅ File saved at:", filepath)

        return jsonify({
            "message": "File uploaded successfully",
            "filename": file.filename
        })

    except Exception as e:
        print("❌ Upload Error:", e)
        return jsonify({"error": str(e)}), 500
# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)