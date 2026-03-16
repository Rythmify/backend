const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const b2 = require('../config/b2');
const env = require('../config/env');

const uploadTrack = async (file, key) => {
  await b2.send(
    new PutObjectCommand({
      Bucket: env.B2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    key,
    url: `${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${key}`,
  };
};

const uploadImage = async (file, key) => {
  await b2.send(
    new PutObjectCommand({
      Bucket: env.B2_BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  return {
    key,
    url: `${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${key}`,
  };
};

const deleteObject = async (key) => {
  await b2.send(
    new DeleteObjectCommand({
      Bucket: env.B2_BUCKET_NAME,
      Key: key,
    })
  );
};

module.exports = {
  uploadTrack,
  uploadImage,
  deleteObject,
};