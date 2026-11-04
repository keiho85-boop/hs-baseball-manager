// 打席結果の短い表記（例：二ゴロ、右中本、三振）

import type { PlayEvent } from './types'

const POS_SHORT: [string, string][] = [
  ['ピッチャー', '投'],
  ['キャッチャー', '捕'],
  ['ファースト', '一'],
  ['セカンド', '二'],
  ['サード', '三'],
  ['ショート', '遊'],
  ['レフト', '左'],
  ['センター', '中'],
  ['ライト', '右'],
  ['三塁線', '三'],
  ['一塁線', '一'],
]

export function shortResult(e: PlayEvent): string {
  const text = e.text.split('：').slice(1).join('：') || e.text
  const pos = POS_SHORT.find(([k]) => text.includes(k))?.[1] ?? ''
  switch (e.kind) {
    case 'single':
      return text.includes('内野安打') ? '内安' : text.includes('バント') ? 'バ安' : `${pos}安`
    case 'double':
      return `${pos}2`
    case 'triple':
      return `${pos}3`
    case 'homerun':
      return `${pos}本`
    case 'groundout':
      return `${pos}ゴロ`
    case 'flyout':
    case 'popout':
      return `${pos}飛`
    case 'lineout':
      return `${pos}直`
    case 'doubleplay':
      return `${pos}併打`
    case 'sacbunt':
      return '犠打'
    case 'sacfly':
      return `${pos}犠飛`
    case 'error':
      return `${pos}失`
    case 'fielderschoice':
      return '野選'
    case 'strikeout':
      return '三振'
    case 'walk':
      return text.includes('敬遠') ? '敬遠' : '四球'
    case 'hbp':
      return '死球'
    case 'buntfail':
      return 'バ失敗'
    default:
      return ''
  }
}

/** ヒットや得点など、目立たせたい結果か */
export function isGoodResult(e: PlayEvent): boolean {
  return ['single', 'double', 'triple', 'homerun'].includes(e.kind) || e.runs > 0
}
