import type { Position, PitchType, PracticeMenu } from './types'

export const SAVE_VERSION = 1
/** セーブ枠：1〜2は選手育成モード、3〜4はチーム育成モード */
export const SAVE_SLOTS = 4
export const PLAYER_MODE_SLOTS = [1, 2]
export const TEAM_MODE_SLOTS = [3, 4]
export type GameMode = 'player' | 'team'
export function modeOfSlot(slot: number): GameMode {
  return PLAYER_MODE_SLOTS.includes(slot) ? 'player' : 'team'
}
export const WEEKS_PER_YEAR = 52
/** 1つの都道府県の学校数 */
export const SCHOOLS_PER_PREF = 32
/** 他の都道府県で選手を個別に持つ上位校の数 */
export const DETAILED_SCHOOLS_OTHER_PREF = 4
export const MIN_ROSTER = 9

export interface Prefecture {
  code: number
  name: string
  region: string
}

export const PREFECTURES: Prefecture[] = [
  { code: 1, name: '北海道', region: '北海道' },
  { code: 2, name: '青森県', region: '東北' },
  { code: 3, name: '岩手県', region: '東北' },
  { code: 4, name: '宮城県', region: '東北' },
  { code: 5, name: '秋田県', region: '東北' },
  { code: 6, name: '山形県', region: '東北' },
  { code: 7, name: '福島県', region: '東北' },
  { code: 8, name: '茨城県', region: '関東' },
  { code: 9, name: '栃木県', region: '関東' },
  { code: 10, name: '群馬県', region: '関東' },
  { code: 11, name: '埼玉県', region: '関東' },
  { code: 12, name: '千葉県', region: '関東' },
  { code: 13, name: '東京都', region: '関東' },
  { code: 14, name: '神奈川県', region: '関東' },
  { code: 15, name: '新潟県', region: '北信越' },
  { code: 16, name: '富山県', region: '北信越' },
  { code: 17, name: '石川県', region: '北信越' },
  { code: 18, name: '福井県', region: '北信越' },
  { code: 19, name: '山梨県', region: '関東' },
  { code: 20, name: '長野県', region: '北信越' },
  { code: 21, name: '岐阜県', region: '東海' },
  { code: 22, name: '静岡県', region: '東海' },
  { code: 23, name: '愛知県', region: '東海' },
  { code: 24, name: '三重県', region: '東海' },
  { code: 25, name: '滋賀県', region: '近畿' },
  { code: 26, name: '京都府', region: '近畿' },
  { code: 27, name: '大阪府', region: '近畿' },
  { code: 28, name: '兵庫県', region: '近畿' },
  { code: 29, name: '奈良県', region: '近畿' },
  { code: 30, name: '和歌山県', region: '近畿' },
  { code: 31, name: '鳥取県', region: '中国' },
  { code: 32, name: '島根県', region: '中国' },
  { code: 33, name: '岡山県', region: '中国' },
  { code: 34, name: '広島県', region: '中国' },
  { code: 35, name: '山口県', region: '中国' },
  { code: 36, name: '徳島県', region: '四国' },
  { code: 37, name: '香川県', region: '四国' },
  { code: 38, name: '愛媛県', region: '四国' },
  { code: 39, name: '高知県', region: '四国' },
  { code: 40, name: '福岡県', region: '九州' },
  { code: 41, name: '佐賀県', region: '九州' },
  { code: 42, name: '長崎県', region: '九州' },
  { code: 43, name: '熊本県', region: '九州' },
  { code: 44, name: '大分県', region: '九州' },
  { code: 45, name: '宮崎県', region: '九州' },
  { code: 46, name: '鹿児島県', region: '九州' },
  { code: 47, name: '沖縄県', region: '九州' },
]

/** 選手育成モードで使う架空の県名（都道府県コードごと） */
export const FICTIONAL_PREF: Record<number, string> = {
  1: '北嶺県', 2: '雪森県', 3: '霧原県', 4: '杜宮県', 5: '稲穂県', 6: '紅野県', 7: '磐瀬県',
  8: '筑野県', 9: '光野県', 10: '赤峰県', 11: '秩川県', 12: '潮房県', 13: '都央県', 14: '浜風県',
  15: '白鳥県', 16: '雷鳥県', 17: '金鞍県', 18: '若越県', 19: '峡央県', 20: '信嶺県', 21: '清流県',
  22: '富峰県', 23: '鯱浜県', 24: '真珠県', 25: '鳰湖県', 26: '雅京県', 27: '七海県', 28: '神凪県',
  29: '鹿野原県', 30: '紀峰県', 31: '白砂県', 32: '神在県', 33: '桃原県', 34: '鯉城県', 35: '門浜県',
  36: '渦潮県', 37: '讃浜県', 38: '橘浜県', 39: '黒潮県', 40: '博浜県', 41: '明海県', 42: '蘭浜県',
  43: '炎野県', 44: '湯ノ里県', 45: '陽南県', 46: '火ノ島県', 47: '南風県',
}
/** 選手育成モードの舞台（県） */
export const PLAYER_MODE_PREF = 27
/** 選手育成モードの学校名（固定） */
export const PLAYER_MODE_SCHOOL = '七海東高校'

let fictionalPlaces = false
/** 地名を架空のものにするか（選手育成モードのとき true） */
export function setFictionalPlaces(on: boolean): void {
  fictionalPlaces = on
}

export function prefName(code: number): string {
  const real = PREFECTURES.find((p) => p.code === code)?.name
  if (!real) return '不明'
  return fictionalPlaces ? (FICTIONAL_PREF[code] ?? real) : real
}

export const POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

/** 守備位置の1文字（打順・守備位置の表示用。左中右を分ける） */
export const POSITION_LABEL_RAW: Record<Position, string> = {
  P: '投',
  C: '捕',
  '1B': '一',
  '2B': '二',
  '3B': '三',
  SS: '遊',
  LF: '左',
  CF: '中',
  RF: '右',
}

export const POSITION_NAME_RAW: Record<Position, string> = {
  P: '投手',
  C: '捕手',
  '1B': '一塁手',
  '2B': '二塁手',
  '3B': '三塁手',
  SS: '遊撃手',
  LF: '左翼手',
  CF: '中堅手',
  RF: '右翼手',
}

const OUTFIELD = new Set<string>(['LF', 'CF', 'RF'])
/** 選手育成モードでは、選手の守備位置の外野を左中右に分けず「外野」とまとめる */
function unifyOutfield(base: Record<Position, string>, of: string): Record<Position, string> {
  return new Proxy(base, {
    get: (t, k) => (fictionalPlaces && typeof k === 'string' && OUTFIELD.has(k) ? of : t[k as Position]),
  })
}
/** 選手の守備位置の1文字 */
export const POSITION_LABEL: Record<Position, string> = unifyOutfield(POSITION_LABEL_RAW, '外')
/** 選手の守備位置の名前 */
export const POSITION_NAME: Record<Position, string> = unifyOutfield(POSITION_NAME_RAW, '外野手')

export const APTITUDE_LABEL = ['×', '△', '○', '◎']

export const PITCH_NAME: Record<PitchType, string> = {
  slider: 'スライダー',
  curve: 'カーブ',
  fork: 'フォーク',
  changeup: 'チェンジアップ',
  shoot: 'シュート',
  sinker: 'シンカー',
  cutter: 'カットボール',
  splitter: 'スプリット',
}

export const PRACTICE_NAME: Record<PracticeMenu, string> = {
  batting: '打撃',
  power: '長打',
  pitching: '投球',
  fitness: '体力づくり',
  fielding: '守備',
  running: '走塁',
}

export const GROWTH_NAME = { early: '早熟', normal: '普通', late: '晩成' } as const

/** ランクの区切り（下限値） */
export const RANKS: { rank: string; min: number }[] = [
  { rank: 'S', min: 90 },
  { rank: 'A', min: 80 },
  { rank: 'B', min: 70 },
  { rank: 'C', min: 60 },
  { rank: 'D', min: 50 },
  { rank: 'E', min: 40 },
  { rank: 'F', min: 20 },
  { rank: 'G', min: 0 },
]

export function rankOf(value: number): string {
  return RANKS.find((r) => value >= r.min)?.rank ?? 'G'
}

/** 球速を1-100の評価値に換算（120km/h=40、150km/h=90 前後） */
export function velocityScore(kmh: number): number {
  return Math.round(Math.max(1, Math.min(100, (kmh - 96) * (5 / 3))))
}

/** 4月第1週を1とした週番号から、月と第何週かを求める */
const WEEKS_IN_MONTH = [4, 5, 4, 4, 5, 4, 4, 5, 4, 4, 5, 4] // 4月〜翌3月
const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

export function weekToDate(week: number): { month: number; weekOfMonth: number } {
  let w = week
  for (let i = 0; i < 12; i++) {
    const n = WEEKS_IN_MONTH[i]!
    if (w <= n) return { month: MONTHS[i]!, weekOfMonth: w }
    w -= n
  }
  return { month: 3, weekOfMonth: 4 }
}

export function formatWeek(year: number, week: number): string {
  const d = weekToDate(week)
  return `${year}年目 ${d.month}月 第${d.weekOfMonth}週`
}

/** 1年間の主な節目（週番号） */
export const SEASON_WEEKS = {
  /** 3年生が引退する週（夏の全国大会が終わった直後） */
  thirdYearRetire: 22, // 8月第5週
  /** 卒業式 */
  graduation: 51, // 3月第3週
} as const

/** 守備適性のまとまり（外野は左・中・右を分けない） */
export const APT_GROUPS: { key: string; label: string; name: string; kind: 'c' | 'if' | 'of'; positions: Position[] }[] = [
  { key: 'C', label: '捕', name: '捕手', kind: 'c', positions: ['C'] },
  { key: '1B', label: '一', name: '一塁手', kind: 'if', positions: ['1B'] },
  { key: '2B', label: '二', name: '二塁手', kind: 'if', positions: ['2B'] },
  { key: '3B', label: '三', name: '三塁手', kind: 'if', positions: ['3B'] },
  { key: 'SS', label: '遊', name: '遊撃手', kind: 'if', positions: ['SS'] },
  { key: 'OF', label: '外', name: '外野手', kind: 'of', positions: ['LF', 'CF', 'RF'] },
]

export function aptGroupOf(pos: Position): string {
  return pos === 'LF' || pos === 'CF' || pos === 'RF' ? 'OF' : pos
}
