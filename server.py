import os
import requests
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from groq import Groq

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")

NUTRIENT_IDS = {
    "potassium":  1092,
    "phosphorus": 1091,
    "sodium":     1093,
    "calories":   1008,
    "protein":    1003,
    "water":      1051,
}

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/food-search")
def food_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])

    url = "https://api.nal.usda.gov/fdc/v1/foods/search"
    params = {
        "query": query,
        "api_key": USDA_API_KEY,
        "pageSize": 8,
        "dataType": ["Foundation", "SR Legacy"],
    }

    try:
        resp = requests.get(url, params=params, timeout=8)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    results = []
    for food in data.get("foods", []):
        nutrients = {
            n["nutrientId"]: round(n.get("value") or 0, 1)
            for n in food.get("foodNutrients", [])
        }
        results.append({
            "fdcId":       food.get("fdcId"),
            "description": food.get("description", "Unknown"),
            "potassium":   nutrients.get(NUTRIENT_IDS["potassium"],  0),
            "phosphorus":  nutrients.get(NUTRIENT_IDS["phosphorus"], 0),
            "sodium":      nutrients.get(NUTRIENT_IDS["sodium"],     0),
            "calories":    nutrients.get(NUTRIENT_IDS["calories"],   0),
            "protein":     nutrients.get(NUTRIENT_IDS["protein"],    0),
            "water":       nutrients.get(NUTRIENT_IDS["water"],      0),
        })

    return jsonify(results)


@app.route("/api/meal-plan", methods=["POST"])
def meal_plan():
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set"}), 500

    body = request.json or {}
    remaining = body.get("remaining", {})
    logged    = body.get("loggedFoods", [])
    meal_type = body.get("mealType", "meal")

    already_eaten = (
        f"They have already eaten today: {', '.join(logged)}. " if logged else ""
    )

    prompt = f"""You are a registered renal dietitian helping a dialysis patient plan their next {meal_type}.

Dialysis patients must strictly stay within four daily limits. Here is what the patient has REMAINING today:
- Potassium:  {remaining.get('potassium',  2000):.0f} mg  (daily max 2000 mg)
- Phosphorus: {remaining.get('phosphorus', 1000):.0f} mg  (daily max 1000 mg)
- Sodium:     {remaining.get('sodium',     2000):.0f} mg  (daily max 2000 mg)
- Fluid:      {remaining.get('fluid',      1500):.0f} mL  (daily max 1500 mL)

{already_eaten}

Please suggest a specific, realistic {meal_type} that fits within those remaining allowances. Use this exact format:

**Meal:** [Name]

**Ingredients:**
- [specific item, e.g. "3 oz (85 g) grilled chicken breast"]
- ...

**Estimated Nutrients for This Meal:**
- Potassium: X mg
- Phosphorus: X mg
- Sodium: X mg
- Fluid: X mL

**Renal Tip:** [One practical sentence about why this meal suits kidney patients]

Rules:
- Avoid high-potassium foods (banana, potato, tomato, orange, avocado, dairy) unless K remaining > 800 mg
- Avoid high-phosphorus foods (dairy, nuts, whole grains, dark colas, processed meats) unless P remaining > 500 mg
- Keep sodium modest — flavor with herbs, lemon, garlic instead of salt
- Prioritize adequate protein (dialysis patients need ~1.2 g/kg/day)
- Only suggest foods a person can realistically buy at a grocery store"""

    client = Groq(api_key=GROQ_API_KEY)
    message = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=700,
        messages=[
            {"role": "system", "content": "You are a compassionate renal dietitian. Be specific, concise, and practical."},
            {"role": "user", "content": prompt},
        ],
    )

    return jsonify({"suggestion": message.choices[0].message.content})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
