// tests/tags-genres.controller.test.js
jest.mock('../src/services/tags.service', () => ({
  getAllTags: jest.fn(),
}));

jest.mock('../src/services/genres.service', () => ({
  getAllGenres: jest.fn(),
}));

jest.mock('../src/utils/api-response', () => ({
  success: jest.fn(),
}));

const tagsController = require('../src/controllers/tags.controller');
const genresController = require('../src/controllers/genres.controller');
const tagsService = require('../src/services/tags.service');
const genresService = require('../src/services/genres.service');
const { success } = require('../src/utils/api-response');

describe('tagsController.getAllTags', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns all tags with success response', async () => {
    const req = {};
    const res = {};

    const data = {
      items: [
        { id: 'tag-1', name: 'ambient' },
        { id: 'tag-2', name: 'chill' },
      ],
    };

    tagsService.getAllTags.mockResolvedValue(data);

    await tagsController.getAllTags(req, res);

    expect(tagsService.getAllTags).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith(res, data, 'Tags fetched successfully', 200);
  });
});

describe('genresController.getAllGenres', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns all genres with success response', async () => {
    const req = {};
    const res = {};

    const data = {
      items: [
        { id: 'genre-1', name: 'Pop' },
        { id: 'genre-2', name: 'Rock' },
      ],
    };

    genresService.getAllGenres.mockResolvedValue(data);

    await genresController.getAllGenres(req, res);

    expect(genresService.getAllGenres).toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith(res, data, 'Genres fetched successfully', 200);
  });
});
