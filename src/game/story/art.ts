// 立ち絵・背景・一枚絵のファイル
// 台本の表情を、人物ごとにある絵へ置き換える（構想書20節「表情の割り当て」）

import type { CharId, Face } from './types'

interface CharArt {
  /** ファイル名の前半（胸から上の絵） */
  prefix: string
  /** 台本の表情 → 絵の表情 */
  faces: Partial<Record<Face, string>>
  /** 割り当てのない表情のときの絵 */
  fallback: string
  /** 名前の欄の色 */
  color: string
  /** 絵がまだないとき：代わりに使う人物（なければ立ち絵を出さない） */
  pending?: { alt: CharId | null }
}

const ART: Record<CharId, CharArt> = {
  nagi: {
    prefix: 'nagi_hs_uniform_bust_',
    faces: { normal: 'normal', smile: 'smile', joy: 'smile', serious: 'serious', surprise: 'surprise', frustrated: 'frustrated', troubled: 'frustrated', cry: 'frustrated', angry: 'angry' },
    fallback: 'normal',
    color: '#ff8a3d',
  },
  nagi_jh: {
    prefix: 'nagi_jh_sailor_bust_',
    faces: { surprise: 'surprise', troubled: 'surprise' },
    fallback: 'normal',
    color: '#ff8a3d',
  },
  daichi: {
    prefix: 'daichi_hs_practice_bust_',
    faces: { normal: 'normal', smile: 'smile', joy: 'smile', serious: 'serious', angry: 'serious', surprise: 'surprise', troubled: 'surprise', frustrated: 'frustrated', cry: 'frustrated' },
    fallback: 'normal',
    color: '#2f6fe0',
  },
  reika: {
    prefix: 'reika_hs_uniform_bust_',
    faces: { normal: 'normal', smile: 'normal', serious: 'serious', angry: 'serious', frustrated: 'serious', joy: 'joy' },
    fallback: 'normal',
    color: '#9b3d5a',
  },
  genzo: {
    prefix: 'genzo_50s_shop_bust_',
    faces: { normal: 'normal', smile: 'smile', joy: 'smile', serious: 'serious', frustrated: 'serious', angry: 'angry', cry: 'cry' },
    fallback: 'normal',
    color: '#c0392b',
  },
  makabe: {
    prefix: 'makabe_20s_teacher_bust_',
    faces: { normal: 'normal', smile: 'smile', joy: 'smile', serious: 'serious', surprise: 'surprise', troubled: 'troubled', frustrated: 'troubled', angry: 'troubled', cry: 'troubled' },
    fallback: 'normal',
    color: '#4a7a3d',
  },
  kuga: {
    prefix: 'kuga_30s_coach_bust_',
    faces: { normal: 'normal', serious: 'normal', smile: 'smile', joy: 'smile', surprise: 'surprise', frustrated: 'frustrated', angry: 'frustrated' },
    fallback: 'normal',
    color: '#7a1f2b',
  },
  tetsuro: {
    prefix: 'tetsuro_50s_pro_bust_',
    faces: { normal: 'normal', serious: 'normal', surprise: 'normal', smile: 'smile', joy: 'smile', angry: 'angry', frustrated: 'frustrated', cry: 'frustrated' },
    fallback: 'normal',
    color: '#c62828',
  },
  okochi: {
    prefix: 'okochi_50s_shop_bust_',
    faces: { normal: 'normal', frustrated: 'normal', smile: 'smile', serious: 'serious', angry: 'serious', surprise: 'serious' },
    fallback: 'normal',
    color: '#2e6b4a',
  },
  grandpa: {
    prefix: 'grandpa_70s_fan_bust_',
    faces: {},
    fallback: 'smile',
    color: '#d84315',
  },
  grandpa_hosp: {
    prefix: 'grandpa_70s_hospital_bust_',
    faces: {},
    fallback: 'smile',
    color: '#d84315',
    pending: { alt: 'grandpa' },
  },
  mob_cap: {
    prefix: 'mob_captain_practice_bust_',
    // 悔しい顔はまだないので、すべて通常の顔で出す（届いたら frustrated に戻す）
    faces: {},
    fallback: 'normal',
    color: '#4f6b8a',
    pending: { alt: null },
  },
  nagi_beach: {
    prefix: 'nagi_beach_bust_',
    faces: { smile: 'smile', joy: 'smile' },
    fallback: 'smile',
    color: '#ff8a3d',
    pending: { alt: 'nagi' },
  },
  hasumi: {
    prefix: 'hasumi_nurse_bust_',
    faces: { smile: 'smile', joy: 'smile', tease: 'tease' },
    fallback: 'normal',
    color: '#c2477a',
    pending: { alt: null },
  },
  hasumi_beach: {
    prefix: 'hasumi_beach_bust_',
    faces: {},
    fallback: 'smile',
    color: '#c2477a',
    pending: { alt: 'hasumi' },
  },
  reika_beach: {
    prefix: 'reika_beach_bust_',
    faces: {},
    fallback: 'normal',
    color: '#9b3d5a',
    pending: { alt: 'reika' },
  },
  hasumi_yukata: {
    prefix: 'hasumi_yukata_bust_',
    faces: { smile: 'smile', joy: 'smile', tease: 'tease' },
    fallback: 'smile',
    color: '#c2477a',
    pending: { alt: 'hasumi' },
  },
  // 他の部活のエース格（絵ができるまでは名前だけ出す）
  iwaki: fixedArt('iwaki_hs_track_bust_', '#8d5a2b'),
  shiomi: fixedArt('shiomi_hs_sumo_bust_', '#6d4c41'),
  amou: fixedArt('amou_hs_soccer_bust_', '#1e88e5'),
  kuon: fixedArt('kuon_hs_tennis_bust_', '#00897b'),
  kobayakawa: fixedArt('kobayakawa_hs_tabletennis_bust_', '#e65100'),
  senju: fixedArt('senju_hs_shogi_bust_', '#5e35b1'),
  shinonome: fixedArt('shinonome_hs_council_bust_', '#37474f'),
  miki: fixedArt('miki_hs_newspaper_bust_', '#795548'),
  pro_scout: fixedArt('pro_scout_40s_bust_', '#455a64'),
}

/** 固定キャラの絵の割り当て（通常・笑顔・真剣・驚き） */
function fixedArt(prefix: string, color: string): CharArt {
  return {
    prefix,
    faces: { smile: 'smile', joy: 'smile', serious: 'serious', angry: 'serious', frustrated: 'serious', surprise: 'surprise', troubled: 'surprise' },
    fallback: 'normal',
    color,
    pending: { alt: null },
  }
}

/** 絵ができた人物（public/chara に置いたら、ここに足すと pending より優先される） */
export const CHAR_READY = new Set<CharId>(['hasumi', 'hasumi_beach', 'miki', 'shinonome', 'senju', 'kobayakawa', 'kuon', 'amou', 'grandpa_hosp', 'mob_cap', 'nagi_beach', 'reika_beach', 'hasumi_yukata', 'pro_scout'])

/** 実際に絵を出す人物（絵がなければ代わりの人物、代わりもなければ null） */
function resolveChar(char: CharId): CharId | null {
  const a = ART[char]
  if (!a.pending || CHAR_READY.has(char)) return char
  return a.pending.alt
}

/** 立ち絵を出せるか */
export function hasPortrait(char: CharId): boolean {
  return resolveChar(char) !== null
}

const BASE = import.meta.env.BASE_URL

/** 立ち絵（胸から上）のURL */
export function portraitUrl(char: CharId, face: Face | undefined): string {
  const a = ART[resolveChar(char) ?? char]
  const f = (face && a.faces[face]) || a.fallback
  return `${BASE}chara/${a.prefix}${f}.webp`
}

export function nameColor(char: CharId | undefined): string {
  return char ? ART[char].color : '#5f6f86'
}

/** 用意できている背景（public/bg にあるもの） */
export const BG_READY = new Set<string>([
  'bg_classroom_day',
  'bg_clubroom_day',
  'bg_ground_day',
  'bg_ground_sunset',
  'bg_hotel_night',
  'bg_liquor_day',
  'bg_nagi_room_hs_night',
  'bg_nagi_room_jh_night',
  'bg_prostadium_night',
  'bg_stadium_day',
  'bg_street_sunset',
  'bg_nagi_room_jh_morning',
  'bg_living_morning',
  'bg_exam_board',
  'bg_hospital_room',
  'bg_jh_ground',
  'bg_sports_shop',
  'bg_clubroom_night',
  'bg_national_stadium',
  'bg_entrance_ceremony',
  'bg_school_gate_sakura',
  'bg_stadium_road_night',
  'bg_infirmary_day',
  'bg_clubroom_tv',
  'bg_summer_festival_night',
  'bg_newspaper_room',
  'bg_student_council',
  'bg_shogi_room',
  'bg_gym_table_tennis',
  'bg_tennis_court',
  'bg_soccer_field',
  'bg_sumo_room',
  'bg_track_field',
  'bg_street_winter_night',
])

/** まだ絵がない背景の代わり（絵ができたら BG_READY に足すだけで差し替わる） */
export const BG_FALLBACK: Record<string, string> = {
  bg_nagi_room_jh_morning: 'bg_nagi_room_jh_night',
  bg_living_morning: 'bg_nagi_room_jh_night',
  bg_exam_board: 'bg_ground_day',
  bg_school_gate_sakura: 'bg_ground_day',
  bg_entrance_ceremony: 'bg_classroom_day',
  bg_hospital_room: 'bg_hotel_night',
  bg_jh_ground: 'bg_ground_day',
  bg_sports_shop: 'bg_street_sunset',
  bg_clubroom_night: 'bg_clubroom_day',
  bg_national_stadium: 'bg_stadium_day',
  bg_stadium_road_night: 'bg_prostadium_night',
  bg_infirmary_day: 'bg_classroom_day',
  // 第1章（サクセス版）で増えた背景
  bg_track_field: 'bg_ground_day',
  bg_sumo_room: 'bg_clubroom_day',
  bg_soccer_field: 'bg_ground_day',
  bg_tennis_court: 'bg_ground_day',
  bg_gym_table_tennis: 'bg_classroom_day',
  bg_shogi_room: 'bg_classroom_day',
  bg_student_council: 'bg_classroom_day',
  bg_newspaper_room: 'bg_classroom_day',
  bg_summer_festival_night: 'bg_street_sunset',
  bg_street_winter_night: 'bg_street_sunset',
  bg_stadium_stands: 'bg_stadium_day',
  bg_clubroom_tv: 'bg_clubroom_day',
}

/** 実際に表示する背景の名前（絵がなければ代わりの絵） */
export function resolveBg(name: string): string {
  return BG_READY.has(name) ? name : (BG_FALLBACK[name] ?? name)
}

export function bgUrl(name: string): string {
  return `${BASE}bg/${resolveBg(name)}.webp`
}

export function cgUrl(name: string): string {
  return `${BASE}ev/${name}.webp`
}

/** 主人公側（画面の左に立つ人物） */
export function isLeftSide(char: CharId): boolean {
  return char === 'nagi' || char === 'nagi_jh'
}

/** 名前の欄の色・立ち絵の割り当てを持つ人物の一覧（テスト用） */
export const ART_CHARS = Object.keys(ART) as CharId[]
