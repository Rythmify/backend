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

// Testing getTrackStream
describe('tracksService.getTrackStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    await expect(
      tracksService.getTrackStream('track-1', null)
    ).rejects.toMatchObject({
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

    await expect(
      tracksService.getTrackStream('track-1', null)
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'STREAM_URL_MISSING',
    });

    expect(tracksModel.findTrackByIdWithDetails).toHaveBeenCalledWith('track-1');
  });
});

// testing updateTrack
describe('tracksService.updateTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.clearAllMocks();
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
    jest.clearAllMocks();
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