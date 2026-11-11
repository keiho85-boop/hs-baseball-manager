// サクセス（1人の選手を3年間育てる遊び方）の型

/** フォーカス選手を評価する人（構想書18節「周りからの評価」） */
export type EvalKey = 'nagi' | 'makabe' | 'hasumi' | 'daichi' | 'team' | 'genzo' | 'scout'

/** 勧誘に行ける部活 */
export type ClubId = 'kitaku' | 'rikujo' | 'sumo' | 'soccer' | 'tennis' | 'takkyu' | 'shogi' | 'seitokai' | 'shinbun'

/** 他の部活の固定キャラ（エース格） */
export type FixedId = 'rikujo' | 'sumo' | 'soccer' | 'tennis' | 'takkyu' | 'shogi' | 'seitokai' | 'shinbun'

/** その週、部活にいる人（勧誘の前に見える） */
export type ClubMember =
  | { kind: 'fixed'; id: FixedId }
  | {
      kind: 'mob'
      surname: string
      givenName: string
      grade: number
      /** 得意な守備位置（表示用。入部するときにこの位置で作る） */
      position: string
      /** 強さの目安（入部するときの能力の基準） */
      strength: number
    }

export interface ClubRoster {
  club: ClubId
  members: ClubMember[]
}

export interface SuccessState {
  /** 育てる選手（フォーカス選手） */
  focusId: string | null
  /** 周りの評価（0〜100） */
  eval: Record<EvalKey, number>
  /** 今週、各部活にいる人（毎週入れ替わる） */
  clubs: ClubRoster[]
  /** 部活ごとに勧誘に行った回数 */
  visits: Partial<Record<ClubId, number>>
  /** 固定キャラに話しかけられた回数（加入の確率が上がる） */
  talks: Partial<Record<FixedId, number>>
  /** 加入した固定キャラ（選手番号） */
  joined: Partial<Record<FixedId, string>>
  /** 勧誘が続けて失敗した回数 */
  failStreak: number
  /** 続けて勧誘に行った週の数（練習をしないと、大地とチームメイトの評価が下がる） */
  recruitStreak: number
  /** 3年目の春に、スカウトがこの学校に注目した（スカウトのマスの評価の上がり幅が大きくなる） */
  scoutFocus: boolean
  /** 大地と付き合っている（告白が成功した年） */
  dating: number | null
  /** シナリオが終わった（'pro' プロ入り、'fail' 育成失敗） */
  ended: 'pro' | 'fail' | null
  /** 夏合宿の行き先のグレード（0〜3。部費で上げる。古いデータには無い） */
  campLevel?: number
}
