// Client-side audio segmentation using ffmpeg.wasm.
// Splits a large local audio/video File into small, valid MP3 segments that
// each sit well under Vercel's 4.5 MB request body cap, so the browser can
// POST them one-by-one to /api/transcribe-chunk. This is what lets the app
// transcribe files far larger than Whisper's 25 MB limit on a serverless
// backend that has no ffmpeg of its own.
//
// NOTE: ffmpeg.wasm runs in 32-bit wasm memory (~2 GB heap ceiling). Very large
// inputs (roughly >500 MB depending on the browser) may exhaust memory.
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

// Single-thread ESM core served same-origin from /public/ffmpeg (copied from
// @ffmpeg/core's dist/esm). Vite bundles ffmpeg.wasm's worker as a MODULE
// worker, so its `importScripts` path is unavailable and it falls back to
// `await import(coreURL)` — which needs the ESM build (default export
// createFFmpegCore), not the UMD build. Pass plain same-origin absolute URLs
// (no toBlobURL): the old unpkg CDN fetch was flaky and threw
// "failed to import ffmpeg-core.js". ST core needs no cross-origin isolation.
const CORE_BASE = new URL(
  `${import.meta.env.BASE_URL || '/'}ffmpeg/`.replace(/\/{2,}/g, '/'),
  window.location.origin,
)

// 5-minute mono 16 kHz @ 64 kbps ≈ 2.4 MB per segment — safely under 4.5 MB.
const SEGMENT_SECONDS = 300

let _ffmpeg = null

async function getFFmpeg(onProgress) {
  if (_ffmpeg) return _ffmpeg
  const ffmpeg = new FFmpeg()
  ffmpeg.on('log', ({ message }) => console.log('[ffmpeg]', message))
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(Math.min(100, Math.round(progress * 100))))
  }
  try {
    await ffmpeg.load({
      coreURL: new URL('ffmpeg-core.js', CORE_BASE).href,
      wasmURL: new URL('ffmpeg-core.wasm', CORE_BASE).href,
    })
  } catch (e) {
    throw new Error(`Failed to load audio engine (ffmpeg.wasm): ${e?.message || e}`)
  }
  _ffmpeg = ffmpeg
  return ffmpeg
}

/**
 * Segment a File into an array of MP3 Blobs.
 * @param {File} file
 * @param {(stage: string, pct?: number) => void} onStatus
 * @returns {Promise<Blob[]>}
 */
export async function segmentAudio(file, onStatus = () => {}) {
  onStatus('Loading audio engine…')
  const ffmpeg = await getFFmpeg((pct) => onStatus('Segmenting audio…', pct))

  const inputName = 'input_source'
  await ffmpeg.writeFile(inputName, await fetchFile(file))

  onStatus('Segmenting audio…', 0)
  const code = await ffmpeg.exec([
    '-i', inputName,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-b:a', '64k',
    '-f', 'segment',
    '-segment_time', String(SEGMENT_SECONDS),
    '-reset_timestamps', '1',
    'chunk_%03d.mp3',
  ])
  if (code !== 0) throw new Error(`ffmpeg segmentation failed (exit ${code}). Unsupported or corrupt audio?`)

  const entries = await ffmpeg.listDir('/')
  const chunkNames = entries
    .filter((e) => !e.isDir && e.name.startsWith('chunk_') && e.name.endsWith('.mp3'))
    .map((e) => e.name)
    .sort()

  if (!chunkNames.length) throw new Error('No audio segments were produced.')

  const blobs = []
  for (const name of chunkNames) {
    const data = await ffmpeg.readFile(name)
    const blob = new Blob([data], { type: 'audio/mpeg' })
    // Drop near-empty tail segments (a few hundred bytes of mp3 header from
    // segment-boundary rounding) — Whisper rejects/empties them. 10 KB ≈ 1.2s.
    if (blob.size >= 10 * 1024) blobs.push(blob)
    await ffmpeg.deleteFile(name).catch(() => {})
  }
  await ffmpeg.deleteFile(inputName).catch(() => {})

  if (!blobs.length) throw new Error('No usable audio segments were produced.')
  return blobs
}
