const {
  getRequestCountryCode,
  isTrackGeoBlocked,
  maskPlaybackUrlsForGeo,
} = require('../../src/utils/geo-restrictions');

describe('geo-restrictions utility', () => {
  it('returns null when X-Country-Code is missing', () => {
    expect(getRequestCountryCode({ headers: {} })).toBeNull();
    expect(getRequestCountryCode({})).toBeNull();
    expect(getRequestCountryCode(null)).toBeNull();
  });

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

    expect(
      getRequestCountryCode({
        headers: {
          'X-Country-Code': 'XX',
        },
      })
    ).toBeNull();
  });

  it('normalizes country codes from req.get and header array values', () => {
    expect(
      getRequestCountryCode({
        get: jest.fn().mockReturnValue(' us '),
      })
    ).toBe('US');

    expect(
      getRequestCountryCode({
        headers: {
          'X-Country-Code': ['eg', 'us'],
        },
      })
    ).toBe('EG');
  });

  it.each(['', 'E', 'EGY', '12', '   '])('rejects invalid country code value %p', (countryCode) => {
    expect(
      getRequestCountryCode({
        headers: {
          'X-Country-Code': countryCode,
        },
      })
    ).toBeNull();
  });

  it('never blocks worldwide tracks, even without a country', () => {
    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'worldwide',
          geo_regions: ['EG'],
        },
        null
      )
    ).toBe(false);

    expect(isTrackGeoBlocked({}, 'US')).toBe(false);
  });

  it('applies exclusive region allow-list behavior', () => {
    const track = {
      geo_restriction_type: 'exclusive_regions',
      geo_regions: ['eg', 'US'],
    };

    expect(isTrackGeoBlocked(track, 'EG')).toBe(false);
    expect(isTrackGeoBlocked(track, 'FR')).toBe(true);
    expect(isTrackGeoBlocked(track, null)).toBe(true);
  });

  it('applies blocked region deny-list behavior', () => {
    const track = {
      geo_restriction_type: 'blocked_regions',
      geo_regions: '["eg","US"]',
    };

    expect(isTrackGeoBlocked(track, 'EG')).toBe(true);
    expect(isTrackGeoBlocked(track, 'FR')).toBe(false);
    expect(isTrackGeoBlocked(track, null)).toBe(true);
  });

  it('defaults safely for malformed, null, and unknown geo metadata', () => {
    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'exclusive_regions',
          geo_regions: 'not-json',
        },
        'EG'
      )
    ).toBe(true);

    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'blocked_regions',
          geo_regions: null,
        },
        'EG'
      )
    ).toBe(false);

    expect(
      isTrackGeoBlocked(
        {
          geo_restriction_type: 'custom_regions',
          geo_regions: ['EG'],
        },
        'EG'
      )
    ).toBe(false);
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

  it('keeps playback URLs and annotates allowed tracks', () => {
    const result = maskPlaybackUrlsForGeo(
      {
        id: 'track-1',
        audio_url: 'audio-url',
        stream_url: 'stream-url',
        preview_url: 'preview-url',
        waveform_url: 'waveform-url',
        geo_restriction_type: 'exclusive_regions',
        geo_regions: ['EG'],
      },
      'EG'
    );

    expect(result).toMatchObject({
      audio_url: 'audio-url',
      stream_url: 'stream-url',
      preview_url: 'preview-url',
      waveform_url: 'waveform-url',
      is_geo_blocked: false,
      playback_restriction_reason: null,
    });
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

  it('does not add absent playback URL fields when masking a blocked track', () => {
    const result = maskPlaybackUrlsForGeo(
      {
        id: 'track-1',
        title: 'Visible title',
        audio_url: 'audio-url',
        geo_restriction_type: 'exclusive_regions',
        geo_regions: ['US'],
      },
      'EG'
    );

    expect(result.audio_url).toBeNull();
    expect(result).not.toHaveProperty('stream_url');
    expect(result).not.toHaveProperty('preview_url');
    expect(result).not.toHaveProperty('waveform_url');
  });

  it('returns nullish tracks unchanged when masking playback urls', () => {
    expect(maskPlaybackUrlsForGeo(null, 'EG')).toBeNull();
    expect(maskPlaybackUrlsForGeo(undefined, 'EG')).toBeUndefined();
  });
});
