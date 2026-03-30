const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { authenticate, requireRegistered } = require('../middleware/auth');
const { createDoctorNote, getDoctorNotes, getDoctorNoteById } = require('../controllers/doctorNoteController');

// 메모리 저장 (디스크 저장 불필요)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },  // 25MB (Whisper 최대 제한)
  fileFilter: (req, file, cb) => {
    const allowedExt = ['mp3', 'm4a', 'mp4', 'wav', 'webm', 'ogg', 'flac', 'mpeg', 'mpga'];
    const ext = (file.originalname || '').split('.').pop().toLowerCase();
    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다. 지원 형식: ${allowedExt.join(', ')}`));
    }
  },
});

// 진료 녹음 업로드 → AI 요약
router.post('/', authenticate, requireRegistered, upload.single('audio'), createDoctorNote);

// 진료 기록 목록
router.get('/', authenticate, requireRegistered, getDoctorNotes);

// 진료 기록 상세
router.get('/:id', authenticate, requireRegistered, getDoctorNoteById);

module.exports = router;
