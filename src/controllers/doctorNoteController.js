const OpenAI                              = require('openai');
const axios                               = require('axios');
const FormData                            = require('form-data');
const { pool }                            = require('../config/database');
const { getPresignedUploadUrl, downloadFromS3 } = require('../utils/s3Uploader');
const { parseScheduleText }               = require('./scheduleController');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 매직 바이트로 실제 오디오 포맷 감지
function detectAudioFormat(buffer) {
  const b = buffer;
  // WebM / MKV: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  // MP4 / M4A: ftyp (bytes 4~7)
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'm4a';
  // MP3: ID3 태그 또는 FF FB/F3/F2
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
  if (b[0] === 0xff && (b[1] === 0xfb || b[1] === 0xf3 || b[1] === 0xf2)) return 'mp3';
  // WAV: RIFF
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'wav';
  // OGG: OggS
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'ogg';
  // FLAC: fLaC
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) return 'flac';
  // 감지 실패 시 확장자 그대로 사용
  return null;
}

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
 * GET /doctor-note/presigned-url?ext=mp3
 * Presigned PUT URL 발급 (클라이언트가 직접 S3에 업로드)
 */
async function getPresignedUrl(req, res) {
  const ext = (req.query.ext || 'mp3').toLowerCase();
  const allowedExt = ['mp3', 'm4a', 'mp4', 'wav', 'webm', 'ogg', 'flac'];
  if (!allowedExt.includes(ext)) {
    return res.status(400).json({
      success: false,
      message: `지원하지 않는 확장자입니다. 지원 형식: ${allowedExt.join(', ')}`,
    });
  }

  const mimeMap = {
    'm4a': 'audio/mp4', 'mp3': 'audio/mpeg', 'mp4': 'audio/mp4',
    'wav': 'audio/wav', 'webm': 'audio/webm', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
  };
  const contentType = mimeMap[ext];
  const s3Key = `recordings/user_${req.user.id}/${Date.now()}.${ext}`;

  try {
    const { uploadUrl, fileUrl } = await getPresignedUploadUrl(s3Key, contentType);
    return res.json({
      success: true,
      data: {
        upload_url:   uploadUrl,   // 클라이언트가 PUT 요청할 URL (5분 유효)
        s3_key:       s3Key,       // 업로드 후 /process 에 전달할 키
        file_url:     fileUrl,     // 업로드 완료 후 최종 S3 URL
        expires_in:   300,
        content_type: contentType,
      },
    });
  } catch (err) {
    console.error('[getPresignedUrl 오류]', err.message);
    return res.status(500).json({ success: false, message: '업로드 URL 생성에 실패했습니다.' });
  }
}

/**
 * POST /doctor-note/process
 * body: { s3_key, visit_date }
 *
 * 흐름: S3에서 오디오 다운로드 → Whisper(STT) → GPT(요약) → DB 저장
 */
async function processDoctorNote(req, res) {
  const { s3_key, visit_date } = req.body;

  if (!s3_key) {
    return res.status(400).json({ success: false, message: 's3_key가 필요합니다.' });
  }

  const visitDate = visit_date || null;

  try {
    // ── STEP 1: S3에서 오디오 다운로드 ──
    const audioBuffer = await downloadFromS3(s3_key);
    const audioUrl    = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3_key}`;

    // 매직 바이트로 실제 포맷 감지
    const originalExt = s3_key.split('.').pop().toLowerCase();
    const detectedExt = detectAudioFormat(audioBuffer) || originalExt;
    const mimeMap = {
      'm4a': 'audio/mp4', 'mp3': 'audio/mpeg', 'mp4': 'audio/mp4',
      'wav': 'audio/wav', 'webm': 'audio/webm', 'ogg': 'audio/ogg', 'flac': 'audio/flac',
    };
    const mimeType = mimeMap[detectedExt] || 'audio/mp4';

    // ── STEP 2: Whisper로 음성 → 텍스트 변환 ──
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename:    `audio.${detectedExt}`,
      contentType: mimeType,
      knownLength: audioBuffer.length,
    });
    form.append('model',    'whisper-1');
    form.append('language', 'ko');

    let originalText;
    try {
      const whisperRes = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );
      originalText = whisperRes.data.text;
    } catch (axiosErr) {
      console.error('[Whisper 오류]', JSON.stringify(axiosErr.response?.data, null, 2));
      throw axiosErr;
    }

    if (!originalText || originalText.trim() === '') {
      return res.status(422).json({
        success: false,
        message: '음성에서 텍스트를 인식하지 못했습니다. 더 명확하게 녹음해주세요.',
      });
    }

    // ── STEP 3: GPT로 진료 내용 요약 ──
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

    // ── STEP 4: 진료 기록 DB 저장 ──
    const [result] = await pool.query(
      `INSERT INTO doctor_notes (user_id, audio_url, original_text, summary, visit_date)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, audioUrl, originalText, JSON.stringify(summary), visitDate]
    );
    const noteId = result.insertId;

    // ── STEP 5: 약 복용 일정 자동 저장 ──
    const medications    = summary.medications || [];
    const savedSchedules = [];

    for (const med of medications) {
      if (!med.name) continue;
      const times = parseScheduleText(med.schedule);
      const [schedResult] = await pool.query(
        `INSERT INTO medicine_schedules
         (user_id, note_id, medicine_name, morning, afternoon, evening, bedtime, schedule_text, caution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, noteId, med.name,
          times.morning, times.afternoon, times.evening, times.bedtime,
          med.schedule || null, med.caution || null,
        ]
      );
      savedSchedules.push({
        id:            schedResult.insertId,
        medicine_name: med.name,
        schedule:      Object.entries(times).filter(([, v]) => v).map(([k]) => ({ morning:'아침', afternoon:'점심', evening:'저녁', bedtime:'취침 전' }[k])),
        schedule_text: med.schedule,
      });
    }

    return res.json({
      success: true,
      data: {
        id:            noteId,
        visit_date:    visitDate,
        audio_url:     audioUrl,
        original_text: originalText,
        summary: {
          diagnosis:    summary.diagnosis   || null,
          medications:  summary.medications || [],
          precautions:  summary.precautions || [],
          next_visit:   summary.next_visit  || null,
          summary:      summary.summary     || null,
        },
        saved_schedules: savedSchedules,
        created_at: new Date(Date.now() + 9 * 60 * 60 * 1000)
                      .toISOString().replace('T', ' ').substring(0, 19),
      },
    });
  } catch (err) {
    console.error('[processDoctorNote 오류]', err.message);
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

module.exports = { getPresignedUrl, processDoctorNote, getDoctorNotes, getDoctorNoteById };
