import os
import json
from http.server import BaseHTTPRequestHandler
from groq import Groq

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if not GROQ_API_KEY:
            self._json({"error": "GROQ_API_KEY not set"}, 500)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")

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

        try:
            client = Groq(api_key=GROQ_API_KEY)
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                max_tokens=700,
                messages=[
                    {"role": "system", "content": "You are a compassionate renal dietitian. Be specific, concise, and practical."},
                    {"role": "user",   "content": prompt},
                ],
            )
            self._json({"suggestion": completion.choices[0].message.content}, 200)
        except Exception as e:
            self._json({"error": str(e)}, 500)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, data, status):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass
