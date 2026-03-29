const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const { analyzeSymptom, getSymptomHistory } = require('../controllers/symptomController');

// 증상 분석
router.post('/', authenticate, requireRegistered, analyzeSymptom);

// 분석 기록 조회
router.get('/history', authenticate, requireRegistered, getSymptomHistory);

module.exports = router;
