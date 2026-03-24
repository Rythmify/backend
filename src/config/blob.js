const { BlobServiceClient } = require('@azure/storage-blob');
const env = require('./env');

const blobServiceClient = BlobServiceClient.fromConnectionString(
  env.AZURE_STORAGE_CONNECTION_STRING
);

async function initBlobContainers() {
  const audioContainer = blobServiceClient.getContainerClient(env.BLOB_CONTAINER_AUDIO);
  await audioContainer.createIfNotExists();

  const mediaContainer = blobServiceClient.getContainerClient(env.BLOB_CONTAINER_MEDIA);
  await mediaContainer.createIfNotExists({ access: 'blob' });

  console.log('Blob containers initialized');
}

module.exports = { blobServiceClient, initBlobContainers };
