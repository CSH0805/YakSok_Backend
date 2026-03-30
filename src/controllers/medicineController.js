const OpenAI = require('openai');
const { pool } = require('../config/database');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `당신은 노인을 위한 약 정보 안내 AI입니다.
사용자가 증상이나 불편한 상태를 입력하면 도움이 될 수 있는 일반의약품을 추천합니다.

반드시 아래 규칙을 따르세요:
1. 처방전 없이 약국에서 구매 가능한 일반의약품(OTC)만 추천하세요.
2. 노인도 이해할 수 있는 쉬운 한국어를 사용하세요.
3. 약을 2~3개 추천하세요.
4. 각 약의 효능, 복용 방법, 주의사항을 간단히 설명하세요.
5. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "recommendations": [
    {
      "name": "약 이름 (예: 타이레놀)",
      "efficacy": "이 약의 효능 (1~2문장, 쉬운 말로)",
      "how_to_take": "복용 방법 (예: 하루 3번, 식후 30분)",
      "caution": "주의사항 (예: 술과 함께 복용 금지)"
    }
  ]
}`;

// ─────────────────────────────────────────
// 컨트롤러
// ─────────────────────────────────────────

/**
 * POST /medicine/recommend
 * Body: { "input": "어지러워" }
 */
async function recommendMedicine(req, res) {
  const { input } = req.body;

  if (!input || typeof input !== 'string' || input.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '증상이나 불편한 상태(input)를 입력해주세요.',
      example: { input: '어지러워' },
    });
  }

  const trimmedInput = input.trim();

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: trimmedInput },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);
    const recommendations = parsed.recommendations || [];

    // DB 저장
    const [result] = await pool.query(
      `INSERT INTO medicine_searches (user_id, input_text, recommendations)
       VALUES (?, ?, ?)`,
      [req.user.id, trimmedInput, JSON.stringify(recommendations)]
    );

    return res.json({
      success: true,
      data: {
        id:              result.insertId,
        input:           trimmedInput,
        recommendations,
        disclaimer:      '위 정보는 참고용이며, 자세한 것은 의사나 약사의 진단을 받아보세요.',
        searched_at:     new Date(Date.now() + 9 * 60 * 60 * 1000)
                           .toISOString().replace('T', ' ').substring(0, 19),
      },
    });
  } catch (err) {
    console.error('[recommendMedicine 오류]', err.message);
    return res.status(500).json({
      success: false,
      message: '약 추천 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
}

/**
 * GET /medicine/history
 * 내 약 검색 기록 조회
 */
async function getMedicineHistory(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  try {
    const [rows] = await pool.query(
      `SELECT id, input_text, recommendations, created_at
       FROM medicine_searches
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    const history = rows.map((row) => ({
      id:              row.id,
      input:           row.input_text,
      recommendations: typeof row.recommendations === 'string'
                         ? JSON.parse(row.recommendations)
                         : row.recommendations,
      created_at:      row.created_at,
    }));

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error('[getMedicineHistory 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { recommendMedicine, getMedicineHistory };
