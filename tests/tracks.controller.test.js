jest.mock('../src/services/tracks.service', () => ({
  uploadTrack: jest.fn(),
}));

jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
}));

const tracksController = require('../src/controllers/tracks.controller');
const tracksService = require('../src/services/tracks.service');
const { success } = require('../src/utils/api-response');

describe('tracksController.uploadTrack', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 400 when audio file is missing', async () => {
    const req = {
      body: { title: 'My Song' },
      files: {},
      user: { id: 'user-1' },
    };
    const res = {};

    await expect(
      tracksController.uploadTrack(req, res)
    ).rejects.toMatchObject({
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

    await expect(
      tracksController.uploadTrack(req, res)
    ).rejects.toMatchObject({
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

    await expect(
      tracksController.uploadTrack(req, res)
    ).rejects.toMatchObject({
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