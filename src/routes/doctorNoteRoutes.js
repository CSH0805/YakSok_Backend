const express = require('express');
const router  = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const {
  getPresignedUrl,
  processDoctorNote,
  getDoctorNotes,
  getDoctorNoteById,
} = require('../controllers/doctorNoteController');
const { notifyGuardian } = require('../controllers/notifyController');

// Presigned PUT URL 발급 (클라이언트가 이 URL로 직접 S3에 업로드)
router.get('/presigned-url', authenticate, requireRegistered, getPresignedUrl);

// S3 업로드 완료 후 AI 처리 요청
router.post('/process', authenticate, requireRegistered, processDoctorNote);

// 보호자에게 진료 기록 SMS 발송
router.post('/:id/notify', authenticate, requireRegistered, notifyGuardian);

// 진료 기록 목록
router.get('/', authenticate, requireRegistered, getDoctorNotes);

// 진료 기록 상세
router.get('/:id', authenticate, requireRegistered, getDoctorNoteById);

module.exports = router;
