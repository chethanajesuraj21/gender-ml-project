from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import os
import base64
from io import BytesIO

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
from scipy.stats import f_oneway
import numpy as np
import joblib

app = Flask(__name__)

CORS(app, origins=[
    "http://localhost:3000",
    os.environ.get("FRONTEND_URL", "https://your-vercel-app.vercel.app")
])


def load_data():
    dataset_path = os.path.join(
        os.path.dirname(__file__),
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

    return X, y, df.drop("Gender", axis=1).columns


try:
    _X, _y, _ = load_data()
    _, X_test_global, _, y_test_global = train_test_split(
        _X, _y, test_size=0.3, stratify=_y, random_state=42
    )
    X_train_global = _X[:len(_X) - len(X_test_global)]
    y_train_global = _y[:len(_y) - len(y_test_global)]

    dt_model   = joblib.load(os.path.join(os.path.dirname(__file__), "dt_model.pkl"))
    rf_model   = joblib.load(os.path.join(os.path.dirname(__file__), "rf_model.pkl"))
    lgbm_model = joblib.load(os.path.join(os.path.dirname(__file__), "lgbm_model.pkl"))
    print("✅ Models loaded")
except Exception as e:
    print(f"⚠️ Startup warning: {e}")
    X_test_global = y_test_global = None
    X_train_global = y_train_global = None
    dt_model = rf_model = lgbm_model = None


@app.route("/")
def home():
    return "ML Backend Running ✅"


def cnn_kfold(X, y):
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import Conv1D, Dense, Flatten
    from sklearn.metrics import accuracy_score

    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scores = []
    X_cnn = X.reshape((X.shape[0], X.shape[1], 1))

    for fold, (train_idx, test_idx) in enumerate(skf.split(X, y)):
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
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        model.fit(X_train, y_train, epochs=15, batch_size=16, verbose=0)

        y_pred = (model.predict(X_test) > 0.5).astype(int)
        scores.append(accuracy_score(y_test, y_pred))

    return np.array(scores)


@app.route("/run-model", methods=["POST"])
def run_model():
    try:
        data = request.get_json()
        model_name = data.get("model", "")
        X, y, feature_names = load_data()

        if model_name == "1D CNN":
            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import Conv1D, Dense, Flatten
            from sklearn.metrics import accuracy_score

            X_cnn = X.reshape((X.shape[0], X.shape[1], 1))
            skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            scores = []

            for train_idx, test_idx in skf.split(X, y):
                X_train, X_test = X_cnn[train_idx], X_cnn[test_idx]
                y_train, y_test = y[train_idx], y[test_idx]

                cnn = Sequential([
                    Conv1D(64, 3, activation='relu', input_shape=(X.shape[1], 1)),
                    Conv1D(128, 3, activation='relu'),
                    Flatten(),
                    Dense(128, activation='relu'),
                    Dense(64, activation='relu'),
                    Dense(1, activation='sigmoid')
                ])
                cnn.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
                cnn.fit(X_train, y_train, epochs=15, batch_size=16, verbose=0)
                y_pred = (cnn.predict(X_test) > 0.5).astype(int)
                scores.append(accuracy_score(y_test, y_pred))

            scores = np.array(scores)
            return jsonify({
                "training_accuracy": round(float(scores.max()), 4),
                "testing_accuracy":  round(float(scores.mean()), 4),
                "cv_mean":  round(float(scores.mean()), 4),
                "cv_std":   round(float(scores.std()), 4),
                "cv_scores": list(np.round(scores, 4)),
                "tree_image": None,
                "cv_image":   None,
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
            return jsonify({"error": f"Unknown model: {model_name}"}), 400

        model.fit(X_train, y_train)
        train_accuracy = model.score(X_train, y_train)
        test_accuracy  = model.score(X_test,  y_test)
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        cv_scores = cross_val_score(model, X, y, cv=kf)

        tree_image = None
        try:
            fig, ax = plt.subplots(figsize=(20, 10))
            if model_name == "Decision Tree":
                tree.plot_tree(model, feature_names=list(feature_names), filled=True, ax=ax)
            elif model_name == "Random Forest":
                tree.plot_tree(model.estimators_[0], feature_names=list(feature_names), filled=True, ax=ax)
            elif model_name == "LGBM":
                lgb.plot_tree(model.booster_, tree_index=0, ax=ax)
            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            tree_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()
        except Exception as e:
            print("Tree image error:", e)

        cv_image = None
        try:
            fig, ax = plt.subplots()
            ax.plot(range(1, 6), cv_scores, marker='o')
            ax.axhline(cv_scores.mean(), linestyle='--', label=f"Mean: {cv_scores.mean():.4f}")
            ax.set_title(f"{model_name} K-Fold Cross Validation")
            ax.set_xlabel("Fold")
            ax.set_ylabel("Accuracy")
            ax.legend()
            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            cv_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()
        except Exception as e:
            print("CV image error:", e)

        anova_image = None
        try:
            from sklearn.feature_selection import f_classif
            F, _ = f_classif(X, y)
            fig, ax = plt.subplots()
            ax.bar(range(len(F)), F)
            ax.set_title("ANOVA Feature Scores")
            ax.set_xlabel("Feature Index")
            ax.set_ylabel("F Score")
            buf = BytesIO()
            plt.savefig(buf, format="png")
            buf.seek(0)
            anova_image = base64.b64encode(buf.read()).decode("utf-8")
            plt.close()
        except Exception as e:
            print("ANOVA image error:", e)

        return jsonify({
            "training_accuracy": round(train_accuracy, 4),
            "testing_accuracy":  round(test_accuracy,  4),
            "cv_mean":   round(float(cv_scores.mean()), 4),
            "cv_std":    round(float(cv_scores.std()),  4),
            "cv_scores": cv_scores.tolist(),
            "tree_image":  tree_image,
            "cv_image":    cv_image,
            "anova_image": anova_image
        })

    except Exception as e:
        print("❌ RUN-MODEL ERROR:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/anova", methods=["GET"])
def anova_test():
    try:
        X, y, _ = load_data()
        models = {
            "Decision Tree": DecisionTreeClassifier(max_depth=5),
            "Random Forest": RandomForestClassifier(n_estimators=100),
            "LGBM": lgb.LGBMClassifier()
        }

        kf  = KFold(n_splits=5, shuffle=True, random_state=42)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        results  = []
        kf_dict  = {}
        skf_dict = {}

        for name, model in models.items():
            kf_scores  = cross_val_score(model, X, y, cv=kf)
            skf_scores = cross_val_score(model, X, y, cv=skf)
            kf_dict[name]  = kf_scores
            skf_dict[name] = skf_scores
            results.append({"cv_type": "Traditional K-Fold", "model": name,
                            "mean": round(float(kf_scores.mean()), 4),
                            "std":  round(float(kf_scores.std()),  4)})
            results.append({"cv_type": "Stratified K-Fold", "model": name,
                            "mean": round(float(skf_scores.mean()), 4),
                            "std":  round(float(skf_scores.std()),  4)})

        try:
            cnn_scores = cnn_kfold(X, y)
            kf_dict["1D CNN"]  = cnn_scores
            skf_dict["1D CNN"] = cnn_scores
            results.append({"cv_type": "Traditional K-Fold", "model": "1D CNN",
                            "mean": round(float(cnn_scores.mean()), 4),
                            "std":  round(float(cnn_scores.std()),  4)})
            results.append({"cv_type": "Stratified K-Fold", "model": "1D CNN",
                            "mean": round(float(cnn_scores.mean()), 4),
                            "std":  round(float(cnn_scores.std()),  4)})
        except Exception as e:
            print("CNN ANOVA error:", e)

        f_kf,  p_kf  = f_oneway(*kf_dict.values())
        f_skf, p_skf = f_oneway(*skf_dict.values())

        return jsonify({
            "results": results,
            "anova": {
                "kfold":      {"f": round(float(f_kf),  3), "p": round(float(p_kf),  3), "df": len(kf_dict)  - 1},
                "stratified": {"f": round(float(f_skf), 3), "p": round(float(p_skf), 3), "df": len(skf_dict) - 1}
            }
        })
    except Exception as e:
        print("❌ ANOVA ERROR:", e)
        return jsonify({"error": str(e)}), 500
@app.route("/anova", methods=["GET"])
def anova_test():
    try:
        X, y, _ = load_data()
 
        models = {
            "Decision Tree": DecisionTreeClassifier(max_depth=5),
            "Random Forest": RandomForestClassifier(n_estimators=100),
            "LGBM":          lgb.LGBMClassifier()
        }
 
        kf  = KFold(n_splits=5, shuffle=True, random_state=42)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
 
        results  = []
        kf_dict  = {}   # name -> np.array of scores
        skf_dict = {}
 
        # ── Tree-based models ────────────────────────────────────────────────
        for name, model in models.items():
            try:
                kf_scores  = cross_val_score(model, X, y, cv=kf,  scoring="accuracy")
                skf_scores = cross_val_score(model, X, y, cv=skf, scoring="accuracy")
 
                kf_dict[name]  = kf_scores
                skf_dict[name] = skf_scores
 
                results.append({
                    "cv_type": "Traditional K-Fold",
                    "model":   name,
                    "mean":    round(float(kf_scores.mean()), 4),
                    "std":     round(float(kf_scores.std()),  4)
                })
                results.append({
                    "cv_type": "Stratified K-Fold",
                    "model":   name,
                    "mean":    round(float(skf_scores.mean()), 4),
                    "std":     round(float(skf_scores.std()),  4)
                })
                print(f"✅ {name} done — KF mean={kf_scores.mean():.4f}, SKF mean={skf_scores.mean():.4f}")
 
            except Exception as e:
                print(f"⚠️  Skipping {name} in ANOVA: {e}")
 
        # ── 1D CNN (optional — skip if TF unavailable or slow) ───────────────
        try:
            cnn_scores = cnn_kfold(X, y)
 
            kf_dict["1D CNN"]  = cnn_scores
            skf_dict["1D CNN"] = cnn_scores
 
            results.append({
                "cv_type": "Traditional K-Fold",
                "model":   "1D CNN",
                "mean":    round(float(cnn_scores.mean()), 4),
                "std":     round(float(cnn_scores.std()),  4)
            })
            results.append({
                "cv_type": "Stratified K-Fold",
                "model":   "1D CNN",
                "mean":    round(float(cnn_scores.mean()), 4),
                "std":     round(float(cnn_scores.std()),  4)
            })
            print(f"✅ 1D CNN done — mean={cnn_scores.mean():.4f}")
 
        except Exception as e:
            print(f"⚠️  CNN skipped in ANOVA (non-fatal): {e}")
 
        # ── ANOVA F-test (only if ≥ 2 groups succeeded) ─────────────────────
        anova_result = {
            "kfold":      {"f": None, "p": None, "df": None},
            "stratified": {"f": None, "p": None, "df": None}
        }
 
        if len(kf_dict) >= 2:
            try:
                f_kf, p_kf = f_oneway(*kf_dict.values())
                anova_result["kfold"] = {
                    "f":  round(float(f_kf),  3),
                    "p":  round(float(p_kf),  3),
                    "df": len(kf_dict) - 1
                }
            except Exception as e:
                print(f"⚠️  KFold f_oneway failed: {e}")
 
        if len(skf_dict) >= 2:
            try:
                f_skf, p_skf = f_oneway(*skf_dict.values())
                anova_result["stratified"] = {
                    "f":  round(float(f_skf), 3),
                    "p":  round(float(p_skf), 3),
                    "df": len(skf_dict) - 1
                }
            except Exception as e:
                print(f"⚠️  Stratified f_oneway failed: {e}")
 
        print(f"📊 ANOVA returning {len(results)} rows, "
              f"KF f={anova_result['kfold']['f']}, SKF f={anova_result['stratified']['f']}")
 
        return jsonify({
            "results": results,
            "anova":   anova_result
        })
 
    except Exception as e:
        print("❌ ANOVA ERROR:", e)
        return jsonify({"error": str(e)}), 500

@app.route("/hybrid-results", methods=["GET"])
def hybrid_results():
    try:
        if dt_model is None or rf_model is None or lgbm_model is None:
            return jsonify({"error": "Pretrained models (.pkl) not found"}), 500
        if X_test_global is None:
            return jsonify({"error": "Test data not loaded"}), 500

        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import Conv1D, Dense, Flatten
        from sklearn.metrics import accuracy_score

        dt_pred   = dt_model.predict(X_test_global)
        rf_pred   = rf_model.predict(X_test_global)
        lgbm_pred = lgbm_model.predict(X_test_global)

        X_cnn_train = X_train_global.reshape((X_train_global.shape[0], X_train_global.shape[1], 1))
        X_cnn_test  = X_test_global.reshape((X_test_global.shape[0],  X_test_global.shape[1],  1))

        cnn = Sequential([
            Conv1D(64, 3, activation='relu', input_shape=(X_train_global.shape[1], 1)),
            Conv1D(128, 3, activation='relu'),
            Flatten(),
            Dense(128, activation='relu'),
            Dense(64,  activation='relu'),
            Dense(1,   activation='sigmoid')
        ])
        cnn.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        cnn.fit(X_cnn_train, y_train_global, epochs=15, batch_size=16, verbose=0)
        cnn_pred = (cnn.predict(X_cnn_test) > 0.5).astype(int).flatten()

        hybrid_pred = ((0.4 * rf_pred) + (0.3 * lgbm_pred) + (0.3 * cnn_pred)) > 0.5
        hybrid_pred = hybrid_pred.astype(int)
        acc = accuracy_score(y_test_global, hybrid_pred)

        return jsonify({"final_accuracy": round(acc * 100, 2)})
    except Exception as e:
        print("❌ HYBRID ERROR:", e)
        return jsonify({"error": str(e)}), 500


@app.route("/upload", methods=["POST"])
def upload():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400
        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "Empty filename"}), 400
        upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
        os.makedirs(upload_dir, exist_ok=True)
        filepath = os.path.join(upload_dir, file.filename)
        file.save(filepath)
        return jsonify({"message": "File uploaded successfully", "filename": file.filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)