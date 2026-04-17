const EventEmitter = require('events');
const path = require('path');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdtemp: jest.fn(),
  writeFile: jest.fn(),
  readFile: jest.fn(),
  rm: jest.fn(),
}));

jest.mock('os', () => ({
  tmpdir: jest.fn(() => '/tmp'),
}));

jest.mock('../src/models/track.model', () => ({
  updateTrackProcessingAssets: jest.fn(),
  markTrackProcessingFailed: jest.fn(),
}));

jest.mock('../src/services/storage.service', () => ({
  downloadBlobToBuffer: jest.fn(),
  uploadGeneratedAudio: jest.fn(),
  uploadJson: jest.fn(),
}));

const { spawn } = require('child_process');
const fs = require('fs/promises');
const tracksModel = require('../src/models/track.model');
const storageService = require('../src/services/storage.service');
const trackProcessingService = require('../src/services/track-processing.service');

const TRACK_ID = '11111111-1111-4111-8111-111111111111';

const queueSpawnResult = ({ stdout = '', stderr = '', code = 0, error = null }) => {
  spawn.mockImplementationOnce(() => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    process.nextTick(() => {
      if (error) {
        child.emit('error', error);
        return;
      }

      if (stdout) {
        child.stdout.emit('data', Buffer.from(stdout));
      }

      if (stderr) {
        child.stderr.emit('data', Buffer.from(stderr));
      }

      child.emit('close', code);
    });

    return child;
  });
};

const buildWaveformSourceBuffer = () => {
  const width = 4;
  const height = 8;
  const activePixelCounts = [2, 4, 7, 1];
  const pixels = Buffer.alloc(width * height, 0);

  activePixelCounts.forEach((count, column) => {
    const startRow = Math.floor((height - count) / 2);

    for (let row = startRow; row < startRow + count; row += 1) {
      pixels[row * width + column] = 255;
    }
  });

  const header = Buffer.from(`P5\n${width} ${height}\n255\n`, 'ascii');
  return Buffer.concat([header, pixels]);
};

describe('track-processing.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.mkdtemp.mockResolvedValue('/tmp/rythmify-track-123');
    fs.writeFile.mockResolvedValue(undefined);
    fs.rm.mockResolvedValue(undefined);
  });

  it('processes a track end-to-end and updates the track with generated preview and waveform assets', async () => {
    const originalAudioBuffer = Buffer.from('original-audio');
    const previewBuffer = Buffer.from('preview-audio');
    const waveformSourceBuffer = buildWaveformSourceBuffer();
    const inputPath = path.join('/tmp/rythmify-track-123', 'input-audio');
    const previewPath = path.join('/tmp/rythmify-track-123', 'preview.mp3');
    const waveformSourcePath = path.join('/tmp/rythmify-track-123', 'waveform-source.pgm');

    storageService.downloadBlobToBuffer.mockResolvedValue(originalAudioBuffer);
    fs.readFile.mockImplementation(async (filePath) => {
      if (filePath === previewPath) {
        return previewBuffer;
      }

      if (filePath === waveformSourcePath) {
        return waveformSourceBuffer;
      }

      throw new Error(`Unexpected read: ${filePath}`);
    });

    queueSpawnResult({
      stdout: JSON.stringify({
        format: {
          duration: '123.4',
          bit_rate: '256000',
        },
        streams: [{ codec_type: 'audio' }],
      }),
    });
    queueSpawnResult({ code: 0 });
    queueSpawnResult({ code: 0 });

    storageService.uploadGeneratedAudio.mockResolvedValue({
      url: 'https://example/audio/preview.mp3',
    });
    storageService.uploadJson.mockResolvedValue({
      url: 'https://example/media/waveform.json',
    });
    tracksModel.updateTrackProcessingAssets.mockResolvedValue({
      status: 'ready',
    });

    const result = await trackProcessingService.processTrackAssets({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'https://example/audio/original.mp3',
    });

    expect(storageService.downloadBlobToBuffer).toHaveBeenCalledWith(
      'https://example/audio/original.mp3'
    );
    expect(fs.writeFile).toHaveBeenCalledWith(inputPath, originalAudioBuffer);
    expect(spawn).toHaveBeenNthCalledWith(
      1,
      'ffprobe',
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', inputPath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(spawn).toHaveBeenNthCalledWith(
      2,
      'ffmpeg',
      ['-y', '-i', inputPath, '-t', '30', '-vn', '-acodec', 'mp3', '-b:a', '128k', previewPath],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(spawn).toHaveBeenNthCalledWith(
      3,
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-filter_complex',
        'aformat=channel_layouts=mono,showwavespic=s=1800x256:colors=white:scale=sqrt',
        '-frames:v',
        '1',
        '-pix_fmt',
        'gray',
        waveformSourcePath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(storageService.uploadGeneratedAudio).toHaveBeenCalledWith(
      previewBuffer,
      `tracks/user-1/${TRACK_ID}/preview.mp3`,
      'audio/mpeg'
    );
    expect(storageService.uploadJson).toHaveBeenCalledWith(
      expect.any(Array),
      `tracks/user-1/${TRACK_ID}/waveform.json`
    );
    const uploadedWaveform = storageService.uploadJson.mock.calls[0][0];
    expect(uploadedWaveform).toHaveLength(200);
    expect(uploadedWaveform.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(uploadedWaveform[25]).toBeGreaterThan(0.15);
    expect(uploadedWaveform[25]).toBeLessThanOrEqual(0.25);
    expect(uploadedWaveform[75]).toBeGreaterThan(uploadedWaveform[25]);
    expect(uploadedWaveform[125]).toBeGreaterThan(uploadedWaveform[75]);
    expect(uploadedWaveform[175]).toBeLessThan(0.05);
    expect(tracksModel.updateTrackProcessingAssets).toHaveBeenCalledWith(TRACK_ID, {
      duration: 123,
      bitrate: 256,
      streamUrl: 'https://example/audio/original.mp3',
      previewUrl: 'https://example/audio/preview.mp3',
      waveformUrl: 'https://example/media/waveform.json',
    });
    expect(result).toEqual({
      trackId: TRACK_ID,
      status: 'ready',
      duration: 123,
      bitrate: 256,
      stream_url: 'https://example/audio/original.mp3',
      preview_url: 'https://example/audio/preview.mp3',
      waveform_url: 'https://example/media/waveform.json',
    });
    expect(fs.rm).toHaveBeenCalledWith('/tmp/rythmify-track-123', {
      recursive: true,
      force: true,
    });
  });

  it('marks the track as failed when ffprobe output is malformed and still cleans up temp files', async () => {
    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('original-audio'));
    tracksModel.markTrackProcessingFailed.mockResolvedValue({ status: 'failed' });
    queueSpawnResult({ stdout: 'not-json', code: 0 });

    await expect(
      trackProcessingService.processTrackAssets({
        trackId: TRACK_ID,
        userId: 'user-1',
        audioUrl: 'https://example/audio/original.mp3',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'TRACK_PROCESSING_METADATA_PARSE_FAILED',
      message: 'Failed to parse ffprobe output',
    });

    expect(tracksModel.markTrackProcessingFailed).toHaveBeenCalledWith(TRACK_ID);
    expect(tracksModel.updateTrackProcessingAssets).not.toHaveBeenCalled();
    expect(fs.rm).toHaveBeenCalledWith('/tmp/rythmify-track-123', {
      recursive: true,
      force: true,
    });
  });

  it('uploads a zeroed waveform when the generated waveform source buffer is missing', async () => {
    const originalAudioBuffer = Buffer.from('original-audio');
    const previewBuffer = Buffer.from('preview-audio');
    const inputPath = path.join('/tmp/rythmify-track-123', 'input-audio');
    const previewPath = path.join('/tmp/rythmify-track-123', 'preview.mp3');
    const waveformSourcePath = path.join('/tmp/rythmify-track-123', 'waveform-source.pgm');

    storageService.downloadBlobToBuffer.mockResolvedValue(originalAudioBuffer);
    fs.readFile.mockImplementation(async (filePath) => {
      if (filePath === previewPath) {
        return previewBuffer;
      }

      if (filePath === waveformSourcePath) {
        return null;
      }

      throw new Error(`Unexpected read: ${filePath}`);
    });

    queueSpawnResult({
      stdout: JSON.stringify({
        format: {
          duration: '60',
          bit_rate: '128000',
        },
        streams: [{ codec_type: 'audio' }],
      }),
    });
    queueSpawnResult({ code: 0 });
    queueSpawnResult({ code: 0 });

    storageService.uploadGeneratedAudio.mockResolvedValue({
      url: 'https://example/audio/preview.mp3',
    });
    storageService.uploadJson.mockResolvedValue({
      url: 'https://example/media/waveform.json',
    });
    tracksModel.updateTrackProcessingAssets.mockResolvedValue({
      status: 'ready',
    });

    const result = await trackProcessingService.processTrackAssets({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'https://example/audio/original.mp3',
    });

    expect(fs.writeFile).toHaveBeenCalledWith(inputPath, originalAudioBuffer);
    expect(storageService.uploadJson).toHaveBeenCalledWith(
      expect.any(Array),
      `tracks/user-1/${TRACK_ID}/waveform.json`
    );
    expect(storageService.uploadJson.mock.calls[0][0]).toHaveLength(200);
    expect(storageService.uploadJson.mock.calls[0][0].every((value) => value === 0)).toBe(true);
    expect(result.waveform_url).toBe('https://example/media/waveform.json');
  });

  it('marks the track as failed when ffmpeg exits with a non-zero code', async () => {
    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('original-audio'));
    tracksModel.markTrackProcessingFailed.mockResolvedValue({ status: 'failed' });

    queueSpawnResult({
      stdout: JSON.stringify({
        format: {
          duration: '60',
          bit_rate: '128000',
        },
        streams: [{ codec_type: 'audio' }],
      }),
    });
    queueSpawnResult({ code: 1, stderr: 'preview generation failed' });

    await expect(
      trackProcessingService.processTrackAssets({
        trackId: TRACK_ID,
        userId: 'user-1',
        audioUrl: 'https://example/audio/original.mp3',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'TRACK_PROCESSING_COMMAND_FAILED',
    });

    expect(tracksModel.markTrackProcessingFailed).toHaveBeenCalledWith(TRACK_ID);
    expect(storageService.uploadGeneratedAudio).not.toHaveBeenCalled();
    expect(fs.rm).toHaveBeenCalledWith('/tmp/rythmify-track-123', {
      recursive: true,
      force: true,
    });
  });

  it('wraps non-AppError failures, marks the track as failed, and preserves cleanup when inputs are missing', async () => {
    storageService.downloadBlobToBuffer.mockRejectedValue(new Error('Missing source audio'));
    tracksModel.markTrackProcessingFailed.mockResolvedValue({ status: 'failed' });

    await expect(
      trackProcessingService.processTrackAssets({
        trackId: TRACK_ID,
        userId: 'user-1',
        audioUrl: undefined,
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'TRACK_PROCESSING_FAILED',
      message: 'Missing source audio',
    });

    expect(storageService.downloadBlobToBuffer).toHaveBeenCalledWith(undefined);
    expect(tracksModel.markTrackProcessingFailed).toHaveBeenCalledWith(TRACK_ID);
    expect(fs.rm).toHaveBeenCalledWith('/tmp/rythmify-track-123', {
      recursive: true,
      force: true,
    });
  });

  it('marks the track as failed when ffmpeg cannot start', async () => {
    storageService.downloadBlobToBuffer.mockResolvedValue(Buffer.from('original-audio'));
    tracksModel.markTrackProcessingFailed.mockResolvedValue({ status: 'failed' });

    queueSpawnResult({
      stdout: JSON.stringify({
        format: {
          duration: '60',
          bit_rate: '128000',
        },
        streams: [{ codec_type: 'audio' }],
      }),
    });
    queueSpawnResult({ error: new Error('spawn missing') });

    await expect(
      trackProcessingService.processTrackAssets({
        trackId: TRACK_ID,
        userId: 'user-1',
        audioUrl: 'https://example/audio/original.mp3',
      })
    ).rejects.toMatchObject({
      statusCode: 500,
      code: 'TRACK_PROCESSING_COMMAND_FAILED',
      message: 'Failed to start ffmpeg: spawn missing',
    });

    expect(tracksModel.markTrackProcessingFailed).toHaveBeenCalledWith(TRACK_ID);
  });

  it('logs background processing failures without throwing to the caller', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    storageService.downloadBlobToBuffer.mockRejectedValue(new Error('Missing source audio'));
    tracksModel.markTrackProcessingFailed.mockResolvedValue({ status: 'failed' });

    trackProcessingService.processTrackInBackground({
      trackId: TRACK_ID,
      userId: 'user-1',
      audioUrl: 'https://example/audio/original.mp3',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      `[TRACK_PROCESSING_FAILED] track=${TRACK_ID}`,
      'Missing source audio'
    );

    errorSpy.mockRestore();
  });
});
