const {
  getRequestCountryCode,
  isTrackGeoBlocked,
  maskPlaybackUrlsForGeo,
} = require('../../src/utils/geo-restrictions');

describe('geo-restrictions utility', () => {
  it('extracts X-Country-Code case-insensitively and normalizes it', () => {
    expect(
      getRequestCountryCode({
        headers: {
          'x-country-code': 'eg',
        },
      })
    ).toBe('EG');

    expect(
      getRequestCountryCode({
        headers: {
          'X-Country-Code': 'USA',
        },
      })
    ).toBeNull();
  });

  it('fails closed for restricted tracks when the country is unknown', () => {
    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'exclusive_regions',
          geo_regions: ['EG'],
        },
        null
      )
    ).toBe(true);

    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'blocked_regions',
          geo_regions: ['US'],
        },
        null
      )
    ).toBe(true);
  });

  it('masks only playback urls when a track is geo blocked', () => {
    const result = maskPlaybackUrlsForGeo(
      {
        id: 'track-1',
        title: 'Visible title',
        cover_image: 'cover-url',
        audio_url: 'audio-url',
        stream_url: 'stream-url',
        preview_url: 'preview-url',
        waveform_url: 'waveform-url',
        like_count: 12,
        geo_restriction_type: 'blocked_regions',
        geo_regions: ['EG'],
      },
      'EG'
    );

    expect(result).toMatchObject({
      id: 'track-1',
      title: 'Visible title',
      cover_image: 'cover-url',
      audio_url: null,
      stream_url: null,
      preview_url: null,
      waveform_url: null,
      like_count: 12,
      is_geo_blocked: true,
      playback_restriction_reason: 'region_restricted',
    });
  });
});
