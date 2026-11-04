// バランス確認用（npm run balance で実行。通常のテストには含めない）
import { it } from 'vitest'
import { createNewGame } from '../src/game/world'
import { advanceWeek } from '../src/game/season'
import { formatReport, runBalance } from '../src/game/match/balance'

it('バランス確認', { timeout: 600000 }, () => {
  const save = createNewGame({
    slot: 1,
    managerName: 'テスト',
    prefCode: 27,
    kind: 'public',
    schoolName: 'テスト高校',
    settings: { injury: 'normal', luck: 'normal', cutin: true, gameSpeed: 2, lightMode: false },
    seed: Number(process.env.SEED ?? 1),
  })
  // 夏の大会の頃（7月）の戦力で比べる
  const weeks = Number(process.env.WEEKS ?? 15)
  for (let i = 0; i < weeks; i++) advanceWeek(save)
  const report = runBalance(save, Number(process.env.GAMES ?? 2000))
  console.log('\n' + formatReport(report))
  require('node:fs').writeFileSync('/tmp/balance.txt', formatReport(report))
})
