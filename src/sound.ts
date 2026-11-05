// 効果音。音源ファイルは使わず、Web Audio でその場で合成する（権利の心配がなく、容量も増えない）
// 設定は端末ごとに localStorage に保存する

type SoundName =
  | 'tap'
  | 'card'
  | 'step'
  | 'hit'
  | 'homerun'
  | 'miss'
  | 'catch'
  | 'cheer'
  | 'out'
  | 'win'
  | 'lose'
  | 'up'
  | 'notice'
  | 'whistle'

const KEY = 'hsbm:sound'
let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
})()

export function soundEnabled(): boolean {
  return enabled
}
export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* 保存できない環境では、その回だけ有効 */
  }
}

function audio(): AudioContext | null {
  if (!enabled) return null
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = 0.55
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** 音程のある短い音 */
function tone(freq: number, dur: number, opt: { type?: OscillatorType; vol?: number; delay?: number; slide?: number } = {}): void {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + (opt.delay ?? 0)
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = opt.type ?? 'sine'
  o.frequency.setValueAtTime(freq, t)
  if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opt.slide), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opt.vol ?? 0.3, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/** 雑音（打球音・歓声など） */
function noise(dur: number, opt: { vol?: number; delay?: number; freq?: number; q?: number; type?: BiquadFilterType; attack?: number } = {}): void {
  const a = audio()
  if (!a || !master) return
  const t = a.currentTime + (opt.delay ?? 0)
  const len = Math.max(1, Math.floor(a.sampleRate * dur))
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = opt.type ?? 'bandpass'
  f.frequency.value = opt.freq ?? 1500
  f.Q.value = opt.q ?? 1
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(opt.vol ?? 0.3, t + (opt.attack ?? 0.005))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
}

/** 歓声：ゆっくり高まって消えていく雑音を重ねる */
function crowd(dur: number, vol: number, delay = 0): void {
  noise(dur, { vol, delay, freq: 900, q: 0.6, attack: dur * 0.3 })
  noise(dur * 0.9, { vol: vol * 0.6, delay: delay + 0.05, freq: 2200, q: 0.8, attack: dur * 0.35 })
}

export function play(name: SoundName): void {
  if (!enabled) return
  switch (name) {
    case 'tap':
      tone(880, 0.06, { type: 'triangle', vol: 0.12 })
      break
    case 'card':
      noise(0.08, { vol: 0.18, freq: 3000, q: 0.7 })
      tone(660, 0.08, { type: 'triangle', vol: 0.1, delay: 0.02 })
      break
    case 'step':
      tone(520, 0.07, { type: 'square', vol: 0.06 })
      break
    case 'hit':
      // 金属バットの「カキーン」
      noise(0.05, { vol: 0.5, freq: 2500, q: 1.5 })
      tone(1900, 0.35, { type: 'triangle', vol: 0.22, slide: 0.92 })
      tone(2850, 0.25, { type: 'sine', vol: 0.12 })
      crowd(1.2, 0.12, 0.1)
      break
    case 'homerun':
      noise(0.05, { vol: 0.55, freq: 2500, q: 1.5 })
      tone(1900, 0.5, { type: 'triangle', vol: 0.25, slide: 0.9 })
      tone(2850, 0.35, { type: 'sine', vol: 0.12 })
      crowd(2.6, 0.32, 0.15)
      ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'square', vol: 0.07, delay: 0.5 + i * 0.12 }))
      break
    case 'miss':
      // 空振り・見逃し：ミットの音
      noise(0.07, { vol: 0.35, freq: 400, q: 0.8, type: 'lowpass' })
      tone(140, 0.08, { vol: 0.2, slide: 0.6 })
      break
    case 'catch':
      noise(0.06, { vol: 0.3, freq: 500, q: 0.8, type: 'lowpass' })
      break
    case 'out':
      noise(0.06, { vol: 0.3, freq: 500, q: 0.8, type: 'lowpass' })
      tone(392, 0.12, { type: 'triangle', vol: 0.1, delay: 0.05 })
      tone(294, 0.18, { type: 'triangle', vol: 0.1, delay: 0.16 })
      break
    case 'cheer':
      crowd(1.6, 0.25)
      break
    case 'win':
      ;[523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.5 : 0.16, { type: 'square', vol: 0.08, delay: i * 0.13 }))
      crowd(2.2, 0.2, 0.1)
      break
    case 'lose':
      ;[392, 349, 311, 262].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.1, delay: i * 0.22 }))
      break
    case 'up':
      ;[660, 880, 1175].forEach((f, i) => tone(f, 0.12, { type: 'triangle', vol: 0.11, delay: i * 0.07 }))
      break
    case 'notice':
      tone(988, 0.1, { type: 'sine', vol: 0.14 })
      tone(1319, 0.16, { type: 'sine', vol: 0.12, delay: 0.09 })
      break
    case 'whistle':
      // 試合開始のサイレン
      tone(700, 1.1, { type: 'sawtooth', vol: 0.05, slide: 1.25 })
      tone(705, 1.1, { type: 'sine', vol: 0.08, slide: 1.25 })
      break
  }
}

/** ボタンを押したときの音を、画面全体に付ける */
export function installTapSound(): void {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest('button')
      if (el && !(el as HTMLButtonElement).disabled && !el.dataset.silent) play('tap')
    },
    { capture: true, passive: true },
  )
}
