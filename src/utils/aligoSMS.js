const axios  = require('axios');
const crypto = require('crypto');
require('dotenv').config();

/**
 * 솔라피 HMAC-SHA256 인증 헤더 생성
 */
function makeAuthHeader() {
  const date  = new Date().toISOString();
  const salt  = crypto.randomBytes(16).toString('hex');
  const hmac  = crypto.createHmac('sha256', process.env.SOLAPI_API_SECRET);
  hmac.update(date + salt);
  const signature = hmac.digest('hex');

  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`;
}

/**
 * 솔라피 문자 발송
 * @param {Object} opts
 * @param {string} opts.receiver  - 수신번호
 * @param {string} opts.msg       - 메시지 본문
 * @param {string} [opts.title]   - LMS 제목
 * @param {string} [opts.msgType] - 'SMS' | 'LMS', 기본 LMS
 * @returns {Object} 솔라피 응답
 */
async function sendSMS({ receiver, msg, title = '[약쏙] 보호자 알림', msgType = 'LMS' }) {
  const body = {
    message: {
      to:   receiver.replace(/-/g, ''),
      from: process.env.SOLAPI_SENDER,
      text: msg,
      type: msgType,
      ...(msgType === 'LMS' ? { subject: title } : {}),
    },
  };

  const response = await axios.post(
    'https://api.solapi.com/messages/v4/send',
    body,
    {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': makeAuthHeader(),
      },
    }
  );

  return response.data;
}

module.exports = { sendSMS };
