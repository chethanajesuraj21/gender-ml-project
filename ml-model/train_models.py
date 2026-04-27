import joblib
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import lightgbm as lgb

from app import load_data  # reuse your function

# Load data
X, y, _ = load_data()

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, stratify=y, random_state=42
)

# Train models
dt = DecisionTreeClassifier(max_depth=4)
rf = RandomForestClassifier(n_estimators=200)
lgbm = lgb.LGBMClassifier(n_estimators=150)

dt.fit(X_train, y_train)
rf.fit(X_train, y_train)
lgbm.fit(X_train, y_train)

# CNN
cnn = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation='relu', input_shape=(X_train.shape[1],)),
    tf.keras.layers.Dense(16, activation='relu'),
    tf.keras.layers.Dense(1, activation='sigmoid')
])

cnn.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
cnn.fit(X_train, y_train, epochs=15, batch_size=16)

# SAVE MODELS
joblib.dump(dt, "dt_model.pkl")
joblib.dump(rf, "rf_model.pkl")
joblib.dump(lgbm, "lgbm_model.pkl")
cnn.save("cnn_model.h5")

print("✅ Models saved successfully")