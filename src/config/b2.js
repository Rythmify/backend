const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

const b2 = new S3Client({
  credentials: {
    accessKeyId: env.B2_KEY_ID,
    secretAccessKey: env.B2_APP_KEY,
  },
  region: env.B2_REGION,
  endpoint: env.B2_ENDPOINT,
});

module.exports = b2;