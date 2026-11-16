// 出来事の結果の文を「良いこと」「悪いこと」に分けて、色と効果音を決める
// 良いこと＝青字、悪いこと＝赤字。「」の中のせりふは判定しない

export type Tone = 'good' | 'bad' | null
export interface Seg {
  text: string
  tone: Tone
}

const GOOD = /部費\s*[+＋]|上がった|上がる|回復|増えた|身につけた|克服|入部|伸びた|手に入れ|治った|開花|絶好調|好調になった|寄付|届いた|強化|つながった|ぐっすり/
const BAD = /下がった|減った|ケガ|故障|全治|違和感|不安|悪化|断られ|失敗|消えた|後遺症|痛め|欠場|棄権|悔し|眠れなかった|休めなかった/
const COIN = /部費[^。）]*(増え|\+|＋|入った|届いた)|寄付|万円/

/** 文を区切る（。！？の後と、（ ）の前後で切る） */
function chunks(text: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote = 0
  for (const ch of text) {
    if (ch === '（' && quote === 0 && cur) {
      out.push(cur)
      cur = ''
    }
    cur += ch
    if (ch === '「') quote += 1
    else if (ch === '」') quote = Math.max(0, quote - 1)
    else if (quote === 0 && /[。！？）]/.test(ch)) {
      out.push(cur)
      cur = ''
    }
  }
  if (cur) out.push(cur)
  return out
}

/** せりふ（「」の中）を除いた文 */
function narration(s: string): string {
  return s.replace(/「[^」]*」/g, '')
}

export function toneOf(s: string): Tone {
  const n = narration(s)
  const bad = BAD.test(n)
  const good = GOOD.test(n)
  if (bad && !good) return 'bad'
  if (good && !bad) return 'good'
  if (good && bad) return /下がった|減った/.test(n) && !/上がった/.test(n) ? 'bad' : 'good'
  return null
}

export function segments(text: string): Seg[] {
  return chunks(text).map((t) => ({ text: t, tone: toneOf(t) }))
}

/** 文全体の効果音：部費が増えた→チャリン、悪いことが多い→悪い音、良いことがある→良い音 */
export function moodOf(text: string): 'coin' | 'good' | 'bad' | null {
  const segs = segments(text)
  const n = narration(text)
  if (COIN.test(n) && !/部費[^。）]*(減|使)/.test(n)) return 'coin'
  const g = segs.filter((x) => x.tone === 'good').length
  const b = segs.filter((x) => x.tone === 'bad').length
  if (b > g) return 'bad'
  if (g > 0) return 'good'
  if (b > 0) return 'bad'
  return null
}
