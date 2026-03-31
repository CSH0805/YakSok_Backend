const express = require('express');
const router  = express.Router();
const { authenticate, requireRegistered } = require('../middleware/auth');
const {
  createFromNote, createSchedule, getSchedules, updateSchedule, deleteSchedule,
} = require('../controllers/scheduleController');

// 진료 기록에서 자동 추출
router.post('/from-note/:noteId', authenticate, requireRegistered, createFromNote);

// 수동 추가
router.post('/', authenticate, requireRegistered, createSchedule);

// 목록 조회
router.get('/', authenticate, requireRegistered, getSchedules);

// 수정
router.put('/:id', authenticate, requireRegistered, updateSchedule);

// 삭제
router.delete('/:id', authenticate, requireRegistered, deleteSchedule);

module.exports = router;
