const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const { getWeather, getGrid } = require('../controllers/weatherController');

// 날씨 + 미세먼지 통합 조회
router.get('/', authenticate, requireRegistered, getWeather);

// 위경도 → 기상청 격자 변환 유틸 (테스트용)
router.get('/grid', getGrid);

module.exports = router;
