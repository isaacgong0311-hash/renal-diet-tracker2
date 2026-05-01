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

  const food = (body.food || "").trim();
  if (!food) {
    return new Response(JSON.stringify({ error: "No food provided" }), { status: 400, headers });
  }

  const prompt = `You are a renal dietitian. A dialysis patient asks if this food is safe for their kidney diet.

Food/Meal: "${food}"

Dialysis patients must stay strictly under:
- Potassium: 2,000 mg/day (high-K foods: banana, potato, tomato, orange, avocado, dairy, beans, nuts)
- Phosphorus: 1,000 mg/day (high-P foods: dairy, nuts, whole grains, dark colas, processed meat, beans)
- Sodium: 2,000 mg/day (high-Na foods: processed foods, fast food, canned goods, condiments)
- Fluid: 1,500 mL/day

Respond ONLY with valid JSON, no other text:
{
  "verdict": "SAFE" or "CAUTION" or "AVOID",
  "headline": "One clear sentence explaining verdict (max 70 chars)",
  "reasons": ["specific reason 1", "specific reason 2"],
  "tip": "One practical sentence: a modification, swap, or safe amount",
  "estimates": { "k": number, "p": number, "na": number }
}

Guidelines:
- SAFE: Low in all restricted nutrients, fine in normal portions
- CAUTION: Moderate levels or risky only in large amounts, can eat small portions
- AVOID: High in one or more restricted nutrients, should not eat or rarely eat`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 350,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "You are a precise renal dietitian. Always respond with valid JSON only — no markdown, no extra text.",
          },
          { role: "user", content: prompt },
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

    let raw = data.choices[0].message.content.trim();
    // Strip markdown code fences if the model wraps in ```json
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return new Response(
        JSON.stringify({ error: "Could not parse AI response", raw }),
        { status: 500, headers }
      );
    }

    return new Response(JSON.stringify(parsed), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}
