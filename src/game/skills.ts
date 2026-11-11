// 特殊能力の定義（名前はすべてこのゲーム独自のもの）

export type SkillTarget = 'batter' | 'pitcher' | 'all'

export interface SkillDef {
  id: string
  name: string
  description: string
  good: boolean
  target: SkillTarget
  /** 入部時に持っている確率 */
  initialRate: number
}

export const SKILLS: SkillDef[] = [
  // 打者の良い能力
  { id: 'first_pitch', name: '一球目の刺客', description: '初球を打つとき、当たりが良くなる', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'persistent', name: '粘りの鬼', description: '追い込まれてから、ファウルで粘りやすい', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'late_hero', name: '土壇場の主役', description: '8回以降、1点差以内の場面でミートとパワーが上がる', good: true, target: 'batter', initialRate: 0.02 },
  { id: 'leadoff', name: '一番槍', description: 'イニングの先頭で出塁しやすい', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'pinch_hitter', name: 'ベンチの秘密兵器', description: '代打で出たときに能力が上がる', good: true, target: 'batter', initialRate: 0.02 },
  { id: 'bases_loaded', name: '満塁ハンター', description: '満塁で長打が出やすい', good: true, target: 'batter', initialRate: 0.02 },
  { id: 'walkoff', name: 'サヨナラ請負人', description: 'サヨナラの場面で能力が上がる', good: true, target: 'batter', initialRate: 0.015 },
  { id: 'all_fields', name: '右へ左へ', description: '逆方向にも強い打球が飛ぶ', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'momentum', name: '波乗り打法', description: '前の打者がヒットだと打ちやすい', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'bunt', name: '犠牲の美学', description: '送りバントが成功しやすい', good: true, target: 'batter', initialRate: 0.04 },
  { id: 'rocket_start', name: 'ロケットスタート', description: '盗塁のスタートが良い', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'heads_up', name: '抜け目なし', description: '次の塁を狙う判断が成功しやすい', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'highlight_defense', name: '魅せる守備', description: '守備でファインプレーが出やすい', good: true, target: 'batter', initialRate: 0.03 },
  { id: 'battery_mate', name: '名女房', description: '捕手として出ると、投手の制球が安定する', good: true, target: 'batter', initialRate: 0.02 },
  // 投手の良い能力
  { id: 'full_throttle', name: '初回から全開', description: '1回の制球が安定する', good: true, target: 'pitcher', initialRate: 0.03 },
  { id: 'gear_change', name: 'ギアチェンジ', description: '回が進むほど球威が上がる', good: true, target: 'pitcher', initialRate: 0.02 },
  { id: 'finisher', name: 'とどめの一球', description: '2ストライクから空振りを取りやすい', good: true, target: 'pitcher', initialRate: 0.02 },
  { id: 'groundball', name: '内野ゴロ量産', description: '打球がゴロになりやすい', good: true, target: 'pitcher', initialRate: 0.03 },
  { id: 'iron_arm', name: '連投上等', description: '連投しても能力が落ちにくく、肩・肘の不安も抱えにくい', good: true, target: 'pitcher', initialRate: 0.015 },
  { id: 'tempo', name: 'テンポ番長', description: '少ない球数で打ち取りやすい', good: true, target: 'pitcher', initialRate: 0.03 },
  { id: 'no_steal', name: '盗塁お断り', description: '牽制で走者を刺しやすく、盗塁もされにくい', good: true, target: 'pitcher', initialRate: 0.03 },
  // 全員共通の良い能力
  { id: 'steel_heart', name: '鋼の心臓', description: '全国大会で能力が上がる', good: true, target: 'all', initialRate: 0.015 },
  { id: 'counterattack', name: '逆襲の狼煙', description: 'リードされている場面で能力が上がる', good: true, target: 'all', initialRate: 0.02 },
  { id: 'pillar', name: 'チームの大黒柱', description: '主将にすると、チーム全体の調子が安定する', good: true, target: 'all', initialRate: 0.015 },
  { id: 'bench_sun', name: 'ベンチの太陽', description: 'ベンチ入りしていると、チームの調子が上がる', good: true, target: 'all', initialRate: 0.02 },
  { id: 'hard_worker', name: '練習の虫', description: '練習での伸びが良い', good: true, target: 'all', initialRate: 0.03 },
  { id: 'summer_child', name: '真夏の申し子', description: '夏の大会で疲れにくい', good: true, target: 'all', initialRate: 0.02 },
  // 弱点
  { id: 'nervous', name: 'ガチガチ', description: '全国大会や決勝で能力が下がる', good: false, target: 'all', initialRate: 0.05 },
  { id: 'slow_starter', name: '寝起きが悪い', description: '1回の制球が乱れる', good: false, target: 'pitcher', initialRate: 0.05 },
  { id: 'out_of_gas', name: 'ガス欠', description: '7回以降に球威が落ちる', good: false, target: 'pitcher', initialRate: 0.05 },
  { id: 'glass_heart', name: 'ガラスのハート', description: '連打を浴びると制球が乱れる', good: false, target: 'pitcher', initialRate: 0.05 },
  { id: 'fan', name: '扇風機', description: '空振りが多い（強振のときはなおさら）', good: false, target: 'batter', initialRate: 0 },
  { id: 'double_play', name: 'ゲッツー量産', description: '内野ゴロや併殺打が多い', good: false, target: 'batter', initialRate: 0.05 },
  { id: 'meatball', name: 'ど真ん中癖', description: '長打を浴びやすい', good: false, target: 'pitcher', initialRate: 0.04 },
  { id: 'sign_lost', name: 'サイン迷子', description: '采配の指示が失敗しやすい', good: false, target: 'all', initialRate: 0.04 },
  { id: 'lazy', name: 'サボり魔', description: '練習での伸びが悪い', good: false, target: 'all', initialRate: 0.04 },
  { id: 'heat_weak', name: '夏バテ体質', description: '夏の大会で疲れやすい', good: false, target: 'all', initialRate: 0.04 },
]

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]))

export function getSkill(id: string): SkillDef | undefined {
  return SKILL_MAP.get(id)
}

/** 同時に持てない組み合わせ（良い能力と、その反対の弱点） */
export const CONFLICTING_SKILLS: [string, string][] = [
  ['full_throttle', 'slow_starter'],
  ['steel_heart', 'nervous'],
  ['summer_child', 'heat_weak'],
  ['hard_worker', 'lazy'],
  ['gear_change', 'out_of_gas'],
  ['groundball', 'meatball'],
]

export function conflicts(a: string, b: string): boolean {
  return CONFLICTING_SKILLS.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}
