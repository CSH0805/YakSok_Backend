const OpenAI     = require('openai');
const axios      = require('axios');
const FormData   = require('form-data');
const fs         = require('fs');
const path       = require('path');
const os         = require('os');
const { pool }   = require('../config/database');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SUMMARY_PROMPT = `당신은 노인을 위한 진료 내용 요약 AI입니다.
아래 진료 대화 내용을 읽고, 노인이 이해하기 쉽게 핵심 내용을 정리해주세요.

반드시 아래 규칙을 따르세요:
1. 쉬운 한국어를 사용하세요. 의학 용어는 쉬운 말로 풀어주세요.
2. 정보가 없는 항목은 null로 설정하세요.
3. 반드시 아래 JSON 형식으로만 응답하세요.

{
  "diagnosis": "진단명 또는 증상 요약 (1~2문장)",
  "medications": [
    {
      "name": "약 이름",
      "schedule": "복용 시간 (예: 아침, 점심, 저녁)",
      "caution": "주의사항"
    }
  ],
  "precautions": ["주의사항1", "주의사항2"],
  "next_visit": "재방문 일정 (예: 5일 뒤, 2주 후) 또는 null",
  "summary": "전체 진료 내용 한 줄 요약"
}`;

// ─────────────────────────────────────────
// 컨트롤러
// ─────────────────────────────────────────

/**
 * POST /doctor-note
 * form-data: audio (파일), visit_date (선택, YYYY-MM-DD)
 *
 * 흐름: 오디오 파일 → Whisper(STT) → GPT(요약) → DB 저장
 */
async function createDoctorNote(req, res) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '오디오 파일(audio)을 업로드해주세요.',
      supported_formats: ['mp3', 'mp4', 'wav', 'm4a', 'webm', 'ogg'],
    });
  }

  const visitDate = req.body.visit_date || null;

  try {
    // ── STEP 1: Whisper로 음성 → 텍스트 변환 ──
    // multer는 파일을 Buffer로 메모리에 저장. OpenAI SDK는 File 객체나 ReadableStream 필요.
    const audioBuffer = req.file.buffer;
    const fileName    = req.file.originalname || 'audio.mp3';

    const ext     = fileName.split('.').pop().toLowerCase();
    const mimeMap = {
      'm4a': 'audio/mp4', 'mp3': 'audio/mpeg', 'mp4': 'audio/mp4',
      'wav': 'audio/wav', 'webm': 'audio/webm', 'ogg': 'audio/ogg',
      'flac': 'audio/flac', 'mpeg': 'audio/mpeg', 'mpga': 'audio/mpeg',
    };
    const mimeType = mimeMap[ext] || 'audio/mp4';
    const tmpPath  = path.join(os.tmpdir(), `audio.${ext}`);
    fs.writeFileSync(tmpPath, audioBuffer);

    let originalText;
    try {
      // OpenAI SDK 우회 → axios + form-data 직접 호출 (Windows 경로 문제 해결)
      const form = new FormData();
      form.append('file', fs.createReadStream(tmpPath), {
        filename:    `audio.${ext}`,
        contentType: mimeType,
      });
      form.append('model',    'whisper-1');
      form.append('language', 'ko');

      const whisperRes = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          maxBodyLength: Infinity,
        }
      );
      originalText = whisperRes.data.text;
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }


    if (!originalText || originalText.trim() === '') {
      return res.status(422).json({
        success: false,
        message: '음성에서 텍스트를 인식하지 못했습니다. 더 명확하게 녹음해주세요.',
      });
    }

    // ── STEP 2: GPT로 진료 내용 요약 ──
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user',   content: `진료 내용:\n${originalText}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const summaryRaw = completion.choices[0].message.content;
    const summary    = JSON.parse(summaryRaw);

    // ── STEP 3: DB 저장 ──
    const [result] = await pool.query(
      `INSERT INTO doctor_notes (user_id, original_text, summary, visit_date)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, originalText, JSON.stringify(summary), visitDate]
    );

    return res.json({
      success: true,
      data: {
        id:            result.insertId,
        visit_date:    visitDate,
        original_text: originalText,
        summary: {
          diagnosis:    summary.diagnosis   || null,
          medications:  summary.medications || [],
          precautions:  summary.precautions || [],
          next_visit:   summary.next_visit  || null,
          summary:      summary.summary     || null,
        },
        created_at: new Date(Date.now() + 9 * 60 * 60 * 1000)
                      .toISOString().replace('T', ' ').substring(0, 19),
      },
    });
  } catch (err) {
    console.error('[createDoctorNote 오류]', err.message);
    return res.status(500).json({
      success: false,
      message: '진료 내용 분석 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
}

/**
 * GET /doctor-note
 * 내 진료 기록 목록 조회
 */
async function getDoctorNotes(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);

  try {
    const [rows] = await pool.query(
      `SELECT id, summary, visit_date, created_at
       FROM doctor_notes
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [req.user.id, limit]
    );

    const notes = rows.map((row) => ({
      id:         row.id,
      visit_date: row.visit_date,
      summary:    typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
      created_at: row.created_at,
    }));

    return res.json({ success: true, data: notes });
  } catch (err) {
    console.error('[getDoctorNotes 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

/**
 * GET /doctor-note/:id
 * 특정 진료 기록 상세 조회 (원문 포함)
 */
async function getDoctorNoteById(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM doctor_notes WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '진료 기록을 찾을 수 없습니다.' });
    }

    const row = rows[0];
    return res.json({
      success: true,
      data: {
        id:            row.id,
        visit_date:    row.visit_date,
        original_text: row.original_text,
        summary:       typeof row.summary === 'string' ? JSON.parse(row.summary) : row.summary,
        created_at:    row.created_at,
      },
    });
  } catch (err) {
    console.error('[getDoctorNoteById 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { createDoctorNote, getDoctorNotes, getDoctorNoteById };
