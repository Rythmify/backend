// aws storage
const {
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
} = require('@aws-sdk/client-s3');
const b2 = require('../config/b2');

const env = require('../config/env');

// azure storage
const { BlobServiceClient } = require('@azure/storage-blob');

const blobServiceClient = BlobServiceClient.fromConnectionString(
  env.AZURE_STORAGE_CONNECTION_STRING
);

const getContainerClient = (type) => {
  const containerName = type === 'audio' ? env.BLOB_CONTAINER_AUDIO : env.BLOB_CONTAINER_MEDIA;
  return blobServiceClient.getContainerClient(containerName);
};

// using azure
const uploadTrack = async (file, key) => {
  const containerClient = getContainerClient('audio');
  const blockBlobClient = containerClient.getBlockBlobClient(key);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: { blobContentType: file.mimetype },
  });

  return {
    key,
    url: blockBlobClient.url,
  };
};

// using aws
// const uploadTrack = async (file, key) => {
//   const result = await b2.send(
//     new PutObjectCommand({
//       Bucket: env.B2_BUCKET_NAME,
//       Key: key,
//       Body: file.buffer,
//       ContentType: file.mimetype,
//     })
//   );

//   return {
//     key,
//     url: `${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/${key}`,
//     versionId: result.VersionId || null,
//   };
// };

const uploadImage = async (file, key) => {
  const result = await b2.send(
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
    versionId: result.VersionId || null,
  };
};

const getKeyFromUrl = (fileUrl) => {
  if (!fileUrl) return null;

  const basePrefix = `${env.B2_ENDPOINT}/${env.B2_BUCKET_NAME}/`;

  if (!fileUrl.startsWith(basePrefix)) {
    throw new Error(`Invalid B2 object URL: ${fileUrl}`);
  }

  return decodeURIComponent(fileUrl.slice(basePrefix.length).split('?')[0]);
};

const deleteObject = async (key, versionId) => {
  await b2.send(
    new DeleteObjectCommand({
      Bucket: env.B2_BUCKET_NAME,
      Key: key,
      VersionId: versionId,
    })
  );
};

const deleteAllVersionsByUrl = async (fileUrl) => {
  const key = getKeyFromUrl(fileUrl);
  if (!key) return 0;

  let keyMarker;
  let versionIdMarker;
  let deletedCount = 0;

  do {
    const response = await b2.send(
      new ListObjectVersionsCommand({
        Bucket: env.B2_BUCKET_NAME,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );

    const versions = [
      ...(response.Versions || []).filter((item) => item.Key === key),
      ...(response.DeleteMarkers || []).filter((item) => item.Key === key),
    ];

    for (const item of versions) {
      await deleteObject(key, item.VersionId);
      deletedCount += 1;
    }

    keyMarker = response.IsTruncated ? response.NextKeyMarker : undefined;
    versionIdMarker = response.IsTruncated ? response.NextVersionIdMarker : undefined;
  } while (keyMarker);

  return deletedCount;
};

const deleteManyByUrls = async (urls = []) => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  for (const url of uniqueUrls) {
    await deleteAllVersionsByUrl(url);
  }
};

module.exports = {
  uploadTrack,
  uploadImage,
  getKeyFromUrl,
  deleteObject,
  deleteAllVersionsByUrl,
  deleteManyByUrls,
};
