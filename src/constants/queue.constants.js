const QUEUE_BUCKET_VALUES = ['next_up', 'context'];
const QUEUE_SOURCE_TYPE_VALUES = [
  'track',
  'playlist',
  'album',
  'mix',
  'station',
  'genre',
  'liked_tracks',
  'listening_history',
  'reposts',
  'user_tracks',
  'system',
];
const QUEUE_CONTEXT_SOURCE_TYPE_VALUES = [
  'playlist',
  'album',
  'mix',
  'station',
  'genre',
  'liked_tracks',
  'listening_history',
  'reposts',
  'user_tracks',
];
const QUEUE_CONTEXT_INTERACTION_TYPE_VALUES = ['play', 'next_up'];

module.exports = {
  QUEUE_BUCKET_VALUES,
  QUEUE_SOURCE_TYPE_VALUES,
  QUEUE_CONTEXT_SOURCE_TYPE_VALUES,
  QUEUE_CONTEXT_INTERACTION_TYPE_VALUES,
  QUEUE_BUCKETS: new Set(QUEUE_BUCKET_VALUES),
  QUEUE_SOURCE_TYPES: new Set(QUEUE_SOURCE_TYPE_VALUES),
  QUEUE_CONTEXT_SOURCE_TYPES: new Set(QUEUE_CONTEXT_SOURCE_TYPE_VALUES),
  QUEUE_CONTEXT_INTERACTION_TYPES: new Set(QUEUE_CONTEXT_INTERACTION_TYPE_VALUES),
};
