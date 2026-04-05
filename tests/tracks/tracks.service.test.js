// ============================================================
// tests/tracks.test.js — Unit & integration tests
// Mirrors: src/routes/tracks.routes.js + src/services/tracks.service.js
// ============================================================
jest.mock('../../src/models/track.model.js', () => ({
  findTrackByIdWithDetails: jest.fn(),
  updateTrackVisibility: jest.fn(),
  deleteTrackPermanently: jest.fn(),
  findMyTracks: jest.fn(),
  updateTrackFields: jest.fn(),
  getGenreIdByName: jest.fn(),
  createTrack: jest.fn(),
  addTrackTags: jest.fn(),
  addTrackArtists: jest.fn(),
  replaceTrackTags: jest.fn(),
  findOrCreateTagsByNames: jest.fn(),
}));

jest.mock('../../src/models/tag.model.js', () => ({
  findByNames: jest.fn(),
  findByIds: jest.fn(),
}));

jest.mock('../../src/services/storage.service.js', () => ({
  deleteManyByUrls: jest.fn(),
  uploadTrack: jest.fn(),
  uploadImage: jest.fn(),
  deleteAllVersionsByUrl: jest.fn(),
  downloadBlobToBuffer: jest.fn(),
  uploadGeneratedAudio: jest.fn(),
  uploadJson: jest.fn(),
}));

jest.mock('../../src/services/track-processing.service.js', () => ({
  processTrackInBackground: jest.fn(),
  processTrackAssets: jest.fn(),
}));

const tracksModel = require('../../src/models/track.model.js');
const tracksService = require('../../src/services/tracks.service.js');
const storageService = require('../../src/services/storage.service.js');
const tagModel = require('../../src/models/tag.model.js');
const trackProcessingService = require('../../src/services/track-processing.service.js');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const INVALID_UUID = 'not-a-uuid';

describe('tracksService.getPrivateShareLink', () => {
  const originalAppUrl = process.env.APP_URL;
  const originalClientUrl = process.env.CLIENT_URL;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.APP_URL = 'http://localhost:5173';
    process.env.CLIENT_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env.APP_URL = originalAppUrl;
    process.env.CLIENT_URL = originalClientUrl;
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(tracksService.getPrivateShareLink(TRACK_ID, 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: false,
      secret_token: 'secret-123',
    });

    await expect(
      tracksService.getPrivateShareLink(TRACK_ID, 'listener-1')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });
  });

  it('throws 400 when track is public', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      secret_token: null,
    });

    await expect(tracksService.getPrivateShareLink(TRACK_ID, 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('returns track_id, secret_token, and share_url when track is private and requester is owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      secret_token: 'secret-123',
    });

    const result = await tracksService.getPrivateShareLink(TRACK_ID, 'user-1');

    expect(result).toEqual({
      track_id: TRACK_ID,
      secret_token: 'secret-123',
      share_url: `http://localhost:5173/tracks/${TRACK_ID}?secret_token=secret-123`,
    });
    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('generates and persists a secret token when a private track does not have one yet', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      secret_token: null,
    });

    const result = await tracksService.getPrivateShareLink(TRACK_ID, 'user-1');

    expect(tracksModel.updateTrackVisibility).toHaveBeenCalledWith(
      TRACK_ID,
      false,
      expect.any(String)
    );
    expect(result).toEqual({
      track_id: TRACK_ID,
      secret_token: expect.any(String),
      share_url: expect.stringMatching(
        new RegExp(`^http://localhost:5173/tracks/${TRACK_ID}\\?secret_token=[a-f0-9]+$`)
      ),
    });
  });

  it('throws 400 when track_id is malformed', async () => {
    await expect(tracksService.getPrivateShareLink(INVALID_UUID, 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });
});

// Test Update Track Visibility -
describe('tracksService.updateTrackVisibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('updates visibility when requester is the owner', async () => {
    // Make fake db responses
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      secret_token: null,
    });
    tracksModel.updateTrackVisibility.mockResolvedValue({
      id: TRACK_ID,
      is_public: false,
    });

    const result = await tracksService.updateTrackVisibility(TRACK_ID, 'user-1', false);

    expect(result).toEqual({
      track_id: TRACK_ID,
      is_public: false,
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
    expect(tracksModel.updateTrackVisibility).toHaveBeenCalledWith(
      TRACK_ID,
      false,
      expect.any(String)
    );
  });

  it('throws 400 when is_public is not boolean', async () => {
    await expect(
      tracksService.updateTrackVisibility(TRACK_ID, 'user-1', 'false')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(
      tracksService.updateTrackVisibility(TRACK_ID, 'user-1', false)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrackVisibility(TRACK_ID, 'user-2', false)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });

    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });

  it('throws 400 when track_id is malformed', async () => {
    await expect(
      tracksService.updateTrackVisibility(INVALID_UUID, 'user-1', false)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });
});

// Test Delete Track -
describe('tracksService.deleteTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('deletes audio and derived assets then removes the track when requester is the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      audio_url: 'audio-url',
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      waveform_url: 'waveform-url',
      cover_image: 'cover-url',
    });

    tracksModel.deleteTrackPermanently.mockResolvedValue({
      id: TRACK_ID,
    });

    const result = await tracksService.deleteTrack(TRACK_ID, 'user-1');

    expect(result).toBeUndefined();
    expect(storageService.deleteManyByUrls).toHaveBeenCalledWith([
      'audio-url',
      'stream-url',
      'preview-url',
      'waveform-url',
      'cover-url',
    ]);
    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
    expect(tracksModel.deleteTrackPermanently).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(tracksService.deleteTrack(TRACK_ID, 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.deleteTrackPermanently).not.toHaveBeenCalled();
    expect(storageService.deleteManyByUrls).not.toHaveBeenCalled();
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(tracksService.deleteTrack(TRACK_ID, 'user-2')).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });

    expect(storageService.deleteManyByUrls).not.toHaveBeenCalled();
    expect(tracksModel.deleteTrackPermanently).not.toHaveBeenCalled();
  });

  it('throws 404 when permanent delete reports no deleted track', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });
    tracksModel.deleteTrackPermanently.mockResolvedValue(null);

    await expect(tracksService.deleteTrack(TRACK_ID, 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.deleteTrackPermanently).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 400 when track_id is malformed', async () => {
    await expect(tracksService.deleteTrack(INVALID_UUID, 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });
});

// Testing getTrackByID
describe('tracksService.getTrackById', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the track when it exists and is public', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
    });

    const result = await tracksService.getTrackById(TRACK_ID, null);

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('returns the track when requester is the owner even if track is private', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    const result = await tracksService.getTrackById(TRACK_ID, 'user-1');

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(tracksService.getTrackById(TRACK_ID, null)).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 404 when track is hidden and requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: true,
      title: 'Hidden Track',
    });

    await expect(tracksService.getTrackById(TRACK_ID, 'user-2')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 403 when track is private and requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    await expect(tracksService.getTrackById(TRACK_ID, 'user-2')).rejects.toMatchObject({
      statusCode: 403,
      code: 'RESOURCE_PRIVATE',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('returns a private track to a non-owner when secret_token is valid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      secret_token: 'secret-123',
      title: 'Private Track',
    });

    const result = await tracksService.getTrackById(TRACK_ID, 'user-2', 'secret-123');

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });
  });

  it('throws 400 when track_id is malformed', async () => {
    await expect(tracksService.getTrackById(INVALID_UUID, null)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });
});

// Testing getMyTracks
describe('tracksService.getMyTracks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns paginated tracks with default page and limit', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Track One',
        },
        {
          id: 'track-2',
          user_id: 'user-1',
          title: 'Track Two',
        },
      ],
      total: 2,
    });

    const result = await tracksService.getMyTracks('user-1', {});

    expect(result).toEqual({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Track One',
        },
        {
          id: 'track-2',
          user_id: 'user-1',
          title: 'Track Two',
        },
      ],
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
    });

    expect(tracksModel.findMyTracks).toHaveBeenCalledWith('user-1', {
      limit: 20,
      offset: 0,
      status: null,
    });
  });

  it('throws 400 when status is invalid', async () => {
    await expect(tracksService.getMyTracks('user-1', { status: 'draft' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.findMyTracks).not.toHaveBeenCalled();
  });

  it('uses the provided valid status filter', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Ready Track',
          status: 'ready',
        },
      ],
      total: 1,
    });

    const result = await tracksService.getMyTracks('user-1', { status: 'ready' });

    expect(result).toEqual({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Ready Track',
          status: 'ready',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    });

    expect(tracksModel.findMyTracks).toHaveBeenCalledWith('user-1', {
      limit: 20,
      offset: 0,
      status: 'ready',
    });
  });

  it('clamps page to minimum 1 and limit to maximum 100', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [],
      total: 150,
    });

    const result = await tracksService.getMyTracks('user-1', {
      page: '0',
      limit: '500',
    });

    expect(result).toEqual({
      items: [],
      page: 1,
      limit: 100,
      total: 150,
      total_pages: 2,
    });

    expect(tracksModel.findMyTracks).toHaveBeenCalledWith('user-1', {
      limit: 100,
      offset: 0,
      status: null,
    });
  });

  it('calculates offset correctly for later pages', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [],
      total: 50,
    });

    const result = await tracksService.getMyTracks('user-1', {
      page: '3',
      limit: '10',
    });

    expect(result).toEqual({
      items: [],
      page: 3,
      limit: 10,
      total: 50,
      total_pages: 5,
    });

    expect(tracksModel.findMyTracks).toHaveBeenCalledWith('user-1', {
      limit: 10,
      offset: 20,
      status: null,
    });
  });
});

// Testing getTrackStream
describe('tracksService.getTrackStream', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when track_id is malformed', async () => {
    await expect(tracksService.getTrackStream(INVALID_UUID, null)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });

  it('returns stream_url when stream_url exists', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: 'stream-url',
      audio_url: 'audio-url',
    });

    const result = await tracksService.getTrackStream(TRACK_ID, null);

    expect(result).toEqual({
      track_id: TRACK_ID,
      stream_url: 'stream-url',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('falls back to audio_url when stream_url is missing', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: null,
      audio_url: 'audio-url',
    });

    const result = await tracksService.getTrackStream(TRACK_ID, null);

    expect(result).toEqual({
      track_id: TRACK_ID,
      stream_url: 'audio-url',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 503 when track status is failed', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'failed',
      stream_url: null,
      audio_url: 'audio-url',
    });

    await expect(tracksService.getTrackStream(TRACK_ID, null)).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_PROCESSING_FAILED',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });

  it('throws 202 when track status is processing', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'processing',
      stream_url: null,
      audio_url: 'audio-url',
    });

    await expect(tracksService.getTrackStream(TRACK_ID, null)).rejects.toMatchObject({
      statusCode: 202,
      code: 'BUSINESS_OPERATION_NOT_ALLOWED',
    });
  });

  it('allows a private stream when the provided secret_token is valid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: false,
      is_hidden: false,
      secret_token: 'secret-123',
      status: 'ready',
      stream_url: 'stream-url',
      audio_url: 'audio-url',
    });

    const result = await tracksService.getTrackStream(TRACK_ID, 'listener-1', 'secret-123');

    expect(result).toEqual({
      track_id: TRACK_ID,
      stream_url: 'stream-url',
    });
  });

  it('throws 404 for hidden tracks when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: true,
      status: 'ready',
      stream_url: 'stream-url',
      audio_url: 'audio-url',
    });

    await expect(tracksService.getTrackStream(TRACK_ID, 'listener-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });
  });

  it('throws 500 when no playable audio is available', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: null,
      audio_url: null,
    });

    await expect(tracksService.getTrackStream(TRACK_ID, null)).rejects.toMatchObject({
      statusCode: 500,
      code: 'STREAM_URL_MISSING',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith(TRACK_ID);
  });
});

describe('tracksService.getTrackWaveform', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns parsed waveform peaks when the track is ready', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      waveform_url: 'waveform-url',
    });

    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('[0.1,0.5,0.2]', 'utf8'));

    const result = await tracksService.getTrackWaveform(TRACK_ID);

    expect(storageService.downloadBlobToBuffer).toHaveBeenCalledWith('waveform-url');
    expect(result).toEqual({
      track_id: TRACK_ID,
      peaks: [0.1, 0.5, 0.2],
    });
  });

  it('allows a private waveform when the provided secret_token is valid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: false,
      is_hidden: false,
      secret_token: 'secret-123',
      status: 'ready',
      waveform_url: 'waveform-url',
    });

    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('[0.1]', 'utf8'));

    const result = await tracksService.getTrackWaveform(TRACK_ID, 'listener-1', 'secret-123');

    expect(result).toEqual({
      track_id: TRACK_ID,
      peaks: [0.1],
    });
  });

  it('throws 202 when waveform is requested while processing', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'processing',
      waveform_url: 'waveform-url',
    });

    await expect(tracksService.getTrackWaveform(TRACK_ID)).rejects.toMatchObject({
      statusCode: 202,
      code: 'BUSINESS_OPERATION_NOT_ALLOWED',
    });

    expect(storageService.downloadBlobToBuffer).not.toHaveBeenCalled();
  });

  it('throws 503 when waveform is requested for a failed track', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'failed',
      waveform_url: 'waveform-url',
    });

    await expect(tracksService.getTrackWaveform(TRACK_ID)).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_PROCESSING_FAILED',
    });
  });
});

// testing updateTrack
describe('tracksService.updateTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when trackId is malformed', async () => {
    await expect(
      tracksService.updateTrack({
        trackId: INVALID_UUID,
        userId: 'user-1',
        payload: { title: 'New Title' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'track_id must be a valid UUID.',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { title: 'New Title' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-2',
        payload: { title: 'New Title' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when payload is empty and no cover image is provided', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {},
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when no valid fields are provided to update', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { unknown_field: 'x' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('updates scalar fields and returns the final track', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        is_public: true,
        explicit_content: false,
        enable_downloads: false,
        enable_offline_listening: false,
        include_in_rss_feed: true,
        display_embed_code: true,
        enable_app_playback: true,
        allow_comments: true,
        show_comments_public: true,
        show_insights_public: true,
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        title: 'New Title',
        description: 'New Description',
        is_public: true,
      });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: TRACK_ID,
    });

    const result = await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {
        title: 'New Title',
        description: 'New Description',
      },
      coverImageFile: null,
    });

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      title: 'New Title',
      description: 'New Description',
      is_public: true,
    });

    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(TRACK_ID, {
      title: 'New Title',
      description: 'New Description',
    });
  });

  it('throws 404 when updateTrackFields returns null after scalar update', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      explicit_content: false,
      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,
      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
    });

    tracksModel.updateTrackFields.mockResolvedValue(null);

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { title: 'New Title' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });
  });

  it('throws 404 when final track lookup after update returns null', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        is_public: true,
        explicit_content: false,
        enable_downloads: false,
        enable_offline_listening: false,
        include_in_rss_feed: true,
        display_embed_code: true,
        enable_app_playback: true,
        allow_comments: true,
        show_comments_public: true,
        show_insights_public: true,
      })
      .mockResolvedValueOnce(null);

    tracksModel.updateTrackFields.mockResolvedValue({
      id: TRACK_ID,
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { title: 'New Title' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });
  });
});

describe('tracksService.updateTrack validations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when title is empty after trimming', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      explicit_content: false,
      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,
      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { title: '   ' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when license_type is invalid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      explicit_content: false,
      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,
      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { license_type: 'pirated' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });
});

describe('tracksService.updateTrack genre and geo validations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when genre is invalid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    tracksModel.getGenreIdByName.mockResolvedValue(null);

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { genre: 'not-a-real-genre' },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_restriction_type is invalid', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {
          geo_restriction_type: 'bad_type',
          geo_regions: [],
        },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is not an array', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {
          geo_restriction_type: 'blocked_regions',
          geo_regions: '"EG"',
        },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is provided with worldwide', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {
          geo_restriction_type: 'worldwide',
          geo_regions: ['EG'],
        },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is missing for exclusive_regions', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {
          geo_restriction_type: 'exclusive_regions',
          geo_regions: [],
        },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });
});

describe('tracksService.updateTrack tag replacement and cover cleanup', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('replaces tags and returns resolved tag names when tags are updated', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        title: 'Old Title',
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        title: 'Old Title',
        tags: ['tag-1', 'tag-2'],
      });

    tracksModel.findOrCreateTagsByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    const result = await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {
        tags: JSON.stringify(['Chill', ' ambient ']),
      },
      coverImageFile: null,
    });

    expect(tracksModel.findOrCreateTagsByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
    expect(tracksModel.replaceTrackTags).toHaveBeenCalledWith(TRACK_ID, ['tag-1', 'tag-2']);

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      title: 'Old Title',
      tags: ['chill', 'ambient'],
    });
  });

  it('replaces tags with an empty list when payload.tags is empty array', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        title: 'Old Title',
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        title: 'Old Title',
        tags: [],
      });

    const result = await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {
        tags: JSON.stringify([]),
      },
      coverImageFile: null,
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
    expect(tracksModel.replaceTrackTags).toHaveBeenCalledWith(TRACK_ID, []);

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      title: 'Old Title',
      tags: [],
    });
  });

  it('uploads a new cover and deletes old cover versions when the cover changes', async () => {
    const coverImageFile = {
      originalname: 'cover.jpg',
      size: 555,
    };

    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        cover_image: 'old-cover-url',
        is_public: true,
        explicit_content: false,
        enable_downloads: false,
        enable_offline_listening: false,
        include_in_rss_feed: true,
        display_embed_code: true,
        enable_app_playback: true,
        allow_comments: true,
        show_comments_public: true,
        show_insights_public: true,
        geo_restriction_type: 'worldwide',
        geo_regions: [],
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        cover_image: 'new-cover-url',
        title: 'Old Title',
      });

    storageService.uploadImage.mockResolvedValue({
      url: 'new-cover-url',
    });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: TRACK_ID,
    });

    const result = await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {},
      coverImageFile,
    });

    expect(storageService.uploadImage).toHaveBeenCalled();
    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(
      TRACK_ID,
      expect.objectContaining({
        cover_image: 'new-cover-url',
      })
    );
    expect(storageService.deleteAllVersionsByUrl).toHaveBeenCalledWith('old-cover-url');

    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      cover_image: 'new-cover-url',
      title: 'Old Title',
    });
  });
});

// Testing uploadTrack
describe('tracksService.uploadTrack validations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 401 when authenticated user id is missing', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: {},
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
        },
      })
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_TOKEN_INVALID',
    });

    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when tags is not a valid array', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: 'not-json',
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when a tag is not a string', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: JSON.stringify(['chill', 123]),
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when a tag name is empty', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: JSON.stringify(['chill', '   ']),
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when more than 10 tags are provided', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: JSON.stringify([
            't1',
            't2',
            't3',
            't4',
            't5',
            't6',
            't7',
            't8',
            't9',
            't10',
            't11',
          ]),
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when genre is invalid', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    tracksModel.getGenreIdByName.mockResolvedValue(null);

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          genre: 'not-a-real-genre',
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksModel.getGenreIdByName).toHaveBeenCalledWith('not-a-real-genre');
    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('creates a track, links tags and artist, and returns the created track with tag names', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    const coverImageFile = {
      originalname: 'cover.jpg',
      size: 555,
    };

    tracksModel.findOrCreateTagsByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    tracksModel.getGenreIdByName.mockResolvedValue('genre-1');

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    storageService.uploadImage.mockResolvedValue({
      url: 'cover-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      description: 'desc',
      genre_id: 'genre-1',
      cover_image: 'cover-url',
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      license_type: 'all_rights_reserved',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    const result = await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile,
      body: {
        title: 'My Song',
        description: 'desc',
        genre: 'Pop',
        tags: JSON.stringify(['chill', 'ambient']),
        is_public: true,
      },
    });

    expect(tracksModel.findOrCreateTagsByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(tracksModel.getGenreIdByName).toHaveBeenCalledWith('Pop');
    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).toHaveBeenCalled();
    expect(tracksModel.createTrack).toHaveBeenCalledWith({
      title: 'My Song',
      description: 'desc',
      genre_id: 'genre-1',
      cover_image: 'cover-url',
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      secret_token: null,
      user_id: 'user-1',

      release_date: null,
      isrc: null,
      p_line: null,
      buy_link: null,
      record_label: null,
      publisher: null,
      explicit_content: false,
      license_type: 'all_rights_reserved',

      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,

      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      user_id: 'user-1',
    });

    expect(tracksModel.addTrackTags).toHaveBeenCalledWith(TRACK_ID, ['tag-1', 'tag-2']);
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith(TRACK_ID, ['user-1']);
    expect(trackProcessingService.processTrackInBackground).toHaveBeenCalledWith({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'audio-url',
    });

    expect(result).toEqual({
      id: TRACK_ID,
      title: 'My Song',
      description: 'desc',
      genre_id: 'genre-1',
      cover_image: 'cover-url',
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      license_type: 'all_rights_reserved',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      tags: ['chill', 'ambient'],
    });
  });
  it('creates a track without cover image, tags, or genre and uses defaults', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      description: null,
      genre_id: null,
      cover_image: null,
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      license_type: 'all_rights_reserved',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    const result = await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile: null,
      body: {
        title: 'My Song',
      },
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(tracksModel.getGenreIdByName).not.toHaveBeenCalled();
    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();

    expect(tracksModel.createTrack).toHaveBeenCalledWith({
      title: 'My Song',
      description: null,
      genre_id: null,
      cover_image: null,
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      secret_token: null,
      user_id: 'user-1',

      release_date: null,
      isrc: null,
      p_line: null,
      buy_link: null,
      record_label: null,
      publisher: null,
      explicit_content: false,
      license_type: 'all_rights_reserved',

      enable_downloads: false,
      enable_offline_listening: false,
      include_in_rss_feed: true,
      display_embed_code: true,
      enable_app_playback: true,

      allow_comments: true,
      show_comments_public: true,
      show_insights_public: true,
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      user_id: 'user-1',
    });

    expect(tracksModel.addTrackTags).not.toHaveBeenCalled();
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith(TRACK_ID, ['user-1']);
    expect(trackProcessingService.processTrackInBackground).toHaveBeenCalledWith({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'audio-url',
    });

    expect(result).toEqual({
      id: TRACK_ID,
      title: 'My Song',
      description: null,
      genre_id: null,
      cover_image: null,
      audio_url: 'audio-url',
      file_size: 12345,
      status: 'processing',
      is_public: true,
      user_id: 'user-1',
      license_type: 'all_rights_reserved',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
      tags: [],
    });
  });
});

// testing uploadTrack geo validations
describe('tracksService.uploadTrack geo validations', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when geo_restriction_type is invalid', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'bad_type',
          geo_regions: [],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is not an array', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'blocked_regions',
          geo_regions: JSON.stringify('EG'),
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is provided with worldwide', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'worldwide',
          geo_regions: ['EG'],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is missing for exclusive_regions', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'exclusive_regions',
          geo_regions: [],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when geo_regions is missing for blocked_regions', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'blocked_regions',
          geo_regions: [],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });
  it('throws when audio upload fails', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockRejectedValue(new Error('audio upload failed'));

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
        },
      })
    ).rejects.toThrow('audio upload failed');

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
    expect(tracksModel.addTrackTags).not.toHaveBeenCalled();
    expect(tracksModel.addTrackArtists).not.toHaveBeenCalled();
  });
  it('throws when cover upload fails after audio upload succeeds', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    const coverImageFile = {
      originalname: 'cover.jpg',
      size: 555,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    storageService.uploadImage.mockRejectedValue(new Error('cover upload failed'));

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile,
        body: {
          title: 'My Song',
        },
      })
    ).rejects.toThrow('cover upload failed');

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
    expect(tracksModel.addTrackTags).not.toHaveBeenCalled();
    expect(tracksModel.addTrackArtists).not.toHaveBeenCalled();
  });

  it('throws when createTrack fails after uploads', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    const coverImageFile = {
      originalname: 'cover.jpg',
      size: 555,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    storageService.uploadImage.mockResolvedValue({
      url: 'cover-url',
    });

    tracksModel.createTrack.mockRejectedValue(new Error('create track failed'));

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile,
        body: {
          title: 'My Song',
        },
      })
    ).rejects.toThrow('create track failed');

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).toHaveBeenCalled();
    expect(tracksModel.createTrack).toHaveBeenCalled();
    expect(tracksModel.addTrackTags).not.toHaveBeenCalled();
    expect(tracksModel.addTrackArtists).not.toHaveBeenCalled();
  });

  it('throws when addTrackTags fails after track creation', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    tracksModel.findOrCreateTagsByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
    });

    tracksModel.addTrackTags.mockRejectedValue(new Error('add tags failed'));

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: JSON.stringify(['chill', 'ambient']),
        },
      })
    ).rejects.toThrow('add tags failed');

    expect(tracksModel.findOrCreateTagsByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(tracksModel.createTrack).toHaveBeenCalled();
    expect(tracksModel.addTrackTags).toHaveBeenCalledWith(TRACK_ID, ['tag-1', 'tag-2']);
    expect(tracksModel.addTrackArtists).not.toHaveBeenCalled();
    expect(trackProcessingService.processTrackInBackground).not.toHaveBeenCalled();
  });

  it('throws when addTrackArtists fails after track creation', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
    });

    tracksModel.addTrackArtists.mockRejectedValue(new Error('add artist failed'));

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
        },
      })
    ).rejects.toThrow('add artist failed');

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(tracksModel.createTrack).toHaveBeenCalled();
    expect(tracksModel.addTrackTags).not.toHaveBeenCalled();
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith(TRACK_ID, ['user-1']);
    expect(trackProcessingService.processTrackInBackground).not.toHaveBeenCalled();
  });
  it('throws 400 when more than 250 geo regions are provided', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    const geoRegions = Array.from({ length: 251 }, () => 'EG');

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'blocked_regions',
          geo_regions: geoRegions,
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when a geo region code is invalid', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'blocked_regions',
          geo_regions: ['EG', 'egy'],
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(storageService.uploadImage).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });
});

// testing tag name validations
describe('tracksService tag name hydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getTrackById maps tag ids to tag names', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
      tags: ['tag-1', 'tag-2'],
    });

    tagModel.findByIds.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    const result = await tracksService.getTrackById(TRACK_ID, null);

    expect(tagModel.findByIds).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
      tags: ['chill', 'ambient'],
    });
  });

  it('getMyTracks maps tag ids to tag names for each returned track', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Track One',
          tags: ['tag-1', 'tag-2'],
        },
        {
          id: 'track-2',
          user_id: 'user-1',
          title: 'Track Two',
          tags: ['tag-2'],
        },
      ],
      total: 2,
    });

    tagModel.findByIds.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    const result = await tracksService.getMyTracks('user-1', {});

    expect(tagModel.findByIds).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    expect(result).toEqual({
      items: [
        {
          id: TRACK_ID,
          user_id: 'user-1',
          title: 'Track One',
          tags: ['chill', 'ambient'],
        },
        {
          id: 'track-2',
          user_id: 'user-1',
          title: 'Track Two',
          tags: ['ambient'],
        },
      ],
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
    });
  });

  it('getTrackById leaves tag names unchanged when tags are already names', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
      tags: ['chill', 'ambient'],
    });

    const result = await tracksService.getTrackById(TRACK_ID, null);

    expect(tagModel.findByIds).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
      tags: ['chill', 'ambient'],
    });
  });
});

describe('tracksService boolean conversion and tag normalization', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('uploadTrack converts string booleans correctly', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
    });

    await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile: null,
      body: {
        title: 'My Song',
        is_public: 'false',
        explicit_content: 'true',
        enable_downloads: 'true',
        enable_offline_listening: 'true',
        include_in_rss_feed: 'false',
        display_embed_code: 'false',
        enable_app_playback: 'false',
        allow_comments: 'false',
        show_comments_public: 'false',
        show_insights_public: 'false',
      },
    });

    expect(tracksModel.createTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: false,
        secret_token: expect.any(String),
        explicit_content: true,
        enable_downloads: true,
        enable_offline_listening: true,
        include_in_rss_feed: false,
        display_embed_code: false,
        enable_app_playback: false,
        allow_comments: false,
        show_comments_public: false,
        show_insights_public: false,
      })
    );
  });

  it('uploadTrack uses defaults when boolean-like fields are empty strings', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
    });

    await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile: null,
      body: {
        title: 'My Song',
        is_public: '',
        explicit_content: '',
        enable_downloads: '',
        include_in_rss_feed: '',
        allow_comments: '',
      },
    });

    expect(tracksModel.createTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        is_public: true,
        explicit_content: false,
        enable_downloads: false,
        include_in_rss_feed: true,
        allow_comments: true,
      })
    );
  });

  it('updateTrack converts string booleans correctly', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        is_public: true,
        explicit_content: false,
        enable_downloads: false,
        enable_offline_listening: false,
        include_in_rss_feed: true,
        display_embed_code: true,
        enable_app_playback: true,
        allow_comments: true,
        show_comments_public: true,
        show_insights_public: true,
        geo_restriction_type: 'worldwide',
        geo_regions: [],
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        is_public: false,
        explicit_content: true,
        enable_downloads: true,
        enable_offline_listening: true,
        include_in_rss_feed: false,
        display_embed_code: false,
        enable_app_playback: false,
        allow_comments: false,
        show_comments_public: false,
        show_insights_public: false,
      });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: TRACK_ID,
    });

    await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {
        explicit_content: 'true',
        enable_downloads: 'true',
        enable_offline_listening: 'true',
        include_in_rss_feed: 'false',
        display_embed_code: 'false',
        enable_app_playback: 'false',
        allow_comments: 'false',
        show_comments_public: 'false',
        show_insights_public: 'false',
      },
      coverImageFile: null,
    });

    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(
      TRACK_ID,
      expect.objectContaining({
        explicit_content: true,
        enable_downloads: true,
        enable_offline_listening: true,
        include_in_rss_feed: false,
        display_embed_code: false,
        enable_app_playback: false,
        allow_comments: false,
        show_comments_public: false,
        show_insights_public: false,
      })
    );
  });

  it('uploadTrack normalizes and deduplicates tags before lookup', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    tracksModel.findOrCreateTagsByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
    });

    const result = await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile: null,
      body: {
        title: 'My Song',
        tags: JSON.stringify([' Chill ', 'ambient', 'CHILL']),
      },
    });

    expect(tracksModel.findOrCreateTagsByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(tracksModel.addTrackTags).toHaveBeenCalledWith(TRACK_ID, ['tag-1', 'tag-2']);
    expect(trackProcessingService.processTrackInBackground).toHaveBeenCalledWith({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'audio-url',
    });
    expect(result).toEqual({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
      tags: ['chill', 'ambient'],
    });
  });
});

describe('tracksService targeted branch coverage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('getTrackById returns an empty tags array without hydrating tag names', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'Tagged Track',
      tags: [],
    });

    const result = await tracksService.getTrackById(TRACK_ID, null);

    expect(tagModel.findByIds).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'Tagged Track',
      tags: [],
    });
  });

  it('uploadTrack rejects tags that parse successfully but are not arrays', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          tags: JSON.stringify('chill'),
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'tags must be a valid array',
    });

    expect(storageService.uploadTrack).not.toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('uploadTrack defaults a blank geo_restriction_type to worldwide', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
    });

    const result = await tracksService.uploadTrack({
      user: { id: 'user-1' },
      audioFile,
      coverImageFile: null,
      body: {
        title: 'My Song',
        geo_restriction_type: '',
      },
    });

    expect(tracksModel.createTrack).toHaveBeenCalledWith(
      expect.objectContaining({
        geo_restriction_type: 'worldwide',
        geo_regions: [],
      })
    );
    expect(result).toEqual({
      id: TRACK_ID,
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
      tags: [],
    });
  });

  it('uploadTrack treats malformed geo_regions JSON as empty before blocked region validation', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    await expect(
      tracksService.uploadTrack({
        user: { id: 'user-1' },
        audioFile,
        coverImageFile: null,
        body: {
          title: 'My Song',
          geo_restriction_type: 'blocked_regions',
          geo_regions: '{bad json',
        },
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'geo_regions is required for the selected geo_restriction_type',
    });

    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(tracksModel.createTrack).not.toHaveBeenCalled();
  });

  it('updateTrack rejects is_public in PATCH payloads', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: { is_public: false },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'Use PATCH /tracks/:track_id/visibility to change track privacy',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('updateTrack clears genre and persists geo settings updates', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        genre: 'Pop',
        geo_restriction_type: 'worldwide',
        geo_regions: [],
      })
      .mockResolvedValueOnce({
        id: TRACK_ID,
        user_id: 'user-1',
        genre: null,
        geo_restriction_type: 'blocked_regions',
        geo_regions: ['EG'],
      });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: TRACK_ID,
    });

    const result = await tracksService.updateTrack({
      trackId: TRACK_ID,
      userId: 'user-1',
      payload: {
        genre: '',
        geo_restriction_type: 'blocked_regions',
        geo_regions: ['EG'],
      },
      coverImageFile: null,
    });

    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(TRACK_ID, {
      genre_id: null,
      geo_restriction_type: 'blocked_regions',
      geo_regions: ['EG'],
    });
    expect(result).toEqual({
      id: TRACK_ID,
      user_id: 'user-1',
      genre: null,
      geo_restriction_type: 'blocked_regions',
      geo_regions: ['EG'],
    });
  });

  it('updateTrack throws when a resolved tag name cannot be mapped back to an id', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'user-1',
    });

    tracksModel.findOrCreateTagsByNames.mockResolvedValue([{ id: 'tag-1', name: 'chill' }]);

    await expect(
      tracksService.updateTrack({
        trackId: TRACK_ID,
        userId: 'user-1',
        payload: {
          tags: JSON.stringify(['Chill', 'Ambient']),
        },
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'TAG_RESOLUTION_FAILED',
      message: 'Failed to resolve tag: ambient',
    });

    expect(tracksModel.replaceTrackTags).not.toHaveBeenCalled();
  });

  it('getTrackWaveform throws 500 when waveform_url is missing', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      waveform_url: null,
    });

    await expect(tracksService.getTrackWaveform(TRACK_ID)).rejects.toMatchObject({
      statusCode: 500,
      code: 'WAVEFORM_URL_MISSING',
    });

    expect(storageService.downloadBlobToBuffer).not.toHaveBeenCalled();
  });

  it('getTrackWaveform throws 500 when waveform data cannot be downloaded', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      waveform_url: 'waveform-url',
    });

    storageService.downloadBlobToBuffer.mockRejectedValue(new Error('blob read failed'));

    await expect(tracksService.getTrackWaveform(TRACK_ID)).rejects.toMatchObject({
      statusCode: 500,
      code: 'WAVEFORM_READ_FAILED',
    });
  });

  it('getTrackWaveform throws 500 when waveform JSON is not an array', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: TRACK_ID,
      user_id: 'owner-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      waveform_url: 'waveform-url',
    });

    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('{"peaks":[1]}', 'utf8'));

    await expect(tracksService.getTrackWaveform(TRACK_ID)).rejects.toMatchObject({
      statusCode: 500,
      code: 'WAVEFORM_INVALID_DATA',
    });
  });
});

