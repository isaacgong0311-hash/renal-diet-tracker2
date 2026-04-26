export const config = { runtime: "edge" };

export default async function handler(req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (!GROQ_API_KEY) {
    return new Response(JSON.stringify({ error: "GROQ_API_KEY not set" }), { status: 500, headers });
  }

  let body = {};
  try { body = await req.json(); } catch {}

  const remaining   = body.remaining   || {};
  const loggedFoods = body.loggedFoods || [];
  const mealType    = body.mealType    || "meal";

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

    if (!groqRes.ok) {
      return new Response(
        JSON.stringify({ error: data.error?.message || "Groq API error" }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({ suggestion: data.choices[0].message.content }),
      { status: 200, headers }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
