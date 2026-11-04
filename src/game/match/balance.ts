// バランス検証ツール：試合を自動でたくさん回して、成績の傾向を集計する

import { Rng } from '../rng'
import { activeMembers } from '../season'
import type { SaveData, School } from '../types'
import { autoLineup } from './lineup'
import { createMatch, defaultOptions, score, simulateToEnd, type MatchContext } from './engine'

export interface BalanceReport {
  games: number
  runsPerTeam: number
  avg: number
  obp: number
  slg: number
  hrPerGame: number
  kRate: number
  bbRate: number
  sbPerGame: number
  errorsPerTeam: number
  pitchesPerTeam: number
  /** 総合力の差が大きい試合で、弱い方が勝った割合 */
  upsetRate: number
  upsetGames: number
  /** 総合力の差ごとの、強い方の勝率 */
  winRateByGap: { gap: string; games: number; strongerWins: number }[]
  extraInnings: number
  ms: number
}

export function runBalance(save: SaveData, games: number, seed = 1): BalanceReport {
  const start = Date.now()
  const rng = Rng.fromSeed(seed)
  const ctx: MatchContext = { players: save.players, rng }
  const schools = Object.values(save.schools).filter((s) => s.detailed && activeMembers(save, s).length >= 9)
  let runs = 0
  let ab = 0
  let h = 0
  let tb = 0
  let bb = 0
  let pa = 0
  let k = 0
  let hr = 0
  let sb = 0
  let errors = 0
  let pitches = 0
  let extra = 0
  let upsetGames = 0
  let upsets = 0
  const gaps = [
    { gap: '0〜4', min: 0, max: 5, games: 0, strongerWins: 0 },
    { gap: '5〜9', min: 5, max: 10, games: 0, strongerWins: 0 },
    { gap: '10〜14', min: 10, max: 15, games: 0, strongerWins: 0 },
    { gap: '15〜19', min: 15, max: 20, games: 0, strongerWins: 0 },
    { gap: '20以上', min: 20, max: 999, games: 0, strongerWins: 0 },
  ]
  const lineupOf = (s: School) => autoLineup(activeMembers(save, s), true)

  for (let g = 0; g < games; g++) {
    const a = rng.pick(schools)
    let b = rng.pick(schools)
    if (a.id === b.id) b = schools[(schools.indexOf(a) + 1) % schools.length]!
    const m = createMatch(
      ctx,
      { schoolId: a.id, name: a.name, lineup: lineupOf(a) },
      { schoolId: b.id, name: b.name, lineup: lineupOf(b) },
      defaultOptions(),
      `bal${g}`,
    )
    simulateToEnd(m, ctx)
    const [ra, rh] = score(m)
    runs += ra + rh
    if (m.inning > 9) extra += 1
    for (const box of Object.values(m.batting)) {
      ab += box.ab
      h += box.h
      tb += box.h + box.d + box.t * 2 + box.hr * 3
      bb += box.bb
      pa += box.pa
      k += box.k
      hr += box.hr
      sb += box.sb
    }
    for (const box of Object.values(m.pitching)) pitches += box.pitches
    errors += m.away.errors + m.home.errors

    const gap = Math.abs(a.overall - b.overall)
    const strongerIsAway = a.overall >= b.overall
    const strongerWon = m.winner === (strongerIsAway ? 'away' : 'home')
    const bucket = gaps.find((x) => gap >= x.min && gap < x.max)!
    bucket.games += 1
    if (strongerWon) bucket.strongerWins += 1
    if (gap >= 15 && m.winner) {
      upsetGames += 1
      if (!strongerWon) upsets += 1
    }
  }
  const teams = games * 2
  return {
    games,
    runsPerTeam: runs / teams,
    avg: h / Math.max(1, ab),
    obp: (h + bb) / Math.max(1, pa),
    slg: tb / Math.max(1, ab),
    hrPerGame: hr / games,
    kRate: k / Math.max(1, pa),
    bbRate: bb / Math.max(1, pa),
    sbPerGame: sb / games,
    errorsPerTeam: errors / teams,
    pitchesPerTeam: pitches / teams,
    upsetRate: upsets / Math.max(1, upsetGames),
    upsetGames,
    winRateByGap: gaps.map(({ gap, games, strongerWins }) => ({ gap, games, strongerWins })),
    extraInnings: extra / games,
    ms: Date.now() - start,
  }
}

export function formatReport(r: BalanceReport): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const lines = [
    `試合数：${r.games}（${r.ms}ms）`,
    `1チームあたりの得点：${r.runsPerTeam.toFixed(2)}`,
    `打率：${r.avg.toFixed(3)} ／ 出塁率：${r.obp.toFixed(3)} ／ 長打率：${r.slg.toFixed(3)}`,
    `本塁打（1試合・両チーム）：${r.hrPerGame.toFixed(2)}`,
    `三振率：${pct(r.kRate)} ／ 四死球率：${pct(r.bbRate)}`,
    `盗塁（1試合）：${r.sbPerGame.toFixed(2)} ／ 失策（1チーム）：${r.errorsPerTeam.toFixed(2)}`,
    `球数（1チーム）：${r.pitchesPerTeam.toFixed(0)} ／ 延長：${pct(r.extraInnings)}`,
    `番狂わせ（総合力の差15以上で弱い方が勝つ）：${pct(r.upsetRate)}（${r.upsetGames}試合）`,
    ...r.winRateByGap.map((g) => `  差${g.gap}：強い方の勝率 ${g.games ? pct(g.strongerWins / g.games) : '-'}（${g.games}試合）`),
  ]
  return lines.join('\n')
}
