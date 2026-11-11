// 選手育成モードの顔アイコン（物語の人物は専用、ほかの選手はみんな共通のモブ）
import type { FaceParts, SaveData } from '../types'
import { FIXED } from './clubs'
import type { FixedId } from './types'

let cache = new WeakMap<FaceParts, string>()
let cachedSave: SaveData | null = null
let cachedRev = -1

/** 顔の部品から、使うアイコンの名前を返す（選手育成モードでなければ null） */
export function faceIconName(save: SaveData | null, rev: number, face: FaceParts): string | null {
  if (!save?.story?.enabled) return null
  if (save !== cachedSave || rev !== cachedRev) {
    cachedSave = save
    cachedRev = rev
    cache = new WeakMap()
    const joined = save.story.success?.joined ?? {}
    const byPlayer = new Map<string, string>()
    for (const [fid, pid] of Object.entries(joined)) if (pid) byPlayer.set(pid, FIXED[fid as FixedId].char)
    for (const p of Object.values(save.players)) {
      const icon = p.storyCast === 'daichi' ? 'daichi' : p.storyCast === 'focus' ? 'focus' : (byPlayer.get(p.id) ?? 'mob')
      cache.set(p.face, icon)
    }
  }
  return cache.get(face) ?? 'mob'
}
