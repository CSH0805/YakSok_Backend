require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const weatherRoutes = require('./routes/weatherRoutes');
const diseaseRoutes = require('./routes/diseaseRoutes');
const pharmacyRoutes = require('./routes/pharmacyRoutes');
const symptomRoutes  = require('./routes/symptomRoutes');
const medicineRoutes    = require('./routes/medicineRoutes');
const doctorNoteRoutes  = require('./routes/doctorNoteRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 헬스체크
app.get('/', (req, res) => {
  res.json({ success: true, message: '약쏙 API 서버가 실행 중입니다.' });
});

// 라우터
app.use('/auth', authRoutes);
app.use('/weather', weatherRoutes);
app.use('/disease', diseaseRoutes);
app.use('/pharmacy', pharmacyRoutes);
app.use('/symptom',  symptomRoutes);
app.use('/medicine',    medicineRoutes);
app.use('/doctor-note', doctorNoteRoutes);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ success: false, message: `경로를 찾을 수 없습니다: ${req.method} ${req.path}` });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('[서버 오류]', err.message);
  res.status(500).json({ success: false, message: '서버 내부 오류가 발생했습니다.' });
});

// 서버 시작
async function start() {
  try {
    await initDB();
    app.listen(PORT, () => {
      console.log(`[서버] http://localhost:${PORT} 에서 실행 중`);
    });
  } catch (err) {
    console.error('[서버 시작 실패]', err.message);
    process.exit(1);
  }
}

start();
