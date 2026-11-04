<script setup lang="ts">
// 3DCGの球場。ナイター照明の下のグラウンドに、守備位置の選手・走者・打者を置き、打球を飛ばす。
// WebGLが使えない端末では、従来の2Dの絵（FieldPerspective）に切り替える。
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Fog,
  Group,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  RepeatWrapping,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three'
import type { PlayEvent } from '@/game/match/types'
import FieldPerspective from './FieldPerspective.vue'

const props = withDefaults(
  defineProps<{
    bases: (string | null)[]
    names: Record<string, string>
    lastEvent: PlayEvent | null
    ownBatting: boolean
    /** 打者の打席（R / L / S） */
    batterSide?: string
    infieldIn?: boolean
    /** タイトル画面用：カメラがゆっくり球場を回る */
    cinematic?: boolean
  }>(),
  { batterSide: 'R', infieldIn: false, cinematic: false },
)

const host = ref<HTMLDivElement | null>(null)
const canvasHost = ref<HTMLDivElement | null>(null)
const failed = ref(false)
const labels = shallowRef<{ key: string; name: string; x: number; y: number }[]>([])

// ---------------------------------------------------------------- 球場の寸法（メートル）
// ゲーム内の座標：x は右が＋、y はセンター方向が＋。three.js では (x, 高さ, -y) に置く。
const fenceDist = (deg: number) => 92 + 26 * Math.cos((deg * Math.PI) / 90)
const at = (x: number, y: number, h = 0) => new Vector3(x, h, -y)
const BASE_POS: [number, number][] = [
  [19.4, 19.4],
  [0, 27.4],
  [-19.4, 19.4],
]
const OWN = 0x2f7fe0
const OPP = 0xe0453b

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let raf = 0
let animUntil = 0
let ro: ResizeObserver | null = null
const disposables: { dispose: () => void }[] = []
function keep<T extends { dispose: () => void }>(x: T): T {
  disposables.push(x)
  return x
}

// ---------------------------------------------------------------- テクスチャ（キャンバスで描く）
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat?: [number, number]): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = keep(new CanvasTexture(c))
  t.colorSpace = SRGBColorSpace
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(repeat[0], repeat[1])
  }
  t.anisotropy = 4
  return t
}

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const grassTex = () =>
  canvasTex(
    256,
    256,
    (g) => {
      // 芝刈りの縞（ゆるい市松）
      g.fillStyle = '#2f8a3b'
      g.fillRect(0, 0, 256, 256)
      g.fillStyle = '#36984a'
      g.fillRect(0, 0, 128, 128)
      g.fillRect(128, 128, 128, 128)
      const r = seeded(3)
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,40,0'},${0.03 + r() * 0.04})`
        g.fillRect(r() * 256, r() * 256, 2, 2)
      }
    },
    [1 / 18, 1 / 18],
  )

const dirtTex = () =>
  canvasTex(
    128,
    128,
    (g) => {
      g.fillStyle = '#c98f57'
      g.fillRect(0, 0, 128, 128)
      const r = seeded(7)
      for (let i = 0; i < 1800; i++) {
        const v = r()
        g.fillStyle = v > 0.5 ? `rgba(255,230,190,${0.08 + r() * 0.1})` : `rgba(90,50,20,${0.06 + r() * 0.1})`
        g.fillRect(r() * 128, r() * 128, 1.5, 1.5)
      }
    },
    [1 / 6, 1 / 6],
  )

const crowdTex = () =>
  canvasTex(
    512,
    128,
    (g) => {
      g.fillStyle = '#2a3446'
      g.fillRect(0, 0, 512, 128)
      const r = seeded(11)
      const colors = ['#b9c4d4', '#c9a94a', '#a8463f', '#3c6fb5', '#b58296', '#6aa676', '#b77a45', '#8f87b8', '#d5dbe4']
      for (let row = 0; row < 16; row++) {
        g.fillStyle = 'rgba(0,0,0,0.35)'
        g.fillRect(0, row * 8 + 6, 512, 2)
        for (let col = 0; col < 128; col++) {
          if (r() < 0.18) continue
          g.fillStyle = colors[Math.floor(r() * colors.length)]!
          g.fillRect(col * 4 + r(), row * 8 + 1 + r(), 3, 4)
          g.fillStyle = '#f1c9a0'
          g.fillRect(col * 4 + 0.5, row * 8, 2, 2)
        }
      }
    },
    [5, 1.5],
  )

const skyTex = () =>
  canvasTex(4, 256, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#07101f')
    grad.addColorStop(0.55, '#0f2443')
    grad.addColorStop(1, '#27497a')
    g.fillStyle = grad
    g.fillRect(0, 0, 4, 256)
  })

const glowTex = () =>
  canvasTex(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, 'rgba(255,255,240,1)')
    grad.addColorStop(0.25, 'rgba(255,250,220,0.6)')
    grad.addColorStop(1, 'rgba(255,250,220,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  })

// ---------------------------------------------------------------- 形
function fanShape(radius: (deg: number) => number, from = -45, to = 45, origin: [number, number] = [0, 0]): Shape {
  const s = new Shape()
  s.moveTo(origin[0], origin[1])
  for (let d = from; d <= to; d += 1.5) {
    const r = (d * Math.PI) / 180
    const dist = radius(d)
    s.lineTo(Math.sin(r) * dist, Math.cos(r) * dist)
  }
  s.closePath()
  return s
}

/** 地面に寝かせた平面の形（Shape は x-y 平面なので回転して x-(-z) に） */
function ground(shape: Shape, mat: MeshStandardMaterial, h: number): Mesh {
  const geo = keep(new ShapeGeometry(shape, 24))
  const m = new Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.position.y = h
  m.receiveShadow = true
  return m
}

/** 曲線に沿った帯（フェンス・スタンド） */
function ribbon(points: Vector3[], heightAt: (i: number, top: boolean) => Vector3, mat: MeshStandardMaterial | MeshBasicMaterial): Mesh {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  let len = 0
  points.forEach((p, i) => {
    if (i > 0) len += p.distanceTo(points[i - 1]!)
    const a = heightAt(i, false)
    const b = heightAt(i, true)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
    uv.push(len / 40, 0, len / 40, 1)
    if (i > 0) {
      const k = i * 2
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k)
    }
  })
  const geo = keep(new BufferGeometry())
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  geo.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const m = new Mesh(geo, mat)
  m.receiveShadow = true
  return m
}

// ---------------------------------------------------------------- 選手の人形
const figureGeo = { body: null as CapsuleGeometry | null, head: null as SphereGeometry | null, cap: null as CylinderGeometry | null }
function figure(color: number): Group {
  figureGeo.body ??= keep(new CapsuleGeometry(0.42, 1.0, 4, 10))
  figureGeo.head ??= keep(new SphereGeometry(0.33, 14, 10))
  figureGeo.cap ??= keep(new CylinderGeometry(0.34, 0.36, 0.2, 14))
  const g = new Group()
  const body = new Mesh(figureGeo.body, keep(new MeshStandardMaterial({ color: 0xf4f6fa, roughness: 0.6 })))
  body.position.y = 0.95
  body.castShadow = true
  const belt = new Mesh(figureGeo.cap, keep(new MeshStandardMaterial({ color, roughness: 0.5 })))
  belt.scale.set(1.25, 0.6, 1.25)
  belt.position.y = 0.85
  const head = new Mesh(figureGeo.head, keep(new MeshStandardMaterial({ color: 0xf1c69c, roughness: 0.7 })))
  head.position.y = 2.0
  head.castShadow = true
  const cap = new Mesh(figureGeo.cap, keep(new MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 })))
  cap.position.y = 2.22
  g.add(body, belt, head, cap)
  g.scale.setScalar(1.55)
  return g
}

// ---------------------------------------------------------------- 組み立て
let fielders: Group[] = []
let runners: Group[] = []
let batterFig: Group | null = null
let baseMeshes: Mesh[] = []
let ball: Mesh | null = null
let trail: Line | null = null
let landing: Mesh | null = null
let burst: Mesh | null = null
let flight: { from: Vector3; to: Vector3; peak: number; start: number; dur: number; bounce: boolean; hr: boolean } | null = null

const FIELD_POS: [number, number][] = [
  [0, 18.4], // 投
  [0, -1.8], // 捕
  [16.5, 24], // 一
  [8.5, 33], // 二
  [-16.5, 24], // 三
  [-8.5, 33], // 遊
  [-31, 68], // 左
  [0, 80], // 中
  [31, 68], // 右
]

function build(): void {
  const sc = new Scene()
  scene = sc
  sc.background = skyTex()
  sc.fog = new Fog(0x0f2443, 160, 330)

  const hemi = new HemisphereLight(0xcfe3ff, 0x24402a, 0.9)
  sc.add(hemi)
  const sun = new DirectionalLight(0xfff6e6, 2.1)
  sun.position.set(-50, 90, 40)
  sun.target.position.set(0, 0, -40)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  const sh = sun.shadow.camera
  sh.left = -110
  sh.right = 110
  sh.top = 110
  sh.bottom = -110
  sh.near = 10
  sh.far = 260
  sun.shadow.bias = -0.0008
  sc.add(sun, sun.target)

  // 地面（ファウルゾーンの芝）
  const grass = grassTex()
  const outside = new Mesh(keep(new CircleGeometry(150, 48)), keep(new MeshStandardMaterial({ color: 0x2c7a37, map: grass, roughness: 0.95 })))
  outside.rotation.x = -Math.PI / 2
  outside.position.z = -40
  outside.receiveShadow = true
  sc.add(outside)

  // フェア地域の芝
  const grassMat = keep(new MeshStandardMaterial({ color: 0xffffff, map: grass, roughness: 0.9 }))
  sc.add(ground(fanShape(fenceDist, -45, 45, [0, -2]), grassMat, 0.02))

  // 内野の土（マウンドを中心にした弧）と本塁まわり
  const dirt = dirtTex()
  const dirtMat = keep(new MeshStandardMaterial({ color: 0xffffff, map: dirt, roughness: 1 }))
  const c = 18.4
  const R = 28.5
  const dirtR = (deg: number) => {
    const t = Math.cos((deg * Math.PI) / 180) * c
    return t + Math.sqrt(t * t - (c * c - R * R))
  }
  sc.add(ground(fanShape(dirtR, -45, 45, [0, 0]), dirtMat, 0.04))
  const homeDirt = new Mesh(keep(new CircleGeometry(4.2, 32)), dirtMat)
  homeDirt.rotation.x = -Math.PI / 2
  homeDirt.position.y = 0.05
  homeDirt.receiveShadow = true
  sc.add(homeDirt)

  // 内野の芝（ダイヤモンドの内側）
  const inner = new Shape()
  inner.moveTo(0, 2.8)
  inner.lineTo(16.6, 19.4)
  inner.lineTo(0, 25)
  inner.lineTo(-16.6, 19.4)
  inner.closePath()
  sc.add(ground(inner, grassMat, 0.06))

  // マウンド
  const mound = new Mesh(keep(new CylinderGeometry(2.4, 2.9, 0.35, 32)), dirtMat)
  mound.position.copy(at(0, 18.4, 0.15))
  mound.receiveShadow = true
  sc.add(mound)
  const rubber = new Mesh(keep(new BoxGeometry(0.7, 0.06, 0.18)), keep(new MeshStandardMaterial({ color: 0xffffff })))
  rubber.position.copy(at(0, 18.4, 0.34))
  sc.add(rubber)

  // ファウルライン
  const lineMat = keep(new MeshBasicMaterial({ color: 0xf5f8ff }))
  for (const sgn of [-1, 1]) {
    const len = fenceDist(45)
    const ln = new Mesh(keep(new BoxGeometry(0.18, 0.02, len)), lineMat)
    ln.position.set((sgn * Math.sin(Math.PI / 4) * len) / 2, 0.09, (-Math.cos(Math.PI / 4) * len) / 2)
    ln.rotation.y = Math.atan2(sgn * Math.sin(Math.PI / 4), -Math.cos(Math.PI / 4))
    sc.add(ln)
  }
  // ベースと本塁
  const baseGeo = keep(new BoxGeometry(0.9, 0.12, 0.9))
  baseMeshes = BASE_POS.map(([x, y]) => {
    const b = new Mesh(baseGeo, new MeshStandardMaterial({ color: 0xffffff, emissive: 0x000000, roughness: 0.4 }))
    keep(b.material as MeshStandardMaterial)
    b.position.copy(at(x, y, 0.1))
    b.rotation.y = Math.PI / 4
    b.castShadow = true
    sc.add(b)
    return b
  })
  const plate = new Shape()
  plate.moveTo(-0.45, 0)
  plate.lineTo(0.45, 0)
  plate.lineTo(0.45, 0.3)
  plate.lineTo(0, 0.6)
  plate.lineTo(-0.45, 0.3)
  plate.closePath()
  const plateMesh = new Mesh(keep(new ShapeGeometry(plate)), keep(new MeshStandardMaterial({ color: 0xffffff })))
  plateMesh.rotation.x = -Math.PI / 2
  plateMesh.rotation.z = Math.PI
  plateMesh.position.set(0, 0.1, 0.3)
  sc.add(plateMesh)

  // 外野フェンス（緑の壁と黄色のライン）
  const fencePts: Vector3[] = []
  for (let d = -45; d <= 45; d += 1.5) {
    const r = (d * Math.PI) / 180
    const dist = fenceDist(d)
    fencePts.push(at(Math.sin(r) * dist, Math.cos(r) * dist))
  }
  const wallMat = keep(new MeshStandardMaterial({ color: 0x1d5a35, roughness: 0.8, side: DoubleSide }))
  sc.add(ribbon(fencePts, (i, top) => fencePts[i]!.clone().setY(top ? 3.2 : 0), wallMat))
  const yellow = keep(new MeshBasicMaterial({ color: 0xffd33d, side: DoubleSide }))
  sc.add(ribbon(fencePts, (i, top) => fencePts[i]!.clone().setY(top ? 3.45 : 3.2), yellow))

  // スタンド（すり鉢状。外野はフェンスの外、内野側はファウルラインの外）
  const standIn: Vector3[] = []
  const standOut: Vector3[] = []
  for (let d = -92; d <= 92; d += 2) {
    const ad = Math.abs(d)
    const r = (d * Math.PI) / 180
    const inner = ad <= 45 ? fenceDist(d) + 2 : fenceDist(45) + 2 - ((ad - 45) / 47) * (fenceDist(45) - 24)
    const outer = inner + (ad <= 45 ? 34 : 30)
    standIn.push(at(Math.sin(r) * inner, Math.cos(r) * inner, ad <= 45 ? 3.6 : 1.6))
    standOut.push(at(Math.sin(r) * outer, Math.cos(r) * outer, ad <= 45 ? 26 : 18))
  }
  const crowdMat = keep(new MeshStandardMaterial({ color: 0xffffff, map: crowdTex(), roughness: 0.95, side: DoubleSide }))
  sc.add(ribbon(standIn, (i, top) => (top ? standOut[i]! : standIn[i]!), crowdMat))
  // 内野のフェンス（スタンドの手前の壁）
  const lowWallMat = keep(new MeshStandardMaterial({ color: 0x24406a, roughness: 0.7, side: DoubleSide }))
  sc.add(ribbon(standIn, (i, top) => standIn[i]!.clone().setY(top ? standIn[i]!.y : 0), lowWallMat))
  // スタンドの屋根の縁
  const rim = keep(new MeshStandardMaterial({ color: 0x0b1626, roughness: 0.6, side: DoubleSide }))
  sc.add(ribbon(standOut, (i, top) => standOut[i]!.clone().setY(top ? standOut[i]!.y + 3 : standOut[i]!.y), rim))

  // センターのスコアボード
  const board = new Mesh(keep(new BoxGeometry(34, 12, 2)), keep(new MeshStandardMaterial({ color: 0x0b1626, emissive: 0x0a1a10, roughness: 0.5 })))
  board.position.copy(at(0, fenceDist(0) + 40, 30))
  sc.add(board)
  const screen = new Mesh(keep(new BoxGeometry(30, 8.5, 0.3)), keep(new MeshBasicMaterial({ color: 0x14361f })))
  screen.position.copy(at(0, fenceDist(0) + 38.9, 30))
  sc.add(screen)

  // 照明塔（光の玉で、ナイターの雰囲気を出す）
  const glow = glowTex()
  const poleMat = keep(new MeshStandardMaterial({ color: 0x5a6b82, roughness: 0.6 }))
  const lampMat = keep(new MeshBasicMaterial({ color: 0xfffbe8 }))
  for (const d of [-70, -32, 32, 70]) {
    const r = (d * Math.PI) / 180
    const dist = Math.abs(d) > 45 ? 70 : fenceDist(d) + 40
    const base = at(Math.sin(r) * dist, Math.cos(r) * dist)
    const pole = new Mesh(keep(new CylinderGeometry(0.7, 1, 46, 8)), poleMat)
    pole.position.copy(base).setY(23)
    sc.add(pole)
    const lamp = new Mesh(keep(new BoxGeometry(9, 5, 1)), lampMat)
    lamp.position.copy(base).setY(48)
    lamp.lookAt(0, 0, -30)
    sc.add(lamp)
    const sp = new Sprite(keep(new SpriteMaterial({ map: glow, color: 0xfff8d8, blending: AdditiveBlending, depthWrite: false, transparent: true })))
    sp.position.copy(lamp.position)
    sp.scale.set(34, 34, 1)
    sc.add(sp)
  }

  // 守備の選手・打者・走者
  fielders = FIELD_POS.map(([x, y]) => {
    const f = figure(OPP)
    f.position.copy(at(x, y, x === 0 && y === 18.4 ? 0.32 : 0))
    f.lookAt(0, f.position.y, 0)
    sc.add(f)
    return f
  })
  batterFig = figure(OWN)
  sc.add(batterFig)
  runners = BASE_POS.map(() => {
    const r = figure(OWN)
    r.visible = false
    sc.add(r)
    return r
  })

  // 打球
  ball = new Mesh(keep(new SphereGeometry(0.55, 14, 10)), keep(new MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666 })))
  ball.visible = false
  ball.castShadow = true
  sc.add(ball)
  trail = new Line(keep(new BufferGeometry()), keep(new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })))
  trail.visible = false
  sc.add(trail)
  landing = new Mesh(keep(new RingGeometry(1.2, 2, 32)), keep(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: DoubleSide })))
  landing.rotation.x = -Math.PI / 2
  landing.visible = false
  sc.add(landing)
  burst = new Mesh(keep(new RingGeometry(2, 3.2, 40)), keep(new MeshBasicMaterial({ color: 0xffd33d, transparent: true, side: DoubleSide, blending: AdditiveBlending })))
  burst.visible = false
  sc.add(burst)
}

// ---------------------------------------------------------------- 状態の反映
function setColor(g: Group, color: number): void {
  // 帽子とベルトの色だけ替える（子の 2 番目と 4 番目）
  ;((g.children[1] as Mesh).material as MeshStandardMaterial).color.setHex(color)
  ;((g.children[3] as Mesh).material as MeshStandardMaterial).color.setHex(color)
}

function syncPlayers(): void {
  const batting = props.ownBatting ? OWN : OPP
  const fielding = props.ownBatting ? OPP : OWN
  fielders.forEach((f, i) => {
    setColor(f, fielding)
    const [x, y] = FIELD_POS[i]!
    const pull = props.infieldIn && i >= 2 && i <= 5 ? 5 : 0
    f.position.copy(at(x * (pull ? 0.85 : 1), y - pull, i === 0 ? 0.32 : 0))
  })
  if (batterFig) {
    setColor(batterFig, batting)
    batterFig.position.set(props.batterSide === 'L' ? 1.2 : -1.2, 0, -0.3)
    batterFig.lookAt(0, 0, -0.3)
  }
  runners.forEach((r, i) => {
    setColor(r, batting)
    const on = !!props.bases[i]
    r.visible = on
    const [x, y] = BASE_POS[i]!
    // ベースから少し離れて立つ（リード）
    const lead = i === 2 ? [1.5, -1.5] : i === 1 ? [-1.8, 0.4] : [-1.4, 1.4]
    r.position.copy(at(x + lead[0]!, y + lead[1]!))
    r.lookAt(0, 0, -18.4)
  })
  baseMeshes.forEach((b, i) => {
    const mat = b.material as MeshStandardMaterial
    mat.emissive.setHex(props.bases[i] ? batting : 0x000000)
    mat.emissiveIntensity = props.bases[i] ? 0.9 : 0
  })
  requestRender()
}

function launch(e: PlayEvent | null): void {
  if (!ball || !trail || !landing || !burst) return
  if (!e?.ball) {
    ball.visible = trail.visible = landing.visible = burst.visible = false
    flight = null
    requestRender()
    return
  }
  const type = e.ball.type
  const to = at(e.ball.x, e.ball.y, 0.5)
  const hr = e.kind === 'homerun'
  if (hr) to.y = 12
  const dist = Math.hypot(e.ball.x, e.ball.y)
  const peak = type === 'fly' ? 22 + dist * 0.12 : type === 'pop' ? 30 : type === 'line' ? 4 + dist * 0.04 : 0.6
  const dur = type === 'ground' ? 600 + dist * 9 : 700 + dist * 7
  flight = { from: new Vector3(0, 1.2, -0.6), to, peak, start: performance.now(), dur, bounce: type === 'ground', hr }
  const hits = ['single', 'double', 'triple', 'homerun']
  const color = hr ? 0xffd33d : hits.includes(e.kind) ? 0xff5a4f : 0xffffff
  ;(trail.material as LineBasicMaterial).color.setHex(color)
  ;(landing.material as MeshBasicMaterial).color.setHex(color)
  ball.visible = trail.visible = true
  landing.visible = burst.visible = false
  animUntil = performance.now() + dur + (hr ? 1400 : 500)
  loop()
}

function flightPoint(t: number, out: Vector3): Vector3 {
  const f = flight!
  out.lerpVectors(f.from, f.to, t)
  if (f.bounce) out.y = 0.5 + Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 1.6
  else out.y = f.from.y + (f.to.y - f.from.y) * t + 4 * f.peak * t * (1 - t)
  return out
}

const tmp = new Vector3()
function tick(now: number): void {
  if (!flight || !ball || !trail || !landing || !burst) return
  const t = Math.min(1, (now - flight.start) / flight.dur)
  flightPoint(t, tmp)
  ball.position.copy(tmp)
  const n = Math.max(2, Math.ceil(t * 40))
  const pts: number[] = []
  for (let i = 0; i <= n; i++) {
    const p = flightPoint((t * i) / n, new Vector3())
    pts.push(p.x, p.y, p.z)
  }
  trail.geometry.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3))
  trail.geometry.computeBoundingSphere()
  if (t >= 1) {
    landing.visible = !flight.hr
    landing.position.set(flight.to.x, 0.12, flight.to.z)
    if (flight.hr) {
      const k = Math.min(1, (now - flight.start - flight.dur) / 1200)
      burst.visible = k < 1
      burst.position.copy(flight.to)
      burst.lookAt(camera!.position)
      burst.scale.setScalar(1 + k * 6)
      ;(burst.material as MeshBasicMaterial).opacity = 1 - k
    }
  }
}

// ---------------------------------------------------------------- 描画
let pending = false
function requestRender(): void {
  if (pending) return
  pending = true
  requestAnimationFrame(() => {
    pending = false
    draw(performance.now())
  })
}

function draw(now: number): void {
  if (!renderer || !scene || !camera) return
  tick(now)
  renderer.render(scene, camera)
  updateLabels()
}

function loop(): void {
  cancelAnimationFrame(raf)
  const step = (now: number) => {
    draw(now)
    if (now < animUntil) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function updateLabels(): void {
  const el = canvasHost.value
  if (!el || !camera) return
  const w = el.clientWidth
  const h = el.clientHeight
  const list: { key: string; name: string; x: number; y: number }[] = []
  props.bases.forEach((id, i) => {
    if (!id) return
    const p = runners[i]!.position.clone().setY(3.6).project(camera!)
    list.push({ key: `r${i}`, name: props.names[id] ?? '', x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h })
  })
  labels.value = list
}

/** 画面の縦横比に合わせて、内野から外野フェンスまでが収まるようにカメラを置く */
let cineTimer = 0
let cineLast = 0
/** タイトル画面：外野の上空から本塁方向へ、ゆっくり回り込むカメラ（30fpsに抑える） */
function cineLoop(now: number): void {
  cineTimer = requestAnimationFrame(cineLoop)
  if (now - cineLast < 33 || !camera) return
  cineLast = now
  const t = now / 1000
  const ang = Math.sin(t * 0.08) * 0.75
  const r = 70
  camera.position.set(Math.sin(ang) * r, 30 + Math.sin(t * 0.13) * 4, Math.cos(ang) * r - 25)
  camera.lookAt(0, 4, -40)
  draw(now)
}

function fit(): void {
  const el = canvasHost.value
  if (!el || !renderer || !camera) return
  const w = Math.max(1, el.clientWidth)
  const h = Math.max(1, el.clientHeight)
  renderer.setSize(w, h, false)
  const aspect = w / h
  camera.aspect = aspect
  if (props.cinematic) {
    camera.fov = aspect < 1 ? 62 : 46
    camera.updateProjectionMatrix()
    return
  }
  // 横幅（フェンスの両翼）が入る画角を基準にする
  const hfov = 60
  const vfov = (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / aspect) * 180) / Math.PI
  camera.fov = Math.min(66, Math.max(24, vfov))
  // 縦長ならカメラを高く、横長なら低く。本塁が画面の下端の少し上に来るよう、見下ろす角度を決める
  const [H, D] = aspect < 1.1 ? [38, 24] : aspect < 1.8 ? [32, 32] : [30, 42]
  camera.position.set(0, H, D)
  const toHome = Math.atan2(H, D) * (180 / Math.PI)
  const pitch = ((toHome - camera.fov / 2 + 5) * Math.PI) / 180
  camera.lookAt(0, H - Math.sin(pitch) * 100, D - Math.cos(pitch) * 100)
  camera.updateProjectionMatrix()
  requestRender()
}

onMounted(() => {
  const el = canvasHost.value
  if (!el) return
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
  } catch {
    failed.value = true
    return
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  el.appendChild(renderer.domElement)
  camera = new PerspectiveCamera(50, 1, 0.5, 600)
  build()
  syncPlayers()
  fit()
  launch(props.lastEvent)
  if (props.cinematic) cineTimer = requestAnimationFrame(cineLoop)
  ro = new ResizeObserver(() => fit())
  ro.observe(el)
  renderer.domElement.addEventListener('webglcontextlost', () => (failed.value = true))
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  cancelAnimationFrame(cineTimer)
  ro?.disconnect()
  for (const d of disposables) d.dispose()
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
  scene = null
})

watch(
  () => [props.bases.join(','), props.ownBatting, props.batterSide, props.infieldIn] as const,
  () => syncPlayers(),
)
watch(
  () => props.lastEvent,
  (e) => launch(e),
)

</script>

<template>
  <div ref="host" class="f3d">
    <FieldPerspective v-if="failed" :bases="bases" :names="names" :last-event="lastEvent" :own-batting="ownBatting" />
    <template v-else>
      <div ref="canvasHost" class="canvas" />
      <div v-for="l in labels" :key="l.key" class="tag" :style="{ left: `${l.x}px`, top: `${l.y}px` }">{{ l.name }}</div>
    </template>
  </div>
</template>

<style scoped>
.f3d {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.canvas {
  position: absolute;
  inset: 0;
}
.tag {
  position: absolute;
  transform: translate(-50%, -100%);
  background: rgba(11, 22, 38, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  padding: 1px 7px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.35);
  white-space: nowrap;
  pointer-events: none;
}
</style>
