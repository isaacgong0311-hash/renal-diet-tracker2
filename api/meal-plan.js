export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) return res.status(500).json({ error: "GROQ_API_KEY not set" });

  const { remaining = {}, loggedFoods = [], mealType = "meal" } = req.body || {};

  const alreadyEaten = loggedFoods.length
    ? `They have already eaten today: ${loggedFoods.join(", ")}. `
    : "";

  const prompt = `You are a registered renal dietitian helping a dialysis patient plan their next ${mealType}.

Dialysis patients must strictly stay within four daily limits. Here is what the patient has REMAINING today:
- Potassium:  ${Math.round(remaining.potassium  ?? 2000)} mg  (daily max 2000 mg)
- Phosphorus: ${Math.round(remaining.phosphorus ?? 1000)} mg  (daily max 1000 mg)
- Sodium:     ${Math.round(remaining.sodium     ?? 2000)} mg  (daily max 2000 mg)
- Fluid:      ${Math.round(remaining.fluid      ?? 1500)} mL  (daily max 1500 mL)

${alreadyEaten}

Please suggest a specific, realistic ${mealType} that fits within those remaining allowances. Use this exact format:

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
- Only suggest foods a person can realistically buy at a grocery store`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 700,
        messages: [
          { role: "system", content: "You are a compassionate renal dietitian. Be specific, concise, and practical." },
          { role: "user",   content: prompt },
        ],
      }),
    });

    const data = await groqRes.json();
    if (!groqRes.ok) return res.status(500).json({ error: data.error?.message || "Groq API error" });

    return res.status(200).json({ suggestion: data.choices[0].message.content });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
