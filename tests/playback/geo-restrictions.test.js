const {
  getRequestCountryCode,
  isTrackGeoBlocked,
  maskPlaybackUrlsForGeo,
} = require('../../src/utils/geo-restrictions');

describe('geo-restrictions utility', () => {
  it('extracts and normalizes X-Country-Code from req.get or headers', () => {
    expect(getRequestCountryCode({ get: jest.fn().mockReturnValue(' eg ') })).toBe('EG');
    expect(getRequestCountryCode({ headers: { 'X-Country-Code': 'EG' } })).toBe('EG');
    expect(getRequestCountryCode({ headers: { 'x-country-code': ['us', 'eg'] } })).toBe('US');
    expect(getRequestCountryCode({ headers: {} })).toBeNull();
    expect(getRequestCountryCode(null)).toBeNull();
  });

  it.each(['', 'E', 'EGY', '12', '   ', 'XX', null])('rejects invalid country code %p', (value) => {
    expect(getRequestCountryCode({ headers: { 'X-Country-Code': value } })).toBeNull();
  });

  it('applies worldwide, exclusive, blocked, malformed, and unknown restriction behavior', () => {
    expect(isTrackGeoBlocked({ geo_restriction_type: 'worldwide' }, null)).toBe(false);

    expect(
      isTrackGeoBlocked({ geo_restriction_type: 'exclusive_regions', geo_regions: ['eg'] }, 'EG')
    ).toBe(false);
    expect(
      isTrackGeoBlocked(
        { geo_restriction_type: 'exclusive_regions', geo_regions: '["US"]' },
        'EG'
      )
    ).toBe(true);
    expect(
      isTrackGeoBlocked({ geo_restriction_type: 'exclusive_regions', geo_regions: ['US'] }, null)
    ).toBe(true);

    expect(
      isTrackGeoBlocked(
        { geo_restriction_type: 'blocked_regions', geo_regions: '["EG"]' },
        'EG'
      )
    ).toBe(true);
    expect(
      isTrackGeoBlocked({ geo_restriction_type: 'blocked_regions', geo_regions: null }, 'EG')
    ).toBe(false);
    expect(
      isTrackGeoBlocked({ geo_restriction_type: 'blocked_regions', geo_regions: ['US'] }, null)
    ).toBe(true);

    expect(
      isTrackGeoBlocked(
        { geo_restriction_type: 'exclusive_regions', geo_regions: 'not-json' },
        'EG'
      )
    ).toBe(true);
    expect(
      isTrackGeoBlocked({ geo_restriction_type: 'custom_regions', geo_regions: ['EG'] }, 'EG')
    ).toBe(false);
  });

  it('keeps allowed track URLs and annotates geo metadata', () => {
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

  it('masks only playback media fields for blocked tracks and preserves metadata', () => {
    const result = maskPlaybackUrlsForGeo(
      {
        id: 'track-1',
        title: 'Visible title',
        cover_image: 'cover-url',
        audio_url: 'audio-url',
        stream_url: 'stream-url',
        preview_url: 'preview-url',
        waveform_url: 'waveform-url',
        play_count: 10,
        like_count: 4,
        geo_restriction_type: 'blocked_regions',
        geo_regions: ['EG'],
      },
      'EG'
    );

    expect(result).toMatchObject({
      title: 'Visible title',
      cover_image: 'cover-url',
      audio_url: null,
      stream_url: null,
      preview_url: null,
      waveform_url: null,
      play_count: 10,
      like_count: 4,
      is_geo_blocked: true,
      playback_restriction_reason: 'region_restricted',
    });
  });

  it('returns nullish tracks unchanged and does not invent absent URL fields', () => {
    expect(maskPlaybackUrlsForGeo(null, 'EG')).toBeNull();
    expect(maskPlaybackUrlsForGeo(undefined, 'EG')).toBeUndefined();

    const result = maskPlaybackUrlsForGeo(
      {
        id: 'track-1',
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
});
