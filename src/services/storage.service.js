// Azure Blob Storage / Azurite storage service
const {
  BlobServiceClient,
  BlobSASPermissions,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} = require('@azure/storage-blob');
const env = require('../config/env');

const _connStr = env.AZURE_STORAGE_CONNECTION_STRING;
if (!_connStr || !_connStr.includes('AccountName=') || !_connStr.includes('AccountKey=')) {
  throw new Error(
    'AZURE_STORAGE_CONNECTION_STRING is missing or malformed. ' +
      'Must include AccountName and AccountKey. ' +
      'Get the full connection string from Azure Portal → ' +
      'rythmifystorage → Access keys → Connection string.'
  );
}

const blobServiceClient = BlobServiceClient.fromConnectionString(_connStr);

const parseConnectionString = (connectionString) => {
  if (!connectionString || connectionString === 'UseDevelopmentStorage=true') {
    return null;
  }

  return connectionString.split(';').reduce((parts, pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) return parts;

    return {
      ...parts,
      [pair.slice(0, separatorIndex)]: pair.slice(separatorIndex + 1),
    };
  }, {});
};

const getStorageAccountName = () => {
  const connectionParts = parseConnectionString(_connStr);
  return connectionParts?.AccountName || null;
};

const isBlobDeletionEnabled = () => env.ENABLE_BLOB_DELETION !== 'false';

const getRequestContext = () => {
  // No AsyncLocalStorage/request context is currently wired into this backend.
  // Keep this field stable so future request-scoped logging can populate it.
  return null;
};

const getCallerStack = () => {
  const stack = new Error().stack;
  if (!stack) return null;

  return stack
    .split('\n')
    .slice(3)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
};

const inferLogicalTypeFromContainer = (containerName) => {
  if (containerName === env.BLOB_CONTAINER_AUDIO) return 'audio';
  if (containerName === env.BLOB_CONTAINER_MEDIA) return 'media';
  return containerName || null;
};

const getAzureResponseIds = (result = {}) => ({
  requestId: result.requestId || result._response?.headers?.get?.('x-ms-request-id') || null,
  clientRequestId:
    result.clientRequestId || result._response?.headers?.get?.('x-ms-client-request-id') || null,
});

const logBlobDeletion = (payload, level = 'info') => {
  const logRecord = {
    ...payload,
    timestamp: new Date().toISOString(),
    nodeEnv: env.NODE_ENV,
    NODE_ENV: env.NODE_ENV,
    blobContainerAudio: env.BLOB_CONTAINER_AUDIO,
    BLOB_CONTAINER_AUDIO: env.BLOB_CONTAINER_AUDIO,
    blobContainerMedia: env.BLOB_CONTAINER_MEDIA,
    BLOB_CONTAINER_MEDIA: env.BLOB_CONTAINER_MEDIA,
    enableBlobDeletion: env.ENABLE_BLOB_DELETION ?? null,
    ENABLE_BLOB_DELETION: env.ENABLE_BLOB_DELETION ?? null,
    requestContext: getRequestContext(),
  };

  const message = JSON.stringify(logRecord);
  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.info(message);
  }
};

logBlobDeletion({
  event: 'BLOB_DELETION_CONFIG',
  storageAccountName: getStorageAccountName(),
});

/* Maps logical asset types to the configured blob container names. */
const getContainerName = (type) => {
  return type === 'audio' ? env.BLOB_CONTAINER_AUDIO : env.BLOB_CONTAINER_MEDIA;
};

/* Rewrites Docker-internal Azurite URLs into host-readable URLs for API clients. */
const toPublicBlobUrl = (fileUrl) => {
  if (!fileUrl) return fileUrl;

  try {
    const url = new URL(fileUrl);
    if (url.hostname === 'azurite') {
      url.hostname = 'localhost';
    }
    return url.toString();
  } catch {
    return fileUrl;
  }
};

/* Returns a container client from either a logical asset type or a direct container name. */
const getContainerClient = (typeOrName) => {
  const containerName =
    typeOrName === 'audio' || typeOrName === 'media' ? getContainerName(typeOrName) : typeOrName;

  return blobServiceClient.getContainerClient(containerName);
};

/* Ensures the audio and media containers exist before the app starts using blob storage. */
const initBlobContainers = async () => {
  const audioContainer = getContainerClient('audio');
  await audioContainer.createIfNotExists({
    access: 'blob',
  });
  await audioContainer.setAccessPolicy('blob');

  const mediaContainer = getContainerClient('media');
  await mediaContainer.createIfNotExists({
    access: 'blob',
  });
  await mediaContainer.setAccessPolicy('blob');

  console.log('Blob containers initialized');
};

/* Uploads an incoming file buffer to blob storage and returns its storage metadata. */
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
    url: toPublicBlobUrl(blockBlobClient.url),
    versionId: null,
  };
};

/* Uploads an original track file to the audio container. */
const uploadTrack = async (file, key) => {
  return uploadBlob(file, key, 'audio');
};

/* Uploads an image asset such as track artwork to the media container. */
const uploadImage = async (file, key) => {
  return uploadBlob(file, key, 'media');
};

/* Extracts the container name and blob key from a full Azure Blob URL. */
const parseAzureBlobUrl = (fileUrl) => {
  if (!fileUrl) return null;

  const url = new URL(fileUrl);
  const pathSegments = decodeURIComponent(url.pathname).split('/').filter(Boolean);

  const knownContainers = [env.BLOB_CONTAINER_AUDIO, env.BLOB_CONTAINER_MEDIA].filter(Boolean);

  // Find the configured container segment first so blob names can safely include nested folders.
  const containerIndex = pathSegments.findIndex((segment) => knownContainers.includes(segment));

  if (containerIndex === -1 || containerIndex === pathSegments.length - 1) {
    throw new Error(`Invalid Azure blob URL: ${fileUrl}`);
  }

  return {
    containerName: pathSegments[containerIndex],
    blobName: pathSegments.slice(containerIndex + 1).join('/'),
  };
};

/* Returns only the blob key portion of a blob URL when callers already know the container. */
const getKeyFromUrl = (fileUrl) => {
  const parsed = parseAzureBlobUrl(fileUrl);
  return parsed ? parsed.blobName : null;
};

/* Deletes a single blob by key from the selected container, including snapshots when present. */
const deleteObject = async (key, _versionId = null, type = 'audio') => {
  const containerName = getContainerName(type);
  const baseLogPayload = {
    functionName: 'deleteObject',
    logicalType: type,
    resolvedContainerName: containerName,
    blobKey: key,
    originalUrl: null,
  };

  logBlobDeletion({
    event: 'BLOB_DELETE_ATTEMPT',
    ...baseLogPayload,
    callerStack: getCallerStack(),
  });

  if (!isBlobDeletionEnabled()) {
    logBlobDeletion({
      event: 'BLOB_DELETE_RESULT',
      ...baseLogPayload,
      deleted: false,
      skipped: true,
      skipReason: 'ENABLE_BLOB_DELETION=false',
      requestId: null,
      clientRequestId: null,
    });
    return 0;
  }

  const containerClient = getContainerClient(type);
  const blockBlobClient = containerClient.getBlockBlobClient(key);

  try {
    const result = await blockBlobClient.deleteIfExists({
      deleteSnapshots: 'include',
    });

    logBlobDeletion({
      event: 'BLOB_DELETE_RESULT',
      ...baseLogPayload,
      deleted: Boolean(result.succeeded),
      skipped: false,
      ...getAzureResponseIds(result),
    });

    return result.succeeded ? 1 : 0;
  } catch (error) {
    logBlobDeletion(
      {
        event: 'BLOB_DELETE_ERROR',
        ...baseLogPayload,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
      },
      'error'
    );
    throw error;
  }
};

/* Deletes a blob and any snapshots by parsing its stored public URL. */
const deleteAllVersionsByUrl = async (fileUrl) => {
  let parsed;
  try {
    parsed = parseAzureBlobUrl(fileUrl);
  } catch (error) {
    logBlobDeletion(
      {
        event: 'BLOB_DELETE_ERROR',
        functionName: 'deleteAllVersionsByUrl',
        logicalType: null,
        resolvedContainerName: null,
        blobKey: null,
        originalUrl: fileUrl,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
      },
      'error'
    );
    throw error;
  }

  if (!parsed) return 0;

  const baseLogPayload = {
    functionName: 'deleteAllVersionsByUrl',
    logicalType: inferLogicalTypeFromContainer(parsed.containerName),
    resolvedContainerName: parsed.containerName,
    blobKey: parsed.blobName,
    originalUrl: fileUrl,
  };

  logBlobDeletion({
    event: 'BLOB_DELETE_ATTEMPT',
    ...baseLogPayload,
    callerStack: getCallerStack(),
  });

  if (!isBlobDeletionEnabled()) {
    logBlobDeletion({
      event: 'BLOB_DELETE_RESULT',
      ...baseLogPayload,
      deleted: false,
      skipped: true,
      skipReason: 'ENABLE_BLOB_DELETION=false',
      requestId: null,
      clientRequestId: null,
    });
    return 0;
  }

  const containerClient = getContainerClient(parsed.containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(parsed.blobName);

  try {
    const result = await blockBlobClient.deleteIfExists({
      deleteSnapshots: 'include',
    });

    logBlobDeletion({
      event: 'BLOB_DELETE_RESULT',
      ...baseLogPayload,
      deleted: Boolean(result.succeeded),
      skipped: false,
      ...getAzureResponseIds(result),
    });

    return result.succeeded ? 1 : 0;
  } catch (error) {
    logBlobDeletion(
      {
        event: 'BLOB_DELETE_ERROR',
        ...baseLogPayload,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
      },
      'error'
    );
    throw error;
  }
};

/* Deletes multiple blob assets safely after de-duplicating empty or repeated URLs. */
const deleteManyByUrls = async (urls = []) => {
  const uniqueUrls = [...new Set(urls.filter(Boolean))];

  logBlobDeletion({
    event: 'BLOB_DELETE_ATTEMPT',
    functionName: 'deleteManyByUrls',
    logicalType: null,
    resolvedContainerName: null,
    blobKey: null,
    originalUrl: null,
    urlCount: urls.length,
    uniqueUrlCount: uniqueUrls.length,
    urls: uniqueUrls,
    callerStack: getCallerStack(),
  });

  let deletedCount = 0;

  try {
    for (const url of uniqueUrls) {
      deletedCount += await deleteAllVersionsByUrl(url);
    }

    logBlobDeletion({
      event: 'BLOB_DELETE_RESULT',
      functionName: 'deleteManyByUrls',
      logicalType: null,
      resolvedContainerName: null,
      blobKey: null,
      originalUrl: null,
      urlCount: urls.length,
      uniqueUrlCount: uniqueUrls.length,
      deleted: deletedCount > 0,
      deletedCount,
      skipped: !isBlobDeletionEnabled(),
      requestId: null,
      clientRequestId: null,
    });
  } catch (error) {
    logBlobDeletion(
      {
        event: 'BLOB_DELETE_ERROR',
        functionName: 'deleteManyByUrls',
        logicalType: null,
        resolvedContainerName: null,
        blobKey: null,
        originalUrl: null,
        urlCount: urls.length,
        uniqueUrlCount: uniqueUrls.length,
        urls: uniqueUrls,
        errorName: error?.name,
        errorMessage: error?.message,
        errorStack: error?.stack,
      },
      'error'
    );
    throw error;
  }
};

// convert readable stream to one complete file object (buffer)
const streamToBuffer = async (readable) => {
  const chunks = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

// download file from blob and return as buffer
const downloadBlobToBuffer = async (fileUrl) => {
  const parsed = parseAzureBlobUrl(fileUrl);
  if (!parsed) {
    throw new Error(`Invalid Azure blob URL: ${fileUrl}`);
  }

  // Blob downloads return a readable stream, so convert it back into a single buffer for local processing.
  const containerClient = getContainerClient(parsed.containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(parsed.blobName);

  const response = await blockBlobClient.download();
  return streamToBuffer(response.readableStreamBody);
};

/* Returns a short-lived read URL when SAS signing is available, otherwise the original blob URL. */
const getSignedReadUrl = async (fileUrl, expiresInSeconds = 300) => {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  try {
    const parsed = parseAzureBlobUrl(fileUrl);
    const connectionParts = parseConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);

    if (
      !parsed ||
      !connectionParts?.AccountName ||
      !connectionParts?.AccountKey ||
      !BlobSASPermissions ||
      !StorageSharedKeyCredential ||
      !generateBlobSASQueryParameters
    ) {
      return { url: fileUrl, expiresAt, expiresInSeconds };
    }

    const credential = new StorageSharedKeyCredential(
      connectionParts.AccountName,
      connectionParts.AccountKey
    );
    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: parsed.containerName,
        blobName: parsed.blobName,
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: expiresAt,
      },
      credential
    ).toString();

    return {
      url: `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}${sasToken}`,
      expiresAt,
      expiresInSeconds,
    };
  } catch {
    return { url: fileUrl, expiresAt, expiresInSeconds };
  }
};

// upload user files after being processed
/* Uploads generated in-memory assets such as previews or waveform JSON to blob storage. */
const uploadBuffer = async (buffer, key, type, contentType) => {
  const containerClient = getContainerClient(type);
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(key);

  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: contentType,
    },
  });

  return {
    key,
    url: toPublicBlobUrl(blockBlobClient.url),
    versionId: null,
  };
};

/* Uploads generated audio artifacts, such as previews, to the audio container. */
const uploadGeneratedAudio = async (buffer, key, contentType = 'audio/mpeg') => {
  return uploadBuffer(buffer, key, 'audio', contentType);
};

// for uploading waveform
/* Serializes and uploads generated JSON assets like waveform peak arrays. */
const uploadJson = async (data, key) => {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  return uploadBuffer(body, key, 'media', 'application/json');
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
  parseAzureBlobUrl,
  getContainerClient,
  getSignedReadUrl,
  streamToBuffer,
  downloadBlobToBuffer,
  uploadGeneratedAudio,
  uploadJson,
  toPublicBlobUrl,
};
