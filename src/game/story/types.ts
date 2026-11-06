// ストーリー（会話の場面）の型

import type { Rng } from '../rng'
import type { SaveData } from '../types'

/** 立ち絵のある人物 */
export type CharId =
  | 'nagi'
  | 'nagi_jh'
  | 'daichi'
  | 'reika'
  | 'genzo'
  | 'makabe'
  | 'kuga'
  | 'tetsuro'
  | 'okochi'
  | 'grandpa'
  /** 病衣の祖父（病室の場面） */
  | 'grandpa_hosp'
  /** 1年目の3年生の主将（帽子を深くかぶったモブ） */
  | 'mob_cap'

/** 台本の表情（人物ごとの絵の割り当てで、実際の絵に置き換える） */
export type Face = 'normal' | 'smile' | 'serious' | 'surprise' | 'frustrated' | 'angry' | 'cry' | 'joy' | 'troubled'

/** 台詞 */
export interface SayStep {
  kind: 'say'
  /** 立ち絵のある人物（なければ名前だけ出す） */
  char?: CharId
  /** 名前の欄に出す名前 */
  name: string
  face?: Face
  text: string
  /** 心の声 */
  think?: boolean
}

/** 場面の説明（ト書き） */
export interface NarrStep {
  kind: 'narr'
  text: string
}

/** 背景・一枚絵の切り替え（暗転して切り替え、立ち絵はいったん片付ける） */
export interface BgStep {
  kind: 'bg'
  bg: string | null
  cg?: string | null
}

/** 画面中央のタイトルコール（「合格発表の日」など、時間や場所が飛ぶところ） */
export interface TitleStep {
  kind: 'title'
  /** 大きく出す言葉 */
  text: string
  /** 上に小さく出す言葉（「3月」「1年目 4月」など） */
  sub?: string
}

export interface ChoiceOption {
  label: string
  /** 選んだあとに続く台詞 */
  reply: Step[]
  /** 選んだときの効果。戻り値は画面に出す知らせ */
  apply?: (ctx: StoryContext) => string[] | void
}

export interface ChoiceStep {
  kind: 'choice'
  options: ChoiceOption[]
}

export type Step = SayStep | NarrStep | BgStep | TitleStep | ChoiceStep

/** 章の中で記録しておくこと（セーブデータに入る） */
export interface StoryState {
  enabled: boolean
  chapter: number
  /** 見終わった場面 */
  seen: string[]
  /** 物語の旗（選択の結果、出来事の記録など） */
  flags: Record<string, string | number | boolean>
  /** 実績 */
  achievements: string[]
  /** 手に入れた衣装 */
  costumes: string[]
  /** ライバル校（龍ヶ峰学園） */
  rivalId: string | null
  /** 日向大地の選手番号 */
  daichiId: string | null
  /** 主将に選んだ選手 */
  captainId: string | null
}

export interface StoryContext {
  save: SaveData
  st: StoryState
  rng: Rng
}

export interface Scene {
  id: string
  title: string
  chapter: number
  /** 場面タイトルの上に出す時期（省略すると「第1章　1年目 5月」のように自動で出す） */
  sub?: string
  /** 発生条件 */
  when: (ctx: StoryContext) => boolean
  /** 台本（{学校名}などは表示の前に置き換える） */
  steps: (ctx: StoryContext) => Step[]
  /** 見終わったときの効果。戻り値は画面に出す知らせ */
  onEnd?: (ctx: StoryContext) => string[] | void
}
