jest.mock('../../src/services/tracks.service', () => ({
  uploadTrack: jest.fn(),
  getTrackById: jest.fn(),
  updateTrackVisibility: jest.fn(),
  getMyTracks: jest.fn(),
  deleteTrack: jest.fn(),
  updateTrack: jest.fn(),
  getTrackStream: jest.fn(),
}));

jest.mock('../../src/utils/api-response', () => ({
  success: jest.fn(),
}));

const tracksController = require('../../src/controllers/tracks.controller');
const tracksService = require('../../src/services/tracks.service');
const { success } = require('../../src/utils/api-response');

describe('tracksController.uploadTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('throws 400 when audio file is missing', async () => {
    const req = {
      body: { title: 'My Song' },
      files: {},
      user: { id: 'user-1' },
    };
    const res = {};

    await expect(tracksController.uploadTrack(req, res)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksService.uploadTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when title is missing', async () => {
    const req = {
      body: {},
      files: {
        audio_file: [{ originalname: 'song.mp3', size: 123 }],
      },
      user: { id: 'user-1' },
    };
    const res = {};

    await expect(tracksController.uploadTrack(req, res)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksService.uploadTrack).not.toHaveBeenCalled();
  });

  it('throws 400 when title is blank', async () => {
    const req = {
      body: { title: '   ' },
      files: {
        audio_file: [{ originalname: 'song.mp3', size: 123 }],
      },
      user: { id: 'user-1' },
    };
    const res = {};

    await expect(tracksController.uploadTrack(req, res)).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
    });

    expect(tracksService.uploadTrack).not.toHaveBeenCalled();
  });

  it('calls service and returns 201 when request is valid', async () => {
    const req = {
      body: { title: 'My Song', description: 'desc' },
      files: {
        audio_file: [{ originalname: 'song.mp3', size: 123 }],
        cover_image: [{ originalname: 'cover.jpg', size: 55 }],
      },
      user: { id: 'user-1' },
    };
    const res = {};

    const createdTrack = {
      id: 'track-1',
      title: 'My Song',
    };

    tracksService.uploadTrack.mockResolvedValue(createdTrack);

    await tracksController.uploadTrack(req, res);

    expect(tracksService.uploadTrack).toHaveBeenCalledWith({
      user: req.user,
      audioFile: req.files.audio_file[0],
      coverImageFile: req.files.cover_image[0],
      body: req.body,
    });

    expect(success).toHaveBeenCalledWith(
      res,
      createdTrack,
      'Track created and queued for processing.',
      201
    );
  });
});

describe('tracksController.getTrackById', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls service with track_id and null requester when req.user is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
    };
    const res = {};

    const track = {
      id: 'track-1',
      title: 'My Track',
    };

    tracksService.getTrackById.mockResolvedValue(track);

    await tracksController.getTrackById(req, res);

    expect(tracksService.getTrackById).toHaveBeenCalledWith('track-1', null, null);
    expect(success).toHaveBeenCalledWith(res, track, 'Track fetched successfully', 200);
  });

  it('uses req.user.id as requester user id when present', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { id: 'user-1' },
    };
    const res = {};

    const track = {
      id: 'track-1',
      title: 'My Track',
    };

    tracksService.getTrackById.mockResolvedValue(track);

    await tracksController.getTrackById(req, res);

    expect(tracksService.getTrackById).toHaveBeenCalledWith('track-1', 'user-1', null);
    expect(success).toHaveBeenCalledWith(res, track, 'Track fetched successfully', 200);
  });

  it('falls back to req.user.sub when req.user.id is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { sub: 'user-sub-1' },
    };
    const res = {};

    const track = {
      id: 'track-1',
      title: 'My Track',
    };

    tracksService.getTrackById.mockResolvedValue(track);

    await tracksController.getTrackById(req, res);

    expect(tracksService.getTrackById).toHaveBeenCalledWith('track-1', 'user-sub-1', null);
    expect(success).toHaveBeenCalledWith(res, track, 'Track fetched successfully', 200);
  });
});

describe('tracksController.updateTrackVisibility', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls service with track_id, resolved user id, and is_public then returns success', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { is_public: false },
      user: { id: 'user-1' },
    };
    const res = {};

    const updatedTrack = {
      track_id: 'track-1',
      is_public: false,
    };

    tracksService.updateTrackVisibility.mockResolvedValue(updatedTrack);

    await tracksController.updateTrackVisibility(req, res);

    expect(tracksService.updateTrackVisibility).toHaveBeenCalledWith('track-1', 'user-1', false);

    expect(success).toHaveBeenCalledWith(
      res,
      updatedTrack,
      'Track visibility updated successfully',
      200
    );
  });

  it('falls back to req.user.sub when req.user.id is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { is_public: true },
      user: { sub: 'user-sub-1' },
    };
    const res = {};

    const updatedTrack = {
      track_id: 'track-1',
      is_public: true,
    };

    tracksService.updateTrackVisibility.mockResolvedValue(updatedTrack);

    await tracksController.updateTrackVisibility(req, res);

    expect(tracksService.updateTrackVisibility).toHaveBeenCalledWith('track-1', 'user-sub-1', true);

    expect(success).toHaveBeenCalledWith(
      res,
      updatedTrack,
      'Track visibility updated successfully',
      200
    );
  });

  it('falls back to req.user.user_id when id and sub are missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { is_public: true },
      user: { user_id: 'user-legacy-1' },
    };
    const res = {};

    const updatedTrack = {
      track_id: 'track-1',
      is_public: true,
    };

    tracksService.updateTrackVisibility.mockResolvedValue(updatedTrack);

    await tracksController.updateTrackVisibility(req, res);

    expect(tracksService.updateTrackVisibility).toHaveBeenCalledWith(
      'track-1',
      'user-legacy-1',
      true
    );

    expect(success).toHaveBeenCalledWith(
      res,
      updatedTrack,
      'Track visibility updated successfully',
      200
    );
  });
});

describe('tracksController.getMyTracks', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('passes page, limit, and status query params to service and returns success', async () => {
    const req = {
      query: {
        page: '2',
        limit: '10',
        status: 'ready',
      },
      user: { id: 'user-1' },
    };
    const res = {};

    const result = {
      items: [],
      page: 2,
      limit: 10,
      total: 0,
      total_pages: 0,
    };

    tracksService.getMyTracks.mockResolvedValue(result);

    await tracksController.getMyTracks(req, res);

    expect(tracksService.getMyTracks).toHaveBeenCalledWith('user-1', {
      page: '2',
      limit: '10',
      status: 'ready',
    });

    expect(success).toHaveBeenCalledWith(res, result, 'My tracks fetched successfully', 200);
  });

  it('passes undefined query values through when query is empty', async () => {
    const req = {
      query: {},
      user: { id: 'user-1' },
    };
    const res = {};

    const result = {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
    };

    tracksService.getMyTracks.mockResolvedValue(result);

    await tracksController.getMyTracks(req, res);

    expect(tracksService.getMyTracks).toHaveBeenCalledWith('user-1', {
      page: undefined,
      limit: undefined,
      status: undefined,
    });

    expect(success).toHaveBeenCalledWith(res, result, 'My tracks fetched successfully', 200);
  });

  it('falls back to req.user.sub when req.user.id is missing', async () => {
    const req = {
      query: {},
      user: { sub: 'user-sub-1' },
    };
    const res = {};

    const result = {
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      total_pages: 0,
    };

    tracksService.getMyTracks.mockResolvedValue(result);

    await tracksController.getMyTracks(req, res);

    expect(tracksService.getMyTracks).toHaveBeenCalledWith('user-sub-1', {
      page: undefined,
      limit: undefined,
      status: undefined,
    });

    expect(success).toHaveBeenCalledWith(res, result, 'My tracks fetched successfully', 200);
  });
});

describe('tracksController.deleteTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls service with track_id and req.user.id then returns 204 with no content', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { id: 'user-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    tracksService.deleteTrack.mockResolvedValue(undefined);

    await tracksController.deleteTrack(req, res);

    expect(tracksService.deleteTrack).toHaveBeenCalledWith('track-1', 'user-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('falls back to req.user.sub when req.user.id is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { sub: 'user-sub-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    tracksService.deleteTrack.mockResolvedValue(undefined);

    await tracksController.deleteTrack(req, res);

    expect(tracksService.deleteTrack).toHaveBeenCalledWith('track-1', 'user-sub-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('falls back to req.user.user_id when id and sub are missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { user_id: 'legacy-user-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    tracksService.deleteTrack.mockResolvedValue(undefined);

    await tracksController.deleteTrack(req, res);

    expect(tracksService.deleteTrack).toHaveBeenCalledWith('track-1', 'legacy-user-1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
});

describe('tracksController.updateTrack', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls service with trackId, req.body, req.file, and req.user.sub first', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { title: 'New Title', is_public: false },
      file: { originalname: 'cover.jpg', size: 55 },
      user: { id: 'user-1', sub: 'user-sub-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const updatedTrack = {
      id: 'track-1',
      title: 'New Title',
    };

    tracksService.updateTrack.mockResolvedValue(updatedTrack);

    await tracksController.updateTrack(req, res);

    expect(tracksService.updateTrack).toHaveBeenCalledWith({
      trackId: 'track-1',
      userId: 'user-sub-1',
      payload: req.body,
      coverImageFile: req.file,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updatedTrack,
    });
  });

  it('falls back to req.user.id when req.user.sub is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { title: 'New Title' },
      file: null,
      user: { id: 'user-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const updatedTrack = {
      id: 'track-1',
      title: 'New Title',
    };

    tracksService.updateTrack.mockResolvedValue(updatedTrack);

    await tracksController.updateTrack(req, res);

    expect(tracksService.updateTrack).toHaveBeenCalledWith({
      trackId: 'track-1',
      userId: 'user-1',
      payload: req.body,
      coverImageFile: null,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updatedTrack,
    });
  });

  it('falls back to req.user.user_id when sub and id are missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      body: { title: 'New Title' },
      file: null,
      user: { user_id: 'legacy-user-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const updatedTrack = {
      id: 'track-1',
      title: 'New Title',
    };

    tracksService.updateTrack.mockResolvedValue(updatedTrack);

    await tracksController.updateTrack(req, res);

    expect(tracksService.updateTrack).toHaveBeenCalledWith({
      trackId: 'track-1',
      userId: 'legacy-user-1',
      payload: req.body,
      coverImageFile: null,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: updatedTrack,
    });
  });
});

describe('tracksController.getTrackStream', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('calls service with req.user.sub first and returns json success response', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { id: 'user-1', sub: 'user-sub-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const streamData = {
      track_id: 'track-1',
      stream_url: 'stream-url',
    };

    tracksService.getTrackStream.mockResolvedValue(streamData);

    await tracksController.getTrackStream(req, res);

    expect(tracksService.getTrackStream).toHaveBeenCalledWith('track-1', 'user-sub-1', null);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: streamData,
    });
  });

  it('falls back to req.user.id when req.user.sub is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
      user: { id: 'user-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const streamData = {
      track_id: 'track-1',
      stream_url: 'stream-url',
    };

    tracksService.getTrackStream.mockResolvedValue(streamData);

    await tracksController.getTrackStream(req, res);

    expect(tracksService.getTrackStream).toHaveBeenCalledWith('track-1', 'user-1', null);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: streamData,
    });
  });

  it('passes null requester when req.user is missing', async () => {
    const req = {
      params: { track_id: 'track-1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const streamData = {
      track_id: 'track-1',
      stream_url: 'stream-url',
    };

    tracksService.getTrackStream.mockResolvedValue(streamData);

    await tracksController.getTrackStream(req, res);

    expect(tracksService.getTrackStream).toHaveBeenCalledWith('track-1', null, null);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: streamData,
    });
  });
});
