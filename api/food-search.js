const NUTRIENT_IDS = {
  potassium:  1092,
  phosphorus: 1091,
  sodium:     1093,
  calories:   1008,
  protein:    1003,
  water:      1051,
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const q = req.query.q?.trim();
  if (!q) return res.status(200).json([]);

  const USDA_KEY = process.env.USDA_API_KEY || "DEMO_KEY";
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(q)}&api_key=${USDA_KEY}&pageSize=8&dataType=Foundation&dataType=SR%20Legacy`;

  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();

    const results = (data.foods || []).map(food => {
      const nutrients = Object.fromEntries(
        (food.foodNutrients || []).map(n => [n.nutrientId, +(n.value || 0).toFixed(1)])
      );
      return {
        fdcId:       food.fdcId,
        description: food.description,
        potassium:   nutrients[NUTRIENT_IDS.potassium]  || 0,
        phosphorus:  nutrients[NUTRIENT_IDS.phosphorus] || 0,
        sodium:      nutrients[NUTRIENT_IDS.sodium]     || 0,
        calories:    nutrients[NUTRIENT_IDS.calories]   || 0,
        protein:     nutrients[NUTRIENT_IDS.protein]    || 0,
        water:       nutrients[NUTRIENT_IDS.water]      || 0,
      };
    });

    return res.status(200).json(results);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
