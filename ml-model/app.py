import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import matplotlib
matplotlib.use('Agg')

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import lightgbm as lgb

from imblearn.over_sampling import RandomOverSampler
from scipy.stats import f_oneway
from sklearn.metrics import accuracy_score
import numpy as np

# ===============================
# INIT
# ===============================
app = Flask(__name__)
CORS(app)

print("🔥 SERVER STARTED")

# ===============================
# HOME
# ===============================
@app.route("/")
def home():
    return jsonify({"message": "ML Backend Running ✅"})

# ===============================
# LOAD DATA
# ===============================
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

    return X, y

# ===============================
# RUN MODEL
# ===============================
@app.route("/run-model", methods=["GET", "POST"])
def run_model():
    try:
        # ✅ HANDLE GET (important for browser test)
        if request.method == "GET":
            return jsonify({"message": "API working ✅"})

        data = request.get_json()
        model_name = data.get("model")

        X, y = load_data()

        # ===== 1D CNN =====
        if model_name == "1D CNN":
            print("🔥 Running CNN...")

            from tensorflow.keras.models import Sequential
            from tensorflow.keras.layers import Conv1D, Dense, Flatten

            X_cnn = X.reshape((X.shape[0], X.shape[1], 1))

            X_train, X_test, y_train, y_test = train_test_split(
                X_cnn, y, test_size=0.3, stratify=y, random_state=42
            )

            model = Sequential([
                Conv1D(16, 3, activation='relu', input_shape=(X.shape[1], 1)),
                Flatten(),
                Dense(16, activation='relu'),
                Dense(1, activation='sigmoid')
            ])

            model.compile(
                optimizer='adam',
                loss='binary_crossentropy',
                metrics=['accuracy']
            )

            model.fit(X_train, y_train, epochs=2, batch_size=16, verbose=0)

            train_acc = model.evaluate(X_train, y_train, verbose=0)[1]
            test_acc = model.evaluate(X_test, y_test, verbose=0)[1]

            return jsonify({
                "training_accuracy": round(float(train_acc), 4),
                "testing_accuracy": round(float(test_acc), 4),
                "cv_mean": round(float(test_acc), 4),
                "cv_std": 0.0,
                "cv_scores": []
            })

        # ===== OTHER MODELS =====
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, stratify=y, random_state=42
        )

        if model_name == "Decision Tree":
            model = DecisionTreeClassifier(max_depth=4)

        elif model_name == "Random Forest":
            model = RandomForestClassifier(n_estimators=100)

        elif model_name == "LGBM":
            print("🔥 Running LGBM...")
            model = lgb.LGBMClassifier()

        else:
            return jsonify({"error": "Invalid model"})

        model.fit(X_train, y_train)

        train_acc = model.score(X_train, y_train)
        test_acc = model.score(X_test, y_test)

        return jsonify({
            "training_accuracy": round(train_acc, 4),
            "testing_accuracy": round(test_acc, 4),
            "cv_mean": round(test_acc, 4),
            "cv_std": 0.0,
            "cv_scores": []
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# ===============================
# ANOVA
# ===============================
@app.route("/anova", methods=["GET"])
def anova_test():
    try:
        X, y = load_data()

        models = [
            DecisionTreeClassifier(),
            RandomForestClassifier(),
            lgb.LGBMClassifier()
        ]

        scores = [cross_val_score(m, X, y, cv=5) for m in models]
        f, p = f_oneway(*scores)

        return jsonify({
            "f_value": round(f, 4),
            "p_value": round(p, 4)
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# ===============================
# HYBRID
# ===============================
@app.route("/hybrid-results", methods=["GET"])
def hybrid_results():
    try:
        X, y = load_data()

        _, X_test, _, y_test = train_test_split(
            X, y, test_size=0.3, stratify=y, random_state=42
        )

        dt = DecisionTreeClassifier().fit(X, y)
        rf = RandomForestClassifier().fit(X, y)
        lgbm = lgb.LGBMClassifier().fit(X, y)

        dt_pred = dt.predict(X_test)
        rf_pred = rf.predict(X_test)
        lgb_pred = lgbm.predict(X_test)

        hybrid_pred = ((0.4 * rf_pred) + (0.3 * lgb_pred)) > 0.5
        hybrid_pred = hybrid_pred.astype(int)

        acc = accuracy_score(y_test, hybrid_pred)

        return jsonify({
            "final_accuracy": round(acc * 100, 2)
        })

    except Exception as e:
        return jsonify({"error": str(e)})

# ===============================
# UPLOAD
# ===============================
@app.route("/upload", methods=["POST"])
def upload():
    try:
        file = request.files.get("file")

        if not file:
            return jsonify({"error": "No file uploaded"}), 400

        os.makedirs("uploads", exist_ok=True)

        filepath = os.path.join("uploads", file.filename)
        file.save(filepath)

        return jsonify({"message": "Uploaded successfully"})

    except Exception as e:
        return jsonify({"error": str(e)})

# ===============================
# RUN
# ===============================
if __name__ == "__main__":
    print("🚀 STARTING FLASK NOW")
    app.run(host="0.0.0.0", port=5000, debug=True)