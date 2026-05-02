jest.mock('../../../src/models/tag.model', () => ({
  getAllTags: jest.fn(),
}));

const tagModel = require('../../../src/models/tag.model');
const tagsService = require('../../../src/services/tags.service');

describe('tags.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sliced tags with pagination metadata', async () => {
    tagModel.getAllTags.mockResolvedValue([
      { id: 'tag-1', name: 'ambient' },
      { id: 'tag-2', name: 'chill' },
      { id: 'tag-3', name: 'house' },
    ]);

    await expect(tagsService.getAllTags({ limit: 2, offset: 1 })).resolves.toEqual({
      data: [
        { id: 'tag-2', name: 'chill' },
        { id: 'tag-3', name: 'house' },
      ],
      pagination: {
        limit: 2,
        offset: 1,
        total: 3,
      },
    });

    expect(tagModel.getAllTags).toHaveBeenCalledTimes(1);
  });

  it('returns an empty page when offset is beyond the total', async () => {
    tagModel.getAllTags.mockResolvedValue([{ id: 'tag-1', name: 'ambient' }]);

    await expect(tagsService.getAllTags({ limit: 10, offset: 5 })).resolves.toEqual({
      data: [],
      pagination: {
        limit: 10,
        offset: 5,
        total: 1,
      },
    });
  });

  it('handles an empty tag list', async () => {
    tagModel.getAllTags.mockResolvedValue([]);

    await expect(tagsService.getAllTags({ limit: 20, offset: 0 })).resolves.toEqual({
      data: [],
      pagination: {
        limit: 20,
        offset: 0,
        total: 0,
      },
    });
  });
});
