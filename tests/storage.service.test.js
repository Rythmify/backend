const { Readable } = require('stream');

const AUDIO_CONTAINER = 'audio-container';
const MEDIA_CONTAINER = 'media-container';

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
    getBlob: (containerName, blobName) => getContainerClient(containerName).getBlockBlobClient(blobName),
  };
};

const loadStorageService = () => {
  jest.resetModules();

  const harness = createAzureHarness();

  jest.doMock('../src/config/env', () => ({
    AZURE_STORAGE_CONNECTION_STRING: 'UseDevelopmentStorage=true',
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

    expect(fromConnectionString).toHaveBeenCalledWith('UseDevelopmentStorage=true');
    expect(harness.getContainer(AUDIO_CONTAINER).createIfNotExists).toHaveBeenCalledWith();
    expect(harness.getContainer(MEDIA_CONTAINER).createIfNotExists).toHaveBeenCalledWith({
      access: 'blob',
    });
  });

  it('uploads track files to the audio container and returns the generated blob url', async () => {
    const { service, harness } = loadStorageService();
    const file = {
      buffer: Buffer.from('track-bytes'),
      mimetype: 'audio/mpeg',
    };

    const result = await service.uploadTrack(file, 'tracks/user-1/track.mp3');

    expect(harness.getContainer(AUDIO_CONTAINER).createIfNotExists).toHaveBeenCalledWith();
    expect(harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/track.mp3').uploadData).toHaveBeenCalledWith(
      file.buffer,
      {
        blobHTTPHeaders: {
          blobContentType: 'audio/mpeg',
        },
      }
    );
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
    expect(harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/cover.png').uploadData).toHaveBeenCalledWith(
      file.buffer,
      {
        blobHTTPHeaders: {
          blobContentType: 'image/png',
        },
      }
    );
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

    expect(harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/track-1/preview.mp3').uploadData)
      .toHaveBeenCalledWith(buffer, {
        blobHTTPHeaders: {
          blobContentType: 'audio/ogg',
        },
      });
    expect(result.key).toBe('tracks/user-1/track-1/preview.mp3');
  });

  it('serializes JSON assets before uploading them to the media container', async () => {
    const { service, harness } = loadStorageService();
    const payload = [0.25, 0.5, 1];

    const result = await service.uploadJson(payload, 'tracks/user-1/track-1/waveform.json');
    const uploadCall =
      harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/track-1/waveform.json').uploadData.mock.calls[0];

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

  it('throws when getKeyFromUrl receives an invalid Azure blob url', () => {
    const { service } = loadStorageService();

    expect(() =>
      service.getKeyFromUrl('https://example.blob.core.windows.net/audio-container')
    ).toThrow('Invalid Azure blob URL');
  });

  it('deletes a single blob by key and returns 1 when the blob exists', async () => {
    const { service, harness } = loadStorageService();

    const deletedCount = await service.deleteObject('tracks/user-1/song.mp3', null, 'audio');

    expect(harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/song.mp3').deleteIfExists)
      .toHaveBeenCalledWith({
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
    const fileUrl =
      'https://example.blob.core.windows.net/media-container/tracks/user-1/cover.png';

    const deletedCount = await service.deleteAllVersionsByUrl(fileUrl);

    expect(harness.getBlob(MEDIA_CONTAINER, 'tracks/user-1/cover.png').deleteIfExists)
      .toHaveBeenCalledWith({
        deleteSnapshots: 'include',
      });
    expect(deletedCount).toBe(1);
  });

  it('deduplicates blob urls before deleting them in bulk', async () => {
    const { service, harness } = loadStorageService();
    const fileUrl =
      'https://example.blob.core.windows.net/audio-container/tracks/user-1/song.mp3';

    await service.deleteManyByUrls([fileUrl, null, fileUrl]);

    expect(harness.getBlob(AUDIO_CONTAINER, 'tracks/user-1/song.mp3').deleteIfExists)
      .toHaveBeenCalledTimes(1);
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
