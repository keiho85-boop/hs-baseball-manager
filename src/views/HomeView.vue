<script setup lang="ts">
import GameIcon from '@/components/GameIcon.vue'
import { computed, ref, watch } from 'vue'
import { useGuideStore } from '@/stores/guide'
import { useRouter } from 'vue-router'
import { useGameStore } from '@/stores/game'
import { useUiStore } from '@/stores/ui'
import { POSITION_LABEL, rankOf, SEASON_WEEKS, WEEKS_PER_YEAR, formatWeek, weekToDate } from '@/game/constants'
import { fielderRating, pitcherRating, playerRating } from '@/game/player'
import RankBadge from '@/components/RankBadge.vue'
import FaceIcon from '@/components/FaceIcon.vue'
import FieldScene from '@/components/FieldScene.vue'
import SugorokuBoard from '@/components/sugoroku/SugorokuBoard.vue'
import CardHand from '@/components/sugoroku/CardHand.vue'
import EventDialog from '@/components/sugoroku/EventDialog.vue'
import PlayerSheet from '@/components/PlayerSheet.vue'
import { BOARD_SIZE, CARD_EFFECT_DESC, SQUARES } from '@/game/sugoroku'
import type { School, SquareType } from '@/game/types'
import TournamentPanel from '@/components/tournament/TournamentPanel.vue'
import BracketSheet from '@/components/tournament/BracketSheet.vue'
import BoardRefresh from '@/components/sugoroku/BoardRefresh.vue'
import TabIcon from '@/components/TabIcon.vue'
import { play } from '@/sound'
import { portraitUrl } from '@/game/story/art'
import { chapterGoal } from '@/game/story/engine'
import { canRequestPractice, currentTournament, ownAlive, ownPlayedThisWeek, pendingOwnGame } from '@/game/tournament'
import RecruitSheet from '@/components/success/RecruitSheet.vue'
import EndingCard from '@/components/success/EndingCard.vue'
import FacilityPanel from '@/components/FacilityPanel.vue'
import OrderBoard from '@/components/OrderBoard.vue'
import InfoSheet from '@/components/InfoSheet.vue'
import type { EvalKey } from '@/game/success/types'
import { AUTO_WEEKS, EVAL_KEYS, EVAL_LABEL, EVAL_NOTE, evalStars, focusPlayer, repRank, rosterCount, successOf } from '@/game/success/state'
import type { ClubId } from '@/game/success/types'

const game = useGameStore()
const ui = useUiStore()
const router = useRouter()
const picking = ref(false)

/** 練習試合の相手（同じ都道府県の、選手を個別に持つ学校） */
const opponents = computed(() => {
  void game.rev
  const s = game.save
  if (!s) return []
  return Object.values(s.schools)
    .filter((x) => x.prefCode === s.prefCode && x.detailed && x.id !== s.playerSchoolId)
    .sort((a, b) => b.overall - a.overall)
})

// ---- 大会 ----
const tournament = computed(() => {
  void game.rev
  return game.save ? currentTournament(game.save) : null
})
const pendingGame = computed(() => {
  void game.rev
  return game.save ? pendingOwnGame(game.save) : null
})
/** この週は大会の試合がある（または戦い終えた）ので、すごろくの代わりに大会パネルを出す */
const tournamentWeek = computed(() => {
  void game.rev
  return !!game.save && !!tournament.value && (!!pendingGame.value || ownPlayedThisWeek(game.save))
})
const aliveInTournament = computed(() => !!game.save && !!tournament.value && ownAlive(game.save, tournament.value))
const bracketOpen = ref(false)

async function startTournament(): Promise<void> {
  const forfeit = await game.startTournamentMatch()
  if (forfeit) {
    await ui.alert(forfeit.join('\n'), '棄権')
    return
  }
  if (game.match) await router.push({ name: 'match' })
}

// ---- サクセス（1人の選手を3年間育てる） ----
const success = computed(() => {
  void game.rev
  return game.save ? successOf(game.save) : null
})
const focus = computed(() => {
  void game.rev
  return game.save ? focusPlayer(game.save) : null
})
const roster = computed(() => {
  void game.rev
  return game.save ? rosterCount(game.save) : 0
})
/** 年末と春休みは、自主練習で自動に進む（1年を約40ターンにする） */
const autoWeek = computed(() => {
  void game.rev
  return !!success.value && AUTO_WEEKS.includes(game.save?.calendar.week ?? 0) && !sg.value?.pending
})
const ended = computed(() => {
  void game.rev
  return (game.save ? successOf(game.save)?.ended : null) ?? null
})
const recruitOpen = ref(false)
const orderOpen = ref(false)
/** 育成終了：選手の保存はドラフトの場面で済んでいるので、セーブデータは消してタイトルへ */
async function finishScenario(): Promise<void> {
  const slot = game.save?.slot
  if (slot) await game.removeSlot(slot)
  game.closeGame()
  await router.replace({ name: 'title' })
}
/** ホーム上部に出す育成選手の主な能力（部員表の「能力1」と同じ項目） */
const focusStats = computed(() => {
  const p = focus.value
  if (!p) return []
  if (p.mainPosition === 'P') {
    const brk = p.pitching.pitches.reduce((a, x) => a + x.level, 0)
    return [
      { k: '球速', r: '', v: String(p.pitching.velocity) },
      { k: '制球', r: rankOf(p.pitching.control), v: '' },
      { k: 'スタ', r: rankOf(p.pitching.stamina), v: '' },
      { k: 'キレ', r: rankOf(p.pitching.kire), v: '' },
      { k: '変化', r: '', v: String(brk) },
    ]
  }
  return [
    { k: 'ミート', r: rankOf(p.batting.contact), v: '' },
    { k: 'パワー', r: rankOf(p.batting.power), v: '' },
    { k: '走力', r: rankOf(p.running.speed), v: '' },
    { k: '肩力', r: rankOf(p.fielding.arm), v: '' },
    { k: '守備', r: rankOf(p.fielding.range), v: '' },
  ]
})

const BASE = import.meta.env.BASE_URL
/** 評価の顔アイコン */
const EVAL_ICON: Record<EvalKey, string> = {
  nagi: 'nagi',
  makabe: 'makabe',
  hasumi: 'hasumi',
  daichi: 'daichi',
  team: 'mob',
  genzo: 'genzo',
  scout: 'scout',
}
function motivationLabel(v: number): string {
  return v >= 80 ? '絶好調' : v >= 60 ? '好調' : v >= 40 ? 'ふつう' : v >= 20 ? '不調' : '絶不調'
}

async function goRecruit(club: ClubId, target?: number): Promise<void> {
  recruitOpen.value = false
  const r = await game.recruitAt(club, target)
  if (!r) return
  play(r.result.success ? 'cheer' : 'miss')
  await ui.alert(r.result.lines.join('\n'), r.result.title)
  const important = r.week.messages.filter((m) => IMPORTANT.some((k) => m.includes(k)) && !m.includes('治った'))
  if (important.length > 0) await ui.alert(important.join('\n'), '今週の出来事')
}

async function autoAdvance(): Promise<void> {
  const r = await game.nextWeek()
  if (!r) return
  if (r.messages.length > 0) ui.notify({ title: '今週の出来事', message: r.messages[r.messages.length - 1]!, tone: 'info' })
}

function stars(v: number): string {
  const n = evalStars(v)
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

async function nextTournamentWeek(): Promise<void> {
  const r = await game.nextTournamentWeek()
  if (!r) return
  const important = r.messages.filter((m) => IMPORTANT.some((k) => m.includes(k)) && !m.includes('治った'))
  if (important.length > 0) await ui.alert(important.join('\n'), '今週の出来事')
  else if (r.messages.length > 0) ui.notify({ title: '今週の出来事', message: r.messages[r.messages.length - 1]!, tone: 'info' })
}

async function startMatch(id: string): Promise<void> {
  picking.value = false
  await game.startPracticeMatch(id)
  await router.push({ name: 'match' })
}

function canPractice(o: School): boolean {
  const own = game.ownSchool()
  return !!own && canRequestPractice(own, o)
}

const members = computed(() => game.ownPlayers().filter((p) => !p.retired))
const school = computed(() => game.ownSchool())

const milestone = computed(() => {
  void game.rev
  const week = game.save?.calendar.week ?? 1
  const items = [
    { week: SEASON_WEEKS.thirdYearRetire, label: '3年生の引退' },
    { week: SEASON_WEEKS.graduation, label: '卒業式' },
    { week: WEEKS_PER_YEAR + 1, label: '新年度' },
  ]
  const next = items.find((i) => i.week >= week) ?? items[items.length - 1]!
  return { label: next.label, weeks: next.week - week }
})

/** 夕方の景色にする時期（夏の終わり〜秋） */
const evening = computed(() => {
  void game.rev
  const m = weekToDate(game.save?.calendar.week ?? 1).month
  return m >= 9 && m <= 11
})

const summary = computed(() => {
  const list = members.value
  const injured = list.filter((p) => p.condition.injury).length
  const byGrade = [1, 2, 3].map((g) => list.filter((p) => p.grade === g).length)
  const helpers = list.filter((p) => p.helper).length
  const top = [...list].sort((a, b) => playerRating(b) - playerRating(a)).slice(0, 3)
  const goodForm = list.filter((p) => p.condition.form >= 4).length
  return { count: list.length, injured, byGrade, helpers, top, goodForm }
})

/** チームとしての主な能力（レギュラー格の野手9人の平均と、エース投手）とチームの体力 */
const teamPower = computed(() => {
  const list = members.value
  const fielders = list.filter((p) => p.mainPosition !== 'P').sort((a, b) => fielderRating(b) - fielderRating(a)).slice(0, 9)
  const base = fielders.length ? fielders : list
  const avg = (f: (p: (typeof list)[number]) => number) => (base.length ? Math.round(base.reduce((a, p) => a + f(p), 0) / base.length) : 0)
  const ace = [...list].sort((a, b) => pitcherRating(b) - pitcherRating(a))[0]
  const stamina = list.length ? Math.round(list.reduce((a, p) => a + p.condition.stamina, 0) / list.length) : 0
  return {
    items: [
      { label: 'ミート', value: avg((p) => p.batting.contact) },
      { label: 'パワー', value: avg((p) => p.batting.power) },
      { label: '走力', value: avg((p) => p.running.speed) },
      { label: '守備', value: avg((p) => (p.fielding.range + p.fielding.catching + p.fielding.arm + p.fielding.throwing) / 4) },
      { label: '投手', value: ace ? pitcherRating(ace) : 0 },
    ],
    stamina,
  }
})

/** ストーリーありのとき：ナギのひとこと（その週の状況に合わせる） */
const nagiSmile = ref(false)
const nagiTip = computed(() => {
  void game.rev
  const s = game.save
  if (!s?.story?.enabled) return null
  const st = s.story
  const t = currentTournament(s)
  if (t && !t.finished && ownAlive(s, t)) return `${t.name}です。勝ち方を、一つずつ覚えていきましょう`
  if (sg.value && sg.value.campWeeks > 0) return '合宿中です。よく伸びますが、疲れもたまります。休みのマスも忘れずに'
  if (teamPower.value.stamina < 50) return 'みんな疲れています。休みのマスも狙いましょう'
  if (st.chapter >= 2) return '第2章は準備中です。それまでは、このまま部を育てていきましょう'
  const sc = successOf(s)
  if (sc) {
    if (roster.value < 9) return `部員はいま${roster.value}人です。「勧誘」で9人そろえれば、練習試合と大会に出られます`
    const tips = [
      'マスに付いた人のイベントも狙いましょう。スカウトのマスは、プロ入りへの近道です',
      `${focus.value?.surname ?? 'あの子'}くんをプロに送るのが目標です。周りの評価も大事ですよ`,
      '練習試合で勝つと、評判とチームの評価が上がります',
      '勧誘ばかりだと、練習が足りなくなります。ほどほどに',
    ]
    return tips[s.calendar.week % tips.length]!
  }
  const lines = [
    '狙ったマスに止まるよう、カードの数字を選んでください',
    '練習試合は、下の「練習試合」から申し込めます。実戦の経験も大事です',
    '打順は「チーム」の画面で入れ替えられます。2番に一番いい打者、です',
    'スカウトは「学校」の画面から。来年の戦力は、今年の秋に決まります',
    `目標は、3年目の夏に全国です。…ノートの1ページ目に、そう書きましたから`,
  ]
  return lines[s.calendar.week % lines.length]!
})

/** ストーリーありのとき：第1章の目標と、今年の目安 */
const goal = computed(() => {
  void game.rev
  return game.save ? chapterGoal(game.save) : null
})

const recentLog = computed(() => {
  void game.rev
  return [...(game.save?.log ?? [])].reverse().slice(0, 12)
})

const sg = computed(() => {
  void game.rev
  return game.save?.sugoroku ?? null
})
const selected = ref<number | null>(null)
const displayPos = ref<number | null>(null)
const moving = ref(false)
const eventOpen = ref(false)
const specialOpen = ref(false)
const viewing = ref<string | null>(null)
const info = ref<'team' | 'log' | null>(null)

const preview = computed(() => {
  const s = sg.value
  if (!s || selected.value === null) return null
  const c = s.hand[selected.value]
  return c ? (s.position + c.value) % BOARD_SIZE : null
})

function squareName(sq: SquareType): string {
  return SQUARES[sq].label
}

function selectCard(i: number): void {
  selected.value = selected.value === i ? null : i
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function go(): Promise<void> {
  if (selected.value === null || moving.value) return
  const idx = selected.value
  selected.value = null
  const start = sg.value?.position ?? 0
  moving.value = true
  displayPos.value = start
  const r = await game.useCard(idx)
  if (!r) {
    moving.value = false
    displayPos.value = null
    return
  }
  play('card')
  for (const pos of r.path) {
    displayPos.value = pos
    play('step')
    await sleep(170)
  }
  await sleep(250)
  moving.value = false
  displayPos.value = null
  afterLand()
}

function afterLand(): void {
  const pending = sg.value?.pending
  if (!pending) return
  if (pending.event) eventOpen.value = true
  else if (pending.needsPlayer) specialOpen.value = true
  else void finish({})
}

async function onEventDone(choice: number): Promise<void> {
  eventOpen.value = false
  await finish({ choice })
}

async function onSpecial(id: string): Promise<void> {
  specialOpen.value = false
  await finish({ specialPlayerId: id })
}

const IMPORTANT = ['特殊能力', '克服', '違和感', '悪化', '全治', '入部した', '適性が', 'ドラフト', '入学を決め', '進学を決め']

async function finish(opts: { choice?: number; specialPlayerId?: string }): Promise<void> {
  const r = await game.finishSquare(opts)
  if (!r) return
  const important = r.week.messages.filter((m) => IMPORTANT.some((k) => m.includes(k)) && !m.includes('治った'))
  if (important.length > 0) await ui.alert(important.join('\n'), '今週の出来事')
  else if (r.week.messages.length > 0) ui.notify({ title: '今週の出来事', message: r.week.messages[r.week.messages.length - 1]!, tone: 'info' })
  if (r.week.backupPrompt) {
    const ok = await ui.confirm(
      '新しい年度になりました。\nスマホの故障や機種変更に備えて、セーブデータを書き出しておきませんか？',
      { title: 'バックアップのおすすめ', okLabel: '書き出す', cancelLabel: 'あとで' },
    )
    if (ok) await game.exportCurrent()
  }
}

const specialCandidates = computed(() =>
  game
    .ownPlayers()
    .filter((p) => !p.retired && !p.condition.injury)
    .sort((a, b) => playerRating(b) - playerRating(a)),
)
const info2 = ref(false)
/** 部員が9人に満たない間は、毎週はじめに勧誘をうながす */
const guideStore = useGuideStore()
const shortWarned = new Set<string>()
watch(
  () => {
    void game.rev
    const s = game.save
    if (!s || !success.value || ended.value || roster.value >= 9) return null
    if (game.story || guideStore.active || game.match || sg.value?.pending || game.busy) return null
    return `${s.calendar.year}-${s.calendar.week}`
  },
  async (key) => {
    if (!key || shortWarned.has(key)) return
    shortWarned.add(key)
    await ui.alert(`部員が足りていないよ！（いま${roster.value}人）\n勧誘しよう！`, '人数が足りない')
  },
  { immediate: true },
)

/** 選手育成モード：部員が9人に満たないまま大会の試合を迎えたら、そのまま棄権にする（勧誘に進めるように） */
const forfeited = new Set<string>()
watch(
  () => {
    void game.rev
    const pg = pendingGame.value
    if (!success.value || !pg || roster.value >= 9 || game.busy || game.match || game.story) return null
    return `${game.save?.calendar.year}-${game.save?.calendar.week}-${pg.round}`
  },
  async (key) => {
    if (!key || forfeited.has(key)) return
    forfeited.add(key)
    await startTournament()
  },
  { immediate: true },
)
</script>

<template>
  <div class="home" :class="{ 'with-tip': !!nagiTip, succ: !!success }">
    <div class="stage">
      <FieldScene :height="84" :evening="evening" />
      <!-- 選手育成モード：育てている選手の様子 -->
      <div v-if="success && focus" class="strip focus-strip">
        <button class="fs-face" aria-label="育成選手を見る" @click="router.push({ name: 'focus' })">
          <img :src="`${BASE}icon/icon_focus.webp`" alt="" />
        </button>
        <div class="fs-main">
          <div class="fs-name">
            <b>{{ focus.surname }}</b>
            <span class="fs-pos" :class="{ p: focus.mainPosition === 'P' }">{{ POSITION_LABEL[focus.mainPosition] }}</span>
            <RankBadge :value="playerRating(focus)" size="sm" />
            <span class="fs-stats">
              <span v-for="x in focusStats" :key="x.k" class="fs-st">
                <small>{{ x.k }}</small>
                <b :class="x.r ? `rk-${x.r}` : ''">{{ x.r || x.v }}</b>
              </span>
            </span>
          </div>
          <div class="fs-cond">
            <img :src="`${BASE}ui/ui_stamina.webp`" alt="体力" />
            <span class="bar"><i :style="{ width: `${focus.condition.stamina}%` }" :class="{ low: focus.condition.stamina < 50 }" /></span>
            <img :src="`${BASE}ui/ui_motivation.webp`" alt="やる気" />
            <b class="mot">{{ motivationLabel(focus.condition.motivation) }}</b>
          </div>
        </div>
        <button class="fs-eval" aria-label="まわりの評価" @click="info2 = true">
          <img :src="`${BASE}ui/ui_eval.webp`" alt="" />
          <small>評価</small>
        </button>
      </div>
      <div v-else class="strip">
        <div v-for="it in teamPower.items" :key="it.label" class="tp">
          <small>{{ it.label }}</small>
          <RankBadge :value="it.value" size="sm" />
        </div>
        <div class="tp stam">
          <small>チーム体力</small>
          <b :class="{ low: teamPower.stamina < 50 }">{{ teamPower.stamina }}</b>
          <span class="bar"><i :style="{ width: `${teamPower.stamina}%` }" :class="{ low: teamPower.stamina < 50 }" /></span>
        </div>
      </div>
    </div>

    <div class="page">
      <div v-if="nagiTip" class="nagi-tip" @click="nagiSmile = !nagiSmile">
        <img class="nagi-face" :src="portraitUrl('nagi', nagiSmile ? 'smile' : 'normal')" alt="ナギ" />
        <div class="nagi-say">
          <b>ナギ<span v-if="goal" class="goal" :class="{ done: goal.done }">今年の目安：{{ goal.target }}{{ goal.done ? ' ✓' : '' }}</span></b>{{ nagiTip }}
        </div>
      </div>
      <EndingCard v-if="ended" @title="finishScenario" />
      <div v-if="ended" class="end-spacer" />
      <button v-if="!ended && game.match" class="sun go" @click="router.push({ name: 'match' })">
        <span class="go-main">試合の続きへ</span>
        <span class="go-sub"><GameIcon name="play" :size="12" /> {{ game.match.options.label }}</span>
      </button>
      <TournamentPanel
        v-else-if="!ended && tournamentWeek && tournament"
        class="t-panel"
        :t="tournament"
        :schools="game.save!.schools"
        :own-id="game.save!.playerSchoolId"
        :pending="pendingGame ? { round: pendingGame.round, opponentId: pendingGame.opponentId } : null"
        :busy="game.busy"
        @start="startTournament"
        @next="nextTournamentWeek"
        @bracket="bracketOpen = true"
        @order="router.push({ name: 'team' })"
      />
      <template v-else-if="!ended && sg">
        <div class="card board-card" data-tut="board">
          <div class="board-fit">
            <SugorokuBoard
              :board="sg.board"
              :position="displayPos ?? sg.position"
              :preview="moving ? null : preview"
              :month="sg.boardMonth"
              :camp="sg.campWeeks > 0"
              :milestone="`${milestone.label}まで あと${milestone.weeks}週`"
              :card-note="selected !== null && sg.hand[selected] && sg.hand[selected]!.effect !== 'none' ? CARD_EFFECT_DESC[sg.hand[selected]!.effect] : null"
              :attach="sg.attach ?? null"
            />
          </div>
          <template v-if="autoWeek">
            <p class="auto-note muted">年末年始・春休みの週は、自主練習で進みます。</p>
            <button class="sun full go-btn" :disabled="game.busy" @click="autoAdvance"><GameIcon name="play" :size="14" /> 自主練習で1週間進む</button>
          </template>
          <template v-else-if="sg.pending && !moving">
            <button class="sun full go-btn" :disabled="game.busy" @click="afterLand">{{ squareName(sg.pending.square) }}マスの続きをする</button>
          </template>
          <template v-else>
            <div class="hand-wrap" data-tut="hand">
              <CardHand :hand="sg.hand" :selected="selected" :disabled="moving || game.busy" @select="selectCard" />
            </div>
            <button class="sun full go-btn" data-tut="go" :disabled="selected === null || moving || game.busy" @click="go">
              <GameIcon name="play" :size="14" /> {{ selected === null ? 'カードを選んでください' : `${sg.hand[selected]!.value}マス進む` }}
            </button>
          </template>
        </div>
      </template>

      <!-- 練習試合・チームの様子・出来事（詳しくはポップアップで） -->
      <div v-if="success && !ended" class="actions icons">
        <button
          v-if="tournament && aliveInTournament"
          class="ib"
          @click="bracketOpen = true"
        >
          <img :src="`${BASE}ui/ui_trophy.webp`" alt="" /><span>組み合わせ</span>
        </button>
        <button
          v-else
          class="ib"
          data-tut="recruit-btn"
          :disabled="!!game.match || !sg || game.busy || moving || !!sg?.pending || autoWeek"
          @click="recruitOpen = true"
        >
          <img :src="`${BASE}ui/ui_recruit.webp`" alt="" /><span>勧誘</span>
        </button>
        <button
          class="ib"
          data-tut="practice-match"
          :disabled="!!game.match || !sg || game.busy || moving || !!sg?.pending || roster < 9 || !!(tournament && (aliveInTournament || tournamentWeek))"
          @click="picking = true"
        >
          <img :src="`${BASE}ui/ui_practice_match.webp`" alt="" /><span>{{ roster < 9 ? '9人から' : '練習試合' }}</span>
        </button>
        <button class="ib" @click="info = 'team'">
          <img :src="`${BASE}ui/ui_club.webp`" alt="" /><span>部の様子</span><i v-if="summary.injured > 0" class="dot" />
        </button>
        <button class="ib" @click="info = 'log'">
          <img :src="`${BASE}ui/ui_news.webp`" alt="" /><span>出来事</span>
        </button>
      </div>
      <div v-else-if="!success" class="actions">
        <button
          v-if="tournament && (aliveInTournament || tournamentWeek) && !ended"
          class="sky practice-match"
          @click="bracketOpen = true"
        >
          <GameIcon name="trophy" :size="18" /> 組み合わせ
        </button>
        <button
          v-if="!(tournament && (aliveInTournament || tournamentWeek)) && !ended"
          class="sky practice-match"
          data-tut="practice-match"
          :disabled="!!game.match || !sg || game.busy || moving || !!sg.pending"
          @click="picking = true"
        >
          <GameIcon name="ball" :size="18" /> 練習試合
        </button>
        <button v-if="tournament && !aliveInTournament && !tournamentWeek" class="icon-btn" aria-label="大会の組み合わせ" @click="bracketOpen = true">
          <TabIcon name="records" :size="34" />
        </button>
        <button class="icon-btn" aria-label="チームの様子" @click="info = 'team'">
          <TabIcon name="pennant" :size="34" /><i v-if="summary.injured > 0" class="dot" />
        </button>
        <button class="icon-btn" aria-label="最近の出来事" @click="info = 'log'">
          <TabIcon name="news" :size="34" />
        </button>
      </div>
    </div>
    <div v-if="info" class="picker-backdrop" @click.self="info = null">
      <div class="picker card">
        <template v-if="info === 'team'">
          <h2 class="grass"><img v-if="success" class="h-icon" :src="`${BASE}ui/ui_club.webp`" alt="" /><GameIcon v-else name="cap" /> {{ success ? '部の様子' : 'チームの様子' }}</h2>
          <div class="stats">
            <div class="stat">
              <div class="num">{{ summary.count }}<small>人</small></div>
              <div class="muted">部員</div>
            </div>
            <div class="stat">
              <div class="num">{{ summary.goodForm }}<small>人</small></div>
              <div class="muted">好調</div>
            </div>
            <div class="stat">
              <div class="num" :class="{ warn: summary.injured > 0 }">{{ summary.injured }}<small>人</small></div>
              <div class="muted">ケガ人</div>
            </div>
          </div>
          <div class="grades">
            <span class="pill">1年 {{ summary.byGrade[0] }}人</span>
            <span class="pill">2年 {{ summary.byGrade[1] }}人</span>
            <span class="pill">3年 {{ summary.byGrade[2] }}人</span>
            <span v-if="summary.helpers > 0" class="pill gold">助っ人 {{ summary.helpers }}人</span>
          </div>
          <div v-if="summary.top.length" class="sub-h"><GameIcon name="star" :size="14" /> 注目の選手</div>
          <button v-for="(p, i) in summary.top" :key="p.id" class="star" @click="viewing = p.id">
            <span class="medal" :class="`m${i}`">{{ i + 1 }}</span>
            <FaceIcon :face="p.face" :size="42" />
            <span class="star-name">
              <b>{{ p.surname }} {{ p.givenName }}</b>
              <span class="muted">{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}</span>
            </span>
            <RankBadge :value="playerRating(p)" />
          </button>
          <template v-if="success">
            <div class="sub-h">部の設備と部費</div>
            <FacilityPanel />
            <button class="sky full order-btn" :disabled="roster < 9" @click="orderOpen = true; info = null">
              <GameIcon name="clipboard" :size="16" /> {{ roster < 9 ? 'オーダーは部員が9人そろってから' : 'オーダーを組む' }}
            </button>
          </template>
        </template>
        <template v-else>
          <h2><GameIcon name="megaphone" /> 最近の出来事</h2>
          <ul class="log">
            <li v-for="(l, i) in recentLog" :key="i">
              <span class="muted">{{ formatWeek(l.year, l.week) }}</span>
              <div>{{ l.text }}</div>
            </li>
          </ul>
        </template>
        <button class="secondary full" @click="info = null">閉じる</button>
      </div>
    </div>

    <InfoSheet v-if="orderOpen" @close="orderOpen = false">
      <h2 class="orange"><GameIcon name="clipboard" /> オーダー</h2>
      <OrderBoard />
    </InfoSheet>
    <RecruitSheet v-if="recruitOpen" @close="recruitOpen = false" @go="goRecruit" />
    <div v-if="info2 && success && focus" class="picker-backdrop" @click.self="info2 = false">
      <div class="picker card">
        <h2 class="grass"><img class="h-icon" :src="`${BASE}ui/ui_eval.webp`" alt="" /> {{ focus.surname }} {{ focus.givenName }}への評価</h2>
        <div class="evals">
          <div v-for="k in EVAL_KEYS" :key="k" class="ev-row">
            <img :src="`${BASE}icon/icon_${EVAL_ICON[k]}.webp`" alt="" />
            <span class="ev-name"><b>{{ EVAL_LABEL[k] }}</b><small>{{ EVAL_NOTE[k] }}</small></span>
            <span class="star-s">{{ stars(success.eval[k]) }}</span>
          </div>
        </div>
        <button class="sky full" @click="info2 = false; router.push({ name: 'focus' })">育成選手の画面へ</button>
        <button class="secondary full" @click="info2 = false">閉じる</button>
      </div>
    </div>
    <EventDialog v-if="eventOpen && sg?.pending?.event" :event="sg.pending.event" @done="onEventDone" />
    <div v-if="specialOpen" class="picker-backdrop">
      <div class="picker card">
        <h2 class="red"><GameIcon name="flame" /> 特訓する選手を選ぶ</h2>
        <p class="muted">選んだ選手は大きく伸び、特殊能力を覚えることもあります。そのぶん疲れます。</p>
        <div class="opp-list">
          <div v-for="p in specialCandidates" :key="p.id" class="opp-row">
            <button class="opp" @click="onSpecial(p.id)">
              <FaceIcon :face="p.face" :size="34" />
              <span class="opp-name">{{ p.surname }} {{ p.givenName }}<small>{{ p.grade }}年・{{ POSITION_LABEL[p.mainPosition] }}・体力{{ Math.round(p.condition.stamina) }}</small></span>
              <RankBadge :value="playerRating(p)" size="sm" />
            </button>
            <button class="secondary look" aria-label="能力を見る" @click="viewing = p.id"><GameIcon name="search" :size="16" /></button>
          </div>
        </div>
      </div>
    </div>
    <PlayerSheet v-if="viewing" :player-id="viewing" @close="viewing = null" />
    <BoardRefresh
      v-if="game.boardNotice && !game.showGrowth && sg && !eventOpen && !ui.dialog"
      :month="game.boardNotice"
      :board="sg.board"
      @close="game.boardNotice = null"
    />
    <BracketSheet v-if="bracketOpen && tournament" :t="tournament" :schools="game.save!.schools" :own-id="game.save!.playerSchoolId" @close="bracketOpen = false" />
    <div v-if="picking" class="picker-backdrop" @click.self="picking = false">
      <div class="picker card">
        <h2 class="grass"><GameIcon name="ball" /> 練習試合の相手を選ぶ</h2>
        <p class="muted">練習試合をした週は、すごろくの練習の代わりに試合を行います。強い相手ほど学ぶことも多くなります。強豪校と組むには、大会で結果を出して評判を上げる必要があります。</p>
        <div class="opp-list" data-tut="opp-list">
          <button v-for="o in opponents" :key="o.id" class="opp" :disabled="!canPractice(o)" @click="startMatch(o.id)">
            <span class="opp-name">{{ o.name }}<small>{{ o.kind === 'private' ? '私立' : '公立' }}{{ canPractice(o) ? '' : '・評判が足りず断られる' }}</small></span>
            <RankBadge :value="o.overall" />
          </button>
        </div>
        <button class="secondary full" @click="picking = false">やめる</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  --stage-h: 66px;
}
.home.with-tip {
  /* ナギのひとことの高さぶん、盤面を小さくして重ならないようにする */
  --tip-h: 64px;
}
.home.with-focus {
  --focus-h: 42px;
}
.home.with-tip .board-card {
  margin-top: 0;
}
.focus-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  margin: 0 0 8px;
  padding: 4px 8px;
  border-radius: 12px;
  background: #fff;
  color: var(--ink);
  text-shadow: none;
  box-shadow: inset 0 0 0 2px #ffd9b8;
  font-size: 12px;
  font-weight: 400;
  position: relative;
  z-index: 3;
}
.fb-item {
  margin-left: auto;
  white-space: nowrap;
}
.fb-item + .fb-item {
  margin-left: 6px;
}
.fb-item b.warn {
  color: var(--red);
}
.star-s {
  color: #f5a300;
  letter-spacing: -1px;
}
.end-card {
  margin-bottom: 12px;
}
.auto-note {
  text-align: center;
  margin: 12px 0 0;
}
.evals {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 6px 0 10px;
}
.ev-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
  border-bottom: 1px dashed #e2eef8;
}
.ev-row img {
  width: 40px;
  height: 40px;
  flex: none;
}
.ev-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ev-name b {
  font-size: 14px;
}
.ev-name small {
  font-size: 11px;
  color: var(--ink-soft);
}
.h-icon {
  width: 28px;
  height: 28px;
  vertical-align: middle;
}
.order-btn {
  margin-top: 10px;
}
/* ---- 選手育成モード：上の帯（育成選手の様子） ---- */
.focus-strip {
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
}
.fs-face,
.fs-eval {
  flex: none;
  padding: 0;
  background: transparent;
  box-shadow: none;
  border-radius: 12px;
}
.fs-face img {
  width: 46px;
  height: 46px;
  display: block;
}
.fs-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fs-name {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fs-name b {
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 3.5em;
  font-weight: 900;
}
.fs-stats {
  margin-left: auto;
  display: flex;
  gap: 2px;
}
.fs-st {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 24px;
  line-height: 1.05;
}
.fs-st small {
  font-size: 8px;
  font-weight: 800;
  color: var(--ink-soft);
  white-space: nowrap;
}
.fs-st b {
  font-size: 14px;
  font-weight: 900;
  font-style: italic;
}
.fs-pos {
  font-size: 11px;
  font-weight: 900;
  color: #fff;
  background: #2a6fd6;
  border-radius: 6px;
  padding: 0 6px;
}
.fs-pos.p {
  background: #e53935;
}
.fs-cond {
  display: flex;
  align-items: center;
  gap: 4px;
}
.fs-cond img {
  width: 18px;
  height: 18px;
}
.fs-cond .bar {
  flex: 1;
  height: 7px;
}
.fs-cond .mot {
  font-size: 12px;
  font-weight: 900;
  color: #d9731f;
  white-space: nowrap;
}
.fs-eval {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 50px;
}
.fs-eval img {
  width: 38px;
  height: 38px;
}
.fs-eval small {
  font-size: 10px;
  font-weight: 900;
  color: var(--ink);
  margin-top: -2px;
}
/* ---- 選手育成モード：下のボタン（絵＋短い文字） ---- */
.actions.icons {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}
.ib {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
  padding: 4px 2px 6px;
  border-radius: 16px;
  color: var(--ink);
  background:
    radial-gradient(120% 90% at 30% 10%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff, #e4eef9);
  box-shadow: inset 0 0 0 2px #cfe0f1, 0 4px 0 #b7cde3, 0 6px 10px rgba(0, 0, 0, 0.12);
}
.ib:active:not(:disabled) {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 2px #cfe0f1, 0 1px 0 #b7cde3;
}
.ib:disabled {
  opacity: 0.55;
}
.ib img {
  width: 40px;
  height: 40px;
}
.ib span {
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}
.ib .dot {
  top: 6px;
  right: 10px;
}
.nagi-tip {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 2px 0 8px;
  cursor: pointer;
}
.nagi-face {
  width: 54px;
  height: 54px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  object-position: 50% 8%;
  background: linear-gradient(180deg, #fff3e6, #ffd9b8);
  box-shadow: 0 0 0 3px #fff, 0 3px 0 3px rgba(0, 0, 0, 0.12);
}
.nagi-say {
  position: relative;
  flex: 1;
  background: #fff;
  border-radius: 14px;
  padding: 6px 11px;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--ink);
  box-shadow: var(--panel-shadow);
}
.nagi-say b {
  display: block;
  font-size: 11px;
  color: #ff8a3d;
}
.goal {
  margin-left: 8px;
  padding: 0 7px;
  border-radius: 999px;
  background: #fff1e0;
  color: #b35a00;
  font-size: 10px;
  font-weight: 800;
}
.goal.done {
  background: #e5f6e8;
  color: #1f8a42;
}
.nagi-say::before {
  content: '';
  position: absolute;
  left: -7px;
  bottom: 14px;
  border: 7px solid transparent;
  border-right-color: #fff;
  border-left: 0;
}
.stage {
  position: relative;
  margin-top: -18px;
  overflow: hidden;
}
/* 縦に短い画面では背景の帯を省き、盤面を大きくする（節目までの週数は盤面の中に出す） */
@media (max-height: 720px) {
  .home {
    --stage-h: 0px;
  }
  .home:not(.succ) .stage {
    display: none;
  }
  .home:not(.succ) .board-card {
    margin-top: 0 !important;
  }
}
.strip {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 24px;
  display: flex;
  align-items: stretch;
  gap: 3px;
  background: rgba(255, 255, 255, 0.94);
  border-radius: 14px;
  padding: 3px 6px;
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
}
.tp {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-width: 0;
}
.tp > small {
  font-size: 9px;
  font-weight: 800;
  color: var(--ink-soft);
  white-space: nowrap;
}
.tp.stam {
  flex: 1.6;
  border-left: 2px dashed #e2eef8;
  padding-left: 4px;
}
.stam b {
  font-size: 15px;
  font-weight: 900;
  line-height: 1;
  color: var(--grass-deep, #2a9137);
}
.stam b.low {
  color: var(--red);
}
.bar {
  width: 100%;
  height: 5px;
  border-radius: 9px;
  background: #e2eef8;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #6ad66f, #2f9e3a);
}
.bar i.low {
  background: linear-gradient(90deg, #ff9f43, #e0353b);
}
.go {
  width: 100%;
  padding: 14px;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -36px;
  position: relative;
  z-index: 2;
  box-shadow: 0 6px 0 var(--sun-deep), 0 10px 18px rgba(0, 0, 0, 0.18);
}
.go {
  overflow: hidden;
}
.go::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 30%;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 50%, rgba(255, 255, 255, 0) 100%);
  animation: shine 3.2s ease-in-out infinite;
  pointer-events: none;
}
.go-main {
  font-size: 21px;
  font-weight: 900;
}
.go-sub {
  font-size: 12px;
  opacity: 0.85;
}
.board-card {
  margin-top: -14px;
  z-index: 2;
  padding-top: 10px;
}
/* 盤面・カード・進むボタンが1画面に収まるよう、画面の高さに合わせて盤面の大きさを決める */
.board-fit {
  width: min(100%, max(170px, calc(100dvh - 476px - var(--stage-h) - var(--tip-h, 0px) - var(--focus-h, 0px) - env(safe-area-inset-top, 0px) - var(--safe-bottom))));
  margin: 0 auto;
}
.h-note {
  margin-left: auto;
  font-size: 11px;
  opacity: 0.9;
}
.hand-wrap {
  margin-top: 16px;
}
.card-desc {
  text-align: center;
  margin: 8px 0 0;
}
.go-btn {
  margin-top: 10px;
  padding: 12px;
  font-size: 16px;
}
.t-panel {
  margin-bottom: 14px;
}
.actions {
  display: flex;
  gap: 8px;
}
.go + .actions {
  margin-top: 12px;
}
.practice-match {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  margin-top: 0;
  padding: 11px 6px;
}
.icon-btn {
  position: relative;
  flex: 0 0 auto;
  width: 54px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background:
    radial-gradient(120% 90% at 30% 10%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0) 60%),
    linear-gradient(180deg, #ffffff, #e4eef9);
  box-shadow: inset 0 0 0 2px #cfe0f1, 0 4px 0 #b7cde3, 0 6px 10px rgba(0, 0, 0, 0.12);
}
.icon-btn:active {
  transform: translateY(3px);
  box-shadow: inset 0 0 0 2px #cfe0f1, 0 1px 0 #b7cde3;
}
.icon-btn .dot {
  top: 6px;
  right: 6px;
}
.actions .mini {
  flex: 1;
  padding: 8px 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 14px;
}
.actions .mini span {
  position: relative;
}
.dot {
  position: absolute;
  top: -4px;
  right: -9px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--red);
}
.sub-h {
  font-weight: 900;
  font-size: 14px;
  margin: 12px 0 6px;
  color: var(--orange);
}
.picker-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(10, 25, 45, 0.5);
  display: flex;
  align-items: flex-end;
}
.picker {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(14px + var(--safe-bottom));
}
.opp-list {
  overflow-y: auto;
  margin: 6px 0 10px;
}
.opp {
  display: flex;
  align-items: center;
  width: 100%;
  background: #fff;
  color: var(--ink);
  text-shadow: none;
  box-shadow: inset 0 0 0 2px #e2eef8;
  margin-bottom: 8px;
  text-align: left;
}
.opp-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}
.opp-row .opp {
  flex: 1;
}
.look {
  padding: 0 12px;
  margin-bottom: 8px;
}
.opp-name {
  flex: 1;
  font-weight: 900;
}
.opp-name small {
  margin-left: 6px;
  font-size: 11px;
  color: var(--ink-soft);
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
  gap: 6px;
}
.stat {
  background: #f3f9ff;
  border-radius: 12px;
  padding: 6px 0;
}
.num {
  font-size: 26px;
  font-weight: 900;
  line-height: 1.1;
  color: var(--sky-deep);
}
.num small {
  font-size: 12px;
}
.num.warn {
  color: var(--red);
}
.grades {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.star {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: #fff;
  color: var(--ink);
  box-shadow: none;
  text-shadow: none;
  padding: 6px 4px;
  border-radius: 12px;
  font-weight: 400;
  text-align: left;
}
.star:active {
  background: #f3f9ff;
  box-shadow: none;
}
.star + .star {
  border-top: 2px dashed #eef3f8;
}
.medal {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: 13px;
  color: #fff;
}
.m0 {
  background: linear-gradient(135deg, #ffe066, #f5a300);
}
.m1 {
  background: linear-gradient(135deg, #e6ebf1, #a4afbd);
}
.m2 {
  background: linear-gradient(135deg, #f3c39a, #c27a43);
}
.star-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.log {
  list-style: none;
  padding: 0;
  margin: 0;
}
.log li {
  padding: 6px 0;
  border-bottom: 2px dashed #eef3f8;
}
.log li:last-child {
  border-bottom: none;
}
</style>
