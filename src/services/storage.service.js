// Azure Blob Storage / Azurite storage service
const { BlobServiceClient } = require('@azure/storage-blob');
const env = require('../config/env');

const blobServiceClient = BlobServiceClient.fromConnectionString(
  env.AZURE_STORAGE_CONNECTION_STRING
);

const getContainerName = (type) => {
  return type === 'audio' ? env.BLOB_CONTAINER_AUDIO : env.BLOB_CONTAINER_MEDIA;
};

const getContainerClient = (typeOrName) => {
  const containerName =
    typeOrName === 'audio' || typeOrName === 'media' ? getContainerName(typeOrName) : typeOrName;

  return blobServiceClient.getContainerClient(containerName);
};

const initBlobContainers = async () => {
  const audioContainer = getContainerClient('audio');
  await audioContainer.createIfNotExists();

  const mediaContainer = getContainerClient('media');
  await mediaContainer.createIfNotExists({
    access: 'blob',
  });

  console.log('Blob containers initialized');
};

const uploadBlob = async (file, key, type) => {
  const containerClient = getContainerClient(type);
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(key);

  await blockBlobClient.uploadData(file.buffer, {
    blobHTTPHeaders: {
      blobContentType: file.mimetype,
    },
  });

  return {
    key,
    url: blockBlobClient.url,
    versionId: null,
  };
};

const uploadTrack = async (file, key) => {
  return uploadBlob(file, key, 'audio');
};

const uploadImage = async (file, key) => {
  return uploadBlob(file, key, 'media');
};

const parseAzureBlobUrl = (fileUrl) => {
  if (!fileUrl) return null;

  const url = new URL(fileUrl);
  const pathSegments = decodeURIComponent(url.pathname).split('/').filter(Boolean);

  const knownContainers = [env.BLOB_CONTAINER_AUDIO, env.BLOB_CONTAINER_MEDIA].filter(Boolean);

  const containerIndex = pathSegments.findIndex((segment) => knownContainers.includes(segment));

  if (containerIndex === -1 || containerIndex === pathSegments.length - 1) {
    throw new Error(`Invalid Azure blob URL: ${fileUrl}`);
  }

  return {
    containerName: pathSegments[containerIndex],
    blobName: pathSegments.slice(containerIndex + 1).join('/'),
  };
};

const getKeyFromUrl = (fileUrl) => {
  const parsed = parseAzureBlobUrl(fileUrl);
  return parsed ? parsed.blobName : null;
};

const deleteObject = async (key, _versionId = null, type = 'audio') => {
  const containerClient = getContainerClient(type);
  const blockBlobClient = containerClient.getBlockBlobClient(key);

  const result = await blockBlobClient.deleteIfExists({
    deleteSnapshots: 'include',
  });

  return result.succeeded ? 1 : 0;
};

const deleteAllVersionsByUrl = async (fileUrl) => {
  const parsed = parseAzureBlobUrl(fileUrl);
  if (!parsed) return 0;

  const containerClient = getContainerClient(parsed.containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(parsed.blobName);

  const result = await blockBlobClient.deleteIfExists({
    deleteSnapshots: 'include',
  });

  return result.succeeded ? 1 : 0;
};

const deleteManyByUrls = async (urls = []) => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  for (const url of uniqueUrls) {
    await deleteAllVersionsByUrl(url);
  }
};

module.exports = {
  blobServiceClient,
  initBlobContainers,
  uploadTrack,
  uploadImage,
  getKeyFromUrl,
  deleteObject,
  deleteAllVersionsByUrl,
  deleteManyByUrls,
};
