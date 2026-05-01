const PLAYBACK_URL_FIELDS = ['audio_url', 'stream_url', 'preview_url', 'waveform_url'];
const REGION_RESTRICTED_REASON = 'region_restricted';

const normalizeCountryCode = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
};

const getHeaderValue = (headers, headerName) => {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  const requestedHeaderName = headerName.toLowerCase();
  const matchedHeaderName = Object.keys(headers).find(
    (key) => key.toLowerCase() === requestedHeaderName
  );

  const value = matchedHeaderName ? headers[matchedHeaderName] : null;
  return Array.isArray(value) ? value[0] : value;
};

const getRequestCountryCode = (req) => {
  const rawCountryCode =
    typeof req?.get === 'function'
      ? req.get('X-Country-Code')
      : getHeaderValue(req?.headers, 'X-Country-Code');

  return normalizeCountryCode(rawCountryCode);
};

const normalizeGeoRegions = (geoRegions) => {
  if (Array.isArray(geoRegions)) {
    return geoRegions.map(normalizeCountryCode).filter(Boolean);
  }

  if (typeof geoRegions === 'string') {
    try {
      const parsed = JSON.parse(geoRegions);
      return normalizeGeoRegions(parsed);
    } catch {
      return [];
    }
  }

  return [];
};

const isTrackGeoBlocked = (track, countryCode) => {
  const restrictionType = track?.geo_restriction_type || 'worldwide';
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (restrictionType === 'worldwide') {
    return false;
  }

  if (!normalizedCountryCode) {
    return true;
  }

  const geoRegions = new Set(normalizeGeoRegions(track?.geo_regions));

  if (restrictionType === 'exclusive_regions') {
    return !geoRegions.has(normalizedCountryCode);
  }

  if (restrictionType === 'blocked_regions') {
    return geoRegions.has(normalizedCountryCode);
  }

  return false;
};

const maskPlaybackUrlsForGeo = (track, countryCode) => {
  if (!track) {
    return track;
  }

  const isGeoBlocked = isTrackGeoBlocked(track, countryCode);
  const hasGeoMetadata =
    Object.prototype.hasOwnProperty.call(track, 'geo_restriction_type') ||
    Object.prototype.hasOwnProperty.call(track, 'geo_regions');
  const shouldAnnotate = isGeoBlocked || hasGeoMetadata || countryCode !== null;
  const maskedTrack = {
    ...track,
  };

  if (shouldAnnotate) {
    maskedTrack.is_geo_blocked = isGeoBlocked;
    maskedTrack.playback_restriction_reason = isGeoBlocked ? REGION_RESTRICTED_REASON : null;
  }

  if (isGeoBlocked) {
    PLAYBACK_URL_FIELDS.forEach((fieldName) => {
      if (Object.prototype.hasOwnProperty.call(maskedTrack, fieldName)) {
        maskedTrack[fieldName] = null;
      }
    });
  }

  return maskedTrack;
};

module.exports = {
  REGION_RESTRICTED_REASON,
  getRequestCountryCode,
  isTrackGeoBlocked,
  maskPlaybackUrlsForGeo,
};
