const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION;

/**
 * S3 업로드용 Presigned PUT URL 발급
 * @param {string} key         - S3 저장 경로
 * @param {string} contentType - MIME 타입
 * @param {number} expiresIn   - 만료 시간(초), 기본 300초
 * @returns {{ uploadUrl, s3Key, fileUrl }}
 */
async function getPresignedUploadUrl(key, contentType, expiresIn = 300) {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn });
  const fileUrl   = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return { uploadUrl, s3Key: key, fileUrl };
}

/**
 * S3에서 파일을 Buffer로 다운로드
 * @param {string} key - S3 저장 경로
 * @returns {Buffer}
 */
async function downloadFromS3(key) {
  const command  = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);

  // ReadableStream → Buffer
  const chunks = [];
  for await (const chunk of response.Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 버퍼를 S3에 직접 업로드 (서버 사이드 업로드용)
 */
async function uploadToS3(buffer, key, contentType) {
  const command = new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  });
  await s3.send(command);
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

module.exports = { getPresignedUploadUrl, downloadFromS3, uploadToS3 };
