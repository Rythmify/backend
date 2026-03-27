// ============================================================
// tests/tracks.test.js — Unit & integration tests
// Mirrors: src/routes/tracks.routes.js + src/services/tracks.service.js
// ============================================================
jest.mock('../src/models/track.model.js', () => ({
  findTrackByIdWithDetails: jest.fn(),
  updateTrackVisibility: jest.fn(),
  deleteTrackPermanently: jest.fn(),
  findMyTracks: jest.fn(),
}));

jest.mock('../src/services/storage.service.js', () => ({
  deleteManyByUrls: jest.fn(),
}));


const tracksModel = require('../src/models/track.model.js');
const tracksService = require('../src/services/tracks.service.js');
const storageService = require('../src/services/storage.service.js');


// Test Update Track Visibility -
describe('tracksService.updateTrackVisibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates visibility when requester is the owner', async () => {
    // Make fake db responses
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
    });
    tracksModel.updateTrackVisibility.mockResolvedValue({
      id: 'track-1',
      is_public: false,
    });

    const result = await tracksService.updateTrackVisibility('track-1', 'user-1', false);

    expect(result).toEqual({
      track_id: 'track-1',
      is_public: false,
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
    expect(tracksModel.updateTrackVisibility).toHaveBeenCalledWith('track-1', false);
  });

  it('throws 400 when is_public is not boolean', async () => {
    await expect(
      tracksService.updateTrackVisibility('track-1', 'user-1', 'false')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(tracksModel.findTrackByIdWithDetails).not.toHaveBeenCalled();
    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(
      tracksService.updateTrackVisibility('track-1', 'user-1', false)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrackVisibility('track-1', 'user-2', false)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });

    expect(tracksModel.updateTrackVisibility).not.toHaveBeenCalled();
  });
});

// Test Delete Track - 
describe('tracksService.deleteTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes audio and derived assets then removes the track when requester is the owner', async () => {

    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      audio_url: 'audio-url',
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      waveform_url: 'waveform-url',
      cover_image: 'cover-url',
    });

    tracksModel.deleteTrackPermanently.mockResolvedValue({
      id: 'track-1',
    });


    const result = await tracksService.deleteTrack('track-1', 'user-1');

    expect(result).toBeUndefined();
    expect(storageService.deleteManyByUrls).toHaveBeenCalledWith([
      'audio-url',
      'stream-url',
      'preview-url',
      'waveform-url',
      'cover-url',
    ]);
    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
    expect(tracksModel.deleteTrackPermanently).toHaveBeenCalledWith('track-1');
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);
  
    await expect(
      tracksService.deleteTrack('track-1', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });
  
    expect(tracksModel.deleteTrackPermanently).not.toHaveBeenCalled();
    expect(storageService.deleteManyByUrls).not.toHaveBeenCalled();
  });

  it('throws 403 when requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
    });

    await expect(
      tracksService.deleteTrack('track-1', 'user-2')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PERMISSION_NOT_OWNER',
    });

    expect(storageService.deleteManyByUrls).not.toHaveBeenCalled();
    expect(tracksModel.deleteTrackPermanently).not.toHaveBeenCalled();
  });

  it('throws 404 when permanent delete reports no deleted track', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
    });
    tracksModel.deleteTrackPermanently.mockResolvedValue(null);

    await expect(
      tracksService.deleteTrack('track-1', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.deleteTrackPermanently).toHaveBeenCalledWith('track-1');
  });
});

// Testing getTrackByID
describe('tracksService.getTrackById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the track when it exists and is public', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
    });

    const result = await tracksService.getTrackById('track-1', null);

    expect(result).toEqual({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('returns the track when requester is the owner even if track is private', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    const result = await tracksService.getTrackById('track-1', 'user-1');

    expect(result).toEqual({
      id: 'track-1',
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(
      tracksService.getTrackById('track-1', null)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('throws 404 when track is hidden and requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: true,
      title: 'Hidden Track',
    });

    await expect(
      tracksService.getTrackById('track-1', 'user-2')
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('throws 403 when track is private and requester is not the owner', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: false,
      is_hidden: false,
      title: 'Private Track',
    });

    await expect(
      tracksService.getTrackById('track-1', 'user-2')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'RESOURCE_PRIVATE',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });
});

// Testing getMyTracks
describe('tracksService.getMyTracks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated tracks with default page and limit', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [
        {
          id: 'track-1',
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
          id: 'track-1',
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
    await expect(
      tracksService.getMyTracks('user-1', { status: 'draft' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(tracksModel.findMyTracks).not.toHaveBeenCalled();
  });

  it('uses the provided valid status filter', async () => {
    tracksModel.findMyTracks.mockResolvedValue({
      items: [
        {
          id: 'track-1',
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
          id: 'track-1',
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