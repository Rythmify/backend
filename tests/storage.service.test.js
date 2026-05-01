const { Readable } = require('stream');

const AUDIO_CONTAINER = 'audio-container';
const MEDIA_CONTAINER = 'media-container';
const AZURE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=https;AccountName=example;AccountKey=fake-key;EndpointSuffix=core.windows.net';

const createAzureHarness = () => {
  const containers = new Map();

  const ensureBlobClient = (containerName, blobName) => {
    const container = containers.get(containerName);

    if (!container.blobs.has(blobName)) {
      container.blobs.set(blobName, {
        url: `https://example.blob.core.windows.net/${containerName}/${blobName}`,
        uploadData: jest.fn().mockResolvedValue(undefined),
        deleteIfExists: jest.fn().mockResolvedValue({ succeeded: true }),
        download: jest.fn().mockResolvedValue({
          readableStreamBody: Readable.from([]),
        }),
      });
    }

    return container.blobs.get(blobName);
  };

  const getContainerClient = jest.fn((containerName) => {
    if (!containers.has(containerName)) {
      containers.set(containerName, {
        createIfNotExists: jest.fn().mockResolvedValue(undefined),
        setAccessPolicy: jest.fn().mockResolvedValue(undefined),
        getBlockBlobClient: jest.fn((blobName) => ensureBlobClient(containerName, blobName)),
        blobs: new Map(),
      });
    }

    return containers.get(containerName);
  });

  return {
    blobServiceClient: {
      getContainerClient,
    },
    getContainer: (containerName) => getContainerClient(containerName),
    getBlob: (containerName, blobName) =>
      getContainerClient(containerName).getBlockBlobClient(blobName),
  };
};

const loadStorageService = () => {
  jest.resetModules();

  const harness = createAzureHarness();

  jest.doMock('../src/config/env', () => ({
    AZURE_STORAGE_CONNECTION_STRING: AZURE_CONNECTION_STRING,
    BLOB_CONTAINER_AUDIO: AUDIO_CONTAINER,
    BLOB_CONTAINER_MEDIA: MEDIA_CONTAINER,
  }));

  const fromConnectionString = jest.fn(() => harness.blobServiceClient);

  jest.doMock('@azure/storage-blob', () => ({
    BlobServiceClient: {
      fromConnectionString,
    },
  }));

  const service = require('../src/services/storage.service');

  return {
    service,
    harness,
    fromConnectionString,
  };
};

describe('storage.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes the audio and media blob containers with the expected access options', async () => {
    const { service, harness, fromConnectionString } = loadStorageService();

    await service.initBlobContainers();

    expect(fromConnectionString).toHaveBeenCalledWith(AZURE_CONNECTION_STRING);
    expect(harness.getContainer(AUDIO_CONTAINER).createIfNotExists).toHaveBeenCalledWith({
      access: 'blob',
    });
    expect(harness.getContainer(AUDIO_CONTAINER).setAccessPolicy).toHaveBeenCalledWith('blob');
    expect(harness.getContainer(MEDIA_CONTAINER).createIfNotExists).toHaveBeenCalledWith({
      access: 'blob',
    });
    expect(harness.getContainer(MEDIA_CONTAINER).setAccessPolicy).toHaveBeenCalledWith('blob');
  });

  it('uploads track files to the audio container and returns the generated blob url', async () => {
    const { service, harness } = loadStorageService();
    const file = {
      buffer: Buffer.from('track-bytes'),
      mimetype: 'audio/mpeg',
    };

    const result = await service.uploadTrack(file, 'tracks/user-1/track.mp3');

    expect(harness.getContainer(AUDIO_CONTAINER).createIfNotExists).toHaveBeenCalledWith();
    expect(
      harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/track.mp3').uploadData
    ).toHaveBeenCalledWith(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: 'audio/mpeg',
      },
    });
    expect(result).toEqual({
      key: 'tracks/user-1/track.mp3',
      url: 'https://example.blob.core.windows.net/audio-container/tracks/user-1/track.mp3',
      versionId: null,
    });
  });

  it('uploads images to the media container', async () => {
    const { service, harness } = loadStorageService();
    const file = {
      buffer: Buffer.from('image-bytes'),
      mimetype: 'image/png',
    };

    const result = await service.uploadImage(file, 'tracks/user-1/cover.png');

    expect(harness.getContainer(MEDIA_CONTAINER).createIfNotExists).toHaveBeenCalledWith();
    expect(
      harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/cover.png').uploadData
    ).toHaveBeenCalledWith(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: 'image/png',
      },
    });
    expect(result.url).toBe(
      'https://example.blob.core.windows.net/media-container/tracks/user-1/cover.png'
    );
  });

  it('uploads generated audio with the supplied content type', async () => {
    const { service, harness } = loadStorageService();
    const buffer = Buffer.from('preview-bytes');

    const result = await service.uploadGeneratedAudio(
      buffer,
      'tracks/user-1/track-1/preview.mp3',
      'audio/ogg'
    );

    expect(
      harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/track-1/preview.mp3').uploadData
    ).toHaveBeenCalledWith(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'audio/ogg',
      },
    });
    expect(result.key).toBe('tracks/user-1/track-1/preview.mp3');
  });

  it('defaults generated audio uploads to audio/mpeg when contentType is omitted', async () => {
    const { service, harness } = loadStorageService();
    const buffer = Buffer.from('preview-bytes');

    await service.uploadGeneratedAudio(buffer, 'tracks/user-1/track-1/preview.mp3');

    expect(
      harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/track-1/preview.mp3').uploadData
    ).toHaveBeenCalledWith(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'audio/mpeg',
      },
    });
  });

  it('serializes JSON assets before uploading them to the media container', async () => {
    const { service, harness } = loadStorageService();
    const payload = [0.25, 0.5, 1];

    const result = await service.uploadJson(payload, 'tracks/user-1/track-1/waveform.json');
    const uploadCall = harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/track-1/waveform.json')
      .uploadData.mock.calls[0];

    expect(uploadCall[0].toString('utf8')).toBe(JSON.stringify(payload));
    expect(uploadCall[1]).toEqual({
      blobHTTPHeaders: {
        blobContentType: 'application/json',
      },
    });
    expect(result.url).toBe(
      'https://example.blob.core.windows.net/media-container/tracks/user-1/track-1/waveform.json'
    );
  });

  it('extracts nested blob keys from configured Azure blob urls', () => {
    const { service } = loadStorageService();

    expect(
      service.getKeyFromUrl(
        'https://example.blob.core.windows.net/audio-container/tracks/user-1/folder/song%20name.mp3'
      )
    ).toBe('tracks/user-1/folder/song name.mp3');
  });

  it('returns null when getKeyFromUrl receives an empty url', () => {
    const { service } = loadStorageService();

    expect(service.getKeyFromUrl(null)).toBeNull();
  });

  it('returns the original URL for signed reads when SAS signing is unavailable locally', async () => {
    const { service } = loadStorageService();
    const fileUrl = 'https://example.blob.core.windows.net/audio-container/tracks/user-1/song.mp3';

    const result = await service.getSignedReadUrl(fileUrl, 300);

    expect(result).toEqual({
      url: fileUrl,
      expiresAt: expect.any(Date),
      expiresInSeconds: 300,
    });
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws when getKeyFromUrl receives an invalid Azure blob url', () => {
    const { service } = loadStorageService();

    expect(() =>
      service.getKeyFromUrl('https://example.blob.core.windows.net/audio-container')
    ).toThrow('Invalid Azure blob URL');
  });

  it('deletes a single blob by key and returns 1 when the blob exists', async () => {
    const { service, harness } = loadStorageService();

    const deletedCount = await service.deleteObject('tracks/user-1/song.mp3', null, 'audio');

    expect(
      harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/song.mp3').deleteIfExists
    ).toHaveBeenCalledWith({
      deleteSnapshots: 'include',
    });
    expect(deletedCount).toBe(1);
  });

  it('returns 0 when deleteObject does not remove anything', async () => {
    const { service, harness } = loadStorageService();

    harness
      .getBlob(MEDIA_CONTAINER, 'tracks/user-1/missing.png')
      .deleteIfExists.mockResolvedValue({ succeeded: false });

    await expect(service.deleteObject('tracks/user-1/missing.png', null, 'media')).resolves.toBe(0);
  });

  it('deletes all versions of a blob by parsing its full url', async () => {
    const { service, harness } = loadStorageService();
    const fileUrl = 'https://example.blob.core.windows.net/media-container/tracks/user-1/cover.png';

    const deletedCount = await service.deleteAllVersionsByUrl(fileUrl);

    expect(
      harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/cover.png').deleteIfExists
    ).toHaveBeenCalledWith({
      deleteSnapshots: 'include',
    });
    expect(deletedCount).toBe(1);
  });

  it('returns 0 when deleteAllVersionsByUrl receives an empty url', async () => {
    const { service } = loadStorageService();

    await expect(service.deleteAllVersionsByUrl(null)).resolves.toBe(0);
  });

  it('returns 0 when deleteAllVersionsByUrl does not remove anything', async () => {
    const { service, harness } = loadStorageService();
    const fileUrl = 'https://example.blob.core.windows.net/media-container/tracks/user-1/cover.png';

    harness
      .getBlob(MEDIA_CONTAINER, 'tracks/user-1/cover.png')
      .deleteIfExists.mockResolvedValue({ succeeded: false });

    await expect(service.deleteAllVersionsByUrl(fileUrl)).resolves.toBe(0);
  });

  it('deduplicates blob urls before deleting them in bulk', async () => {
    const { service, harness } = loadStorageService();
    const fileUrl = 'https://example.blob.core.windows.net/audio-container/tracks/user-1/song.mp3';

    await service.deleteManyByUrls([fileUrl, null, fileUrl]);

    expect(
      harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/song.mp3').deleteIfExists
    ).toHaveBeenCalledTimes(1);
  });

  it('skips deletion when deleteManyByUrls receives only empty values', async () => {
    const { service, harness } = loadStorageService();

    await expect(service.deleteManyByUrls([null, '', undefined])).resolves.toBeUndefined();

    expect(harness.getContainer(AUDIO_CONTAINER).getBlockBlobClient).not.toHaveBeenCalled();
    expect(harness.getContainer(MEDIA_CONTAINER).getBlockBlobClient).not.toHaveBeenCalled();
  });

  it('converts readable streams into a single buffer when downloading blobs', async () => {
    const { service, harness } = loadStorageService();

    harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/song.mp3').download.mockResolvedValue({
      readableStreamBody: Readable.from(['hello ', Buffer.from('world')]),
    });

    await expect(
      service.downloadBlobToBuffer(
        'https://example.blob.core.windows.net/audio-container/tracks/user-1/song.mp3'
      )
    ).resolves.toEqual(Buffer.from('hello world'));
  });

  it('throws when downloadBlobToBuffer receives an invalid Azure blob url', async () => {
    const { service } = loadStorageService();

    await expect(
      service.downloadBlobToBuffer('https://example.blob.core.windows.net/audio-container')
    ).rejects.toThrow('Invalid Azure blob URL');
  });

  it('throws when downloadBlobToBuffer receives an empty url', async () => {
    const { service } = loadStorageService();

    await expect(service.downloadBlobToBuffer(null)).rejects.toThrow(
      'Invalid Azure blob URL: null'
    );
  });

  it('propagates SDK upload errors from uploadTrack', async () => {
    const { service, harness } = loadStorageService();
    const file = {
      buffer: Buffer.from('track-bytes'),
      mimetype: 'audio/mpeg',
    };

    harness
      .getBlob(AUDIO_CONTAINER, 'tracks/user-1/track.mp3')
      .uploadData.mockRejectedValue(new Error('upload failed'));

    await expect(service.uploadTrack(file, 'tracks/user-1/track.mp3')).rejects.toThrow(
      'upload failed'
    );
  });
});
