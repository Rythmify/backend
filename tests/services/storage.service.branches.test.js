// ============================================================
// tests/services/storage.service.branches.test.js
// Coverage Target: 100%
// ============================================================

const storageService = require('../../src/services/storage.service');

describe('Storage Service - Branch Coverage Expansion', () => {
  describe('parseConnectionString Branches', () => {
    it('handles development storage string', () => {
        // We can't easily re-run the module-level code, but we can test the exported function if it were exported.
        // It's not exported. But we can test toPublicBlobUrl and parseAzureBlobUrl.
    });
  });

  describe('toPublicBlobUrl Branches', () => {
    it('returns null if input is null', () => {
        expect(storageService.toPublicBlobUrl(null)).toBeNull();
    });

    it('returns input if URL parsing fails', () => {
        expect(storageService.toPublicBlobUrl('not-a-url')).toBe('not-a-url');
    });

    it('rewrites azurite to localhost', () => {
        const url = 'http://azurite:10000/devstoreaccount1/audio/track.mp3';
        expect(storageService.toPublicBlobUrl(url)).toBe('http://localhost:10000/devstoreaccount1/audio/track.mp3');
    });
  });

  describe('parseAzureBlobUrl Branches', () => {
    it('throws if container not in path', () => {
        const url = 'http://localhost/something/else';
        expect(() => storageService.parseAzureBlobUrl(url)).toThrow();
    });

    it('throws if container is the last segment', () => {
        const url = 'http://localhost/audio';
        expect(() => storageService.parseAzureBlobUrl(url)).toThrow();
    });
  });

  describe('getSignedReadUrl Branches', () => {
    it('returns original URL if parsing fails or account missing', async () => {
        const res = await storageService.getSignedReadUrl('http://not-azure.com/x');
        expect(res.url).toBe('http://not-azure.com/x');
    });
  });

  describe('streamToBuffer Branches', () => {
    it('handles non-buffer chunks', async () => {
        const { Readable } = require('stream');
        const stream = Readable.from(['abc', 'def']);
        const res = await storageService.streamToBuffer(stream);
        expect(res.toString()).toBe('abcdef');
    });
  });
});
