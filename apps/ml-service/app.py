from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
import pickle

app = Flask(__name__)

# --- Real Dataset Training ---
print("Loading dataset...")
model_economy = LinearRegression()
model_business = LinearRegression()
dataset_loaded = False

try:
    import os
    # Check for the file in the nested directory (as found) or root
    base_dir = os.path.dirname(__file__)
    csv_path = os.path.join(base_dir, 'Clean_Dataset.csv', 'Clean_Dataset.csv')
    if not os.path.exists(csv_path):
        csv_path = os.path.join(base_dir, 'Clean_Dataset.csv')
    
    if os.path.exists(csv_path):
        df = pd.read_csv(csv_path)
        print(f"Dataset loaded: {len(df)} records.")
        
        # Train Economy Model
        df_eco = df[df['class'] == 'Economy']
        X_eco = df_eco[['duration']].values * 60
        y_eco = df_eco['price'].values
        model_economy.fit(X_eco, y_eco)
        
        # Train Business Model
        df_bus = df[df['class'] == 'Business']
        X_bus = df_bus[['duration']].values * 60
        y_bus = df_bus['price'].values
        model_business.fit(X_bus, y_bus)
        
        print("Models trained on real data (Economy & Business).")
        dataset_loaded = True
    else:
        raise FileNotFoundError("Clean_Dataset.csv not found")

except Exception as e:
    print(f"Warning: Could not train on real dataset ({e}). Falling back to mock.")
    # Fallback Mock
    dataset_loaded = False
    
    # Mock Economy
    X_train = np.array([[60], [120], [180], [300], [600]]) 
    y_train = np.array([50, 90, 120, 200, 450])
    model_economy.fit(X_train, y_train)
    
    # Mock Business (Just 5x price)
    model_business.fit(X_train, y_train * 5)

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        duration = data.get('duration') # in minutes
        flight_class = data.get('class', 'Economy') # Default to Economy

        if duration is None:
            return jsonify({'error': 'duration is required'}), 400

        # Select Model
        if flight_class == 'Business':
            model = model_business
        else:
            model = model_economy

        prediction = model.predict(np.array([[float(duration)]]))
        
        # Ensure non-negative price
        price = max(0, round(prediction[0], 2))
        
        return jsonify({
            'predicted_price': price,
            'currency': 'INR',
            'class': flight_class,
            'model_type': 'Real Data' if dataset_loaded else 'Mock Data'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
