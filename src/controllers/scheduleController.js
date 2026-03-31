const { pool } = require('../config/database');

// ─────────────────────────────────────────
// 복용 시간 텍스트 파싱
// "하루 3회, 식후 30분" → { morning:1, afternoon:1, evening:1 }
// ─────────────────────────────────────────
function parseScheduleText(text) {
  if (!text) return { morning: 0, afternoon: 0, evening: 0, bedtime: 0 };
  const t = text;

  // 명시적 시간대 키워드
  const morning   = /아침|오전|morning/i.test(t) ? 1 : 0;
  const afternoon = /점심|오후|낮|afternoon/i.test(t) ? 1 : 0;
  const evening   = /저녁|evening|night/i.test(t) ? 1 : 0;
  const bedtime   = /취침|자기 전|bedtime/i.test(t) ? 1 : 0;

  // 키워드가 없으면 횟수로 추론
  if (!morning && !afternoon && !evening && !bedtime) {
    if (/3회|3번|세 번|세번/i.test(t)) return { morning: 1, afternoon: 1, evening: 1, bedtime: 0 };
    if (/2회|2번|두 번|두번/i.test(t)) return { morning: 1, afternoon: 0, evening: 1, bedtime: 0 };
    if (/1회|1번|한 번|한번/i.test(t)) return { morning: 1, afternoon: 0, evening: 0, bedtime: 0 };
    // 기본값: 아침
    return { morning: 1, afternoon: 0, evening: 0, bedtime: 0 };
  }

  return { morning, afternoon, evening, bedtime };
}

function formatSchedule(row) {
  const times = [];
  if (row.morning)   times.push('아침');
  if (row.afternoon) times.push('점심');
  if (row.evening)   times.push('저녁');
  if (row.bedtime)   times.push('취침 전');
  return {
    id:            row.id,
    medicine_name: row.medicine_name,
    schedule:      times,
    schedule_text: row.schedule_text,
    caution:       row.caution,
    is_active:     !!row.is_active,
    note_id:       row.note_id,
    created_at:    row.created_at,
  };
}

// ─────────────────────────────────────────
// 진료 기록에서 일정 자동 추출
// POST /schedule/from-note/:noteId
// ─────────────────────────────────────────
async function createFromNote(req, res) {
  const { noteId } = req.params;

  try {
    // 진료 기록 조회
    const [notes] = await pool.query(
      'SELECT id, summary FROM doctor_notes WHERE id = ? AND user_id = ?',
      [noteId, req.user.id]
    );
    if (notes.length === 0) {
      return res.status(404).json({ success: false, message: '진료 기록을 찾을 수 없습니다.' });
    }

    const summary = typeof notes[0].summary === 'string'
      ? JSON.parse(notes[0].summary)
      : notes[0].summary;

    const medications = summary?.medications || [];
    if (medications.length === 0) {
      return res.status(400).json({ success: false, message: '진료 기록에 약 정보가 없습니다.' });
    }

    // 각 약을 schedule 테이블에 저장
    const saved = [];
    for (const med of medications) {
      const times = parseScheduleText(med.schedule);
      const [result] = await pool.query(
        `INSERT INTO medicine_schedules
         (user_id, note_id, medicine_name, morning, afternoon, evening, bedtime, schedule_text, caution)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id, noteId, med.name,
          times.morning, times.afternoon, times.evening, times.bedtime,
          med.schedule || null, med.caution || null,
        ]
      );
      saved.push({ id: result.insertId, medicine_name: med.name, schedule: times, schedule_text: med.schedule });
    }

    return res.status(201).json({
      success: true,
      message: `${saved.length}개의 약 복용 일정이 저장되었습니다.`,
      data: saved,
    });
  } catch (err) {
    console.error('[createFromNote 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// ─────────────────────────────────────────
// 수동 일정 추가
// POST /schedule
// ─────────────────────────────────────────
async function createSchedule(req, res) {
  const { medicine_name, schedule_text, caution, morning, afternoon, evening, bedtime } = req.body;

  if (!medicine_name) {
    return res.status(400).json({ success: false, message: '약 이름(medicine_name)은 필수입니다.' });
  }

  // schedule_text가 있으면 자동 파싱, 없으면 직접 입력값 사용
  let times;
  if (schedule_text) {
    times = parseScheduleText(schedule_text);
  } else {
    times = {
      morning:   morning   ? 1 : 0,
      afternoon: afternoon ? 1 : 0,
      evening:   evening   ? 1 : 0,
      bedtime:   bedtime   ? 1 : 0,
    };
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO medicine_schedules
       (user_id, medicine_name, morning, afternoon, evening, bedtime, schedule_text, caution)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, medicine_name, times.morning, times.afternoon, times.evening, times.bedtime,
       schedule_text || null, caution || null]
    );

    return res.status(201).json({
      success: true,
      data: { id: result.insertId, medicine_name, schedule: times, schedule_text, caution },
    });
  } catch (err) {
    console.error('[createSchedule 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// ─────────────────────────────────────────
// 복용 일정 목록 조회
// GET /schedule
// GET /schedule?active=true
// ─────────────────────────────────────────
async function getSchedules(req, res) {
  const onlyActive = req.query.active === 'true';

  try {
    const query = `
      SELECT * FROM medicine_schedules
      WHERE user_id = ? ${onlyActive ? 'AND is_active = 1' : ''}
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.query(query, [req.user.id]);
    return res.json({ success: true, data: rows.map(formatSchedule) });
  } catch (err) {
    console.error('[getSchedules 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// ─────────────────────────────────────────
// 복용 일정 수정
// PUT /schedule/:id
// ─────────────────────────────────────────
async function updateSchedule(req, res) {
  const { id } = req.params;
  const { medicine_name, schedule_text, caution, morning, afternoon, evening, bedtime, is_active } = req.body;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM medicine_schedules WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '일정을 찾을 수 없습니다.' });
    }

    let times = { morning, afternoon, evening, bedtime };
    if (schedule_text) times = parseScheduleText(schedule_text);

    await pool.query(
      `UPDATE medicine_schedules
       SET medicine_name = COALESCE(?, medicine_name),
           morning       = COALESCE(?, morning),
           afternoon     = COALESCE(?, afternoon),
           evening       = COALESCE(?, evening),
           bedtime       = COALESCE(?, bedtime),
           schedule_text = COALESCE(?, schedule_text),
           caution       = COALESCE(?, caution),
           is_active     = COALESCE(?, is_active)
       WHERE id = ? AND user_id = ?`,
      [
        medicine_name || null,
        times.morning ?? null, times.afternoon ?? null, times.evening ?? null, times.bedtime ?? null,
        schedule_text || null, caution || null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id, req.user.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM medicine_schedules WHERE id = ?', [id]);
    return res.json({ success: true, data: formatSchedule(updated[0]) });
  } catch (err) {
    console.error('[updateSchedule 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

// ─────────────────────────────────────────
// 복용 일정 삭제
// DELETE /schedule/:id
// ─────────────────────────────────────────
async function deleteSchedule(req, res) {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      'SELECT id FROM medicine_schedules WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '일정을 찾을 수 없습니다.' });
    }

    await pool.query('DELETE FROM medicine_schedules WHERE id = ?', [id]);
    return res.json({ success: true, message: '복용 일정이 삭제되었습니다.' });
  } catch (err) {
    console.error('[deleteSchedule 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { parseScheduleText, createFromNote, createSchedule, getSchedules, updateSchedule, deleteSchedule };
