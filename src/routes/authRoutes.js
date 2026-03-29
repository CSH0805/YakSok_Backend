const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const {
  getKakaoAuthUrl,
  kakaoCallback,
  register,
  getMe,
  logout,
} = require('../controllers/authController');

// 카카오 로그인 URL 조회
router.get('/kakao', getKakaoAuthUrl);

// 카카오 콜백 (인가 코드 처리)
router.get('/kakao/callback', kakaoCallback);

// 추가 정보 등록 (temp_token 필요)
router.post('/register', authenticate, register);

// 내 정보 조회 (정식 토큰 + 회원가입 완료 필요)
router.get('/me', authenticate, requireRegistered, getMe);

// 로그아웃
router.post('/logout', authenticate, logout);

module.exports = router;
