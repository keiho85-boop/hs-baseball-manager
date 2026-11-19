// 特殊能力の定義（名前はすべてこのゲーム独自のもの）
// 序列（S〜C）は実際の効果の大きさで決める（構想書・特殊能力の設計 11月19日）。
// 上位・下位：上位を取ると下位が置き換わる。偶然（特訓・試合・入部時）で取れるのは、S以外で上位でもない能力だけ。

import type { Player } from './types'

export type SkillTarget = 'batter' | 'pitcher' | 'all'
export type SkillTier = 'S' | 'A' | 'B' | 'C'
/** 守備位置の制限（C＝捕手、IF＝内野手、OF＝外野手） */
export type SkillPos = 'C' | 'IF' | 'OF'

export interface SkillDef {
  id: string
  name: string
  description: string
  good: boolean
  target: SkillTarget
  /** 序列（弱点は痛さ：S＝大〜C＝小） */
  tier: SkillTier
  /** 入部時に持っている確率の重み（実際の確率は rollInitialSkills で全体を絞る） */
  initialRate: number
  /** 上位版（これを持っていて上位を取ると置き換わる） */
  upper?: string
  /** この能力が上位版のときの下位 */
  lower?: string
  /** 守備位置の制限 */
  pos?: SkillPos
  /** 育成選手の入部時にだけ付く */
  initialOnly?: boolean
}

const S = (
  id: string,
  name: string,
  description: string,
  target: SkillTarget,
  tier: SkillTier,
  initialRate: number,
  extra: Partial<SkillDef> = {},
): SkillDef => ({ id, name, description, good: true, target, tier, initialRate, ...extra })
const W = (id: string, name: string, description: string, target: SkillTarget, tier: SkillTier, initialRate: number): SkillDef => ({
  id,
  name,
  description,
  good: false,
  target,
  tier,
  initialRate,
})

export const SKILLS: SkillDef[] = [
  // ---------------------------------------------------------------- 打者・野手
  S('shikaku', '死角なし', '常にミートが上がり、追い込まれてからはさらに上がって粘れる（三振がおよそ半分）', 'batter', 'S', 0, { lower: 'persistent' }),
  S('supercar', 'スーパーカー', '盗塁・内野安打・長打・走塁がうまく、併殺になりにくい。守備範囲も広がる', 'batter', 'S', 0, { lower: 'rocket_start' }),
  S('seiiki', '聖域', '守備範囲が大きく広がり、自分のところに飛んだ打球がヒットになりにくい', 'batter', 'S', 0, { lower: 'highlight_defense' }),
  S('shigotonin', '仕事人', '二塁・三塁に走者がいると、ミートとパワーが大きく上がる', 'batter', 'S', 0, { lower: 'risp_hunter' }),
  S('ougi', '扇の要', '捕手として出ると、投手の制球とキレが大きく上がる', 'batter', 'S', 0, { lower: 'battery_mate', pos: 'C' }),
  S('persistent', '粘りの鬼', '追い込まれてから、ファウルで粘りやすい', 'batter', 'A', 0.03, { upper: 'shikaku' }),
  S('highlight_defense', '魅せる守備', '守備でファインプレーが出やすい', 'batter', 'A', 0.03, { upper: 'seiiki' }),
  S('battery_mate', '名女房', '捕手として出ると、投手の制球が安定する', 'batter', 'A', 0.02, { upper: 'ougi', pos: 'C' }),
  S('risp_hunter', '得点圏の狩人', '二塁・三塁に走者がいると、ミートが上がる', 'batter', 'A', 0.02, { upper: 'shigotonin' }),
  S('senryo', '千両役者', '一打で同点・逆転の場面で、ミートとパワーが大きく上がる', 'batter', 'A', 0, { lower: 'late_hero' }),
  S('shingan', '心眼', 'ボール球にまず手を出さず、甘い球は長打にしやすい', 'batter', 'A', 0, { lower: 'miwame' }),
  S('sniper', 'スナイパー', '肩が強くなり、送球で走者を刺しやすい。走者も先の塁をためらう', 'batter', 'A', 0, { lower: 'good_throw' }),
  S('pillar', '大黒柱', '安打・打点のたびに、その試合のあいだ味方全員の打撃が上がる（最大3回）', 'batter', 'A', 0),
  S('gekokujo', '下剋上', '相手校の総合が自校より上のとき、ミートとパワーが上がる', 'batter', 'A', 0),
  S('moda', '猛打爆発', 'その試合で安打を打つたびに、次の打席からミートとパワーが上がる', 'batter', 'A', 0),
  S('upper_swing', 'アッパースイング', 'ミートが少し下がるが、パワーと弾道が上がる', 'batter', 'B', 0),
  S('leadoff', '一番槍', 'イニングの先頭で出塁しやすい', 'batter', 'B', 0.03),
  S('all_fields', '右へ左へ', '逆方向にも強い打球が飛ぶ', 'batter', 'B', 0.03),
  S('momentum', '波乗り打法', '前の打者がヒットだと打ちやすい', 'batter', 'B', 0.03),
  S('late_hero', '土壇場の主役', '8回以降、1点差以内の場面でミートとパワーが上がる', 'batter', 'B', 0.02, { upper: 'senryo' }),
  S('first_pitch', '一球目の刺客', '初球を打つとき、当たりが良くなる', 'batter', 'B', 0.03),
  S('rocket_start', '韋駄天スタート', '盗塁のスタートが良い', 'batter', 'B', 0.03, { upper: 'supercar' }),
  S('heads_up', '抜け目なし', '次の塁を狙う判断が成功しやすい', 'batter', 'B', 0.03),
  S('bunt', '犠牲の美学', '送りバントが成功しやすい', 'batter', 'B', 0.04),
  S('pinch_hitter', 'ベンチの秘密兵器', '代打で出たときにミートとパワーが上がる', 'batter', 'B', 0.02),
  S('fastball_killer', '速球殺し', '140km/h以上の直球に強い', 'batter', 'B', 0.02),
  S('breaking_eye', '曲がり球の目', '変化球に強い', 'batter', 'B', 0.02),
  S('hustle', '全力疾走', '内野安打が出やすい', 'batter', 'B', 0.02),
  S('gap_power', '長打の匂い', '二塁打・三塁打が出やすい', 'batter', 'B', 0.02),
  S('steady_glove', '堅実な守り', 'エラーが少ない', 'batter', 'B', 0.03),
  S('shield_mitt', '盾のミット', '捕手として出ると、盗塁を刺しやすい', 'batter', 'B', 0.02, { pos: 'C' }),
  S('miwame', '見極め', 'ボール球に手を出しにくい', 'batter', 'B', 0.03, { upper: 'shingan' }),
  S('good_throw', '好返球', '送球で走者を刺しやすい', 'batter', 'B', 0.02, { upper: 'sniper' }),
  S('lefty_killer', '左腕攻略', '左投手に強い', 'batter', 'B', 0.02),
  S('dp_master', '併殺職人', '内野手として、ゲッツーを取りやすい', 'batter', 'B', 0.02, { pos: 'IF' }),
  S('back_catch', '背走キャッチ', '外野手として、頭上を越える打球を捕りやすい', 'batter', 'B', 0.02, { pos: 'OF' }),
  S('first_ab', '一打席目の嗅覚', 'その試合で初めて対戦する投手に強い', 'batter', 'C', 0.02),
  S('bases_loaded', '満塁ハンター', '満塁で長打が出やすい', 'batter', 'C', 0.02),
  S('walkoff', 'サヨナラ請負人', 'サヨナラの場面で能力が上がる', 'batter', 'C', 0.015),
  S('pinch_runner', '代走の切り札', '代走で出たとき、足が速くなる', 'batter', 'C', 0.02),
  // ---------------------------------------------------------------- 投手
  S('checkmate', 'チェックメイト', '2ストライクから球威と制球が大きく上がる', 'pitcher', 'S', 0, { lower: 'finisher' }),
  S('ouja', '王者の風格', '登板中、相手打者のミートとパワーが下がる', 'pitcher', 'S', 0),
  S('tekkyu', '鉄球', '打たれても打球が飛ばず、本塁打を打たれにくい', 'pitcher', 'S', 0, { lower: 'groundball' }),
  S('makaiten', '魔回転', '常にキレが大きく上がる', 'pitcher', 'S', 0, { lower: 'denka' }),
  S('haisui', '背水の剛腕', '二塁・三塁に走者がいると、球速・制球・キレが大きく上がる', 'pitcher', 'S', 0, { lower: 'pinch_ace' }),
  S('all_in', 'フルスロットル', '体力の持ちが半分になるが、球速・制球・キレ・変化球が大きく上がる', 'pitcher', 'A', 0),
  S('ace', 'エース', '登板中、味方の打撃と守備が少し上がる', 'pitcher', 'A', 0),
  S('mujinzo', '無尽蔵', '疲れにくい', 'pitcher', 'A', 0, { lower: 'tempo' }),
  S('finisher', 'とどめの一球', '2ストライクから空振りを取りやすい', 'pitcher', 'A', 0.02, { upper: 'checkmate' }),
  S('groundball', '内野ゴロ量産', '打球がゴロになりやすい', 'pitcher', 'A', 0.03, { upper: 'tekkyu' }),
  S('denka', '伝家の宝刀', '一番の変化球が、一段上の切れ味になる', 'pitcher', 'A', 0.02, { upper: 'makaiten' }),
  S('pinch_ace', 'ピンチで本領', '二塁・三塁に走者がいると、制球とキレが上がる', 'pitcher', 'A', 0.02, { upper: 'haisui' }),
  S('gear_change', '終盤の剛腕', '回が進むほど球威が上がる', 'pitcher', 'A', 0.02),
  S('last_spurt', 'ラストスパート', '体力が残り2割を切ると、その回だけ全力を出す。回の終わりに体力が尽きる', 'pitcher', 'B', 0),
  S('rikito', '力投', '球速が上がるが、制球が少し下がる', 'pitcher', 'B', 0),
  S('fuiuchi', '不意打ち', '盗塁をほとんど許さない', 'pitcher', 'B', 0, { lower: 'no_steal' }),
  S('game_maker', 'ゲームメーカー', '同じ回に2点取られると、その回は制球とキレが大きく上がる（大量失点しにくい）', 'pitcher', 'B', 0),
  S('tempo', 'テンポ番長', '少ない球数で打ち取りやすい（疲れにくい）', 'pitcher', 'B', 0.03, { upper: 'mujinzo' }),
  S('recover', '立ち直り上手', '点を取られたあと、その回は制球が上がる', 'pitcher', 'B', 0.02),
  S('k_momentum', '三振で勢いづく', '三振を取った次の打者に、球威が上がる', 'pitcher', 'B', 0.02),
  S('sokojikara', '底力の直球', '直球が球速より速く見える', 'pitcher', 'B', 0.02),
  S('lefty_stopper', '左打者封じ', '左打者に強い', 'pitcher', 'B', 0.02),
  S('kyuen', '救援の鬼', '回の途中から登板すると、その回は制球とキレが上がる', 'pitcher', 'B', 0.02),
  S('iron_arm', '連投上等', '肩・肘の不安を抱えにくい', 'pitcher', 'C', 0.015),
  S('full_throttle', '初回から全開', '1回の制球が安定する', 'pitcher', 'C', 0.03),
  S('no_steal', '盗塁お断り', '盗塁されにくい', 'pitcher', 'C', 0.03, { upper: 'fuiuchi' }),
  // ---------------------------------------------------------------- 共通
  S('renshu_oni', '練習の鬼', '練習での伸びがとても良い', 'all', 'S', 0, { lower: 'hard_worker' }),
  S('butai_oni', '大舞台の鬼', '全国大会と県大会の準決勝以降で、能力が大きく上がる', 'all', 'S', 0, { lower: 'steel_heart' }),
  S('hagane', '鋼の体', '練習中のケガをほとんどしない。休養でよく回復する', 'all', 'S', 0, { lower: 'kega_shirazu' }),
  S('hard_worker', '練習の虫', '練習での伸びが良い', 'all', 'A', 0.03, { upper: 'renshu_oni' }),
  S('steel_heart', '鋼の心臓', '全国大会で能力が上がる', 'all', 'A', 0.015, { upper: 'butai_oni' }),
  S('omatsuri', 'お祭り男', '大会中は調子が下がらない', 'all', 'A', 0.02),
  S('scout_uke', 'スカウト受け', 'スカウトの評価が上がりやすい', 'all', 'A', 0.02),
  S('nobizakari', '伸び盛り', '1年目の練習での伸びが良い', 'all', 'A', 0, { initialOnly: true }),
  S('taiki', '大器晩成', '3年目の練習での伸びがとても良い', 'all', 'A', 0, { initialOnly: true }),
  S('kega_shirazu', 'ケガ知らず', '練習中のケガが少ない', 'all', 'A', 0.02, { upper: 'hagane' }),
  S('enten', '炎天の王', '夏の大会で疲れにくく、能力も上がる', 'all', 'A', 0, { lower: 'summer_child' }),
  S('charisma', 'カリスマ', '周りの人物の評価が上がりやすく、下がりにくい', 'all', 'B', 0, { lower: 'jinbo' }),
  S('counterattack', '逆襲の狼煙', 'リードされている場面で能力が上がる', 'all', 'B', 0.02),
  S('summer_child', '真夏の申し子', '夏の大会で疲れにくい', 'all', 'B', 0.02, { upper: 'enten' }),
  S('bench_sun', 'ベンチの太陽', 'ベンチ入りしていると、試合の前に味方の調子が上がる', 'all', 'B', 0.02),
  S('makezugirai', '負けず嫌い', '負けた試合の翌週、練習での伸びが良い', 'all', 'B', 0.02),
  S('kaifuku', '回復上手', '休養でよく回復する', 'all', 'B', 0.02),
  S('heijoshin', '平常心', '調子による能力の上下が小さい', 'all', 'B', 0.02),
  S('jinbo', '人望', 'チームメイトの評価が上がりやすい', 'all', 'C', 0.02, { upper: 'charisma' }),
  // ---------------------------------------------------------------- 弱点（序列は痛さ）
  W('lazy', 'サボり魔', '練習での伸びが悪い', 'all', 'S', 0.04),
  W('fan', '扇風機', '空振りが多い（強振のときはなおさら）', 'batter', 'S', 0.02),
  W('meatball', 'ど真ん中癖', '長打を浴びやすい', 'pitcher', 'S', 0.04),
  W('nervous', 'ガチガチ', '全国大会や決勝で能力が下がる', 'all', 'S', 0.05),
  W('kegagachi', 'ケガがち', '練習中にケガをしやすい', 'all', 'S', 0.03),
  W('chance_katamaru', 'チャンスで固まる', '二塁・三塁に走者がいると打てない', 'batter', 'S', 0.03),
  W('glass_heart', 'ガラスのハート', '連打を浴びると制球が乱れる', 'pitcher', 'A', 0.05),
  W('out_of_gas', 'ガス欠', '7回以降に球威が落ちる', 'pitcher', 'A', 0.05),
  W('double_play', 'ゲッツー量産', '内野ゴロや併殺打が多い', 'batter', 'A', 0.05),
  W('shikyu_guse', '四球ぐせ', 'フルカウントで制球が乱れる', 'pitcher', 'A', 0.03),
  W('choshi_nami', '調子の波', '調子が上下しやすい', 'all', 'A', 0.03),
  W('yajiuma', '野次馬に弱い', '全国大会では能力が少し下がる', 'all', 'A', 0.03),
  W('shubi_zatsu', '守備が雑', 'エラーが多い', 'batter', 'A', 0.03),
  W('slow_starter', '寝起きが悪い', '1回の制球が乱れる', 'pitcher', 'B', 0.05),
  W('heat_weak', '夏バテ体質', '夏の大会で疲れやすい', 'all', 'B', 0.04),
  W('sign_lost', 'サイン迷子', '采配の指示が失敗しやすい', 'all', 'B', 0.04),
  W('bousou', '暴走癖', '盗塁や進塁の判断を誤りやすい', 'batter', 'B', 0.03),
  W('tachiagari', '立ち上がりの空振り', 'その試合の最初の打席で打てない', 'batter', 'B', 0.03),
]

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]))

export function getSkill(id: string): SkillDef | undefined {
  return SKILL_MAP.get(id)
}

/** 同時に持てない組み合わせ（良い能力と、その反対の弱点） */
export const CONFLICTING_SKILLS: [string, string][] = [
  ['full_throttle', 'slow_starter'],
  ['steel_heart', 'nervous'],
  ['butai_oni', 'nervous'],
  ['summer_child', 'heat_weak'],
  ['enten', 'heat_weak'],
  ['hard_worker', 'lazy'],
  ['renshu_oni', 'lazy'],
  ['gear_change', 'out_of_gas'],
  ['groundball', 'meatball'],
  ['tekkyu', 'meatball'],
  ['kega_shirazu', 'kegagachi'],
  ['hagane', 'kegagachi'],
  ['risp_hunter', 'chance_katamaru'],
  ['shigotonin', 'chance_katamaru'],
  ['senryo', 'chance_katamaru'],
  ['omatsuri', 'choshi_nami'],
  ['heijoshin', 'choshi_nami'],
  ['steady_glove', 'shubi_zatsu'],
  ['seiiki', 'shubi_zatsu'],
  ['first_ab', 'tachiagari'],
  ['game_maker', 'glass_heart'],
  ['rikito', 'glass_heart'],
  ['shingan', 'fan'],
]

export function conflicts(a: string, b: string): boolean {
  return CONFLICTING_SKILLS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** 札の色（S＝金、A＝銀、それ以外は通常）。弱点は赤 */
export function skillColor(id: string): 'gold' | 'silver' | 'normal' | 'bad' {
  const s = SKILL_MAP.get(id)
  if (!s) return 'normal'
  if (!s.good) return 'bad'
  return s.tier === 'S' ? 'gold' : s.tier === 'A' ? 'silver' : 'normal'
}

/** 札の色のクラス（id か名前から。S＝金、A＝銀） */
export function tierClass(key: string): string {
  const s = SKILL_MAP.get(key) ?? SKILLS.find((x) => x.name === key)
  if (!s || !s.good) return ''
  return s.tier === 'S' ? 'tier-gold' : s.tier === 'A' ? 'tier-silver' : ''
}

const INFIELD = ['1B', '2B', '3B', 'SS']
const OUTFIELD = ['LF', 'CF', 'RF']

/** その選手がその能力を持てるか（投手・野手、守備位置、両立しない能力） */
export function canHave(p: Pick<Player, 'mainPosition' | 'skills'>, s: SkillDef): boolean {
  const isPitcher = p.mainPosition === 'P'
  if (s.target === 'pitcher' && !isPitcher) return false
  // 「魅せる守備」は投手も持てる（これまでどおり）
  if (s.target === 'batter' && isPitcher && s.id !== 'highlight_defense') return false
  if (s.pos === 'C' && p.mainPosition !== 'C') return false
  if (s.pos === 'IF' && !INFIELD.includes(p.mainPosition)) return false
  if (s.pos === 'OF' && !OUTFIELD.includes(p.mainPosition)) return false
  if (p.skills.includes(s.id)) return false
  // 上位を持っていれば下位は取らない
  if (s.upper && p.skills.includes(s.upper)) return false
  return !p.skills.some((o) => conflicts(o, s.id))
}

/** 偶然（特訓・試合・入部時など）で取れる良い能力の重み（Sと上位は出ない） */
export const RANDOM_WEIGHT: Record<SkillTier, number> = { S: 0, A: 1, B: 3, C: 4 }

/** 偶然で取れる良い能力の候補（重みつき） */
export function randomGoodPool(p: Pick<Player, 'mainPosition' | 'skills'>): { id: string; weight: number }[] {
  return SKILLS.filter((s) => s.good && !s.lower && !s.initialOnly && RANDOM_WEIGHT[s.tier] > 0 && canHave(p, s)).map((s) => ({
    id: s.id,
    weight: RANDOM_WEIGHT[s.tier],
  }))
}

/**
 * 能力を身につける（上位なら下位を置き換え、両立しない弱点は消す）。
 * 身につけたら true
 */
export function grantSkill(p: Player, id: string): boolean {
  const s = SKILL_MAP.get(id)
  if (!s || p.skills.includes(id)) return false
  if (s.upper && p.skills.includes(s.upper)) return false
  if (s.good) {
    // 両立しない弱点は、良い能力を身につけると消える
    p.skills = p.skills.filter((o) => !(conflicts(o, id) && !SKILL_MAP.get(o)?.good))
    if (s.lower) p.skills = p.skills.filter((o) => o !== s.lower)
  } else if (p.skills.some((o) => conflicts(o, id))) return false
  p.skills.push(id)
  return true
}

/** 持っている下位能力の上位版（名将の目・スカウト★5でまれに変化） */
export function upgradable(p: Pick<Player, 'mainPosition' | 'skills'>): string[] {
  return p.skills
    .map((id) => SKILL_MAP.get(id)?.upper)
    .filter((u): u is string => !!u && !p.skills.includes(u))
    .filter((u) => {
      const s = SKILL_MAP.get(u)!
      return canHave({ mainPosition: p.mainPosition, skills: p.skills.filter((x) => x !== s.lower) }, s)
    })
}
