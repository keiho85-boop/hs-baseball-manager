// BGM。曲はこのゲームのために作った音源（tools/bgm/compose.py で作曲・合成。外部の曲は使わない）
// Web Audio で途切れずにくり返し、曲の切り替えはゆっくり重ねる。設定は端末ごとに保存する

export type BgmName = 'home' | 'pref' | 'national' | 'camp' | 'ending' | 'rare'

const KEY = 'hsbm:bgm'
/** BGMの音量（効果音が聞こえるように控えめ） */
const VOLUME = 0.16
const FADE = 1.2
/** 曲を作り直したら上げる（保存済みの古い曲を使わないように） */
const BGM_VERSION = 2

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
})()

let ctx: AudioContext | null = null
let out: GainNode | null = null
let wanted: BgmName | null = null
let playing: { name: BgmName; src: AudioBufferSourceNode; gain: GainNode } | null = null
const buffers = new Map<BgmName, Promise<AudioBuffer | null>>()
/** 最初の操作のあとでないと音を鳴らせない（ブラウザの決まり） */
let unlocked = false

export function bgmEnabled(): boolean {
  return enabled
}

export function setBgmEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 保存できない環境では、その回だけ */
  }
  if (on) void apply()
  else stop()
}

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      out = ctx.createGain()
      out.gain.value = VOLUME
      out.connect(ctx.destination)
    }
    return ctx
  } catch {
    return null
  }
}

function load(name: BgmName): Promise<AudioBuffer | null> {
  let p = buffers.get(name)
  if (!p) {
    p = (async () => {
      const a = audio()
      if (!a) return null
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}bgm/${name}.mp3?v=${BGM_VERSION}`)
        if (!res.ok) return null
        return await a.decodeAudioData(await res.arrayBuffer())
      } catch {
        return null
      }
    })()
    buffers.set(name, p)
  }
  return p
}

function fadeOut(cur: NonNullable<typeof playing>): void {
  const a = ctx
  if (!a) return
  const t = a.currentTime
  cur.gain.gain.cancelScheduledValues(t)
  cur.gain.gain.setValueAtTime(cur.gain.gain.value, t)
  cur.gain.gain.linearRampToValueAtTime(0, t + FADE)
  try {
    cur.src.stop(t + FADE + 0.05)
  } catch {
    /* すでに止まっている */
  }
}

function stop(): void {
  if (playing) fadeOut(playing)
  playing = null
}

async function apply(): Promise<void> {
  const name = wanted
  if (!enabled || !unlocked || document.hidden) return stop()
  if (!name) return stop()
  if (playing?.name === name) return
  const a = audio()
  if (!a || !out) return
  if (a.state === 'suspended') await a.resume().catch(() => {})
  const buf = await load(name)
  // 読み込みのあいだに、別の曲に変わっていたらやめる
  if (!buf || wanted !== name || playing?.name === name) return
  if (playing) fadeOut(playing)
  const src = a.createBufferSource()
  src.buffer = buf
  src.loop = true
  const gain = a.createGain()
  gain.gain.setValueAtTime(0, a.currentTime)
  gain.gain.linearRampToValueAtTime(1, a.currentTime + FADE)
  src.connect(gain).connect(out)
  src.start()
  playing = { name, src, gain }
}

/** 鳴らす曲を決める（同じ曲ならそのまま。null で止める） */
export function setBgm(name: BgmName | null): void {
  wanted = name
  void apply()
}

/** 最初の操作で鳴らし始める。画面を離れたら止め、戻ったら鳴らす */
export function installBgm(): void {
  const unlock = (): void => {
    if (unlocked) return
    unlocked = true
    void apply()
  }
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  document.addEventListener('keydown', unlock, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop()
      void ctx?.suspend().catch(() => {})
    } else {
      void ctx?.resume().catch(() => {})
      void apply()
    }
  })
}
