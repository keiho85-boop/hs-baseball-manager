// 試合の状態の型。セーブデータに入れて中断・再開できるよう、選手は番号（id）だけで持つ

import type { Position } from '../types'

export type FieldPos = Position | 'DH'

export interface LineupSlot {
  playerId: string
  position: FieldPos
}

/** 攻撃側の作戦（打者ごと） */
/** 打撃の作戦（流し打ち・引っ張り・ゴロ狙いは打球の方向や角度を変える） */
export type BattingOrder = 'auto' | 'swing' | 'contact' | 'wait' | 'bunt' | 'hitrun' | 'steal' | 'pull' | 'oppo' | 'grounder'
/** 守備側の作戦 */
export type PitchingOrder = 'auto' | 'fullpower' | 'walk'
/** 配球の方針 */
export type PitchPlan = 'auto' | 'inside' | 'outside' | 'low' | 'breaking'
export type DefenseShift = 'normal' | 'infieldIn'

export interface TeamState {
  schoolId: string
  name: string
  lineup: LineupSlot[] // 9人（打順）
  /** いま投げている投手 */
  pitcherId: string
  /** DHなしで投手が打順に入っている位置（DHありなら -1） */
  bench: string[]
  /** 試合に出た（交代で下がった）選手。再出場はできない */
  used: string[]
  battingIndex: number
  runsByInning: number[]
  hits: number
  errors: number
  useDH: boolean
  /** この試合で投げた投手の順番 */
  pitchersUsed: string[]
}

export interface Count {
  balls: number
  strikes: number
}

export interface BoxBatting {
  pa: number
  ab: number
  h: number
  d: number
  t: number
  hr: number
  rbi: number
  bb: number
  k: number
  sb: number
  r: number
}

export interface BoxPitching {
  outs: number
  h: number
  r: number
  bb: number
  k: number
  hr: number
  pitches: number
  /** 試合中の疲れ 0-1以上 */
  fatigue: number
}

export type PlayKind =
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun'
  | 'walk'
  | 'hbp'
  | 'strikeout'
  | 'groundout'
  | 'flyout'
  | 'lineout'
  | 'popout'
  | 'doubleplay'
  | 'sacbunt'
  | 'sacfly'
  | 'error'
  | 'fielderschoice'
  | 'steal'
  | 'caughtstealing'
  | 'buntfail'

/** 1打席（またはプレー）の結果。画面の実況と俯瞰図に使う */
export interface PlayEvent {
  inning: number
  top: boolean
  batterId: string
  pitcherId: string
  kind: PlayKind
  text: string
  runs: number
  /** 打球の着地点（ホームを原点、センター方向が +y、メートル） */
  ball?: { x: number; y: number; type: 'ground' | 'line' | 'fly' | 'pop' }
  outsAfter: number
  basesAfter: (string | null)[]
  scoreAfter: [number, number]
}

export type Situation = 'normal' | 'chance' | 'pinch'

/** 一塁・二塁・三塁の走者 */
export type Bases = [string | null, string | null, string | null]

export interface MatchOptions {
  /** 9回制（将来7回制にも対応できるようにしておく） */
  innings: number
  /** タイブレークを始める回 */
  tiebreakFrom: number
  /** コールドゲーム（地方大会など）：[回, 点差] の組み合わせ */
  mercy: [number, number][]
  /** 全国大会など大舞台か（「鋼の心臓」「ガチガチ」に影響） */
  bigStage: boolean
  /** 夏の大会か（「真夏の申し子」「夏バテ体質」に影響） */
  summer: boolean
  /** 運の大きさ（日ごとの調子のばらつき） */
  luck: 'easy' | 'normal' | 'hard'
  /** プレイヤーの学校（どちらでもなければ null＝CPU同士） */
  userSchoolId: string | null
  label: string
  /** 大会の試合なら、その大会と回戦 */
  tournament?: { id: string; round: number }
  /** プレイヤーの学校の作戦（バント・盗塁・エンドラン）の成功率の上乗せ（座学の効果など） */
  tacticBonus?: number
}

export interface MatchState {
  version: 1
  id: string
  options: MatchOptions
  away: TeamState // 先攻
  home: TeamState // 後攻
  inning: number
  top: boolean
  outs: number
  bases: Bases
  count: Count
  finished: boolean
  winner: 'away' | 'home' | null
  batting: Record<string, BoxBatting>
  pitching: Record<string, BoxPitching>
  /** 選手ごとのその日の調子（運の要素） */
  dayForm: Record<string, number>
  events: PlayEvent[]
  /** 直前の1球の説明（画面に出す） */
  lastPitch: string
  /** 勝ち越し・逆転の記録（勝利投手・敗戦投手の判定用） */
  leadChange: { team: 'away' | 'home'; pitcherOfLoser: string; pitcherOfWinner: string } | null
  winningPitcherId: string | null
  losingPitcherId: string | null
  /** カットインを出した回数（上限を設ける） */
  cutins: number
  /** この打席の作戦（打者が替わるとおまかせに戻る） */
  pending: { batting: BattingOrder; pitching: PitchingOrder; plan: PitchPlan; shift: DefenseShift }
}
