// スカウト（中学生の勧誘）と、3年生のドラフト
//
// スカウト：
// ・毎年4月に、来年入学する県内の中学3年生が10人ほどリストに載る
// ・「視察」で能力が見えるようになり、「勧誘」で自校への関心が上がる
// ・スカウト活動の回数は、すごろくのスカウトマスと毎月の補充で増える。足りなければ部費で行える
// ・2月に進学先が決まり、自校を選んだ選手は4月に入部する
//
// ドラフト：
// ・11月に、引退した自校の3年生のうち実力のある選手がプロ（架空のリーグ）に指名されることがある

import { Rng, clamp } from './rng'
import { prefName } from './constants'
import { fullName, generatePlayer, playerRating } from './player'
import { newId } from './world'
import type { Player, SaveData, School } from './types'

export interface Prospect {
  id: string
  /** 入部したときの選手データ（入学までは学校に属さない） */
  player: Player
  /** 自校への関心 0-100 */
  interest: number
  /** どこまで分かっているか：0=名前と守備位置だけ、1=能力のおおよそ、2=くわしく */
  level: 0 | 1 | 2
  /** 勧誘した回数（回数が増えるほど効き目は落ちる） */
  visits: number
  status: 'open' | 'own' | 'other'
  /** 他校に決まったときの学校名 */
  otherSchool?: string
  /** 中学での評判（強さの目安。視察しなくても分かる） */
  buzz: string
}

export interface ScoutState {
  /** 何年目の4月に作ったリストか（入学はその翌年度） */
  year: number
  /** 残りのスカウト活動の回数 */
  points: number
  prospects: Prospect[]
  decided: boolean
}

export const SCOUT_COST = { visitFunds: 5, recruitFunds: 10 } as const
/** 進学先が決まる週（2月第3週） */
export const SCOUT_DECISION_WEEK = 46

function buzzOf(strength: number): string {
  if (strength >= 78) return '県内屈指の逸材'
  if (strength >= 66) return '地元で評判'
  if (strength >= 52) return '有望'
  if (strength >= 40) return '素質あり'
  return '無名'
}

/** 今年度のスカウトのリスト（なければ作る） */
export function ensureScout(save: SaveData, rng: Rng): ScoutState {
  const year = save.calendar.year
  if (save.scout && save.scout.year === year) return save.scout
  const own = save.schools[save.playerSchoolId]!
  const prospects: Prospect[] = []
  const count = 10
  for (let i = 0; i < count; i++) {
    const strength = i < 2 ? rng.int(72, 90) : i < 5 ? rng.int(56, 72) : rng.int(32, 56)
    const p = generatePlayer(rng, {
      id: newId(save, 'p'),
      schoolId: '',
      grade: 1,
      year: year + 1,
      strength,
      kind: own.kind,
      position: i % 4 === 0 ? 'P' : undefined,
      managerExperience: save.managerExperience,
    })
    // 実力のある選手ほど、評判の低い学校には興味を持ちにくい
    const gap = Math.max(0, strength - own.reputation - 15)
    const interest = clamp(Math.round(15 + own.reputation * 0.35 + rng.int(-5, 15) - gap * 0.45), 3, 70)
    prospects.push({ id: p.id, player: p, interest, level: 0, visits: 0, status: 'open', buzz: buzzOf(strength) })
  }
  save.scout = { year, points: save.scout?.points ?? 2, prospects: rng.shuffle(prospects), decided: false }
  return save.scout
}

/** スカウト活動の回数を増やす（スカウトマス、毎月の補充） */
export function addScoutPoints(save: SaveData, n: number): void {
  if (!save.scout) return
  save.scout.points = Math.min(9, save.scout.points + n)
}

/** 回数か部費を使う。使えなければ false */
function spend(save: SaveData, funds: number): boolean {
  const s = save.scout!
  if (s.points > 0) {
    s.points -= 1
    return true
  }
  const own = save.schools[save.playerSchoolId]!
  if (own.funds < funds) return false
  own.funds -= funds
  return true
}

export function canAct(save: SaveData, kind: 'visit' | 'recruit'): boolean {
  if (!save.scout || save.scout.decided) return false
  if (save.scout.points > 0) return true
  return save.schools[save.playerSchoolId]!.funds >= (kind === 'visit' ? SCOUT_COST.visitFunds : SCOUT_COST.recruitFunds)
}

/** 視察：能力が分かるようになり、関心も少し上がる */
export function scoutVisit(save: SaveData, rng: Rng, id: string): string | null {
  const pr = save.scout?.prospects.find((x) => x.id === id)
  if (!pr || pr.status !== 'open' || pr.level >= 2) return null
  if (!spend(save, SCOUT_COST.visitFunds)) return null
  pr.level = (pr.level + 1) as 1 | 2
  pr.interest = clamp(pr.interest + rng.int(1, 4), 0, 100)
  return `${fullName(pr.player)}を視察した。${pr.level === 1 ? '能力のおおよそが分かった。' : '能力がくわしく分かった。'}`
}

/** 勧誘：自校への関心が上がる（回数を重ねるほど上がりにくい） */
export function scoutRecruit(save: SaveData, rng: Rng, id: string): string | null {
  const pr = save.scout?.prospects.find((x) => x.id === id)
  if (!pr || pr.status !== 'open' || pr.interest >= 100) return null
  if (!spend(save, SCOUT_COST.recruitFunds)) return null
  const own = save.schools[save.playerSchoolId]!
  const gain = Math.max(3, 9 + rng.int(0, 8) + own.reputation / 12 + (own.kind === 'private' ? 3 : 0) - pr.visits * 2)
  pr.visits += 1
  pr.interest = clamp(Math.round(pr.interest + gain), 0, 100)
  return `${fullName(pr.player)}を勧誘した。関心：${interestLabel(pr.interest)}`
}

export function interestLabel(v: number): string {
  if (v >= 85) return '入学を希望'
  if (v >= 65) return 'とても高い'
  if (v >= 45) return '高い'
  if (v >= 25) return 'ある'
  return '低い'
}

/** 2月：進学先が決まる */
export function decideProspects(save: SaveData, rng: Rng): string[] {
  const s = save.scout
  if (!s || s.decided) return []
  s.decided = true
  const rivals = Object.values(save.schools)
    .filter((x) => x.prefCode === save.prefCode && x.id !== save.playerSchoolId)
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 8)
  const joined: string[] = []
  for (const pr of s.prospects) {
    if (pr.status !== 'open') continue
    const p = clamp((pr.interest - 30) / 55, 0.02, 0.97)
    if (rng.chance(p)) {
      pr.status = 'own'
      joined.push(pr.player.surname)
    } else {
      pr.status = 'other'
      pr.otherSchool = rivals.length ? rng.pick(rivals).name : '県外の学校'
    }
  }
  const msg = joined.length > 0 ? `スカウトした中学生のうち、${joined.join('・')}が来春の入学を決めてくれた！` : '勧誘した中学生は、みな他の学校への進学を決めた…'
  save.log.push({ year: save.calendar.year, week: save.calendar.week, text: msg })
  return [msg]
}

/** 新年度：自校に決めた中学生を入部させる。入部した人数を返す */
export function enrollProspects(save: SaveData, own: School, year: number): Player[] {
  const s = save.scout
  if (!s) return []
  const list: Player[] = []
  for (const pr of s.prospects) {
    if (pr.status !== 'own') continue
    const p = pr.player
    p.schoolId = own.id
    p.grade = 1
    p.enrolledYear = year
    save.players[p.id] = p
    own.playerIds.push(p.id)
    list.push(p)
  }
  return list
}

// ---------------------------------------------------------------- ドラフト

/** ドラフトの週（11月第1週） */
export const DRAFT_WEEK = 31

/** 架空のプロリーグの球団 */
const PRO_TEAMS = [
  '札幌ノースベアーズ',
  '仙台フォレスターズ',
  '東京スカイライツ',
  '千葉オーシャンウェーブ',
  '横浜ブルーアンカーズ',
  '名古屋ゴールデンシャチズ',
  '京都ミヤビナイツ',
  '大阪ファイヤーバーズ',
  '神戸ポートパイレーツ',
  '岡山ピーチボーイズ',
  '松山シトラススターズ',
  '福岡ブレイズ',
]

/** 自校の引退した3年生のうち、指名された選手 */
export function runDraft(save: SaveData, rng: Rng): string[] {
  const own = save.schools[save.playerSchoolId]!
  const year = save.calendar.year
  const results = own.history.find((h) => h.year === year)?.results ?? []
  // 大舞台で目立つと、スカウトの目に留まりやすい
  const stage = results.some((r) => r.includes('全国')) ? 6 : results.some((r) => r.includes('県優勝') || r.includes('準優勝')) ? 3 : 0
  const messages: string[] = []
  const candidates = own.playerIds
    .map((id) => save.players[id])
    .filter((p): p is Player => !!p && p.grade === 3 && !p.helper)
  for (const p of candidates) {
    const rating = playerRating(p) + stage
    const chance = clamp((rating - 60) / 22, 0, 0.92)
    if (!rng.chance(chance)) continue
    const round = clamp(Math.round(8 - (rating - 58) / 4 + rng.normal(0, 1)), 1, 7)
    const team = rng.pick(PRO_TEAMS)
    p.drafted = { team, round }
    messages.push(`ドラフト会議で、${fullName(p)}が${team}から${round}位指名を受けた！`)
  }
  if (messages.length === 0 && candidates.some((p) => playerRating(p) >= 55)) {
    messages.push('ドラフト会議。今年は自校からの指名はなかった。')
  }
  for (const m of messages) save.log.push({ year, week: save.calendar.week, text: m })
  return messages
}

export function scoutPrefLabel(save: SaveData): string {
  return prefName(save.prefCode)
}
