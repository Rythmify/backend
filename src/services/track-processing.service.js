// ============================================================
// services/track-processing.service.js
// Real audio post-upload processing
// - reads uploaded audio
// - extracts duration + bitrate
// - generates 30s preview
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
const WAVEFORM_SAMPLES = 400;
const PCM_SAMPLE_RATE = 8000;

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

// keeps first 30 seconds of the track for preview, converts to mp3 at 128kbps
const generatePreviewFile = async (inputPath, outputPath) => {
  await runCommand(FFMPEG_BIN, [
    '-y',
    '-i',
    inputPath,
    '-t',
    String(PREVIEW_SECONDS),
    '-vn',
    '-acodec',
    'mp3',
    '-b:a',
    '128k',
    outputPath,
  ]);
};

// converts original audio to raw PCM mono file at 8kHz sample rate for waveform generation
const exportPcmMonoFile = async (inputPath, outputPath) => {
  await runCommand(FFMPEG_BIN, [
    '-y',
    '-i',
    inputPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    String(PCM_SAMPLE_RATE),
    '-f',
    's16le',
    outputPath,
  ]);
};

// generates actual waveform data and normalizes to 0-1 range based on 16-bit PCM max value
const buildWaveformFromPcm = (buffer, sampleCount = WAVEFORM_SAMPLES) => {
  if (!buffer || buffer.length < 2) {
    return Array.from({ length: sampleCount }, () => 0);
  }

  const sampleTotal = Math.floor(buffer.length / 2);

  if (sampleTotal === 0) {
    return Array.from({ length: sampleCount }, () => 0);
  }

  const bucketSize = Math.max(1, Math.floor(sampleTotal / sampleCount));
  const waveform = [];

  for (let bucket = 0; bucket < sampleCount; bucket += 1) {
    const startSample = bucket * bucketSize;
    const endSample =
      bucket === sampleCount - 1 ? sampleTotal : Math.min(sampleTotal, startSample + bucketSize);

    let peak = 0;

    for (let i = startSample; i < endSample; i += 1) {
      const value = Math.abs(buffer.readInt16LE(i * 2));
      if (value > peak) peak = value;
    }

    waveform.push(Number((peak / 32767).toFixed(3)));
  }

  return waveform;
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
    const pcmPath = path.join(tempDir, 'waveform.pcm');

    const originalAudioBuffer = await storageService.downloadBlobToBuffer(audioUrl);
    await fs.writeFile(inputPath, originalAudioBuffer);

    const { duration, bitrate } = await getAudioMetadata(inputPath);

    await generatePreviewFile(inputPath, previewPath);
    await exportPcmMonoFile(inputPath, pcmPath);

    const previewBuffer = await fs.readFile(previewPath);
    const pcmBuffer = await fs.readFile(pcmPath);

    const rawWaveform = buildWaveformFromPcm(pcmBuffer, WAVEFORM_SAMPLES);
    const maxPeak = Math.max(...rawWaveform, 0);

    const waveform =
      maxPeak > 0 ? rawWaveform.map((value) => Number((value / maxPeak).toFixed(3))) : rawWaveform;

    const previewUpload = await storageService.uploadGeneratedAudio(
      previewBuffer,
      `tracks/${userId}/${trackId}/preview.mp3`,
      'audio/mpeg'
    );

    const waveformUpload = await storageService.uploadJson(
      waveform,
      `tracks/${userId}/${trackId}/waveform.json`
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
    await tracksModel.markTrackProcessingFailed(trackId);

    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(err.message || 'Track processing failed', 500, 'TRACK_PROCESSING_FAILED');
  } finally {
    await cleanupDirectory(tempDir);
  }
};

const processTrackInBackground = ({ trackId, userId, audioUrl }) => {
  void processTrackAssets({ trackId, userId, audioUrl }).catch((err) => {
    console.error(`[TRACK_PROCESSING_FAILED] track=${trackId}`, err.message);
  });
};

module.exports = {
  processTrackAssets,
  processTrackInBackground,
};
