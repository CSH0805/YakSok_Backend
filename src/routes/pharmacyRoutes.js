const express = require('express');
const router = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const { getNearbyPharmacies } = require('../controllers/pharmacyController');

// 주변 약국 찾기
router.get('/', authenticate, requireRegistered, getNearbyPharmacies);

module.exports = router;
