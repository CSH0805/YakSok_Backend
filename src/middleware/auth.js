const jwt = require('jsonwebtoken');

// 일반 JWT 인증 미들웨어
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: '유효하지 않은 토큰입니다.' });
  }
}

// 회원가입 완료 여부 확인 미들웨어
function requireRegistered(req, res, next) {
  if (!req.user.is_registered) {
    return res.status(403).json({
      success: false,
      message: '추가 정보 입력이 필요합니다. /auth/register 를 먼저 호출하세요.',
    });
  }
  next();
}

module.exports = { authenticate, requireRegistered };
