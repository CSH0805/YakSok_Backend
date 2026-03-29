const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const { getDiseases } = require('../controllers/diseaseController');

// 유행 질병 조회
router.get('/', authenticate, requireRegistered, getDiseases);

module.exports = router;
