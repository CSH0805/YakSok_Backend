const OpenAI = require('openai');
const { pool } = require('../config/database');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `당신은 노인을 위한 의료 정보 안내 AI입니다.
사용자가 증상을 입력하면 관련 가능성이 있는 질병 목록을 안내합니다.

반드시 아래 규칙을 따르세요:
1. 이것은 의료 진단이 아닌 "가능성 안내"입니다. 절대 확정적으로 표현하지 마세요.
2. 노인도 이해할 수 있는 쉬운 한국어를 사용하세요.
3. 가능성 있는 질병을 3~5개 제시하세요.
4. 응급 증상(심한 흉통, 마비, 의식 저하 등)이 포함된 경우 is_emergency를 true로 설정하세요.
5. 반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "possible_diseases": [
    {
      "name": "질병명",
      "reason": "이 증상과 관련될 수 있는 이유 (1~2문장, 쉬운 말로)"
    }
  ],
  "is_emergency": false,
  "emergency_message": "응급일 때만 작성. 아니면 빈 문자열"
}`;

// ─────────────────────────────────────────
// 컨트롤러
// ─────────────────────────────────────────

/**
 * POST /symptom
 * Body: { "symptom": "가슴이 아프고 숨이 차요" }
 */
async function analyzeSymptom(req, res) {
  const { symptom } = req.body;

  if (!symptom || typeof symptom !== 'string' || symptom.trim() === '') {
    return res.status(400).json({
      success: false,
      message: '증상(symptom)을 입력해주세요.',
    });
  }

  const trimmedSymptom = symptom.trim();

  try {
    // OpenAI 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `증상: ${trimmedSymptom}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    const possibleDiseases = parsed.possible_diseases || [];
    const isEmergency      = !!parsed.is_emergency;
    const emergencyMessage = parsed.emergency_message || '';

    // DB 저장
    const [result] = await pool.query(
      `INSERT INTO symptoms (user_id, symptom_text, possible_diseases, is_emergency)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, trimmedSymptom, JSON.stringify(possibleDiseases), isEmergency ? 1 : 0]
    );

    return res.json({
      success: true,
      data: {
        id:               result.insertId,
        symptom:          trimmedSymptom,
        possible_diseases: possibleDiseases,
        is_emergency:     isEmergency,
        emergency_message: isEmergency ? emergencyMessage : null,
        disclaimer:       '정확한 진단은 병원을 방문하여 받는 것을 권장합니다.',
        analyzed_at:      new Date(Date.now() + 9 * 60 * 60 * 1000)
                            .toISOString().replace('T', ' ').substring(0, 19),
      },
    });
  } catch (err) {
    console.error('[analyzeSymptom 오류]', err.message);
    return res.status(500).json({
      success: false,
      message: '증상 분석 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
}

/**
 * GET /symptom/history
 * 내 증상 분석 기록 조회
 */
async function getSymptomHistory(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  try {
    const [rows] = await pool.query(
      `SELECT id, symptom_text, possible_diseases, is_emergency, created_at
       FROM symptoms
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    const history = rows.map((row) => ({
      id:               row.id,
      symptom:          row.symptom_text,
      possible_diseases: typeof row.possible_diseases === 'string'
                          ? JSON.parse(row.possible_diseases)
                          : row.possible_diseases,
      is_emergency:     !!row.is_emergency,
      created_at:       row.created_at,
    }));

    return res.json({ success: true, data: history });
  } catch (err) {
    console.error('[getSymptomHistory 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { analyzeSymptom, getSymptomHistory };
