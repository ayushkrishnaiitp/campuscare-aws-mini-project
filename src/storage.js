const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

async function saveUpload(file) {
  if (!file) return null;
  const ext = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
  const key = `${randomUUID()}${ext}`;
  if (process.env.UPLOAD_DRIVER === 's3') {
    if (!process.env.S3_BUCKET) throw new Error('S3_BUCKET is required when UPLOAD_DRIVER=s3');
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
    return `s3://${process.env.S3_BUCKET}/${key}`;
  }
  const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, key), file.buffer, { flag: 'wx' });
  return `/uploads/${key}`;
}
module.exports = { saveUpload };
