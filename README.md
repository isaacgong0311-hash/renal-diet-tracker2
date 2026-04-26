# RenalGuide — Dialysis Diet Tracker

A meal and fluid tracker built for dialysis patients, who must stay within strict daily limits for potassium, phosphorus, sodium, and fluid. Existing nutrition apps (MyFitnessPal, Cronometer) don't understand these combined constraints. This does.

## Features

- **4-nutrient dashboard** — live progress bars for K, P, Na, and fluid against dialysis-specific daily limits
- **USDA food search** — real nutritional data from the USDA FoodData Central database
- **14 quick-add staples** — curated renal-safe foods ready to log instantly
- **Serving size control** — log any portion and see exact nutrient impact before confirming
- **AI meal planner** — Claude suggests a specific breakfast/lunch/dinner/snack that fits your *remaining* allowances for the day

## Setup

### 1. Install dependencies
```bash
pip install flask flask-cors anthropic requests
```

### 2. Set your API key
```bash
# Windows PowerShell
$env:ANTHROPIC_API_KEY = "sk-ant-..."

# macOS / Linux
export ANTHROPIC_API_KEY="sk-ant-..."
```

> The USDA food search uses a free `DEMO_KEY` (30 req/hr). For production, get a free key at https://fdc.nal.usda.gov/api-key-signup.html and set `USDA_API_KEY`.

### 3. Run
```bash
cd renal-diet-tracker
python server.py
```

Open **http://localhost:5000** in your browser.

## Dialysis dietary limits used

| Nutrient   | Daily Max | Why it matters |
|------------|-----------|----------------|
| Potassium  | 2,000 mg  | Damaged kidneys can't excrete K; hyperkalemia causes cardiac arrest |
| Phosphorus | 1,000 mg  | High P pulls calcium from bones and hardens arteries |
| Sodium     | 2,000 mg  | Drives fluid retention between dialysis sessions |
| Fluid      | 1,500 mL  | Fluid builds up dangerously between sessions |

## DevPost summary

**Who:** ~800,000 Americans on hemodialysis (tens of millions globally)

**Problem:** Dialysis patients must simultaneously manage four strict dietary limits every day. Existing apps track calories and macros but fail them: phosphorus data is incomplete, potassium warnings don't exist, and no app reasons about the *combination* of all four constraints together.

**Why it's not solved:** The dialysis population is small relative to the general fitness market, so mainstream apps don't prioritize it. Renal dietitians exist but can only see patients monthly — patients are on their own for 29 out of 30 days.

**How RenalGuide helps:** Real food data + a serving-size-aware log + an AI that knows exactly how much of each nutrient the patient has left today and plans meals accordingly. Not generic advice — specific meals that fit their actual remaining allowances right now.
