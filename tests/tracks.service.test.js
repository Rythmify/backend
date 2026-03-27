// ============================================================
// tests/tracks.test.js — Unit & integration tests
// Mirrors: src/routes/tracks.routes.js + src/services/tracks.service.js
// ============================================================
jest.mock('../src/models/track.model.js', () => ({
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
}));

jest.mock('../src/models/tag.model.js', () => ({
  findByNames: jest.fn(),
  findByIds: jest.fn(),
}));

jest.mock('../src/services/storage.service.js', () => ({
  deleteManyByUrls: jest.fn(),
  uploadTrack: jest.fn(),
  uploadImage: jest.fn(),
  deleteAllVersionsByUrl: jest.fn(),
}));

const tracksModel = require('../src/models/track.model.js');
const tracksService = require('../src/services/tracks.service.js');
const storageService = require('../src/services/storage.service.js');
const tagModel = require('../src/models/tag.model.js');

// Test Update Track Visibility -
describe('tracksService.updateTrackVisibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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
    jest.resetAllMocks();
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

    await expect(tracksService.deleteTrack('track-1', 'user-1')).rejects.toMatchObject({
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

    await expect(tracksService.deleteTrack('track-1', 'user-2')).rejects.toMatchObject({
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

    await expect(tracksService.deleteTrack('track-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TRACK_NOT_FOUND',
    });

    expect(tracksModel.deleteTrackPermanently).toHaveBeenCalledWith('track-1');
  });
});

// Testing getTrackByID
describe('tracksService.getTrackById', () => {
  beforeEach(() => {
    jest.resetAllMocks();
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

    await expect(tracksService.getTrackById('track-1', null)).rejects.toMatchObject({
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

    await expect(tracksService.getTrackById('track-1', 'user-2')).rejects.toMatchObject({
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

    await expect(tracksService.getTrackById('track-1', 'user-2')).rejects.toMatchObject({
      statusCode: 403,
      code: 'RESOURCE_PRIVATE',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
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
    await expect(tracksService.getMyTracks('user-1', { status: 'draft' })).rejects.toMatchObject({
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

// Testing getTrackStream
describe('tracksService.getTrackStream', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns stream_url when stream_url exists', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: 'stream-url',
      audio_url: 'audio-url',
    });

    const result = await tracksService.getTrackStream('track-1', null);

    expect(result).toEqual({
      track_id: 'track-1',
      stream_url: 'stream-url',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('falls back to audio_url when stream_url is missing', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: null,
      audio_url: 'audio-url',
    });

    const result = await tracksService.getTrackStream('track-1', null);

    expect(result).toEqual({
      track_id: 'track-1',
      stream_url: 'audio-url',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('throws 503 when track status is failed', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'failed',
      stream_url: null,
      audio_url: 'audio-url',
    });

    await expect(tracksService.getTrackStream('track-1', null)).rejects.toMatchObject({
      statusCode: 503,
      code: 'UPLOAD_PROCESSING_FAILED',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });

  it('throws 500 when no playable audio is available', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      status: 'ready',
      stream_url: null,
      audio_url: null,
    });

    await expect(tracksService.getTrackStream('track-1', null)).rejects.toMatchObject({
      statusCode: 500,
      code: 'STREAM_URL_MISSING',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });
});

// testing updateTrack
describe('tracksService.updateTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 404 when track not found', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue(null);

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
        userId: 'user-1',
        payload: {},
        coverImageFile: null,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });

    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
  });

  it('throws 400 when no valid fields are provided to update', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
      user_id: 'user-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
        id: 'track-1',
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
        id: 'track-1',
        user_id: 'user-1',
        title: 'New Title',
        description: 'New Description',
        is_public: false,
      });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: 'track-1',
    });

    const result = await tracksService.updateTrack({
      trackId: 'track-1',
      userId: 'user-1',
      payload: {
        title: 'New Title',
        description: 'New Description',
        is_public: false,
      },
      coverImageFile: null,
    });

    expect(result).toEqual({
      id: 'track-1',
      user_id: 'user-1',
      title: 'New Title',
      description: 'New Description',
      is_public: false,
    });

    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith('track-1', {
      title: 'New Title',
      description: 'New Description',
      is_public: false,
    });
  });

  it('throws 404 when updateTrackFields returns null after scalar update', async () => {
    tracksModel.findTrackByIdWithDetails.mockResolvedValue({
      id: 'track-1',
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
        trackId: 'track-1',
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
        id: 'track-1',
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
      id: 'track-1',
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
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
        trackId: 'track-1',
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
      id: 'track-1',
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
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    tracksModel.getGenreIdByName.mockResolvedValue(null);

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      geo_restriction_type: 'worldwide',
      geo_regions: [],
    });

    await expect(
      tracksService.updateTrack({
        trackId: 'track-1',
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
        id: 'track-1',
        user_id: 'user-1',
        title: 'Old Title',
      })
      .mockResolvedValueOnce({
        id: 'track-1',
        user_id: 'user-1',
        title: 'Old Title',
        tags: ['tag-1', 'tag-2'],
      });

    tagModel.findByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    const result = await tracksService.updateTrack({
      trackId: 'track-1',
      userId: 'user-1',
      payload: {
        tags: JSON.stringify(['Chill', ' ambient ']),
      },
      coverImageFile: null,
    });

    expect(tagModel.findByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
    expect(tracksModel.replaceTrackTags).toHaveBeenCalledWith('track-1', ['tag-1', 'tag-2']);

    expect(result).toEqual({
      id: 'track-1',
      user_id: 'user-1',
      title: 'Old Title',
      tags: ['chill', 'ambient'],
    });
  });

  it('replaces tags with an empty list when payload.tags is empty array', async () => {
    tracksModel.findTrackByIdWithDetails
      .mockResolvedValueOnce({
        id: 'track-1',
        user_id: 'user-1',
        title: 'Old Title',
      })
      .mockResolvedValueOnce({
        id: 'track-1',
        user_id: 'user-1',
        title: 'Old Title',
        tags: [],
      });

    const result = await tracksService.updateTrack({
      trackId: 'track-1',
      userId: 'user-1',
      payload: {
        tags: JSON.stringify([]),
      },
      coverImageFile: null,
    });

    expect(tagModel.findByNames).not.toHaveBeenCalled();
    expect(tracksModel.updateTrackFields).not.toHaveBeenCalled();
    expect(tracksModel.replaceTrackTags).toHaveBeenCalledWith('track-1', []);

    expect(result).toEqual({
      id: 'track-1',
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
        id: 'track-1',
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
        id: 'track-1',
        user_id: 'user-1',
        cover_image: 'new-cover-url',
        title: 'Old Title',
      });

    storageService.uploadImage.mockResolvedValue({
      url: 'new-cover-url',
    });

    tracksModel.updateTrackFields.mockResolvedValue({
      id: 'track-1',
    });

    const result = await tracksService.updateTrack({
      trackId: 'track-1',
      userId: 'user-1',
      payload: {},
      coverImageFile,
    });

    expect(storageService.uploadImage).toHaveBeenCalled();
    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({
        cover_image: 'new-cover-url',
      })
    );
    expect(storageService.deleteAllVersionsByUrl).toHaveBeenCalledWith('old-cover-url');

    expect(result).toEqual({
      id: 'track-1',
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

  it('throws 400 when unknown tags are provided', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 123,
    };

    tagModel.findByNames.mockResolvedValue([{ id: 'tag-1', name: 'chill' }]);

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
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tagModel.findByNames).toHaveBeenCalledWith(['chill', 'ambient']);
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

    tagModel.findByNames.mockResolvedValue([
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
      id: 'track-1',
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

    expect(tagModel.findByNames).toHaveBeenCalledWith(['chill', 'ambient']);
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

    expect(tracksModel.addTrackTags).toHaveBeenCalledWith('track-1', ['tag-1', 'tag-2']);
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith('track-1', ['user-1']);

    expect(result).toEqual({
      id: 'track-1',
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
      id: 'track-1',
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
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith('track-1', ['user-1']);

    expect(result).toEqual({
      id: 'track-1',
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

    tagModel.findByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: 'track-1',
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

    expect(tagModel.findByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(storageService.uploadTrack).toHaveBeenCalled();
    expect(tracksModel.createTrack).toHaveBeenCalled();
    expect(tracksModel.addTrackTags).toHaveBeenCalledWith('track-1', ['tag-1', 'tag-2']);
    expect(tracksModel.addTrackArtists).not.toHaveBeenCalled();
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
      id: 'track-1',
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
    expect(tracksModel.addTrackArtists).toHaveBeenCalledWith('track-1', ['user-1']);
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
      id: 'track-1',
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

    const result = await tracksService.getTrackById('track-1', null);

    expect(tagModel.findByIds).toHaveBeenCalledWith(['tag-1', 'tag-2']);
    expect(result).toEqual({
      id: 'track-1',
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
          id: 'track-1',
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
          id: 'track-1',
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
      id: 'track-1',
      user_id: 'user-1',
      is_public: true,
      is_hidden: false,
      title: 'My Track',
      tags: ['chill', 'ambient'],
    });

    const result = await tracksService.getTrackById('track-1', null);

    expect(tagModel.findByIds).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: 'track-1',
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
      id: 'track-1',
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
      id: 'track-1',
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
        id: 'track-1',
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
        id: 'track-1',
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
      id: 'track-1',
    });

    await tracksService.updateTrack({
      trackId: 'track-1',
      userId: 'user-1',
      payload: {
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
      coverImageFile: null,
    });

    expect(tracksModel.updateTrackFields).toHaveBeenCalledWith(
      'track-1',
      expect.objectContaining({
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
      })
    );
  });

  it('uploadTrack normalizes and deduplicates tags before lookup', async () => {
    const audioFile = {
      originalname: 'song.mp3',
      size: 12345,
    };

    tagModel.findByNames.mockResolvedValue([
      { id: 'tag-1', name: 'chill' },
      { id: 'tag-2', name: 'ambient' },
    ]);

    storageService.uploadTrack.mockResolvedValue({
      url: 'audio-url',
    });

    tracksModel.createTrack.mockResolvedValue({
      id: 'track-1',
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

    expect(tagModel.findByNames).toHaveBeenCalledWith(['chill', 'ambient']);
    expect(tracksModel.addTrackTags).toHaveBeenCalledWith('track-1', ['tag-1', 'tag-2']);
    expect(result).toEqual({
      id: 'track-1',
      title: 'My Song',
      audio_url: 'audio-url',
      status: 'processing',
      user_id: 'user-1',
      tags: ['chill', 'ambient'],
    });
  });
});
