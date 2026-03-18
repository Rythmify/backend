const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
const env = require('./env');

const account = 'devstoreaccount1';
const accountKey = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OcuhHHH4a+GCKoV9wJ5Lw==';

const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey);

const blobServiceClient = new BlobServiceClient(
  `http://rythmify_blob:10000/${account}`,
  sharedKeyCredential
);

async function initBlobContainers() {
  const audioContainer = blobServiceClient.getContainerClient(env.BLOB_CONTAINER_AUDIO);
  await audioContainer.createIfNotExists();

  const mediaContainer = blobServiceClient.getContainerClient(env.BLOB_CONTAINER_MEDIA);
  await mediaContainer.createIfNotExists({ access: 'blob' });

  console.log('Blob containers initialized');
}

module.exports = { blobServiceClient, initBlobContainers };
