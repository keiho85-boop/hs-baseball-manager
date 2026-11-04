// 状態を保存できる乱数（xoshiro128**）
// 乱数の状態をセーブデータに含めることで、中断・再起動しても同じ結果になる（やり直し防止）

export class Rng {
  private s: Uint32Array

  constructor(state: number[]) {
    if (state.length !== 4) throw new Error('乱数の状態が不正です')
    this.s = new Uint32Array(state)
    if (this.s.every((v) => v === 0)) this.s[0] = 1
  }

  /** 数値の種から乱数を作る */
  static fromSeed(seed: number): Rng {
    let x = seed >>> 0
    const next = () => {
      // splitmix32
      x = (x + 0x9e3779b9) >>> 0
      let z = x
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0
      return (z ^ (z >>> 16)) >>> 0
    }
    return new Rng([next(), next(), next(), next()])
  }

  getState(): number[] {
    return Array.from(this.s)
  }

  private nextUint32(): number {
    const s = this.s
    const result = Math.imul(rotl(Math.imul(s[1]!, 5) >>> 0, 7), 9) >>> 0
    const t = (s[1]! << 9) >>> 0
    s[2] = (s[2]! ^ s[0]!) >>> 0
    s[3] = (s[3]! ^ s[1]!) >>> 0
    s[1] = (s[1]! ^ s[2]!) >>> 0
    s[0] = (s[0]! ^ s[3]!) >>> 0
    s[2] = (s[2]! ^ t) >>> 0
    s[3] = rotl(s[3]!, 11)
    return result
  }

  /** 0以上1未満 */
  next(): number {
    return this.nextUint32() / 4294967296
  }

  /** min以上max以下の整数 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  /** 確率pで true */
  chance(p: number): boolean {
    return this.next() < p
  }

  /** 正規分布に近い乱数（平均mean、標準偏差sd） */
  normal(mean: number, sd: number): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('空の配列からは選べません')
    return items[Math.floor(this.next() * items.length)]!
  }

  /** 重み付きで選ぶ */
  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, i) => sum + i.weight, 0)
    let r = this.next() * total
    for (const item of items) {
      r -= item.weight
      if (r < 0) return item.value
    }
    return items[items.length - 1]!.value
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1))
      ;[items[i], items[j]] = [items[j]!, items[i]!]
    }
    return items
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
