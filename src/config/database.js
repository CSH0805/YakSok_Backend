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
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDB };
