/* Builds reusable viewer-personalization SELECT fragments for track-shaped queries. */
const buildTrackPersonalizationSelect = ({
  requesterUserIdParam,
  trackAlias = 't',
  includeIsLikedByMe = true,
  includeIsRepostedByMe = true,
  includeIsArtistFollowedByMe = true,
}) => {
  const selectClauses = [];

  if (includeIsLikedByMe) {
    selectClauses.push(`
      CASE
        WHEN ${requesterUserIdParam}::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM track_likes tl
          WHERE tl.track_id = ${trackAlias}.id
            AND tl.user_id = ${requesterUserIdParam}::uuid
        )
      END AS is_liked_by_me
    `);
  }

  if (includeIsRepostedByMe) {
    selectClauses.push(`
      CASE
        WHEN ${requesterUserIdParam}::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM track_reposts tr
          WHERE tr.track_id = ${trackAlias}.id
            AND tr.user_id = ${requesterUserIdParam}::uuid
        )
      END AS is_reposted_by_me
    `);
  }

  if (includeIsArtistFollowedByMe) {
    selectClauses.push(`
      CASE
        WHEN ${requesterUserIdParam}::uuid IS NULL THEN false
        ELSE EXISTS (
          SELECT 1
          FROM follows f
          WHERE f.follower_id = ${requesterUserIdParam}::uuid
            AND f.following_id = ${trackAlias}.user_id
        )
      END AS is_artist_followed_by_me
    `);
  }

  return selectClauses.join(',\n');
};

module.exports = {
  buildTrackPersonalizationSelect,
};
