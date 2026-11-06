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
}

const BASE = import.meta.env.BASE_URL

/** 立ち絵（胸から上）のURL */
export function portraitUrl(char: CharId, face: Face | undefined): string {
  const a = ART[char]
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
