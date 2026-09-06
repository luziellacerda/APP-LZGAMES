"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MEDIA_ROOT = process.env.MARKETPLACE_MEDIA_ROOT ||
  "/home/lz-servidor/.local/share/lzgames-marketplace/media";
const TMP_ROOT = process.env.MARKETPLACE_TMP_ROOT ||
  "/home/lz-servidor/.cache/lzgames-marketplace/uploads";
let storageReady = null;
// Do not let a disguised playlist make ffmpeg/ffprobe read URLs or arbitrary files.
const INPUT_GUARDS = ["-protocol_whitelist", "file,pipe", "-format_whitelist", "image2,jpeg_pipe,png_pipe,webp_pipe,mov,matroska,webm", "-threads", "2"];

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("MEDIA_PROCESSING_TIMEOUT"));
    }, timeoutMs);
    child.stderr.on("data", chunk => {
      if (stderr.length < 32768) stderr += chunk.toString();
    });
    child.once("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`MEDIA_PROCESSING_FAILED:${stderr.slice(-500)}`));
    });
  });
}

async function probe(file) {
  let stdout = "";
  await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/ffprobe", [
      ...INPUT_GUARDS,
      "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height,duration",
      "-of", "json", file,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("MEDIA_PROBE_TIMEOUT")); }, 15000);
    child.stdout.on("data", chunk => { if (stdout.length < 65536) stdout += chunk.toString(); });
    child.stderr.on("data", chunk => { if (stderr.length < 8192) stderr += chunk.toString(); });
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`MEDIA_INVALID:${stderr.slice(-300)}`));
    });
  });
  const parsed = JSON.parse(stdout);
  return { streams: Array.isArray(parsed.streams) ? parsed.streams : [], format: parsed.format || {} };
}

function videoStream(info) {
  return info.streams.find(stream => stream.codec_type === "video");
}

function dimensions(stream) {
  const width = Number(stream?.width);
  const height = Number(stream?.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 16 || height < 16 || width > 12000 || height > 12000 || width*height>48000000) {
    throw new Error("MEDIA_DIMENSIONS_INVALID");
  }
  return { width, height };
}

async function processImage(input, outputDir, position) {
  const before = await probe(input.path);
  const stream = videoStream(before);
  dimensions(stream);
  const storageName = `${crypto.randomUUID()}.jpg`;
  const output = path.join(outputDir, storageName);
  await run("/usr/bin/ffmpeg", [
    "-nostdin", "-v", "error", "-y", ...INPUT_GUARDS, "-i", input.path, "-threads", "2", "-filter_threads", "2",
    "-map_metadata", "-1", "-frames:v", "1",
    "-vf", "scale=w='min(1600,iw)':h='min(1600,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuvj420p",
    "-q:v", "4", output,
  ], 60000);
  const after = await probe(output);
  const size = dimensions(videoStream(after));
  const stat = await fs.stat(output);
  if (stat.size < 100 || stat.size > 8 * 1024 * 1024) throw new Error("MEDIA_OUTPUT_SIZE_INVALID");
  return { kind: "image", storageName, posterName: null, position, ...size, durationMs: null, bytes: stat.size };
}

async function processVideo(input, outputDir, position) {
  const before = await probe(input.path);
  const stream = videoStream(before);
  dimensions(stream);
  const duration = Number(before.format.duration || stream?.duration || 0);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30.75) throw new Error("MEDIA_VIDEO_DURATION_INVALID");
  const token = crypto.randomUUID();
  const storageName = `${token}.mp4`;
  const posterName = `${token}-poster.jpg`;
  const output = path.join(outputDir, storageName);
  const poster = path.join(outputDir, posterName);
  await run("/usr/bin/ffmpeg", [
    "-nostdin", "-v", "error", "-y", ...INPUT_GUARDS, "-i", input.path, "-threads", "2", "-filter_threads", "2",
    "-map", "0:v:0", "-map", "0:a?", "-map_metadata", "-1", "-t", "30",
    "-vf", "scale=w='min(1280,iw)':h='min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
    "-c:v", "libx264", "-preset", "faster", "-crf", "28", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", output,
  ], 180000);
  await run("/usr/bin/ffmpeg", [
    "-nostdin", "-v", "error", "-y", ...INPUT_GUARDS, "-ss", String(Math.min(0.5, duration / 3)),
    "-i", output, "-map_metadata", "-1", "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", poster,
  ], 30000);
  const after = await probe(output);
  const size = dimensions(videoStream(after));
  const stat = await fs.stat(output);
  if (stat.size < 1000 || stat.size > 24 * 1024 * 1024) throw new Error("MEDIA_OUTPUT_SIZE_INVALID");
  return { kind: "video", storageName, posterName, position, ...size, durationMs: Math.round(Number(after.format.duration)*1000), bytes: stat.size };
}

async function processUpload(files, publicId) {
  const outputDir = path.join(MEDIA_ROOT, publicId);
  await fs.mkdir(outputDir, { recursive: false, mode: 0o750 });
  try {
    const media = [];
    for (let index = 0; index < files.photos.length; index += 1) {
      media.push(await processImage(files.photos[index], outputDir, index));
    }
    if (files.video) media.push(await processVideo(files.video, outputDir, media.length));
    return { outputDir, media };
  } catch (error) {
    await fs.rm(outputDir, { recursive: true, force: true });
    throw error;
  }
}

async function ensureStorage() {
  if (storageReady) return storageReady;
  storageReady = (async () => {
    await fs.mkdir(MEDIA_ROOT, { recursive: true, mode: 0o750 });
    await fs.mkdir(TMP_ROOT, { recursive: true, mode: 0o750 });
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const entries = await fs.readdir(TMP_ROOT, { withFileTypes: true });
    await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
      const file = path.join(TMP_ROOT, entry.name);
      const stat = await fs.stat(file);
      if (stat.mtimeMs < cutoff) await fs.rm(file, { force: true });
    }));
  })().catch(error => { storageReady = null; throw error; });
  return storageReady;
}

module.exports = { MEDIA_ROOT, TMP_ROOT, ensureStorage, processUpload, probe };
