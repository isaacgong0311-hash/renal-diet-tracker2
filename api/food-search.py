import os
import json
import urllib.request
import urllib.parse
from http.server import BaseHTTPRequestHandler

USDA_API_KEY = os.environ.get("USDA_API_KEY", "DEMO_KEY")

NUTRIENT_IDS = {
    "potassium":  1092,
    "phosphorus": 1091,
    "sodium":     1093,
    "calories":   1008,
    "protein":    1003,
    "water":      1051,
}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        query = params.get("q", [""])[0].strip()

        if not query:
            self._json([], 200)
            return

        usda_params = urllib.parse.urlencode({
            "query": query,
            "api_key": USDA_API_KEY,
            "pageSize": 8,
            "dataType": ["Foundation", "SR Legacy"],
        }, doseq=True)

        try:
            url = f"https://api.nal.usda.gov/fdc/v1/foods/search?{usda_params}"
            with urllib.request.urlopen(url, timeout=8) as resp:
                data = json.loads(resp.read())
        except Exception as e:
            self._json({"error": str(e)}, 502)
            return

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

        self._json(results, 200)

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
