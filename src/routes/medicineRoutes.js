const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const { recommendMedicine, getMedicineHistory } = require('../controllers/medicineController');

// 약 추천
router.post('/recommend', authenticate, requireRegistered, recommendMedicine);

// 검색 기록 조회
router.get('/history', authenticate, requireRegistered, getMedicineHistory);

module.exports = router;
