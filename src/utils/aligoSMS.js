const axios = require('axios');
require('dotenv').config();

/**
 * 알리고 문자 발송
 * @param {Object} opts
 * @param {string} opts.receiver  - 수신번호 (하이픈 제거 가능)
 * @param {string} opts.msg       - 메시지 본문
 * @param {string} [opts.title]   - LMS 제목 (LMS일 때 필수)
 * @param {string} [opts.msgType] - 'SMS'(90byte) | 'LMS'(2000byte), 기본 LMS
 * @returns {Object} 알리고 응답
 */
async function sendSMS({ receiver, msg, title = '[약쏙] 보호자 알림', msgType = 'LMS' }) {
  const params = new URLSearchParams({
    key:      process.env.ALIGO_API_KEY,
    user_id:  process.env.ALIGO_USER_ID,
    sender:   process.env.ALIGO_SENDER,
    receiver,
    msg,
    msg_type: msgType,
    ...(msgType === 'LMS' ? { title } : {}),
  });

  const response = await axios.post(
    'https://apis.aligo.in/send/',
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  // result_code: 1 이상이면 성공, 음수면 오류
  if (response.data.result_code < 1) {
    throw new Error(`알리고 발송 실패: ${response.data.message}`);
  }

  return response.data;
}

module.exports = { sendSMS };
