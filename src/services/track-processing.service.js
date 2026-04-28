// ============================================================
// services/track-processing.service.js
// Real audio post-upload processing
// - reads uploaded audio
// - extracts duration + bitrate
// - generates middle 30s preview, or the full track when shorter
// - generates waveform JSON
// - marks track ready / failed
// ============================================================

const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const AppError = require('../utils/app-error');
const tracksModel = require('../models/track.model');
const storageService = require('./storage.service');

const FFMPEG_BIN = 'ffmpeg';
const FFPROBE_BIN = 'ffprobe';

const PREVIEW_SECONDS = 30;
const MASTER_WAVEFORM_SAMPLES = 1800;
const DISPLAY_WAVEFORM_SAMPLES = 200;
const DISPLAY_WAVEFORM_PERCENTILE = 0.75;
const DISPLAY_WAVEFORM_PERCENTILE_WEIGHT = 0.7;
const DISPLAY_WAVEFORM_AVG_WEIGHT = 0.3;
const WAVEFORM_SOURCE_HEIGHT = 256;
const WAVEFORM_SOURCE_PIXEL_THRESHOLD = 32;
const WAVEFORM_SOURCE_SCALE = 'sqrt';
const WAVEFORM_DEBUG_STATS = process.env.WAVEFORM_DEBUG_STATS === 'true';

/* Runs an ffmpeg/ffprobe command and captures stdout/stderr for error reporting. */
const runCommand = (bin, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(
        new AppError(
          `Failed to start ${bin}: ${err.message}`,
          500,
          'TRACK_PROCESSING_COMMAND_FAILED'
        )
      );
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new AppError(
            `${bin} exited with code ${code}\n${stderr || stdout}`.trim(),
            500,
            'TRACK_PROCESSING_COMMAND_FAILED'
          )
        );
      }

      resolve({ stdout, stderr });
    });
  });

// runs ffprobe in terminal to get duration and bitrate of the audio file
const getAudioMetadata = async (inputPath) => {
  // ffprobe returns structured metadata that the service uses to populate duration and bitrate fields.
  const { stdout } = await runCommand(FFPROBE_BIN, [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ]);

  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new AppError(
      'Failed to parse ffprobe output',
      500,
      'TRACK_PROCESSING_METADATA_PARSE_FAILED'
    );
  }

  const audioStream = (parsed.streams || []).find((stream) => stream.codec_type === 'audio');
  const format = parsed.format || {};

  const durationSeconds = Math.round(Number(format.duration || audioStream?.duration || 0));

  const bitrateBps = Number(format.bit_rate || audioStream?.bit_rate || 0);
  const bitrateKbps = bitrateBps > 0 ? Math.round(bitrateBps / 1000) : null;

  return {
    duration: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    bitrate: bitrateKbps,
  };
};

// keeps the middle 30 seconds for preview, or the full track from the start when shorter
const generatePreviewFile = async (inputPath, outputPath, durationSeconds) => {
  const duration = Number(durationSeconds);
  const hasValidDuration = Number.isFinite(duration) && duration > 0;
  const previewDuration =
    hasValidDuration && duration <= PREVIEW_SECONDS ? duration : PREVIEW_SECONDS;
  const previewStart =
    hasValidDuration && duration > PREVIEW_SECONDS
      ? Math.max(0, (duration - PREVIEW_SECONDS) / 2)
      : null;

  const args = ['-y'];

  if (previewStart !== null) {
    args.push('-ss', String(previewStart));
  }

  args.push(
    '-i',
    inputPath,
    '-t',
    String(previewDuration),
    '-vn',
    '-acodec',
    'mp3',
    '-b:a',
    '128k',
    outputPath
  );

  await runCommand(FFMPEG_BIN, args);
};

// generates a high-resolution waveform image that becomes the source of truth for the display waveform
const exportWaveformSourceImage = async (inputPath, outputPath) => {
  await runCommand(FFMPEG_BIN, [
    '-y',
    '-i',
    inputPath,
    '-filter_complex',
    `aformat=channel_layouts=mono,showwavespic=s=${MASTER_WAVEFORM_SAMPLES}x${WAVEFORM_SOURCE_HEIGHT}:colors=white:scale=${WAVEFORM_SOURCE_SCALE}`,
    '-frames:v',
    '1',
    '-pix_fmt',
    'gray',
    outputPath,
  ]);
};

const clampWaveformValue = (value) => Math.min(Math.max(value, 0), 1);

const roundWaveform = (waveform) =>
  waveform.map((value) => Number(clampWaveformValue(value).toFixed(3)));

const getWaveformPercentile = (values, percentile) => {
  if (!values.length) {
    return 0;
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const percentileIndex = Math.min(
    sortedValues.length - 1,
    Math.floor((sortedValues.length - 1) * percentile)
  );

  return sortedValues[percentileIndex];
};

const getWaveformRange = (waveform) => {
  if (!waveform.length) {
    return { min: 0, max: 0 };
  }

  return waveform.reduce(
    (range, value) => ({
      min: Math.min(range.min, value),
      max: Math.max(range.max, value),
    }),
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );
};

const parsePgmImage = (buffer) => {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  let index = 0;
  const isWhitespace = (byte) => byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09;

  const readToken = () => {
    while (index < buffer.length) {
      if (buffer[index] === 0x23) {
        while (index < buffer.length && buffer[index] !== 0x0a) index += 1;
        continue;
      }

      if (!isWhitespace(buffer[index])) {
        break;
      }

      index += 1;
    }

    const start = index;

    while (index < buffer.length && !isWhitespace(buffer[index])) {
      index += 1;
    }

    return buffer.toString('ascii', start, index);
  };

  const magic = readToken();
  const width = Number(readToken());
  const height = Number(readToken());
  const maxValue = Number(readToken());

  if (magic !== 'P5' || !Number.isInteger(width) || !Number.isInteger(height) || maxValue !== 255) {
    throw new AppError(
      'Waveform source image is invalid',
      500,
      'TRACK_PROCESSING_WAVEFORM_SOURCE_INVALID'
    );
  }

  if (index < buffer.length && isWhitespace(buffer[index])) {
    index += 1;
  }

  const expectedPixelCount = width * height;
  const pixels = buffer.subarray(index, index + expectedPixelCount);

  if (pixels.length !== expectedPixelCount) {
    throw new AppError(
      'Waveform source image is truncated',
      500,
      'TRACK_PROCESSING_WAVEFORM_SOURCE_INVALID'
    );
  }

  return { width, height, pixels };
};

const extractWaveformSourceColumns = (buffer, fallbackColumns = MASTER_WAVEFORM_SAMPLES) => {
  const image = parsePgmImage(buffer);

  if (!image) {
    return Array.from({ length: fallbackColumns }, () => 0);
  }

  const { width, height, pixels } = image;
  const columns = [];

  for (let x = 0; x < width; x += 1) {
    let activePixels = 0;

    for (let y = 0; y < height; y += 1) {
      if (pixels[y * width + x] > WAVEFORM_SOURCE_PIXEL_THRESHOLD) {
        activePixels += 1;
      }
    }

    columns.push(activePixels > 0 ? Math.max(0, (activePixels - 1) / Math.max(height - 1, 1)) : 0);
  }

  return columns;
};

const resampleWaveformColumns = (columns, sampleCount = DISPLAY_WAVEFORM_SAMPLES) => {
  if (!columns.length) {
    return Array.from({ length: sampleCount }, () => 0);
  }

  const sampled = [];

  for (let bucket = 0; bucket < sampleCount; bucket += 1) {
    const start = Math.floor((bucket * columns.length) / sampleCount);
    const end = Math.floor(((bucket + 1) * columns.length) / sampleCount);
    const bucketEnd = Math.max(Math.min(columns.length, end), Math.min(columns.length, start + 1));
    let total = 0;
    const windowValues = [];

    for (let i = start; i < bucketEnd; i += 1) {
      const value = columns[i];
      total += value;
      windowValues.push(value);
    }

    if (!windowValues.length) {
      sampled.push(0);
      continue;
    }

    const average = total / windowValues.length;
    const percentileValue = getWaveformPercentile(windowValues, DISPLAY_WAVEFORM_PERCENTILE);

    sampled.push(
      percentileValue * DISPLAY_WAVEFORM_PERCENTILE_WEIGHT + average * DISPLAY_WAVEFORM_AVG_WEIGHT
    );
  }

  return sampled;
};

const normalizeWaveformValues = (waveform) => {
  const maxValue = Math.max(...waveform, 0);

  if (maxValue <= 0) {
    return waveform;
  }

  return waveform.map((value) => value / maxValue);
};

// deletes temp files after processing is done or if any step fails
const cleanupDirectory = async (dirPath) => {
  if (!dirPath) return;
  await fs.rm(dirPath, { recursive: true, force: true });
};

// main processing function - runs all steps and updates track record with new asset URLs and metadata
const processTrackAssets = async ({ trackId, userId, audioUrl }) => {
  let tempDir;

  try {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rythmify-track-'));

    const inputPath = path.join(tempDir, 'input-audio');
    const previewPath = path.join(tempDir, 'preview.mp3');
    const waveformSourcePath = path.join(tempDir, 'waveform-source.pgm');

    const originalAudioBuffer = await storageService.downloadBlobToBuffer(audioUrl);
    await fs.writeFile(inputPath, originalAudioBuffer);

    const { duration, bitrate } = await getAudioMetadata(inputPath);

    // Generate the middle preview and waveform source in separate ffmpeg passes from the downloaded original.
    await generatePreviewFile(inputPath, previewPath, duration);
    await exportWaveformSourceImage(inputPath, waveformSourcePath);

    const previewBuffer = await fs.readFile(previewPath);
    const waveformSourceBuffer = await fs.readFile(waveformSourcePath);

    const masterWaveform = extractWaveformSourceColumns(
      waveformSourceBuffer,
      MASTER_WAVEFORM_SAMPLES
    );
    const displayWaveform = resampleWaveformColumns(masterWaveform, DISPLAY_WAVEFORM_SAMPLES);

    if (WAVEFORM_DEBUG_STATS) {
      console.log('[WAVEFORM_DEBUG_STATS]', {
        trackId,
        master: getWaveformRange(masterWaveform),
        display: getWaveformRange(displayWaveform),
      });
    }

    const normalizedDisplayWaveform = normalizeWaveformValues(displayWaveform);
    const waveform = roundWaveform(normalizedDisplayWaveform);

    const previewUpload = await storageService.uploadGeneratedAudio(
      previewBuffer,
      `tracks/${userId}/${trackId}/preview.mp3`,
      'audio/mpeg'
    );

    const waveformUpload = await storageService.uploadJson(
      waveform,
      `tracks/${trackId}/waveform.json`
    );

    const updatedTrack = await tracksModel.updateTrackProcessingAssets(trackId, {
      duration,
      bitrate,
      streamUrl: audioUrl,
      previewUrl: previewUpload.url,
      waveformUrl: waveformUpload.url,
    });

    return {
      trackId,
      status: updatedTrack?.status || 'ready',
      duration,
      bitrate,
      stream_url: audioUrl,
      preview_url: previewUpload.url,
      waveform_url: waveformUpload.url,
    };
  } catch (err) {
    // Any processing error moves the track into a failed state so clients stop polling for ready assets.
    await tracksModel.markTrackProcessingFailed(trackId);

    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(err.message || 'Track processing failed', 500, 'TRACK_PROCESSING_FAILED');
  } finally {
    await cleanupDirectory(tempDir);
  }
};

/* Starts processing without blocking the upload request and logs any background failure. */
const processTrackInBackground = ({ trackId, userId, audioUrl }) => {
  void processTrackAssets({ trackId, userId, audioUrl }).catch((err) => {
    console.error(`[TRACK_PROCESSING_FAILED] track=${trackId}`, err.message);
  });
};

module.exports = {
  processTrackAssets,
  processTrackInBackground,
};
