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