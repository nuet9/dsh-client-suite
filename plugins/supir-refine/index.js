/**
 * SUPIR image refinement plugin.
 *
 * Registers the `image_refine` tool, which drives the local ComfyUI + SUPIR
 * installation (__DSH_SUITE_SUPIR_REFINE_COMFY_ROOT__) headlessly and keeps the ComfyUI server warm
 * between calls so a refinement takes roughly 10-15 s instead of a cold start.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

export const name = 'supir-refine'
export const inject = ['tools']

const DEFAULTS = {
  comfyDir: '__DSH_SUITE_SUPIR_REFINE_COMFY_ROOT__\\ComfyUI',
  python: '__DSH_SUITE_SUPIR_REFINE_COMFY_ROOT__\\venv\\Scripts\\python.exe',
  port: 8199,
  checkpoint: 'juggernautXL_v9Rdphoto2Lightning.safetensors',
  supirModel: 'SUPIR-v0Q_fp16.safetensors',
  outputDir: '__DSH_SUITE_SUPIR_REFINE_COMFY_ROOT__\\results',
  attachmentsDir: '',
  preset: 'balanced',
  scale: 2,
  maxSide: 2048,
  serverIdleMinutes: 30,
}

const PRESETS = {
  faithful: { restore: 6.0, s0: 1.0, s1: 0.85, cfg: 1.5, steps: 10 },
  balanced: { restore: 4.0, s0: 1.0, s1: 0.9, cfg: 1.5, steps: 10 },
  detail: { restore: 2.5, s0: 1.0, s1: 0.95, cfg: 1.8, steps: 14 },
  creative: { restore: 1.0, s0: 1.0, s1: 1.0, cfg: 2.2, steps: 16 },
}

const POS =
  'Cinematic, High Contrast, highly detailed, taken using a Canon EOS R camera, ' +
  'hyper detailed photo - realistic maximum detail, 32k, Color Grading, ultra HD, ' +
  'extreme meticulous detailing, skin pore detailing, hyper sharpness, perfect without ' +
  'deformations, high quality, detailed, photograph'
const NEG =
  'painting, oil painting, illustration, drawing, art, sketch, cartoon, CG Style, 3D render, ' +
  'unreal engine, blurring, dirty, messy, worst quality, low quality, frames, watermark, ' +
  'signature, jpeg artifacts, deformed, lowres, over-smooth, blurry, messy'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Copy over an existing file even when Windows left it read-only (EPERM on overwrite). */
function copyOver(src, dst) {
  try {
    fs.copyFileSync(src, dst)
    return
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'EACCES' && error.code !== 'EBUSY') throw error
  }
  try {
    fs.chmodSync(dst, 0o666)
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(dst, { force: true })
  } catch {
    /* ignore */
  }
  fs.copyFileSync(src, dst)
}

function baseUrl(cfg) {
  return `http://127.0.0.1:${cfg.port}`
}

function request(cfg, method, route, body, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body))
    const req = http.request(
      {
        host: '127.0.0.1',
        port: cfg.port,
        path: route,
        method,
        timeout: timeoutMs,
        headers: data
          ? { 'content-type': 'application/json', 'content-length': data.length }
          : undefined,
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          if (res.statusCode >= 400) {
            reject(new Error(`ComfyUI ${method} ${route} -> ${res.statusCode}: ${text.slice(0, 500)}`))
            return
          }
          try {
            resolve(text ? JSON.parse(text) : {})
          } catch {
            reject(new Error(`ComfyUI ${route} returned non-JSON: ${text.slice(0, 200)}`))
          }
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error(`ComfyUI ${route} timed out`)))
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function isImageFile(file) {
  try {
    const fd = fs.openSync(file, 'r')
    const head = Buffer.alloc(12)
    fs.readSync(fd, head, 0, 12, 0)
    fs.closeSync(fd)
    if (head[0] === 0xff && head[1] === 0xd8) return 'jpg'
    if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
    if (head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp'
    if (head.subarray(0, 3).toString('ascii') === 'GIF') return 'gif'
  } catch {
    /* ignore */
  }
  return null
}

function attachmentsRoot(cfg) {
  if (cfg.attachmentsDir) return cfg.attachmentsDir
  return path.join(os.homedir(), '.dsh', 'attachments', 'v1', 'objects')
}

/** Newest image the user attached to the conversation (objects are content-addressed, no extension). */
function newestAttachmentImage(cfg) {
  const root = attachmentsRoot(cfg)
  const found = []
  const walk = (dir, depth) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (depth > 0) walk(full, depth - 1)
        continue
      }
      try {
        const stat = fs.statSync(full)
        if (stat.size < 4096) continue
        if (stat.mtimeMs < Date.now() - 6 * 3600 * 1000) continue
        const kind = isImageFile(full)
        if (kind) found.push({ file: full, mtime: stat.mtimeMs, size: stat.size, kind })
      } catch {
        /* ignore */
      }
    }
  }
  walk(root, 2)
  found.sort((a, b) => b.mtime - a.mtime)
  return found[0]
}

/** Materialise an attachment object as a real .jpg/.png so ComfyUI's LoadImage accepts it. */
function materializeSource(cfg, input) {
  let file
  if (input) {
    file = path.isAbsolute(input) ? input : path.resolve(input)
    if (!fs.existsSync(file)) throw new Error(`image not found: ${file}`)
    if (!isImageFile(file)) throw new Error(`not a supported image file: ${file}`)
    return { file, origin: 'explicit path' }
  }
  const newest = newestAttachmentImage(cfg)
  if (!newest) {
    throw new Error(
      'no image given and no recent image attachment found; pass an explicit "image" path',
    )
  }
  const targetDir = path.join(cfg.outputDir, '_src')
  fs.mkdirSync(targetDir, { recursive: true })
  const target = path.join(targetDir, `src_${path.basename(newest.file).slice(0, 12)}.${newest.kind}`)
  if (!fs.existsSync(target)) fs.copyFileSync(newest.file, target)
  return {
    file: target,
    origin: `newest attachment (${path.basename(path.dirname(newest.file))}/${path.basename(newest.file).slice(0, 12)}…, ${new Date(newest.mtime).toLocaleString()})`,
  }
}

function readImageSize(file) {
  try {
    const b = fs.readFileSync(file)
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2
      while (i < b.length) {
        if (b[i] !== 0xff) {
          i += 1
          continue
        }
        const marker = b[i + 1]
        const len = b.readUInt16BE(i + 2)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
        }
        i += 2 + len
      }
    }
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
    }
  } catch {
    /* ignore */
  }
  return undefined
}

const PLUGIN_VERSION = '0.1.1'
const server = { proc: null, owned: false, lastUse: 0, idleTimer: null }

function pidFile(cfg) {
  return path.join(cfg.outputDir, '_comfyui.pid')
}

/** Kill a whole process tree: on Windows the venv python.exe is a shim that owns the real interpreter. */
function killTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } catch {
      /* ignore */
    }
  }
  try {
    process.kill(pid)
  } catch {
    /* already gone */
  }
}

/** A previous Host process may have left a ComfyUI behind; stop it only if it answers on our own port. */
async function reapStale(cfg) {
  const file = pidFile(cfg)
  let pid
  try {
    pid = Number(fs.readFileSync(file, 'utf8').trim())
  } catch {
    return
  }
  if (!Number.isFinite(pid) || pid <= 0) return
  if (await ping(cfg, 1500)) {
    killTree(pid)
    await sleep(800)
  }
  try {
    fs.unlinkSync(file)
  } catch {
    /* ignore */
  }
}

async function ping(cfg, timeout = 2500) {
  try {
    await request(cfg, 'GET', '/system_stats', undefined, timeout)
    return true
  } catch {
    return false
  }
}

async function ensureServer(cfg, log) {
  server.lastUse = Date.now()
  if (server.idleTimer) {
    clearTimeout(server.idleTimer)
    server.idleTimer = null
  }
  if (await ping(cfg)) {
    if (!server.owned) log('reusing an already running ComfyUI server')
    return
  }
  if (!fs.existsSync(cfg.python)) throw new Error(`python not found: ${cfg.python}`)
  if (!fs.existsSync(path.join(cfg.comfyDir, 'main.py'))) {
    throw new Error(`ComfyUI not found at ${cfg.comfyDir}`)
  }
  log(`starting ComfyUI on port ${cfg.port}`)
  server.proc = spawn(
    cfg.python,
    ['main.py', '--listen', '127.0.0.1', '--port', String(cfg.port), '--disable-auto-launch', '--preview-method', 'none'],
    { cwd: cfg.comfyDir, windowsHide: true, stdio: 'ignore' },
  )
  server.owned = true
  try {
    fs.mkdirSync(cfg.outputDir, { recursive: true })
    fs.writeFileSync(pidFile(cfg), String(server.proc.pid), 'utf8')
  } catch {
    /* pidfile is best effort */
  }
  server.proc.on('exit', () => {
    if (server.owned) {
      server.owned = false
      server.proc = null
    }
  })
  const deadline = Date.now() + 180000
  while (Date.now() < deadline) {
    if (await ping(cfg)) return
    await sleep(1200)
  }
  throw new Error('ComfyUI server did not become ready within 180s')
}

function scheduleIdleShutdown(cfg) {
  if (server.idleTimer) clearTimeout(server.idleTimer)
  const ms = Math.max(1, cfg.serverIdleMinutes) * 60000
  server.idleTimer = setTimeout(() => {
    if (server.owned && server.proc) killTree(server.proc.pid)
    server.proc = null
    server.owned = false
    server.idleTimer = null
    try {
      fs.unlinkSync(pidFile(cfg))
    } catch {
      /* ignore */
    }
  }, ms)
  server.idleTimer.unref?.()
}

function shutdown(cfg) {
  if (server.idleTimer) clearTimeout(server.idleTimer)
  server.idleTimer = null
  if (server.owned && server.proc) killTree(server.proc.pid)
  server.proc = null
  server.owned = false
  if (cfg) {
    try {
      fs.unlinkSync(pidFile(cfg))
    } catch {
      /* ignore */
    }
  }
}

function buildGraph(cfg, p) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: cfg.checkpoint } },
    2: { class_type: 'ModelPatchLoader', inputs: { name: cfg.supirModel } },
    3: { class_type: 'LoadImage', inputs: { image: p.imageName } },
    4: {
      class_type: 'ImageScale',
      inputs: { image: ['3', 0], upscale_method: 'lanczos', width: p.width, height: p.height, crop: 'disabled' },
    },
    5: {
      class_type: 'SUPIRApply',
      inputs: {
        model: ['1', 0],
        model_patch: ['2', 0],
        vae: ['1', 2],
        image: ['4', 0],
        strength_start: p.strengthStart,
        strength_end: p.strengthEnd,
        restore_cfg: p.restoreCfg,
        restore_cfg_s_tmin: 0.05,
      },
    },
    6: { class_type: 'VAEEncode', inputs: { pixels: ['4', 0], vae: ['1', 2] } },
    7: { class_type: 'CLIPTextEncode', inputs: { text: POS, clip: ['1', 1] } },
    8: { class_type: 'CLIPTextEncode', inputs: { text: NEG, clip: ['1', 1] } },
    9: {
      class_type: 'KSampler',
      inputs: {
        model: ['5', 0],
        positive: ['7', 0],
        negative: ['8', 0],
        latent_image: ['6', 0],
        seed: p.seed,
        steps: p.steps,
        cfg: p.cfg,
        sampler_name: 'dpmpp_2m_sde',
        scheduler: 'sgm_uniform',
        denoise: 1.0,
      },
    },
    10: { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['1', 2] } },
    11: {
      class_type: 'ColorTransfer',
      inputs: {
        image_target: ['10', 0],
        image_ref: ['4', 0],
        method: p.colorMethod,
        source_stats: 'per_frame',
        strength: 1.0,
      },
    },
    12: { class_type: 'SaveImage', inputs: { images: ['11', 0], filename_prefix: 'refine' } },
  }
}

async function runCompare(cfg, source, output, targetPath) {
  const script = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'compare.py')
  if (!fs.existsSync(script)) return undefined
  return new Promise((resolve) => {
    const child = spawn(cfg.python, [script, source, output, targetPath], {
      windowsHide: true,
      stdio: 'ignore',
    })
    child.on('exit', (code) => resolve(code === 0 && fs.existsSync(targetPath) ? targetPath : undefined))
    child.on('error', () => resolve(undefined))
  })
}

let queue = Promise.resolve()

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config }
  const log = (m) => ctx.logger?.info?.(`[supir-refine] ${m}`)

  ctx.effect(() => {
    void reapStale(cfg).catch(() => {})
    return () => shutdown(cfg)
  })

  ctx.effect(() =>
    ctx.tools.register({
      name: 'image_refine',
      description:
        'Refine a photo with SUPIR: regenerate realistic detail and raise resolution (typically 2-4x). ' +
        'Use it on blurry, low-resolution, noisy, or heavily compressed images that should look sharper and more photographic. ' +
        'Omit "image" to refine the newest picture the user just attached to this conversation. ' +
        'Presets: faithful (closest to the original, least identity change), balanced (default), detail (stronger texture), ' +
        'creative (freest redraw, most detail, highest risk of changing faces or text).',
      parameters: {
        type: 'object',
        properties: {
          image: {
            type: 'string',
            description:
              'Absolute or workspace-relative path to the source image. Omit to use the newest image the user attached.',
          },
          preset: {
            type: 'string',
            enum: ['faithful', 'balanced', 'detail', 'creative'],
            description: 'Quality preset. Default: balanced.',
          },
          scale: {
            type: 'number',
            description: 'Resolution multiplier applied before refinement (default 2).',
          },
          max_side: {
            type: 'integer',
            description: 'Longest output side in pixels; 2048 is safe on 16 GB VRAM (default 2048).',
          },
          steps: { type: 'integer', description: 'Sampling steps; overrides the preset.' },
          cfg: { type: 'number', description: 'Guidance scale; must stay above 1.0 or fidelity control is disabled.' },
          restore_cfg: {
            type: 'number',
            description: 'Fidelity to the input. Lower = freer redraw, higher = closer to the original (1-8).',
          },
          strength: { type: 'number', description: 'SUPIR injection strength at the start of sampling (0-1).' },
          strength_end: { type: 'number', description: 'SUPIR injection strength at the end of sampling (0-1).' },
          color_method: {
            type: 'string',
            enum: ['mkl_lab', 'reinhard_lab', 'histogram', 'none'],
            description: 'Post colour transfer to the source (default mkl_lab).',
          },
          seed: { type: 'integer', description: 'Random seed; keep it fixed to compare parameter changes.' },
          compare: {
            type: 'boolean',
            description: 'Also produce a side-by-side comparison image (bicubic vs refined).',
          },
          tag: { type: 'string', description: 'Optional filename tag.' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            output: { type: 'string' },
            compare: { type: 'string' },
            width: { type: 'integer' },
            height: { type: 'integer' },
            seconds: { type: 'number' },
            source: { type: 'string' },
            preset: { type: 'string' },
            params: { type: 'object' },
          },
          required: ['output', 'width', 'height', 'seconds'],
        },
        render(args, value) {
          const lines = [
            `Refined ${value.width}x${value.height} in ${value.seconds}s (preset ${value.preset})`,
            `output: ${value.output}`,
          ]
          if (value.compare) lines.push(`compare: ${value.compare}`)
          lines.push(`source: ${value.source}`)
          lines.push(`plugin ${value.pluginVersion ?? 'unknown'}`)
          return [{ type: 'text', text: lines.join('\n') }]
        },
      },
      async execute(args) {
        const task = queue.then(() => refine(cfg, args || {}, log))
        queue = task.catch(() => {})
        return task
      },
    }),
  )
}

async function refine(cfg, args, log) {
  const presetName = args.preset || cfg.preset
  const preset = PRESETS[presetName]
  if (!preset) throw new Error(`unknown preset: ${presetName}`)

  const source = materializeSource(cfg, args.image)
  const size = readImageSize(source.file)
  if (!size) throw new Error(`could not read image dimensions: ${source.file}`)

  const scale = Number(args.scale) > 0 ? Number(args.scale) : cfg.scale
  const maxSide = Number(args.max_side) > 0 ? Number(args.max_side) : cfg.maxSide
  let width = Math.round(size.width * scale)
  let height = Math.round(size.height * scale)
  const limit = Math.max(width, height)
  if (limit > maxSide) {
    const k = maxSide / limit
    width = Math.round(width * k)
    height = Math.round(height * k)
  }
  width = Math.max(64, Math.floor(width / 8) * 8)
  height = Math.max(64, Math.floor(height / 8) * 8)

  const params = {
    steps: Number(args.steps) > 0 ? Number(args.steps) : preset.steps,
    cfg: Number(args.cfg) > 0 ? Number(args.cfg) : preset.cfg,
    restoreCfg: Number(args.restore_cfg) >= 0 ? Number(args.restore_cfg) : preset.restore,
    strengthStart: Number(args.strength) > 0 ? Number(args.strength) : preset.s0,
    strengthEnd: Number(args.strength_end) > 0 ? Number(args.strength_end) : preset.s1,
    colorMethod: args.color_method || 'mkl_lab',
    seed: Number.isFinite(Number(args.seed)) ? Number(args.seed) : 174277455657959,
  }
  if (params.cfg <= 1.0) params.cfg = 1.2

  const inputDir = path.join(cfg.comfyDir, 'input')
  fs.mkdirSync(inputDir, { recursive: true })
  const ext = isImageFile(source.file) === 'png' ? '.png' : '.jpg'
  const imageName = `refine_in${ext}`
  copyOver(source.file, path.join(inputDir, imageName))

  await ensureServer(cfg, log)
  const started = Date.now()

  const graph = buildGraph(cfg, {
    imageName,
    width,
    height,
    ...params,
  })
  const queued = await request(cfg, 'POST', '/prompt', { prompt: graph }, 60000)
  const promptId = queued.prompt_id
  if (!promptId) throw new Error('ComfyUI rejected the workflow')

  let entry
  const deadline = Date.now() + 15 * 60000
  while (Date.now() < deadline) {
    const history = await request(cfg, 'GET', `/history/${promptId}`, undefined, 30000)
    if (history[promptId]) {
      entry = history[promptId]
      break
    }
    await sleep(900)
  }
  if (!entry) throw new Error('refinement timed out after 15 minutes')
  if (entry.status?.status_str === 'error') {
    throw new Error(`ComfyUI error: ${JSON.stringify(entry.status).slice(0, 800)}`)
  }

  const images = Object.values(entry.outputs || {}).flatMap((o) => o.images || [])
  if (!images.length) throw new Error('ComfyUI produced no image')

  const produced = path.join(cfg.comfyDir, 'output', images[0].subfolder || '', images[0].filename)
  fs.mkdirSync(cfg.outputDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
  const tagPart = args.tag ? `_${String(args.tag).replace(/[^\w-]/g, '')}` : ''
  const target = path.join(cfg.outputDir, `refined_${stamp}${tagPart}_${presetName}.png`)
  copyOver(produced, target)

  let comparePath
  if (args.compare === true) {
    const compareTarget = target.replace(/\.png$/, '_compare.jpg')
    comparePath = await runCompare(cfg, source.file, target, compareTarget)
  }

  server.lastUse = Date.now()
  scheduleIdleShutdown(cfg)

  const result = {
    output: target,
    width,
    height,
    seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    source: `${source.file} (${source.origin})`,
    preset: presetName,
    params,
    pluginVersion: PLUGIN_VERSION,
  }
  if (comparePath) result.compare = comparePath
  log(`done ${width}x${height} in ${result.seconds}s -> ${target}`)
  return result
}
