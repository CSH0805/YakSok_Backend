const { pool }    = require('../config/database');
const { sendSMS } = require('../utils/aligoSMS');

/**
 * 진료 기록 요약을 LMS 메시지 문자열로 변환
 */
function buildMessage(userName, note, schedules) {
  const s = note.summary || {};
  const lines = [];

  lines.push(`[약쏙] ${userName || '사용자'} 님의 진료 알림`);
  lines.push('');

  if (note.visit_date) {
    lines.push(`진료일: ${note.visit_date}`);
  }

  if (s.diagnosis) {
    lines.push(`진단: ${s.diagnosis}`);
  }

  if (schedules.length > 0) {
    lines.push('');
    lines.push('▶ 처방 약 복용 일정');
    for (const sch of schedules) {
      const times = sch.schedule_times.length > 0
        ? sch.schedule_times.join(', ')
        : (sch.schedule_text || '일정 없음');
      const caution = sch.caution ? ` (주의: ${sch.caution})` : '';
      lines.push(`- ${sch.medicine_name}: ${times}${caution}`);
    }
  } else if (s.medications && s.medications.length > 0) {
    lines.push('');
    lines.push('▶ 처방 약');
    for (const med of s.medications) {
      const caution = med.caution ? ` (주의: ${med.caution})` : '';
      lines.push(`- ${med.name}: ${med.schedule || ''}${caution}`);
    }
  }

  if (s.precautions && s.precautions.length > 0) {
    lines.push('');
    lines.push('▶ 주의사항');
    for (const p of s.precautions) {
      lines.push(`- ${p}`);
    }
  }

  if (s.next_visit) {
    lines.push('');
    lines.push(`다음 방문: ${s.next_visit}`);
  }

  if (s.summary) {
    lines.push('');
    lines.push(`한줄 요약: ${s.summary}`);
  }

  lines.push('');
  lines.push('- 약쏙 앱');

  return lines.join('\n');
}

/**
 * POST /doctor-note/:id/notify
 * 보호자에게 진료 기록 + 약 복용 일정을 SMS로 발송
 */
async function notifyGuardian(req, res) {
  const { id } = req.params;

  try {
    // 유저 정보 조회 (보호자 연락처 확인)
    const [userRows] = await pool.query(
      'SELECT name, guardian_phone FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = userRows[0];

    if (!user.guardian_phone) {
      return res.status(400).json({
        success: false,
        message: '등록된 보호자 연락처가 없습니다. /auth/guardian 에서 먼저 등록해주세요.',
      });
    }

    // 진료 기록 조회
    const [noteRows] = await pool.query(
      'SELECT id, summary, visit_date FROM doctor_notes WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (noteRows.length === 0) {
      return res.status(404).json({ success: false, message: '진료 기록을 찾을 수 없습니다.' });
    }

    const note = noteRows[0];
    note.summary = typeof note.summary === 'string'
      ? JSON.parse(note.summary)
      : note.summary;

    // 해당 진료 기록에 연결된 약 복용 일정 조회
    const [schedRows] = await pool.query(
      `SELECT medicine_name, morning, afternoon, evening, bedtime, schedule_text, caution
       FROM medicine_schedules
       WHERE note_id = ? AND user_id = ? AND is_active = 1`,
      [id, req.user.id]
    );

    const schedules = schedRows.map((row) => {
      const times = [];
      if (row.morning)   times.push('아침');
      if (row.afternoon) times.push('점심');
      if (row.evening)   times.push('저녁');
      if (row.bedtime)   times.push('취침 전');
      return {
        medicine_name:  row.medicine_name,
        schedule_times: times,
        schedule_text:  row.schedule_text,
        caution:        row.caution,
      };
    });

    // 메시지 생성 및 발송
    const msg = buildMessage(user.name, note, schedules);
    const result = await sendSMS({
      receiver: user.guardian_phone,
      msg,
      title: `[약쏙] ${user.name || '사용자'} 님 진료 알림`,
    });

    return res.json({
      success: true,
      message: `보호자(${user.guardian_phone})에게 알림을 발송했습니다.`,
      data: {
        mid:        result.mid,
        msg_count:  result.msg_count,
        sent_count: result.sent_cnt,
      },
    });
  } catch (err) {
    console.error('[notifyGuardian 오류]', err.message);
    return res.status(500).json({
      success: false,
      message: '알림 발송 중 오류가 발생했습니다.',
      error: err.message,
    });
  }
}

/**
 * PUT /auth/guardian
 * 보호자 연락처 등록/수정
 * body: { guardian_phone }
 */
async function updateGuardian(req, res) {
  const { guardian_phone } = req.body;

  if (!guardian_phone) {
    return res.status(400).json({ success: false, message: 'guardian_phone 은 필수입니다.' });
  }

  // 숫자와 하이픈만 허용, 10~11자리
  const cleaned = guardian_phone.replace(/-/g, '');
  if (!/^\d{10,11}$/.test(cleaned)) {
    return res.status(400).json({
      success: false,
      message: '올바른 전화번호 형식이 아닙니다. 예: 010-1234-5678',
    });
  }

  try {
    await pool.query(
      'UPDATE users SET guardian_phone = ? WHERE id = ?',
      [cleaned, req.user.id]
    );
    return res.json({
      success: true,
      message: '보호자 연락처가 등록되었습니다.',
      data: { guardian_phone: cleaned },
    });
  } catch (err) {
    console.error('[updateGuardian 오류]', err.message);
    return res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
}

module.exports = { notifyGuardian, updateGuardian };
