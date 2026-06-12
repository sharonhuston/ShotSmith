import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { buildBatchJobs, MAX_TAKES_PER_SHOT } from './lib/buildBatchJobs'
import { GENERATED_OUTPUT, generatedOutputHeightPx } from './lib/generatedFrameSize'
import { makeBatchSeed } from './lib/identityLock'
import { generateFrameImageBase64 } from './lib/geminiImageGeneration'
import { buildOutputFilename, buildUpscaleSaveName, extensionForImageMime } from './lib/naming'
import {
  firstAvailableNumberedName,
  saveArrayBufferToDirectory,
  saveBase64ImageToDirectory,
} from './lib/savePngToDirectory'
import { TARGET_4K_WIDTH_PX, upscaleTo4KFromBlob, upscaleToTargetWidthFromBlob } from './lib/falTopazUpscale'
import {
  type FileWithHandle,
  pickImageFiles,
  saveSoloCleanupResult,
  saveSoloUpscaleResult,
} from './lib/soloUpscalePickSave'
import {
  CLEANUP_PRESET_LIST,
  decodeImageBase64ToArrayBuffer,
  generateCleanupImageBase64,
  type CleanupPresetId,
} from './lib/geminiCleanupImage'
import { pickWritableDirectory } from './lib/pickOutputDirectory'
import { SHOT_PACKS, shotKey } from './lib/shotPacks'
import { formatVibeParseError } from './lib/vibeErrors'
import { createObjectUrlFromBase64Image } from './lib/galleryObjectUrl'
import { parseVibeFromImage, type VibeParseResult } from './lib/vibeParser'
import './App.css'

const DEFAULT_PROJECT = 'ShotSmith'

/** Shown in log/status when the user cancels a multi-job run. */
const RUN_STOPPED_MESSAGE =
  'Stopped — remaining jobs cancelled. Completed images are kept. The in-flight request may still bill.'

const SOLO_UPSCALE_PRESETS: readonly { w: number; label: string }[] = [
  { w: 1280, label: '1280 px' },
  { w: 1920, label: '1920 px (Full HD)' },
  { w: 2560, label: '2560 px (QHD / 2.5K class)' },
  { w: 3840, label: '3840 px (4K UHD)' },
  { w: 5504, label: '5504 px' },
  { w: 7680, label: '7680 px (8K class)' },
]

type MainTab = 'upload' | 'shots' | 'gallery' | 'cleanup' | 'upscale'

type BatchGalleryItem = {
  key: string
  filename: string
  shotLabel: string
  /** `blob:` URL; revoked when a new batch starts or the app unmounts */
  previewUrl: string
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'AbortError') ||
    (e instanceof Error && e.name === 'AbortError')
  )
}

function imageFilesFromFileList(files: FileList | null): FileWithHandle[] {
  if (!files?.length) return []
  const out: FileWithHandle[] = []
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!
    if (f.type === 'image/png' || f.type === 'image/jpeg') {
      out.push({ file: f, fileHandle: null })
    }
  }
  return out
}

function useObjectUrl(file: File | null): string | null {
  return useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
}

export default function App() {
  const baseId = useId()
  const [mainTab, setMainTab] = useState<MainTab>('upload')
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [vibe, setVibe] = useState<VibeParseResult | null>(null)
  const [vibeError, setVibeError] = useState<string | null>(null)
  const [vibeLoading, setVibeLoading] = useState(false)
  /** Per shot type: how many takes to generate (0 = off, 1–10). */
  const [shotTakeCounts, setShotTakeCounts] = useState<Record<string, number>>(() => ({}))
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT)
  const [denoising, setDenoising] = useState(0.45)
  const [outputDirName, setOutputDirName] = useState<string | null>(null)
  const [outputHandle, setOutputHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [outputPicking, setOutputPicking] = useState(false)
  const [batchLog, setBatchLog] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchStatusLine, setBatchStatusLine] = useState<string | null>(null)
  const [batchGallery, setBatchGallery] = useState<BatchGalleryItem[]>([])
  const [galleryUpscaleSelected, setGalleryUpscaleSelected] = useState<Set<string>>(
    () => new Set()
  )
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [upscaleBusy, setUpscaleBusy] = useState(false)
  const [upscaleStatus, setUpscaleStatus] = useState<string | null>(null)
  /** One-off “Upscale Only” tab (fal + save beside original or Save As). */
  const [soloPicks, setSoloPicks] = useState<FileWithHandle[]>([])
  const [soloTargetWidth, setSoloTargetWidth] = useState(3840)
  const [soloOnlyBusy, setSoloOnlyBusy] = useState(false)
  const [soloStatus, setSoloStatus] = useState<string | null>(null)
  /** “Cleanup only” (Gemini Nano Banana Pro) — same UX pattern as solo upscale. */
  const [cleanupPicks, setCleanupPicks] = useState<FileWithHandle[]>([])
  const [cleanupPreset, setCleanupPreset] = useState<CleanupPresetId>('balanced')
  const [cleanupOnlyBusy, setCleanupOnlyBusy] = useState(false)
  const [cleanupStatus, setCleanupStatus] = useState<string | null>(null)
  /** Batch or upscale has started — locks Upload and Shots until Stop and Reset. */
  const [queueStarted, setQueueStarted] = useState(false)
  /** User finished Upload (image + folder + prefix) and used Next; locks Upload until reset. */
  const [uploadCommitted, setUploadCommitted] = useState(false)

  /** Any long-running queue (batch, gallery upscale, solo upscale, or solo cleanup) — blocks changing the reference image. */
  const queueProcessing = batchBusy || upscaleBusy || soloOnlyBusy || cleanupOnlyBusy

  const uploadChecklistComplete = useMemo(
    () =>
      referenceFile != null &&
      outputHandle != null &&
      projectName.trim().length > 0,
    [referenceFile, outputHandle, projectName]
  )

  const uploadTabDisabled = uploadCommitted || queueProcessing
  const shotsTabDisabled = !uploadCommitted || queueProcessing
  /** Gallery opens once a batch or gallery upscale run has started (Generate / Upscale to 4K). */
  const galleryTabDisabled = !queueStarted

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const soloFileInputRef = useRef<HTMLInputElement | null>(null)
  const soloOnlyAbortRef = useRef<AbortController | null>(null)
  /** Synchronous lock so a second Go click can’t start before state updates. */
  const soloGoLockRef = useRef(false)
  const cleanupFileInputRef = useRef<HTMLInputElement | null>(null)
  const cleanupOnlyAbortRef = useRef<AbortController | null>(null)
  const cleanupGoLockRef = useRef(false)
  const galleryUrlsRef = useRef<string[]>([])
  const lightboxCloseRef = useRef<HTMLButtonElement>(null)
  const outputPickerLockRef = useRef(false)
  const batchAbortRef = useRef<AbortController | null>(null)
  const upscaleAbortRef = useRef<AbortController | null>(null)

  const vibeRequestIdRef = useRef(0)
  const vibeAbortRef = useRef<AbortController | null>(null)

  const previewUrl = useObjectUrl(referenceFile)
  const soloPreviewUrl = useObjectUrl(soloPicks[0]?.file ?? null)
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])
  useEffect(() => {
    return () => {
      if (soloPreviewUrl) URL.revokeObjectURL(soloPreviewUrl)
    }
  }, [soloPreviewUrl])
  const revokeBatchGallery = useCallback(() => {
    setLightboxIndex(null)
    setGalleryUpscaleSelected(new Set())
    for (const u of galleryUrlsRef.current) {
      URL.revokeObjectURL(u)
    }
    galleryUrlsRef.current = []
    setBatchGallery([])
  }, [])

  useEffect(() => {
    return () => {
      for (const u of galleryUrlsRef.current) {
        URL.revokeObjectURL(u)
      }
      galleryUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    if (lightboxIndex == null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxIndex])

  useEffect(() => {
    if (lightboxIndex == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setLightboxIndex(null)
        return
      }
      const n = batchGallery.length
      if (n <= 1) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setLightboxIndex((i) => (i == null ? 0 : (i - 1 + n) % n))
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setLightboxIndex((i) => (i == null ? 0 : (i + 1) % n))
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [lightboxIndex, batchGallery.length])

  useEffect(() => {
    if (lightboxIndex != null) {
      lightboxCloseRef.current?.focus()
    }
  }, [lightboxIndex])

  const runVibe = useCallback(async (file: File) => {
    const id = ++vibeRequestIdRef.current
    vibeAbortRef.current?.abort()
    const ac = new AbortController()
    vibeAbortRef.current = ac

    setVibeLoading(true)
    setVibeError(null)
    try {
      const r = await parseVibeFromImage(file, { signal: ac.signal })
      if (id !== vibeRequestIdRef.current) return
      setVibe(r)
    } catch (e) {
      if (id !== vibeRequestIdRef.current) return
      if (e instanceof Error && e.name === 'AbortError') return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setVibe(null)
      setVibeError(formatVibeParseError(e))
    } finally {
      if (id === vibeRequestIdRef.current) {
        setVibeLoading(false)
      }
    }
  }, [])

  const onPickFile = (file: File | null) => {
    setReferenceFile(file)
    setVibe(null)
    setVibeError(null)
    if (file) void runVibe(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (queueProcessing) return
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type === 'image/png' || f.type === 'image/jpeg')) onPickFile(f)
  }

  const getShotCount = (packId: string, shotId: string) => {
    const k = shotKey(packId, shotId)
    return shotTakeCounts[k] ?? 0
  }

  const adjustShotCount = (packId: string, shotId: string, delta: number) => {
    const k = shotKey(packId, shotId)
    setShotTakeCounts((prev) => {
      const cur = prev[k] ?? 0
      const n = Math.max(0, Math.min(MAX_TAKES_PER_SHOT, cur + delta))
      const next = { ...prev }
      if (n === 0) {
        delete next[k]
      } else {
        next[k] = n
      }
      return next
    })
  }

  const selectAllInPack = (packId: string, on: boolean) => {
    const pack = SHOT_PACKS.find((p) => p.id === packId)
    if (!pack) return
    setShotTakeCounts((prev) => {
      const next = { ...prev }
      for (const s of pack.shots) {
        const k = shotKey(packId, s.id)
        if (on) {
          next[k] = 1
        } else {
          delete next[k]
        }
      }
      return next
    })
  }

  const totalTakeJobs = useMemo(
    () => Object.values(shotTakeCounts).reduce((a, b) => a + b, 0),
    [shotTakeCounts]
  )

  const toggleGalleryUpscale = (key: string) => {
    setGalleryUpscaleSelected((prev) => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  const pickOutputDirectory = async () => {
    if (outputPickerLockRef.current) return
    outputPickerLockRef.current = true
    setOutputPicking(true)
    try {
      const handle = await pickWritableDirectory()
      if (!handle) {
        setOutputDirName(null)
        setOutputHandle(null)
        setBatchLog(
          'This browser does not support the directory picker. Use a Chromium-based browser, or package with Electron for full access.'
        )
        return
      }
      setOutputHandle(handle)
      setOutputDirName(handle.name)
      setBatchLog(null)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      if (e instanceof Error) {
        const m = e.message
        if (m.includes('File picker already active')) {
          setBatchLog(
            "Chromium bug/quirk: a picker is still 'active' even with no window visible. " +
              'Try: use a new tab, or fully quit the browser and reopen. In Task Manager, end the browser (e.g. Microsoft Edge) — not Windows Explorer. ' +
              'Technical: ' +
              m
          )
        } else {
          setBatchLog(m)
        }
        return
      }
      setBatchLog('Could not open folder')
    } finally {
      outputPickerLockRef.current = false
      setOutputPicking(false)
    }
  }

  /** Stop the active multi-job run without clearing reference, vibe, folder, or gallery. */
  const cancelCurrentRun = useCallback(() => {
    batchAbortRef.current?.abort()
    upscaleAbortRef.current?.abort()
    soloOnlyAbortRef.current?.abort()
    cleanupOnlyAbortRef.current?.abort()
  }, [])

  const stopAndReset = useCallback(() => {
    cancelCurrentRun()
    vibeAbortRef.current?.abort()
    vibeRequestIdRef.current += 1
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (soloFileInputRef.current) {
      soloFileInputRef.current.value = ''
    }
    if (cleanupFileInputRef.current) {
      cleanupFileInputRef.current.value = ''
    }
    setSoloPicks([])
    setSoloStatus(null)
    setSoloTargetWidth(3840)
    setSoloOnlyBusy(false)
    soloOnlyAbortRef.current = null
    soloGoLockRef.current = false
    setCleanupPicks([])
    setCleanupPreset('balanced')
    setCleanupStatus(null)
    setCleanupOnlyBusy(false)
    cleanupOnlyAbortRef.current = null
    cleanupGoLockRef.current = false
    setReferenceFile(null)
    setVibe(null)
    setVibeError(null)
    setVibeLoading(false)
    setShotTakeCounts({})
    setProjectName(DEFAULT_PROJECT)
    setDenoising(0.45)
    setOutputDirName(null)
    setOutputHandle(null)
    setOutputPicking(false)
    setBatchLog(null)
    setBatchProgress(0)
    setBatchStatusLine(null)
    setBatchBusy(false)
    setUpscaleBusy(false)
    setUpscaleStatus(null)
    setQueueStarted(false)
    setUploadCommitted(false)
    revokeBatchGallery()
    setGalleryUpscaleSelected(new Set())
    setMainTab('upload')
    setLightboxIndex(null)
    batchAbortRef.current = null
    upscaleAbortRef.current = null
  }, [cancelCurrentRun, revokeBatchGallery])

  const onBatchGenerate = async () => {
    if (!referenceFile) {
      setBatchLog('Add a reference image first.')
      return
    }
    if (!vibe) {
      setBatchLog('Wait for the internal vibe parse to finish, or re-upload the image.')
      return
    }
    if (totalTakeJobs === 0) {
      setBatchLog('Set at least one take (1–10) for a shot in the matrix, or use All in a pack.')
      return
    }
    if (!outputHandle) {
      setBatchLog('Choose an output folder (directory picker).')
      return
    }

    const ac = new AbortController()
    batchAbortRef.current = ac

    const batchSeed = makeBatchSeed()
    const jobs = buildBatchJobs(shotTakeCounts, vibe, { identityLock: true, batchSeed })
    const genH = generatedOutputHeightPx()
    const lines: string[] = [
      `One continuous batch: ${jobs.length} job(s) in order (do not split across runs for identity).`,
      'Shared batch seed: on (one seed per run for subject consistency; repeated shot types get different variant ids in each request).',
      `Batch seed: ${batchSeed}`,
    ]
    lines.push(
      `Denoising (creativity): ${denoising.toFixed(2)}`,
      `Target preview: ${GENERATED_OUTPUT.widthPx}×${genH} (16:9) — upscale later (e.g. Topaz) if needed`,
      `Output: ${outputDirName ?? '?'}`,
      '',
    )

    setQueueStarted(true)
    setBatchBusy(true)
    setBatchProgress(0)
    setBatchStatusLine('Preparing…')
    setMainTab('gallery')
    revokeBatchGallery()
    lines.push('— Starting Pro image batch —', '')
    setBatchLog(lines.join('\n'))

    try {
      for (let i = 0; i < jobs.length; i++) {
        if (ac.signal.aborted) break
        const j = jobs[i]!
        setBatchStatusLine(`Generating… ${i + 1} / ${jobs.length}`)
        setBatchProgress(Math.round((i / Math.max(1, jobs.length)) * 100))
        setBatchLog([...lines, `Generating ${i + 1}/${jobs.length}: ${j.shotLabel}…`].join('\n'))
        let img: Awaited<ReturnType<typeof generateFrameImageBase64>>
        try {
          img = await generateFrameImageBase64({
            referenceFile,
            job: j,
            denoising,
            signal: ac.signal,
          })
        } catch (e) {
          if (isAbortError(e)) {
            lines.push('', RUN_STOPPED_MESSAGE)
            setBatchLog(lines.join('\n'))
            setBatchStatusLine('Stopped')
            return
          }
          throw e
        }
        const ext = extensionForImageMime(img.mimeType)
        const name = await firstAvailableNumberedName(outputHandle, i + 1, (n) =>
          buildOutputFilename(projectName, j.packId, j.shotId, n, ext)
        )
        await saveBase64ImageToDirectory(outputHandle, name, img.base64)
        const previewUrl = createObjectUrlFromBase64Image(img.base64, img.mimeType)
        galleryUrlsRef.current.push(previewUrl)
        const item: BatchGalleryItem = {
          key: `${name}-${i}`,
          filename: name,
          shotLabel: j.shotLabel,
          previewUrl,
        }
        setBatchGallery((prev) => [...prev, item])
        lines.push(
          `Saved: ${name}  ←  ${j.shotLabel}  [batch: ${j.batchSeed ?? '—'} · variant: ${j.variantSeed}]`
        )
        setBatchLog(lines.join('\n'))
        setBatchProgress(Math.round(((i + 1) / Math.max(1, jobs.length)) * 100))
      }
      if (ac.signal.aborted) {
        lines.push('', RUN_STOPPED_MESSAGE)
        setBatchLog(lines.join('\n'))
        setBatchStatusLine('Stopped')
      } else {
        lines.push('', 'Batch complete.')
        setBatchLog(lines.join('\n'))
        setBatchStatusLine('Batch complete')
        if (import.meta.env.DEV) {
          console.log('Batch complete', { jobCount: jobs.length, outputHandle, batchSeed })
        }
      }
    } catch (e) {
      if (isAbortError(e)) {
        setBatchLog([lines.join('\n'), '', RUN_STOPPED_MESSAGE].join('\n'))
        setBatchStatusLine('Stopped')
        return
      }
      setBatchLog(
        [lines.join('\n'), '', 'Error:', formatVibeParseError(e)].join('\n')
      )
      setBatchStatusLine('Error')
    } finally {
      batchAbortRef.current = null
      setBatchBusy(false)
    }
  }

  const goToShotsAndCommit = () => {
    if (!uploadChecklistComplete || uploadCommitted) return
    setUploadCommitted(true)
    setMainTab('shots')
  }

  const onSoloChooseImage = async () => {
    if (soloOnlyBusy) return
    if (!('showOpenFilePicker' in window)) {
      soloFileInputRef.current?.click()
      return
    }
    try {
      const list = await pickImageFiles()
      if (list.length > 0) {
        setSoloPicks(list)
        setSoloStatus(null)
      }
    } catch (e) {
      setSoloStatus(formatVibeParseError(e))
    }
  }

  const onSoloFilePicked = (files: FileList | null) => {
    const list = imageFilesFromFileList(files)
    if (list.length) {
      setSoloPicks(list)
      setSoloStatus(null)
    }
  }

  const onSoloOnlyGo = async () => {
    if (soloPicks.length === 0 || soloOnlyBusy || soloGoLockRef.current) return
    soloGoLockRef.current = true
    const runList = soloPicks
    const targetW = soloTargetWidth
    const ac = new AbortController()
    soloOnlyAbortRef.current = ac
    setSoloOnlyBusy(true)
    const n = runList.length
    const savedLine: string[] = []
    try {
      for (let i = 0; i < n; i++) {
        if (ac.signal.aborted) {
          setSoloStatus('Stopped')
          return
        }
        const { file: fileForRun, fileHandle: handleForRun } = runList[i]!
        setSoloStatus(`Upscaling ${i + 1}/${n}: ${fileForRun.name}…`)
        const { arrayBuffer, mime, width, height, passes } = await upscaleToTargetWidthFromBlob(
          fileForRun,
          targetW,
          {
            signal: ac.signal,
            onProgress: (m) => setSoloStatus(`${i + 1}/${n}: ${m}`),
          }
        )
        const { filename: saved } = await saveSoloUpscaleResult(
          arrayBuffer,
          mime,
          fileForRun.name,
          handleForRun
        )
        savedLine.push(
          `${saved} (${width}×${height}px, ${passes} pass${passes === 1 ? '' : 'es'})`
        )
      }
      if (soloFileInputRef.current) {
        soloFileInputRef.current.value = ''
      }
      setSoloPicks([])
      setSoloStatus(
        `Done — ${n} file(s). ${savedLine.join(' · ')} Form reset: choose new images before Go.`
      )
    } catch (e) {
      if (isAbortError(e)) {
        setSoloStatus('Stopped')
      } else {
        setSoloStatus(formatVibeParseError(e))
      }
    } finally {
      soloOnlyAbortRef.current = null
      soloGoLockRef.current = false
      setSoloOnlyBusy(false)
    }
  }

  const onCleanupChooseImage = async () => {
    if (cleanupOnlyBusy) return
    if (!('showOpenFilePicker' in window)) {
      cleanupFileInputRef.current?.click()
      return
    }
    try {
      const list = await pickImageFiles()
      if (list.length > 0) {
        setCleanupPicks(list)
        setCleanupStatus(null)
      }
    } catch (e) {
      setCleanupStatus(formatVibeParseError(e))
    }
  }

  const onCleanupFilePicked = (files: FileList | null) => {
    const list = imageFilesFromFileList(files)
    if (list.length) {
      setCleanupPicks(list)
      setCleanupStatus(null)
    }
  }

  const onCleanupOnlyGo = async () => {
    if (cleanupPicks.length === 0 || cleanupOnlyBusy || cleanupGoLockRef.current) return
    cleanupGoLockRef.current = true
    const runList = cleanupPicks
    const preset = cleanupPreset
    const ac = new AbortController()
    cleanupOnlyAbortRef.current = ac
    setCleanupOnlyBusy(true)
    const n = runList.length
    const savedLine: string[] = []
    try {
      for (let i = 0; i < n; i++) {
        if (ac.signal.aborted) {
          setCleanupStatus('Stopped')
          return
        }
        const { file: fileForRun, fileHandle: handleForRun } = runList[i]!
        setCleanupStatus(`Cleanup ${i + 1}/${n}: ${fileForRun.name}…`)
        const out = await generateCleanupImageBase64({
          referenceFile: fileForRun,
          preset,
          signal: ac.signal,
        })
        setCleanupStatus(`Saving ${i + 1}/${n}…`)
        const ab = decodeImageBase64ToArrayBuffer(out.base64)
        const outcome = await saveSoloCleanupResult(
          ab,
          out.mimeType,
          fileForRun.name,
          handleForRun
        )
        savedLine.push(outcome.filename)
      }
      if (cleanupFileInputRef.current) {
        cleanupFileInputRef.current.value = ''
      }
      setCleanupPicks([])
      setCleanupPreset('balanced')
      setCleanupStatus(
        `Done — ${n} file(s) saved: ${savedLine.join(', ')}. Form reset: choose new images before Go.`
      )
    } catch (e) {
      if (isAbortError(e)) {
        setCleanupStatus('Stopped')
      } else {
        setCleanupStatus(formatVibeParseError(e))
      }
    } finally {
      cleanupOnlyAbortRef.current = null
      cleanupGoLockRef.current = false
      setCleanupOnlyBusy(false)
    }
  }

  const onUpscaleClick = async () => {
    if (galleryUpscaleSelected.size === 0 || !outputHandle) return
    const selected = batchGallery.filter((g) => galleryUpscaleSelected.has(g.key))
    if (selected.length === 0) return

    const ac = new AbortController()
    upscaleAbortRef.current = ac

    setQueueStarted(true)
    setUpscaleBusy(true)
    setUpscaleStatus('Starting…')
    const append = (m: string) => setBatchLog((p) => (p ? `${p}\n${m}` : m))
    const n = selected.length
    const g0 = selected[0]!
    setMainTab('gallery')
    setBatchLog((prev) =>
      (prev ? `${prev}\n\n` : '') +
        `— Topaz upscale (target ~${TARGET_4K_WIDTH_PX}px wide) —\n` +
        `${n} image(s). Originals are unchanged; new files use *_upscale before the extension.\n` +
        `[1/${n}] ${g0.filename}`
    )

    try {
      for (let i = 0; i < selected.length; i++) {
        if (ac.signal.aborted) {
          append(RUN_STOPPED_MESSAGE)
          setUpscaleStatus('Stopped')
          return
        }
        const g = selected[i]!
        setUpscaleStatus(`Upscaling ${i + 1}/${n}: ${g.shotLabel}`)
        if (i > 0) {
          append(`[${i + 1}/${n}] ${g.filename}`)
        }

        const res = await fetch(g.previewUrl, { signal: ac.signal })
        if (!res.ok) {
          append(`  → Error: could not read preview (${res.status})`)
          continue
        }
        const blob = await res.blob()

        const { arrayBuffer, mime, width, height, passes } = await upscaleTo4KFromBlob(blob, {
          signal: ac.signal,
          onProgress: (m) => {
            setUpscaleStatus(`${i + 1}/${selected.length}: ${m}`)
            append(`  ${m}`)
          },
        })
        const ext = extensionForImageMime(mime)
        const stem = g.filename.replace(/\.[^.]+$/, '')
        const finalName = await firstAvailableNumberedName(outputHandle, 0, (n) =>
          buildUpscaleSaveName(stem, ext, n)
        )

        await saveArrayBufferToDirectory(outputHandle, finalName, arrayBuffer)
        append(
          `  → Saved: ${finalName} (${width}×${height}px, ${passes} Topaz pass${passes === 1 ? '' : 'es'})`
        )
        const previewUrl = URL.createObjectURL(
          new Blob([arrayBuffer], { type: mime || 'image/png' })
        )
        galleryUrlsRef.current.push(previewUrl)
        setBatchGallery((prev) => [
          ...prev,
          {
            key: `upscale-${g.key}-${i}-${Date.now()}`,
            filename: finalName,
            shotLabel: `${g.shotLabel} (4K)`,
            previewUrl,
          },
        ])
      }
      setUpscaleStatus('4K upscales complete')
      setGalleryUpscaleSelected(new Set())
    } catch (e) {
      if (isAbortError(e)) {
        append(RUN_STOPPED_MESSAGE)
        setUpscaleStatus('Stopped')
      } else {
        const msg = formatVibeParseError(e)
        append(`Upscale error: ${msg}`)
        setUpscaleStatus('Upscale failed')
      }
    } finally {
      upscaleAbortRef.current = null
      setUpscaleBusy(false)
    }
  }

  return (
    <div className="app app--shell">
      <div className="window">
        <header className="window__titlebar">
          <h1 className="window__title">ShotSmith</h1>
          <div className="window__controls" aria-hidden="true">
            <span className="window__dot" />
            <span className="window__dot" />
            <span className="window__dot window__dot--close" />
          </div>
        </header>

        <div className="app-tabs" role="tablist" aria-label="Main sections and Upscale">
          {(
            [
              [
                'upload',
                '① Select Image',
                uploadTabDisabled,
                uploadCommitted && !queueProcessing
                  ? 'This step is complete. Use Stop and Reset to change image, folder, or prefix.'
                  : queueProcessing
                    ? 'Locked while a run is in progress. Cancel on Gallery (or Cleanup / Upscale tabs), or use Stop and Reset.'
                    : 'Step 1 — choose image, output folder, and filename prefix — then use Next.',
              ] as const,
              [
                'shots',
                '② Select Shots',
                shotsTabDisabled,
                !uploadCommitted
                  ? 'Select image, output folder, and prefix on ① Select Image — then use Next to open this step.'
                  : queueProcessing
                    ? 'Locked while a run is in progress. Cancel on Gallery, or use Stop and Reset.'
                    : 'Step 2 — configure takes per shot, then Generate.',
              ] as const,
              [
                'gallery',
                '③ Gallery',
                galleryTabDisabled,
                galleryTabDisabled
                  ? 'Opens when you start Generate (or Upscale to 4K from the gallery).'
                  : 'Step 3 — progress, log, and image grid.',
              ] as const,
            ] as const
          ).map(([id, label, stepDisabled, stepTitle]) => (
            <button
              key={id}
              type="button"
              role="tab"
              className={mainTab === id ? 'app-tabs__tab app-tabs__tab--active' : 'app-tabs__tab'}
              id={`${baseId}-main-${id}`}
              aria-selected={mainTab === id}
              tabIndex={mainTab === id ? 0 : -1}
              disabled={stepDisabled}
              title={stepTitle || undefined}
              onClick={() => {
                if (stepDisabled) return
                setMainTab(id)
              }}
            >
              {label}
            </button>
          ))}
          <div className="app-tabs__trail" role="none">
            <button
              type="button"
              role="tab"
              className={
                mainTab === 'cleanup'
                  ? 'app-tabs__tab app-tabs__tab--active app-tabs__tab--trail'
                  : 'app-tabs__tab app-tabs__tab--trail'
              }
              id={`${baseId}-main-cleanup`}
              aria-selected={mainTab === 'cleanup'}
              tabIndex={mainTab === 'cleanup' ? 0 : -1}
              title="Photo cleanup with Gemini (Nano Banana): sharpen, specks, contrast—vintage light preserved."
              onClick={() => {
                setMainTab('cleanup')
              }}
            >
              Cleanup Only
            </button>
            <button
              type="button"
              role="tab"
              className={
                mainTab === 'upscale'
                  ? 'app-tabs__tab app-tabs__tab--active app-tabs__tab--trail'
                  : 'app-tabs__tab app-tabs__tab--trail'
              }
              id={`${baseId}-main-upscale`}
              aria-selected={mainTab === 'upscale'}
              tabIndex={mainTab === 'upscale' ? 0 : -1}
              title="Single image Topaz upscale; file saved next to the original when the browser allows."
              onClick={() => {
                setMainTab('upscale')
              }}
            >
              Upscale Only
            </button>
          </div>
        </div>

        {mainTab === 'upload' && (
          <div
            className="tab-page"
            role="tabpanel"
            aria-labelledby={`${baseId}-main-upload`}
          >
            <div className="upload-columns">
              <div className="card upload-col upload-col--main">
                <div
                  className="dropzone dropzone--hero"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => {
                    if (!queueProcessing) fileInputRef.current?.click()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!queueProcessing) fileInputRef.current?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={
                    queueProcessing
                      ? 'Reference image (replace after batch or upscale finishes)'
                      : 'Choose reference image'
                  }
                  aria-disabled={queueProcessing}
                >
                  <input
                    ref={fileInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                  {previewUrl ? (
                    <img className="dropzone__preview dropzone__preview--hero" src={previewUrl} alt="Reference" />
                  ) : (
                    <>
                      <div className="dropzone__plus" aria-hidden>
                        +
                      </div>
                      <p className="dropzone__cta">Choose image</p>
                    </>
                  )}
                </div>
                {referenceFile && (
                  <p className="file-badge">
                    {referenceFile.name} · {(referenceFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
                {referenceFile && vibeLoading && (
                  <p className="upload-aux" role="status">
                    Analyzing style from image…
                  </p>
                )}
                {referenceFile && vibeError && !vibeLoading && (
                  <p className="upload-aux upload-aux--error" role="alert">
                    {vibeError}
                    <button
                      type="button"
                      className="btn btn--text upload-aux__retry"
                      disabled={queueProcessing}
                      onClick={() => void runVibe(referenceFile)}
                    >
                      Try again
                    </button>
                  </p>
                )}
              </div>

              <div className="card upload-col upload-col--settings">
                <h2 className="output-settings__title">Output settings</h2>
                <div className="field">
                  <span className="field__label">Output folder</span>
                  <button
                    type="button"
                    className="btn btn--folder"
                    disabled={outputPicking || queueProcessing}
                    onClick={() => void pickOutputDirectory()}
                  >
                    <span className="btn--folder__icon" aria-hidden>
                      📁
                    </span>
                    {outputPicking ? 'Opening…' : 'Select output folder…'}
                  </button>
                  <p className="path-hint">Any folder you choose (e.g. exports or a project drive)</p>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor={`${baseId}-prefix`}>
                    Filename prefix
                  </label>
                  <input
                    id={`${baseId}-prefix`}
                    className="input"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    autoComplete="off"
                    disabled={queueProcessing}
                    placeholder="e.g. ProjectA_"
                  />
                  <p className="path-hint">Files use ProjectName_pack_shot_#.png</p>
                </div>
              </div>
            </div>
            <div className="upload-nav">
              {!uploadChecklistComplete && !queueProcessing && (
                <p className="upload-nav__checklist" role="status" aria-live="polite">
                  <span>
                    {referenceFile ? 'Image selected' : 'Select an image'}
                  </span>
                  <span aria-hidden> · </span>
                  <span>
                    {outputHandle ? 'Output folder set' : 'Choose an output folder'}
                  </span>
                  <span aria-hidden> · </span>
                  <span>
                    {projectName.trim() ? 'Prefix set' : 'Add a filename prefix'}
                  </span>
                </p>
              )}
              <div className="upload-nav__actions">
                <button
                  type="button"
                  className="btn btn--next"
                  disabled={!uploadChecklistComplete || queueProcessing}
                  onClick={goToShotsAndCommit}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {mainTab === 'shots' && (
          <div
            className="tab-page tab-page--shots"
            role="tabpanel"
            aria-labelledby={`${baseId}-main-shots`}
          >
            <div className="shots-top-bar">
              <div className="shots-top-bar__inner">
                <h2 className="shots-top-bar__head">Control panel</h2>
                <div className="creativity creativity--in-shots">
                  <div className="creativity__ends">
                    <span className="creativity__label">Preserve details</span>
                    <span className="creativity__label">Be creative</span>
                  </div>
                  <div className="creativity__track">
                    <input
                      id={`${baseId}-denoise`}
                      className="range range--creativity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={denoising}
                      onChange={(e) => setDenoising(Number(e.target.value))}
                      disabled={queueProcessing}
                    />
                  </div>
                </div>
                <p className="shots-top-bar__hint">
                  Use − / + for 1–10 takes per shot, then <strong>Generate</strong> below. Multiple
                  takes use separate variant lines in the prompt (shared batch only ties identity).
                  The slider sets denoising (creativity) for this batch. After you start, progress
                  and the log appear in <strong>③ Gallery</strong>.
                </p>
              </div>
            </div>
            <div className="shots-workspace-wrap">
              <div className="shots-workspace">
              {SHOT_PACKS.map((p) => (
                <div key={p.id} className="shot-column">
                  <h3 className="shot-column__title" title={p.description}>
                    {p.title}
                  </h3>
                  <div className="shot-column__tools">
                    <button
                      type="button"
                      className="text-btn"
                      disabled={queueProcessing}
                      onClick={() => selectAllInPack(p.id, true)}
                    >
                      All
                    </button>
                    <span className="text-btn-sep" aria-hidden>
                      |
                    </span>
                    <button
                      type="button"
                      className="text-btn"
                      disabled={queueProcessing}
                      onClick={() => selectAllInPack(p.id, false)}
                    >
                      None
                    </button>
                  </div>
                  <ul className="shot-column__list">
                    {p.shots.map((s) => {
                      const c = getShotCount(p.id, s.id)
                      const isOn = c > 0
                      return (
                        <li
                          key={s.id}
                          className={isOn ? 'shot-row shot-row--on' : 'shot-row'}
                          title={s.description || s.label}
                        >
                          <span className="shot-row__name">{s.label}</span>
                          <div className="shot-stepper">
                            <button
                              type="button"
                              className="shot-stepper__btn"
                              aria-label={`Decrease takes for ${s.label}`}
                              disabled={!isOn || queueProcessing}
                              onClick={() => adjustShotCount(p.id, s.id, -1)}
                            >
                              −
                            </button>
                            <span className="shot-stepper__val" aria-live="polite">
                              {c}
                            </span>
                            <button
                              type="button"
                              className="shot-stepper__btn"
                              aria-label={`Increase takes for ${s.label} (max ${MAX_TAKES_PER_SHOT})`}
                              disabled={c >= MAX_TAKES_PER_SHOT || queueProcessing}
                              onClick={() => adjustShotCount(p.id, s.id, 1)}
                            >
                              +
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
            </div>
            <div className="shots-generate-row" role="group" aria-label="Start batch">
              <button
                type="button"
                className="btn btn--generate"
                disabled={queueProcessing || vibeLoading || totalTakeJobs < 1}
                title={
                  totalTakeJobs < 1
                    ? 'Select at least one take in the shot groups above (use + or All).'
                    : undefined
                }
                onClick={() => void onBatchGenerate()}
              >
                Generate
              </button>
            </div>
          </div>
        )}

        {mainTab === 'gallery' && (
          <div
            className="tab-page tab-page--gallery"
            role="tabpanel"
            aria-labelledby={`${baseId}-main-gallery`}
          >
            {(queueProcessing || batchLog) && (
              <div className="gallery-queue">
                {batchBusy && (
                  <div
                    className="progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={batchProgress}
                  >
                    <div className="progress__bar" style={{ width: `${batchProgress}%` }} />
                  </div>
                )}
                {(batchBusy || upscaleBusy) && (
                  <div className="run-actions">
                    <button
                      type="button"
                      className="btn btn--cancel-run"
                      onClick={cancelCurrentRun}
                    >
                      Cancel run
                    </button>
                    <p className="run-actions__hint">
                      Stops remaining jobs and keeps images already saved. The in-flight request may
                      still bill.
                    </p>
                  </div>
                )}
                <p className="progress__status" role="status">
                  {batchBusy
                    ? `Generating… ${batchProgress}%${batchStatusLine ? ` · ${batchStatusLine}` : ''}`
                    : upscaleBusy
                      ? upscaleStatus
                      : batchStatusLine
                        ? batchStatusLine
                        : batchLog
                          ? 'See activity log below.'
                          : 'Ready.'}
                </p>
                {batchLog && (
                  <details className="log-details" open={batchBusy || upscaleBusy}>
                    <summary>Activity log</summary>
                    <pre className="batch-log batch-log--compact">{batchLog}</pre>
                  </details>
                )}
              </div>
            )}

            {batchGallery.length > 0 ? (
              <div className="gallery-section">
                <ul className="batch-gallery" aria-label="Last batch images">
                  {batchGallery.map((g, i) => {
                    const checked = galleryUpscaleSelected.has(g.key)
                    return (
                      <li key={g.key} className="batch-gallery__item">
                        <div className="gallery-card">
                          <button
                            type="button"
                            className="batch-gallery__trigger"
                            onClick={() => setLightboxIndex(i)}
                            aria-label={`Enlarge preview: ${g.shotLabel} (${g.filename})`}
                          >
                            <div className="gallery-card__frame">
                              <img
                                className="batch-gallery__thumb"
                                src={g.previewUrl}
                                alt={g.shotLabel}
                                width={500}
                                height={281}
                                loading="lazy"
                                decoding="async"
                              />
                            </div>
                          </button>
                          <div className="gallery-card__meta">
                            <div className="gallery-card__text">
                              <span className="batch-gallery__label">{g.shotLabel}</span>
                              <span className="batch-gallery__file">{g.filename}</span>
                            </div>
                            <label
                              className="gallery-card__check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                className="gallery-card__cb"
                                checked={checked}
                                onChange={() => toggleGalleryUpscale(g.key)}
                                aria-label={`Select for upscale: ${g.shotLabel}`}
                              />
                            </label>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <footer className="gallery-foot">
                  <p className="gallery-foot__meta" role="status">
                    {!outputHandle
                      ? 'Select an output folder on ① Select Image to save 4K files.'
                      : upscaleStatus
                        ? upscaleStatus
                        : 'Topaz (fal) targets about ' + String(TARGET_4K_WIDTH_PX) + 'px wide (may use multiple passes from ~500px previews).'}
                  </p>
                  <button
                    type="button"
                    className="btn btn--upscale"
                    disabled={
                      galleryUpscaleSelected.size === 0 || !outputHandle || upscaleBusy
                    }
                    onClick={() => void onUpscaleClick()}
                  >
                    {upscaleBusy ? 'Upscaling…' : 'Upscale to 4K'}
                  </button>
                </footer>
              </div>
            ) : (
              <p className="empty-gallery" role="status">
                {queueProcessing ? (
                  'Images appear here as they are generated or upscaled…'
                ) : batchLog ? (
                  'No image previews in the grid for this run. See the activity log for status or errors.'
                ) : (
                  <>
                    Use <strong>② Select Shots</strong> and <strong>Generate</strong> to start;
                    this page shows the log and results.
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {mainTab === 'cleanup' && (
          <div
            className={
              cleanupOnlyBusy
                ? 'tab-page tab-page--solo-upscale tab-page--solo-upscale--running'
                : 'tab-page tab-page--solo-upscale'
            }
            role="tabpanel"
            aria-labelledby={`${baseId}-main-cleanup`}
            aria-busy={cleanupOnlyBusy}
          >
            {cleanupOnlyBusy && (
              <div className="solo-upscale__busy" role="status" aria-live="polite">
                <div className="solo-upscale__busy-card">
                  <span className="solo-upscale__busy-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="solo-upscale__busy-text">
                    Cleaning up (Gemini) — cancel to stop remaining files
                  </span>
                  <button
                    type="button"
                    className="btn btn--cancel-run"
                    onClick={cancelCurrentRun}
                  >
                    Cancel run
                  </button>
                </div>
              </div>
            )}
            <h2 className="solo-upscale__title">Cleanup only</h2>
            <p className="solo-upscale__intro">
              Restore old or soft photos: better apparent sharpness, less dust and speckles, saner
              contrast and light—while <strong>keeping</strong> pleasing vintage or period color and
              mood. In the file dialog, use <strong>Ctrl+Click</strong> (macOS: <strong>Cmd+Click</strong>)
              to add several files. Each file
              is saved with <strong>_cleanup</strong> before the extension, next to the original when
              the browser allows (same as Upscale Only).
            </p>
            <input
              ref={cleanupFileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={(e) => onCleanupFilePicked(e.target.files)}
            />
            <div className="solo-upscale__actions">
              <button
                type="button"
                className="btn btn--folder"
                disabled={queueProcessing}
                onClick={() => void onCleanupChooseImage()}
              >
                Choose image(s)
              </button>
            </div>
            {cleanupPicks.length > 0 && (
              <p className="file-badge file-badge--solo" title={cleanupPicks.map((p) => p.file.name).join(', ')}>
                {cleanupPicks.length === 1
                  ? `${cleanupPicks[0]!.file.name} · ${(cleanupPicks[0]!.file.size / 1024).toFixed(0)} KB`
                  : `${cleanupPicks.length} files selected`}
              </p>
            )}
            <div className="solo-upscale__field">
              <label className="solo-upscale__label" htmlFor={`${baseId}-cleanup-preset`}>
                Restoration style
              </label>
              <select
                id={`${baseId}-cleanup-preset`}
                className="input solo-upscale__select"
                value={cleanupPreset}
                disabled={queueProcessing}
                onChange={(e) => setCleanupPreset(e.target.value as CleanupPresetId)}
              >
                {CLEANUP_PRESET_LIST.map((p) => (
                  <option key={p.id} value={p.id} title={p.hint}>
                    {p.label} — {p.hint}
                  </option>
                ))}
              </select>
            </div>
            <div className="solo-upscale__go">
              <button
                type="button"
                className={
                  cleanupOnlyBusy
                    ? 'btn btn--generate btn--generate--blocked'
                    : 'btn btn--generate'
                }
                disabled={cleanupPicks.length === 0 || queueProcessing}
                aria-busy={cleanupOnlyBusy}
                aria-describedby={
                  cleanupPicks.length > 0 && !cleanupOnlyBusy ? `${baseId}-cleanup-hint` : undefined
                }
                onClick={() => void onCleanupOnlyGo()}
              >
                {cleanupOnlyBusy ? 'Working…' : 'Go'}
              </button>
              {cleanupPicks.length > 0 && !cleanupOnlyBusy && (
                <p className="solo-upscale__go-hint" id={`${baseId}-cleanup-hint`}>
                  Processes all selected files in order. The list clears after a successful run to
                  avoid a second Go on the same files.
                </p>
              )}
            </div>
            {cleanupStatus && (
              <p className="solo-upscale__status" role="status">
                {cleanupStatus}
              </p>
            )}
          </div>
        )}

        {mainTab === 'upscale' && (
          <div
            className={
              soloOnlyBusy
                ? 'tab-page tab-page--solo-upscale tab-page--solo-upscale--running'
                : 'tab-page tab-page--solo-upscale'
            }
            role="tabpanel"
            aria-labelledby={`${baseId}-main-upscale`}
            aria-busy={soloOnlyBusy}
          >
            {soloOnlyBusy && (
              <div className="solo-upscale__busy" role="status" aria-live="polite">
                <div className="solo-upscale__busy-card">
                  <span className="solo-upscale__busy-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="solo-upscale__busy-text">
                    Upscaling — cancel to stop remaining files
                  </span>
                  <button
                    type="button"
                    className="btn btn--cancel-run"
                    onClick={cancelCurrentRun}
                  >
                    Cancel run
                  </button>
                </div>
              </div>
            )}
            <h2 className="solo-upscale__title">Upscale only</h2>
            <p className="solo-upscale__intro">
              Choose a target width (Topaz chains up to 4× per pass), then Go. In the file dialog, use
              <strong>Ctrl+Click</strong> (macOS: <strong>Cmd+Click</strong>) to select several files. Each file is saved with{' '}
              <strong>_upscale</strong> before the extension in the same folder when your browser
              exposes the file location; otherwise a save dialog suggests that name.
            </p>
            <input
              ref={soloFileInputRef}
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg"
              multiple
              onChange={(e) => onSoloFilePicked(e.target.files)}
            />
            <div className="solo-upscale__actions">
              <button
                type="button"
                className="btn btn--folder"
                disabled={queueProcessing}
                onClick={() => void onSoloChooseImage()}
              >
                Choose image(s)
              </button>
            </div>
            {soloPicks.length > 0 && (
              <p className="file-badge file-badge--solo" title={soloPicks.map((p) => p.file.name).join(', ')}>
                {soloPicks.length === 1
                  ? `${soloPicks[0]!.file.name} · ${(soloPicks[0]!.file.size / 1024).toFixed(0)} KB`
                  : `${soloPicks.length} files selected`}
              </p>
            )}
            {soloPreviewUrl && (
              <div className="solo-upscale__preview">
                <img
                  className="solo-upscale__thumb"
                  src={soloPreviewUrl}
                  alt="Selected image preview"
                  width={320}
                  height={180}
                />
              </div>
            )}
            <div className="solo-upscale__field">
              <label className="solo-upscale__label" htmlFor={`${baseId}-solo-preset`}>
                Target width
              </label>
              <select
                id={`${baseId}-solo-preset`}
                className="input solo-upscale__select"
                value={String(soloTargetWidth)}
                disabled={queueProcessing}
                onChange={(e) => setSoloTargetWidth(Number(e.target.value))}
              >
                {SOLO_UPSCALE_PRESETS.map((p) => (
                  <option key={p.w} value={p.w}>
                    {p.label} — target {p.w} px wide
                  </option>
                ))}
              </select>
            </div>
            <div className="solo-upscale__go">
              <button
                type="button"
                className={
                  soloOnlyBusy
                    ? 'btn btn--generate btn--generate--blocked'
                    : 'btn btn--generate'
                }
                disabled={soloPicks.length === 0 || queueProcessing}
                aria-busy={soloOnlyBusy}
                aria-describedby={soloPicks.length > 0 && !soloOnlyBusy ? `${baseId}-solo-hint` : undefined}
                onClick={() => void onSoloOnlyGo()}
              >
                {soloOnlyBusy ? 'Upscaling…' : 'Go'}
              </button>
              {soloPicks.length > 0 && !soloOnlyBusy && (
                <p className="solo-upscale__go-hint" id={`${baseId}-solo-hint`}>
                  Processes all selected files in order. The list clears after a successful run to avoid
                  a second Go on the same files.
                </p>
              )}
            </div>
            {soloStatus && (
              <p className="solo-upscale__status" role="status">
                {soloStatus}
              </p>
            )}
          </div>
        )}

        <footer className="window__footer">
          <button
            type="button"
            className="btn btn--stop-reset"
            title={
              queueProcessing
                ? 'Cancel the current run first, or reset everything and return to step ①.'
                : 'Clear this session and return to step ①.'
            }
            onClick={stopAndReset}
          >
            Stop and Reset
          </button>
        </footer>

        {lightboxIndex != null && batchGallery[lightboxIndex] != null && (
          <div
            className="lightbox"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-lightbox-title`}
          >
            <div
              className="lightbox__scrim"
              aria-hidden
              onClick={() => setLightboxIndex(null)}
            />
            <button
              type="button"
              className="lightbox__close"
              ref={lightboxCloseRef}
              onClick={() => setLightboxIndex(null)}
              aria-label="Close"
            >
              ×
            </button>
            {batchGallery.length > 1 && (
              <>
                <button
                  type="button"
                  className="lightbox__chev lightbox__chev--prev"
                  onClick={() => {
                    setLightboxIndex((idx) => {
                      const n = batchGallery.length
                      return idx == null ? 0 : (idx - 1 + n) % n
                    })
                  }}
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox__chev lightbox__chev--next"
                  onClick={() => {
                    setLightboxIndex((idx) => {
                      const n = batchGallery.length
                      return idx == null ? 0 : (idx + 1) % n
                    })
                  }}
                  aria-label="Next image"
                >
                  ›
                </button>
              </>
            )}
            <div className="lightbox__panel">
              <img
                className="lightbox__img"
                src={batchGallery[lightboxIndex]!.previewUrl}
                alt={batchGallery[lightboxIndex]!.shotLabel}
                width={1200}
                height={675}
              />
              <div className="lightbox__foot">
                <span className="lightbox__headline" id={`${baseId}-lightbox-title`}>
                  {batchGallery[lightboxIndex]!.shotLabel}
                </span>
                {batchGallery.length > 1 && (
                  <span className="lightbox__pos" aria-hidden>
                    {lightboxIndex + 1} / {batchGallery.length}
                  </span>
                )}
                <span className="lightbox__filename">{batchGallery[lightboxIndex]!.filename}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
