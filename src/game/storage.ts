// スマホ内（IndexedDB）への保存。セーブ枠ごとに2世代を残し、圧縮して保存する

import { openDB, type IDBPDatabase } from 'idb'
import { SAVE_SLOTS, SAVE_VERSION } from './constants'
import { checksum, gunzip, gzip, summarize, unpackSave, type StoredSave } from './serialize'
import type { SaveData, SaveSummary } from './types'

const DB_NAME = 'hs-baseball-manager'
const STORE = 'saves'

interface SlotPointer {
  /** 新しい方の世代（'a' か 'b'） */
  latest: 'a' | 'b'
  summary: SaveSummary
}

/** IndexedDBに入れる形（中身はgzipで圧縮） */
interface StoredRecord {
  data: Blob
  checksum: string
  savedAt: string
}

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

const pointerKey = (slot: number) => `slot${slot}:pointer`
const genKey = (slot: number, gen: 'a' | 'b') => `slot${slot}:${gen}`
const backupKey = (slot: number) => `slot${slot}:before-migration`

/** ブラウザに「保存データを消さない」よう求める（容量不足時の自動削除を防ぐ） */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

async function toRecord(save: SaveData): Promise<StoredRecord> {
  const json = JSON.stringify(save)
  return { data: await gzip(json), checksum: checksum(json), savedAt: new Date().toISOString() }
}

async function fromRecord(record: StoredRecord | undefined): Promise<{ save: SaveData | null; raw: StoredSave | null }> {
  if (!record?.data) return { save: null, raw: null }
  try {
    const raw: StoredSave = { json: await gunzip(record.data), checksum: record.checksum, savedAt: record.savedAt }
    return { save: null, raw }
  } catch {
    return { save: null, raw: null }
  }
}

/**
 * 保存する。古い方の世代に書いてから、新しい方を指すように切り替える。
 * 書いている最中に電池が切れても、もう一方の世代が残る。
 */
export async function writeSave(save: SaveData): Promise<void> {
  const record = await toRecord(save)
  const d = await db()
  const pointer = (await d.get(STORE, pointerKey(save.slot))) as SlotPointer | undefined
  const target: 'a' | 'b' = pointer?.latest === 'a' ? 'b' : 'a'
  const tx = d.transaction(STORE, 'readwrite')
  await tx.store.put(record, genKey(save.slot, target))
  await tx.store.put({ latest: target, summary: summarize(save) } satisfies SlotPointer, pointerKey(save.slot))
  await tx.done
}

export interface LoadResult {
  save: SaveData | null
  /** 新しい世代が壊れていて、1つ前から復旧した */
  recovered: boolean
}

async function loadGeneration(slot: number, gen: 'a' | 'b'): Promise<SaveData | null> {
  const d = await db()
  const { raw } = await fromRecord((await d.get(STORE, genKey(slot, gen))) as StoredRecord | undefined)
  if (!raw) return null
  // 古い版のデータなら、変換する前に元のデータを残す
  const version = Number(/"version":(\d+)/.exec(raw.json.slice(0, 40))?.[1] ?? SAVE_VERSION)
  if (version < SAVE_VERSION) await d.put(STORE, raw, backupKey(slot))
  return unpackSave(raw)
}

export async function readSave(slot: number): Promise<LoadResult> {
  const d = await db()
  const pointer = (await d.get(STORE, pointerKey(slot))) as SlotPointer | undefined
  if (!pointer) return { save: null, recovered: false }
  const older: 'a' | 'b' = pointer.latest === 'a' ? 'b' : 'a'
  const latest = await loadGeneration(slot, pointer.latest)
  if (latest) return { save: latest, recovered: false }
  const fallback = await loadGeneration(slot, older)
  return { save: fallback, recovered: !!fallback }
}

export async function listSlots(): Promise<(SaveSummary | null)[]> {
  const d = await db()
  const result: (SaveSummary | null)[] = []
  for (let slot = 1; slot <= SAVE_SLOTS; slot++) {
    const pointer = (await d.get(STORE, pointerKey(slot))) as SlotPointer | undefined
    result.push(pointer?.summary ?? null)
  }
  return result
}

export async function deleteSlot(slot: number): Promise<void> {
  const d = await db()
  const tx = d.transaction(STORE, 'readwrite')
  await tx.store.delete(pointerKey(slot))
  await tx.store.delete(genKey(slot, 'a'))
  await tx.store.delete(genKey(slot, 'b'))
  await tx.store.delete(backupKey(slot))
  await tx.done
}
