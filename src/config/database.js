const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+09:00',
});

async function initDB() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        kakao_id      VARCHAR(50)  NOT NULL UNIQUE COMMENT '카카오 고유 ID',
        email         VARCHAR(100) COMMENT '카카오 이메일',
        nickname      VARCHAR(50)  COMMENT '카카오 닉네임',
        profile_image VARCHAR(500) COMMENT '카카오 프로필 이미지 URL',
        name          VARCHAR(50)  COMMENT '실제 이름',
        age           INT          COMMENT '나이',
        gender        ENUM('male','female','other') COMMENT '성별',
        address       VARCHAR(200) COMMENT '주소',
        guardian_email VARCHAR(100) COMMENT '보호자 이메일',
        is_registered TINYINT(1) DEFAULT 0 COMMENT '추가 정보 입력 완료 여부',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('[DB] users 테이블 준비 완료');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        user_id          INT         NOT NULL,
        symptom_text     TEXT        NOT NULL COMMENT '입력한 증상',
        possible_diseases JSON       COMMENT 'AI 분석 결과 질병 목록',
        is_emergency     TINYINT(1)  DEFAULT 0 COMMENT '응급 상황 여부',
        created_at       DATETIME    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('[DB] symptoms 테이블 준비 완료');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS medicine_searches (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        user_id          INT      NOT NULL,
        input_text       TEXT     NOT NULL COMMENT '사용자 입력 (증상/상태)',
        recommendations  JSON     COMMENT 'AI 추천 약 목록',
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('[DB] medicine_searches 테이블 준비 완료');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctor_notes (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        user_id         INT          NOT NULL,
        audio_url       VARCHAR(500) COMMENT 'S3 녹음 파일 URL',
        original_text   LONGTEXT     COMMENT 'Whisper 변환 원문',
        summary         JSON         COMMENT 'GPT 요약 결과',
        visit_date      DATE         COMMENT '진료 날짜',
        created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    // 기존 테이블에 audio_url 컬럼 없으면 추가
    await conn.query(`
      ALTER TABLE doctor_notes
      ADD COLUMN IF NOT EXISTS audio_url VARCHAR(500) COMMENT 'S3 녹음 파일 URL'
      AFTER user_id
    `).catch(() => {}); // 이미 있으면 무시
    console.log('[DB] doctor_notes 테이블 준비 완료');

    // guardian_phone 컬럼 없으면 추가
    await conn.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20) COMMENT '보호자 연락처'
      AFTER guardian_email
    `).catch(() => {});
    console.log('[DB] users.guardian_phone 컬럼 준비 완료');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS medicine_schedules (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT          NOT NULL,
        note_id       INT          DEFAULT NULL COMMENT '진료 기록 연결 (선택)',
        medicine_name VARCHAR(100) NOT NULL COMMENT '약 이름',
        morning       TINYINT(1)   DEFAULT 0 COMMENT '아침',
        afternoon     TINYINT(1)   DEFAULT 0 COMMENT '점심',
        evening       TINYINT(1)   DEFAULT 0 COMMENT '저녁',
        bedtime       TINYINT(1)   DEFAULT 0 COMMENT '취침 전',
        schedule_text VARCHAR(200) COMMENT '원본 복용 일정 텍스트',
        caution       TEXT         COMMENT '주의사항',
        is_active     TINYINT(1)   DEFAULT 1 COMMENT '활성 여부',
        created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (note_id) REFERENCES doctor_notes(id) ON DELETE SET NULL
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('[DB] medicine_schedules 테이블 준비 완료');
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
