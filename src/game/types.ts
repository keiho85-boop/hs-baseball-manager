// ゲーム全体で使うデータの型定義

import type { MatchState } from './match/types'

export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF'
export type Hand = 'R' | 'L'
export type BatSide = 'R' | 'L' | 'S'
export type GrowthType = 'early' | 'normal' | 'late'
export type SchoolKind = 'public' | 'private'
export type PracticeMenu = 'batting' | 'power' | 'pitching' | 'fitness' | 'fielding' | 'running'
export type PitchType =
  | 'slider'
  | 'curve'
  | 'fork'
  | 'changeup'
  | 'shoot'
  | 'sinker'
  | 'cutter'
  | 'splitter'
export type Difficulty = 'easy' | 'normal' | 'hard'

/** 顔パーツの組み合わせ（各パーツの番号） */
export interface FaceParts {
  outline: number
  skin: number
  hair: number
  hairColor: number
  brows: number
  eyes: number
  mouth: number
}

/** 野手の打撃能力 */
export interface BattingAbility {
  contact: number // ミート 1-100
  power: number // パワー 1-100
  trajectory: number // 弾道 1-4
  eye: number // 選球眼 1-100
  vsLeft: number // 対左投手 1-100（50が普通）
  /** コース別の得意・苦手（ストライクゾーン9分割、-2〜+2。左上から右下へ） */
  zone: number[]
}

export interface RunningAbility {
  speed: number // 走力
  steal: number // 盗塁
  baserunning: number // 走塁判断
}

export interface FieldingAbility {
  arm: number // 肩力
  range: number // 守備範囲
  catching: number // 捕球
  throwing: number // 送球の正確さ
  /** ポジションごとの適性 0=× 1=△ 2=○ 3=◎ */
  aptitude: Record<Position, number>
}

export interface PitchArsenal {
  type: PitchType
  level: number // 変化量 1-7
}

export interface PitchingAbility {
  velocity: number // 球速 km/h
  control: number // コントロール
  stamina: number // スタミナ
  pitches: PitchArsenal[] // 最大4種類
  kire: number // キレ
  vsLeft: number // 対左打者（50が普通）
  quick: number // クイック
  pinch: number // ピンチへの強さ
}

export interface CommonAbility {
  clutch: number // チャンスへの強さ
  stability: number // 調子の安定度
  durability: number // ケガのしにくさ
  recovery: number // 回復力
}

/** プレイヤーには直接見せない情報 */
export interface HiddenTalent {
  growthType: GrowthType
  /** 才能の上限（1-100）。各能力の伸びの天井の基準になる */
  potential: number
}

export interface Injury {
  name: string
  weeksLeft: number
}

export interface ArmIssue {
  part: 'shoulder' | 'elbow'
  severity: number // 1-3
  /** 投げずに休んだ週数（一定に達すると治る） */
  restWeeks: number
}

export interface Condition {
  stamina: number // 体力 0-100
  form: number // 調子 1-5（3が普通）
  motivation: number // やる気 0-100
  injury: Injury | null
  armIssue: ArmIssue | null
}

export interface BattingStats {
  games: number
  atBats: number
  hits: number
  doubles?: number
  triples?: number
  homeRuns: number
  rbi: number
  walks?: number
  strikeouts?: number
  steals: number
}

export interface PitchingStats {
  games: number
  outs: number
  earnedRuns: number
  hits?: number
  strikeouts: number
  walks: number
  wins: number
  losses: number
  pitches?: number
}

export interface PlayerStats {
  batting: BattingStats
  pitching: PitchingStats
}

export interface Player {
  id: string
  schoolId: string
  surname: string
  givenName: string
  grade: number // 1-3
  enrolledYear: number
  /** 3年生の夏の大会後に引退した（卒業までは在籍だがチームには入らない） */
  retired: boolean
  /** 部員不足のときに他の部から入った助っ人 */
  helper: boolean
  bats: BatSide
  throws: Hand
  mainPosition: Position
  face: FaceParts
  batting: BattingAbility
  running: RunningAbility
  fielding: FieldingAbility
  pitching: PitchingAbility
  common: CommonAbility
  hidden: HiddenTalent
  /** 監督の見立て（表示用の文言） */
  estimate: string
  skills: string[]
  condition: Condition
  practiceMenu: PracticeMenu
  weeklyPitches: number
  /** 試合に出るまでは null（データ量を抑えるため） */
  seasonStats: PlayerStats | null
  careerStats: PlayerStats | null
  /** OBの息子の場合、父親のOB番号 */
  fatherAlumniId: string | null
  /** 肩・肘の不安が悪化して、投手としては引退した */
  pitchingRetired?: boolean
}

export interface Facilities {
  batting: number // 0-5
  pitching: number
  fielding: number
  running: number
  fitness: number
  medical: number
}

export interface SchoolSeasonRecord {
  year: number
  /** 例：「夏 県ベスト8」 */
  results: string[]
}

export interface School {
  id: string
  name: string
  prefCode: number
  kind: SchoolKind
  /** true なら選手を個別に持つ。false なら総合力だけで管理する */
  detailed: boolean
  /** 総合力 1-100 */
  overall: number
  reputation: number // 0-100
  funds: number // 部費（万円）
  facilities: Facilities
  playerIds: string[]
  history: SchoolSeasonRecord[]
}

export interface AlumniRecord {
  id: string
  playerId: string
  surname: string
  givenName: string
  enrolledYear: number
  graduatedYear: number
  mainPosition: Position
  bats: BatSide
  throws: Hand
  careerStats: PlayerStats
  achievements: string[]
  career: 'pro' | 'university' | 'corporate' | 'work' | 'other'
  /** 得意だった能力の傾向（息子に受け継がれる） */
  strengths: string[]
  /** 活躍したOBか（息子が入部する可能性がある） */
  notable: boolean
  /** 息子が入部する予定の年度（決まっていなければ null） */
  sonYear: number | null
  sonEnrolled: boolean
}

export interface Settings {
  injury: Difficulty
  luck: Difficulty
  cutin: boolean
  gameSpeed: number // 1-3
  lightMode: boolean
}

export interface Calendar {
  year: number // ゲーム内の年度（1年目=1）
  week: number // 1-52（4月第1週=1）
}

export interface GameLogEntry {
  year: number
  week: number
  text: string
}

/** 自校のオーダー（打順・守備位置・先発投手） */
export interface LineupConfig {
  /** 打順1〜9番の選手と守備位置。DHありなら投手は打順に入らない */
  batters: { playerId: string; position: Position | 'DH' }[]
  startingPitcherId: string
  /** ベンチ入りの控え（代打・代走・継投に使う） */
  bench: string[]
  useDH: boolean
}

export interface SaveData {
  version: number
  slot: number
  createdAt: string
  updatedAt: string
  managerName: string
  managerExperience: number
  playerSchoolId: string
  prefCode: number
  calendar: Calendar
  settings: Settings
  /** 乱数の状態（やり直し防止のため保存する） */
  rngState: number[]
  schools: Record<string, School>
  players: Record<string, Player>
  alumni: AlumniRecord[]
  log: GameLogEntry[]
  /** 最後にバックアップを勧めた年度 */
  lastBackupPromptYear: number
  nextId: number
  /** 自校のオーダー（未設定なら自動で組む） */
  lineup?: LineupConfig | null
  /** すごろく（はじめて開いたときに作る） */
  sugoroku?: SugorokuState
}

// ---------------------------------------------------------------- すごろく・イベント

export type SquareType =
  | 'batting'
  | 'power'
  | 'pitching'
  | 'fitness'
  | 'fielding'
  | 'running'
  | 'practical'
  | 'rest'
  | 'special'
  | 'event'
  | 'manager'
  | 'funds'
  | 'scout'
  | 'rain'
  | 'school'

export type CardEffect = 'none' | 'hot' | 'light' | 'all'

export interface Card {
  value: number // 1-6
  effect: CardEffect
}

/** イベントの話し手 */
export type Speaker =
  | { kind: 'player'; playerId: string }
  | { kind: 'manager' | 'coach' | 'principal' | 'ob' | 'narration' | 'local'; name: string }

/** イベントの効果（保存できるよう、データとして持つ） */
export type EffectOp =
  | { op: 'ability'; playerId: string; key: string; delta: number }
  | { op: 'condition'; playerId: string | 'all'; key: 'stamina' | 'motivation' | 'form'; delta: number }
  | { op: 'school'; key: 'funds' | 'reputation'; delta: number }
  | { op: 'skill'; playerId: string; add?: string; remove?: string }
  | { op: 'position'; playerId: string; position: Position }
  | { op: 'camp'; weeks: number }

export interface EventChoice {
  label: string
  /** 選んだあとに出す文 */
  result: string
  ops: EffectOp[]
}

export interface EventInstance {
  id: string
  title: string
  speaker: Speaker
  lines: string[]
  choices: EventChoice[]
}

/** マスに止まったあと、まだ週を終えていない状態（中断しても再開できるよう保存する） */
export interface PendingWeek {
  square: SquareType
  card: Card
  event: EventInstance | null
  /** 特訓マス：選手を選ぶ必要がある */
  needsPlayer: boolean
}

export interface SugorokuState {
  board: SquareType[]
  position: number
  hand: Card[]
  /** 盤面を作った月（月が変わると並びが変わる） */
  boardMonth: number
  pending: PendingWeek | null
  /** 合宿の残り週数（練習の効果と疲れが大きくなる） */
  campWeeks: number
}

/** 自校のその週の過ごし方（週を進めるときに渡す） */
export type WeekPlan =
  | { kind: 'square'; square: SquareType; card: Card; specialPlayerId?: string }
  | { kind: 'match' }

/** 途中の試合の保存データ（セーブデータ本体とは別に、1打席ごとに小さく保存する） */
export interface MatchRecord {
  slot: number
  match: MatchState
  rngState: number[]
}

/** セーブ枠一覧に出す概要 */
export interface SaveSummary {
  slot: number
  schoolName: string
  prefName: string
  managerName: string
  year: number
  week: number
  updatedAt: string
}
