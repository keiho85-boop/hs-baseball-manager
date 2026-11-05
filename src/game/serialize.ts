// セーブデータの書き出し・読み込み用の変換（IndexedDBに依存しない部分）

import { SAVE_VERSION, prefName } from './constants'
import type { Player, Position, SaveData, SaveSummary } from './types'

/** 改ざん・破損を見つけるための簡易チェックサム（FNV-1a） */
export function checksum(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export interface StoredSave {
  json: string
  checksum: string
  savedAt: string
}

export function packSave(save: SaveData): StoredSave {
  const json = JSON.stringify(save)
  return { json, checksum: checksum(json), savedAt: new Date().toISOString() }
}

/** 壊れていれば null を返す */
export function unpackSave(stored: StoredSave | undefined): SaveData | null {
  if (!stored || typeof stored.json !== 'string') return null
  if (checksum(stored.json) !== stored.checksum) return null
  try {
    return migrate(JSON.parse(stored.json) as SaveData)
  } catch {
    return null
  }
}

/**
 * 古い版のセーブデータを新しい版に変換する。
 * 版を上げるときは、ここに「版N→N+1」の変換を追加する。
 */
export function migrate(data: SaveData): SaveData {
  if (typeof data.version !== 'number') throw new Error('セーブデータの形式が不正です')
  if (data.version > SAVE_VERSION) {
    throw new Error('このセーブデータは、より新しい版のゲームで作られています。ゲームを更新してください。')
  }
  // 例：if (data.version === 1) { ...変換...; data.version = 2 }
  // 以前の版で体力などが小数になっていたデータを整数に直す
  for (const p of Object.values(data.players ?? {})) {
    p.condition.stamina = Math.round(p.condition.stamina)
    p.condition.motivation = Math.round(p.condition.motivation)
  }
  // 守備適性の決まりを変えた（本職が基本、サブは多くて1つ、外野はまとめる）
  if (!data.aptRule2) {
    for (const p of Object.values(data.players ?? {})) normalizeAptitude(p)
    data.aptRule2 = true
  }
  return data
}

export function summarize(save: SaveData): SaveSummary {
  return {
    slot: save.slot,
    schoolName: save.schools[save.playerSchoolId]?.name ?? '不明',
    prefName: prefName(save.prefCode),
    managerName: save.managerName,
    year: save.calendar.year,
    week: save.calendar.week,
    updatedAt: save.updatedAt,
  }
}

/** 文字列をgzipで圧縮する */
export async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return await new Response(stream).blob()
}

/** gzipを展開して文字列に戻す */
export async function gunzip(blob: Blob): Promise<string> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}

const EXPORT_MAGIC = 'HSBM1'

/** 書き出し用：gzipで圧縮したファイルの中身を作る */
export async function exportToBlob(save: SaveData): Promise<Blob> {
  const packed = packSave(save)
  return await gzip(JSON.stringify({ magic: EXPORT_MAGIC, ...packed }))
}

/** 読み込み用：書き出したファイルからセーブデータを取り出す */
export async function importFromBlob(blob: Blob): Promise<SaveData> {
  let text: string
  try {
    text = await gunzip(blob)
  } catch {
    throw new Error('ファイルを読み込めませんでした。このゲームで書き出したファイルか確認してください。')
  }
  let parsed: { magic?: string } & Partial<StoredSave>
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('ファイルの中身が壊れています。')
  }
  if (parsed.magic !== EXPORT_MAGIC) throw new Error('このゲームのセーブファイルではありません。')
  const save = unpackSave(parsed as StoredSave)
  if (!save) throw new Error('ファイルの中身が壊れています。')
  return save
}

const OF: Position[] = ['LF', 'CF', 'RF']
/** 以前の版の選手の守備適性を、今の決まりに合わせる */
function normalizeAptitude(p: Player): void {
  const a = p.fielding.aptitude
  const groups: Position[][] = [['C'], ['1B'], ['2B'], ['3B'], ['SS'], OF]
  const main = p.mainPosition
  const mainGroup = groups.find((g) => g.includes(main)) ?? [main]
  const val = (g: Position[]) => Math.max(...g.map((x) => a[x] ?? 0))
  // 本職以外で一番高いもの（コンバート中の位置を優先）を、4人に1人ほど残す
  const others = groups.filter((g) => g !== mainGroup && val(g) > 0).sort((x, y) => val(y) - val(x))
  const conv = p.convertTo ? groups.find((g) => g.includes(p.convertTo!)) : undefined
  let keep = conv && val(conv) > 0 ? conv : others[0]
  const hash = [...p.id].reduce((s, c) => s + c.charCodeAt(0), 0)
  if (keep !== conv && hash % 4 !== 0) keep = undefined
  const keepVal = keep ? Math.min(2, val(keep)) : 0
  const pVal = main === 'P' ? 3 : a.P >= 2 && hash % 5 === 0 ? 1 : 0
  for (const x of Object.keys(a) as Position[]) a[x] = 0
  for (const x of mainGroup) a[x] = 3
  if (keep) for (const x of keep) a[x] = Math.max(a[x], keepVal)
  a.P = Math.max(a.P, pVal)
}
