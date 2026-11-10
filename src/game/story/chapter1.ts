// 第1章「ナギ現役編」（1〜3年目）の台本 ―― サクセス版
// 構想書18節：1人の選手（フォーカス選手＝大地の幼馴染）を3年間育て、プロ入りを目指す。
// 物語はナギ（中身は鬼頭鉄郎）の視点で進む。固定ストーリー30本と、固定キャラの加入イベント6本。

import { Rng, clamp } from '../rng'
import { SEASON_WEEKS, POSITION_NAME } from '../constants'
import { findTournament, ownAlive } from '../tournament'
import { fullName } from '../player'
import { learnable, skillName, ABILITY_LABEL, mainKeys } from '../events'
import { absWeek } from '../modifiers'
import type { Player, Position, SaveData } from '../types'
import { activeOwn, ownOut, pendingGame, week, year } from './query'
import { setFocusPosition } from './setup'
import type { CharId, Face, NarrStep, BgStep, Scene, SayStep, Step, StoryContext, TitleStep } from './types'
import { addAchievement, addCostume } from './rewards'
import { addEval, canConfess, evalStars, focusPlayer, rosterCount } from '../success/state'
import { addFriendOfDaichi } from '../success/clubs'
import { savePlayer, unlockScenario } from '../success/archive'
import type { EvalKey, FixedId } from '../success/types'

// ---------------------------------------------------------------- 台本を書くための短い関数

const NAMES: Record<CharId, string> = {
  nagi: 'ナギ',
  nagi_jh: 'ナギ',
  daichi: '大地',
  focus: '{フォーカス}',
  reika: 'レイカ',
  genzo: '源造',
  makabe: '真壁',
  kuga: '久我',
  tetsuro: '鉄郎',
  okochi: '大河内',
  grandpa: '祖父',
  grandpa_hosp: '祖父',
  mob_cap: '主将',
  nagi_beach: 'ナギ',
  reika_beach: 'レイカ',
  hasumi: '蓮見',
  hasumi_beach: '蓮見',
  hasumi_yukata: '蓮見',
  iwaki: '岩城',
  shiomi: '塩見',
  amou: '天羽',
  kuon: '久遠',
  kobayakawa: '小早川',
  senju: '千手',
  shinonome: '東雲',
  miki: '三木',
  pro_scout: 'スカウト',
}

function say(char: CharId, face: Face, text: string): SayStep {
  return { kind: 'say', char, name: NAMES[char], face, text }
}
/** ナギの心の声（中身は鉄郎） */
function think(text: string, face: Face = 'normal', char: CharId = 'nagi'): SayStep {
  return { kind: 'say', char, name: 'ナギ（心）', face, text, think: true }
}
function thinkJh(text: string, face: Face = 'normal'): SayStep {
  return think(text, face, 'nagi_jh')
}
function tetsuroThink(text: string, face: Face = 'normal'): SayStep {
  return { kind: 'say', char: 'tetsuro', name: '鉄郎（心）', face, text, think: true }
}
/** 立ち絵のない人物（声だけ） */
function voice(name: string, text: string): SayStep {
  return { kind: 'say', name, text }
}
function n(text: string): NarrStep {
  return { kind: 'narr', text }
}
function bg(name: string | null, cg: string | null = null): BgStep {
  return { kind: 'bg', bg: name, cg }
}
function title(text: string, sub?: string): TitleStep {
  return { kind: 'title', text, sub }
}

const nagi = (face: Face, text: string): SayStep => say('nagi', face, text)
const nagiJh = (face: Face, text: string): SayStep => say('nagi_jh', face, text)
const daichiSay = (face: Face, text: string): SayStep => say('daichi', face, text)
const makabe = (face: Face, text: string): SayStep => say('makabe', face, text)
const genzo = (face: Face, text: string): SayStep => say('genzo', face, text)
const kuga = (face: Face, text: string): SayStep => say('kuga', face, text)
const reika = (face: Face, text: string): SayStep => say('reika', face, text)
const hasumi = (face: Face, text: string): SayStep => say('hasumi', face, text)
const cap1 = (text: string, face: Face = 'normal'): SayStep => say('mob_cap', face, text)
const grandpa = (text: string): SayStep => say('grandpa', 'smile', text)
/** 育成選手（いつもの主人公の絵で出す） */
const fv = (text: string, face: Face = 'normal'): SayStep => say('focus', face, text)

/** 場面のあとに、操作のチュートリアルを始める */
function startGuide(c: StoryContext, id: 'practice' | 'funds' | 'order' | 'recruit'): void {
  if (c.st.flags[`guide:${id}`] === undefined) c.st.flags[`guide:${id}`] = 'todo'
}

// ---------------------------------------------------------------- 効果

function motivation(list: Player[], delta: number): void {
  for (const p of list) p.condition.motivation = clamp(Math.round(p.condition.motivation + delta), 0, 100)
}
function form(list: Player[], delta: number): void {
  for (const p of list) p.condition.form = clamp(p.condition.form + delta, 1, 5)
}
function regulars(save: SaveData): Player[] {
  return activeOwn(save).filter((p) => !p.helper)
}
function focus(c: StoryContext): Player | null {
  return focusPlayer(c.save)
}
/** 評価を動かして、知らせを返す */
function evals(c: StoryContext, list: [EvalKey, number][]): string[] {
  return list.map(([k, d]) => addEval(c.save, k, d)).filter((x): x is string => !!x)
}
/** 台本と効果で同じ結果になるよう、場面の乱数とは別に決める（場面を見ている間は乱数の状態が変わらない） */
function luck(c: StoryContext, salt: number, p: number): boolean {
  const st = c.save.rngState
  return new Rng([(st[0] ?? 1) ^ salt, st[1] ?? 2, st[2] ?? 3, st[3] ?? 4]).chance(p)
}

// ---------------------------------------------------------------- 条件

const Y = (c: StoryContext): number => year(c.save)
const W = (c: StoryContext): number => week(c.save)
const flag = (c: StoryContext, k: string): boolean => c.st.flags[k] !== undefined
const seen = (c: StoryContext, id: string): boolean => c.st.seen.includes(id)
const S = (c: StoryContext) => c.st.success!
const national = (c: StoryContext): boolean => flag(c, 'national')

// ---------------------------------------------------------------- 大地の告白（チャンスは3回）

/** 告白の場面の台詞。place は 1（1年目の年末）・2（2年目の夏祭り）・3（卒業式） */
function confessSteps(c: StoryContext, place: 1 | 2 | 3): Step[] {
  const s = S(c)
  if (s.dating !== null) {
    return [
      ...(place === 3 ? [bg('bg_school_gate_sakura', 'ev_c1_confess')] : []),
      daichiSay('smile', place === 3 ? '…卒業しても、店に寄れよ。ラムネくらい、毎日出してやる' : '…なあ。来年も、こうして一緒に帰れたらいいな'),
      nagi('smile', '…はい'),
      think('五十七にもなって、なぜ胸が鳴る。…この体のせいだ。そうに決まっている', 'surprise'),
    ]
  }
  if (!canConfess(c.save)) {
    return [
      daichiSay('normal', place === 1 ? '朝比奈、来年は…いや、なんでもない' : place === 2 ? '…なあ、朝比奈。俺さ…いや、やっぱいいや' : '朝比奈。俺、ずっと…いや。元気でな'),
      nagi('normal', '？　はい'),
      fv('（…ったく、大地のやつ）'),
    ]
  }
  return [
    daichiSay('serious', '朝比奈。…俺、お前のことが好きだ'),
    think('…なに？', 'surprise'),
    think('待て。中身は五十七の男だぞ。いや、この娘の体は十代だ。…いや、そういう問題ではない', 'surprise'),
    nagi('surprise', 'あ、あの…私は、その…'),
    fv('おい、ナギ。逃げるなよ。…こいつ、中学のときからずっとお前の話ばっかりなんだからな'),
    daichiSay('troubled', 'お、お前、余計なこと言うなって！'),
    think('…断る理由を、三つ考えた。どれも、この二人の顔を見たら言えなかった', 'frustrated'),
    ...(place === 3 ? [bg('bg_school_gate_sakura', 'ev_c1_confess')] : []),
    nagi('smile', '…はい。よろしく、お願いします'),
    daichiSay('smile', '…よっしゃああっ！'),
    fv('（やっと言えたか。…世話の焼けるやつだ）'),
  ]
}

/** 告白の結果を反映する */
function confessEnd(c: StoryContext, place: 1 | 2 | 3): string[] {
  const s = S(c)
  if (s.dating !== null || !canConfess(c.save)) return []
  s.dating = Y(c)
  if (place === 3) return ['大地の告白が成功した！']
  motivation(regulars(c.save), 10)
  ;(c.save.modifiers ??= []).push({ key: 'practice', until: absWeek(c.save, 3, 52), label: '大地との交際' })
  return ['大地の告白が成功した！', '部員全員のやる気が上がった。', 'チームの練習の効果が上がった（第1章のあいだ続く）。']
}

// ---------------------------------------------------------------- 固定キャラの加入イベント

const JOIN: { id: FixedId; char: CharId; bgName: string; steps: (c: StoryContext) => Step[] }[] = [
  {
    id: 'rikujo',
    char: 'iwaki',
    bgName: 'bg_track_field',
    steps: () => [
      n('陸上部のグラウンドの隅。砲丸が、測定の線をはるかに越えて落ちる'),
      say('iwaki', 'normal', '…野球部に入れば、もっと遠くへ投げられるのか'),
      nagi('smile', 'はい。砲丸より軽い球を、18.44メートル先へ。誰にも打たせずに'),
      say('iwaki', 'smile', '…面白い。投げることなら、誰にも負けない'),
      think('あの腕の振り。制球は荒いが、球速は今すぐでも県で指折りだ', 'serious'),
    ],
  },
  {
    id: 'sumo',
    char: 'shiomi',
    bgName: 'bg_sumo_room',
    steps: () => [
      n('相撲部の土俵の前。源造が大鍋を抱えて現れた'),
      genzo('smile', 'おう、塩見！　日向酒店特製のちゃんこだ。野球部に入れば、毎週食わせてやる！'),
      say('shiomi', 'surprise', '…毎週、ですか'),
      genzo('smile', 'おかわり自由だ！'),
      say('shiomi', 'smile', '入ります'),
      think('…野球の話を一言もしていないぞ', 'surprise'),
    ],
  },
  {
    id: 'soccer',
    char: 'amou',
    bgName: 'bg_soccer_field',
    steps: () => [
      n('サッカー部のグラウンド。フェンスの外には、いつも女子生徒の人だかり'),
      say('amou', 'smile', '野球部、最近ちょっと面白そうだからさ。足には自信あるよ'),
      voice('女子生徒たち', 'えっ、天羽くん野球部入るの！？　見に行かなきゃ！'),
      makabe('surprise', '…練習の見学希望が、今日だけで20人来たよ'),
      think('人が集まるところに、人は集まる。…こいつは使える', 'smile'),
    ],
  },
  {
    id: 'tennis',
    char: 'kuon',
    bgName: 'bg_tennis_court',
    steps: () => [
      n('テニスコートの横。練習試合の勝利を伝える校内新聞が、掲示板に貼られている'),
      say('kuon', 'normal', '…勝ったんだな、野球部'),
      say('kuon', 'smile', 'ボールを打ち返すのは、ラケットでもバットでも同じだ。ショートなら、俺に任せろ'),
      nagi('smile', '頼りにしています'),
    ],
  },
  {
    id: 'takkyu',
    char: 'kobayakawa',
    bgName: 'bg_gym_table_tennis',
    steps: () => [
      n('体育館の卓球台。フォーカス選手と、反射神経の勝負になった'),
      say('kobayakawa', 'serious', '…今の打球、見えてたのか'),
      fv('お前こそ、なんで今のが取れるんだよ'),
      say('kobayakawa', 'smile', '…いいね。二塁、やらせてくれ。至近距離の打球なら、全部止める'),
    ],
  },
  {
    id: 'shogi',
    char: 'senju',
    bgName: 'bg_shogi_room',
    steps: () => [
      n('将棋部の部室。ナギと千手の対局は、静かに終盤へ'),
      say('senju', 'serious', '…詰みです。まさか、この手順を読まれていたとは'),
      nagi('smile', '相手が一番嫌がる一手を、最初に考えるんです。野球の配球と同じですよ'),
      say('senju', 'smile', '…一イニングだけなら、どんな打者でも詰ませてみせます'),
      think('体力は一回が限界だろう。だが、ピンチの火消しにこれほど向いた男はおらん', 'serious'),
    ],
  },
]

const joinScenes: Scene[] = JOIN.map((j) => ({
  id: `c1_join_${j.id}`,
  title: `${NAMES[j.char]}の入部`,
  chapter: 1,
  when: (c) => flag(c, `join_${j.id}`),
  steps: (c) => [bg(j.bgName), ...j.steps(c)],
  onEnd: (c) => {
    const id = S(c).joined[j.id]
    const p = id ? c.save.players[id] : undefined
    if (p) motivation([p], 15)
    return evals(c, [['team', 2]])
  },
}))

// ---------------------------------------------------------------- 場面

const POS_CHOICES: { label: string; pos: Position }[] = [
  { label: '投手（大地とバッテリーを組む）', pos: 'P' },
  { label: '遊撃手', pos: 'SS' },
  { label: '二塁手', pos: '2B' },
  { label: '三塁手', pos: '3B' },
  { label: '一塁手', pos: '1B' },
  { label: '外野手（中堅）', pos: 'CF' },
]

export const CHAPTER1: Scene[] = [
  // ======================================== 1年目
  {
    id: 'c1_ano_yoru',
    title: 'あの夜',
    chapter: 1,
    sub: '第1章「ナギ現役編」',
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg(null),
      n('暗闇の中に、地鳴りのような歓声が響く'),
      voice('実況', '{球団}、日本一！　鬼頭監督、就任10年目にして、ついに頂点へ！'),
      bg('bg_prostadium_night'),
      n('右翼スタンド。立ち上がって叫ぶ老人と、その隣で退屈そうにスマートフォンをいじる少女'),
      grandpa('見ろ、ナギ！　胴上げだ！　鬼頭が宙を舞っとる！'),
      nagiJh('normal', '…おじいちゃん、声大きい。もう終わったんでしょ。帰ろうよ'),
      grandpa('まだだ、まだ。ほれ、鬼頭がボールを持っとる。投げるぞ！'),
      bg(null, 'ev_ano_yoru'),
      n('胴上げを終えた監督・鬼頭鉄郎が、ウイニングボールを右翼スタンドへ放り込む。老人がそれを素手でつかみ取った'),
      grandpa('と、と、取ったぞおおっ！'),
      nagiJh('surprise', '…素手で？　痛くないの、それ'),
      tetsuroThink('やっと手に入れた日本一だ。…だが、選手を一から育てる時間は、もう俺には残っておらん', 'smile'),
      title('同じ夜', '祝勝会のあと'),
      bg('bg_hotel_night'),
      n('ホテルの廊下。鉄郎は壁に手をつき、立ち止まっている'),
      tetsuroThink('もう一度、最初からやり直せたら――', 'frustrated'),
      title('同じころ', '球場からの帰り道'),
      bg('bg_stadium_road_night'),
      grandpa('ほれ、ナギ。持っとけ。わしの一生の宝物だ'),
      nagiJh('normal', '…ただのボールじゃん。野球の何が、そんなに楽しいの'),
      grandpa('それはな…やってみりゃ分かる'),
      nagiJh('normal', 'やらないし。…受験生なんですけど、私'),
      n('少女の手の中で、ボールが一瞬、白く光った'),
      nagiJh('surprise', '…え？'),
      bg(null),
      tetsuroThink('…胸が、苦しい…', 'frustrated'),
      n('意識が、白く遠のいていく'),
    ],
  },
  {
    id: 'c1_mezame',
    title: '目覚め',
    chapter: 1,
    sub: '中学3年の秋',
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_nagi_room_jh_morning'),
      n('目覚まし時計の音。カーテン越しに、朝の光が差し込んでいる'),
      thinkJh('…ここはどこだ。病院ではないな。…やけに可愛らしい部屋だ'),
      n('姿見に映っているのは、パジャマ姿の見知らぬ少女'),
      thinkJh('…誰だ、この娘は'),
      n('右手を上げる。鏡の中の少女も、右手を上げる。頬をつねる。少女も、頬をつねる'),
      thinkJh('…痛い。夢ではない', 'surprise'),
      nagiJh('surprise', 'な、なんだこれはあああっ！？'),
      thinkJh('声が高い！　腕が細い！　…腰が、痛くない！？　三十年来の腰痛が消えている…', 'surprise'),
      voice('母親（声）', 'ナギー！　起きてるのー？　学校に遅れるわよー！'),
      bg('bg_living_morning'),
      n('台所。テレビが朝のニュースを流している'),
      voice('アナウンサー', '昨夜、祝勝会のあとに倒れた鬼頭監督は意識を回復しましたが、記憶に障害が残り、退任する見通しです'),
      nagiJh('surprise', '…え？'),
      thinkJh('俺は、生きているのか。…では、ここにいる俺は誰だ', 'surprise'),
      voice('母親', 'あら、ナギがニュースを見てるなんて珍しい。野球なんて興味なかったでしょう'),
      thinkJh('考えるのは後回しだ。分からないことは保留にして、目の前の試合をこなす。…監督の鉄則だ', 'serious'),
    ],
  },
  {
    id: 'c1_goukaku',
    title: '合格発表の日',
    chapter: 1,
    sub: '中学3年の冬',
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_classroom_day'),
      n('中学校の教室。進路希望の用紙の第一志望には、元のナギの丸い字で「{学校名}」'),
      thinkJh('…この娘が、自分で決めた学校か。俺の都合で行き先を変えるわけにはいかん'),
      bg('bg_nagi_room_jh_night'),
      voice('ニュース', '{学校名}野球部の監督が、部費を私的に使っていたとして解任。部員の多くが退部し、野球部は存続の危機に'),
      thinkJh('…よりによって、ここか', 'surprise'),
      title('合格発表の日', '3月'),
      bg('bg_exam_board'),
      n('掲示板の前に、受験生と保護者の人だかり'),
      nagiJh('normal', '…あった'),
      daichiSay('smile', 'よっしゃ、あった！　…おい、お前は？'),
      fv('あったよ。…ていうか大地、声でかい'),
      daichiSay('surprise', 'あ、悪い。…ん？　君も受かった？　俺、日向。こっちは幼馴染の{フォーカス}'),
      fv('どうも。…野球部、廃部寸前らしいけど、こいつと二人で入るつもりなんだ'),
      thinkJh('…この二人の歩き方。重心が低い。どちらも、本気で野球をやってきた体だ', 'serious'),
      nagiJh('normal', '{フォーカス}くんは、どこを守るんですか？'),
      {
        kind: 'choice',
        options: POS_CHOICES.map((o) => ({
          label: o.label,
          reply: [fv(o.pos === 'P' ? '投手。大地が受けてくれるから、それしか考えてない' : `${POSITION_NAME[o.pos]}。中学でもずっとここだった`)],
          apply: (x: StoryContext) => {
            const f = setFocusPosition(x.save, x.rng, o.pos)
            return f ? [`${fullName(f)}（${POSITION_NAME[o.pos]}）を育てます。名前は選手の画面で変えられます。`] : []
          },
        })),
      },
      thinkJh('いい目だ。…この二人を、三年で一人前にしてみたくなった', 'smile'),
    ],
  },
  {
    id: 'c1_nyugaku',
    title: '入学の日',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      title('入学の日', '1年目 4月'),
      bg('bg_entrance_ceremony'),
      n('{学校名}の入学式。校長の長い話のあいだ、ナギは窓の外のグラウンドばかり見ていた'),
      title('放課後'),
      bg('bg_ground_sunset'),
      n('荒れたグラウンドに、練習着の部員が一人だけ'),
      cap1('…見学？　悪いけど、部員は俺一人だよ。前の監督の件で、みんな辞めちまった'),
      cap1('それでも、最後の夏くらいは…9人そろえて、試合に出たいんだ'),
      daichiSay('smile', 'じゃあ3人ですね。俺たち、今日から入ります'),
      fv('よろしくお願いします'),
      bg('bg_clubroom_day'),
      makabe('normal', 'あ、入部希望者？　国語の真壁です。この春から、この部の監督…ということになってるんだけど'),
      makabe('troubled', '正直、ルールもよく分からなくて。…インフィールドフライって、何？'),
      think('…終わった', 'surprise'),
      nagi('serious', '先生。マネージャーをやらせてください。練習の計画と、部員集め、私がやります'),
      nagi('smile', '…その、祖父が監督をしていたので！'),
      think('嘘だ。祖父どころか、俺本人だ'),
      {
        kind: 'choice',
        options: [
          {
            label: '必ず、9人そろえます',
            reply: [makabe('smile', 'はは、頼もしいな')],
            apply: (x) => {
              motivation(regulars(x.save), 10)
              return ['部員全員のやる気が上がった。']
            },
          },
          {
            label: '…先生も、一緒にルールを覚えてくださいね',
            reply: [makabe('troubled', 'うっ…がんばります')],
            apply: (x) => evals(x, [['makabe', 5]]),
          },
        ],
      },
      think('女子高生の体で、部員3人の弱小校か。鬼頭鉄郎、二度目の野球人生だ。…マネージャーだがな', 'smile'),
      nagi('serious', 'まずは練習です。そして、夏の大会までに9人。…それが最初の目標です'),
    ],
    onEnd: (c) => {
      startGuide(c, 'practice')
      return ['目標：夏の大会までに部員を9人そろえる（9人で練習試合と大会に出られる）']
    },
  },
  {
    id: 'c1_kanyu',
    title: 'はじめての勧誘',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 2,
    steps: () => [
      bg('bg_classroom_day'),
      n('昼休みの教室。大地が、帰宅部の男子を5人、ぞろぞろと連れてきた'),
      daichiSay('smile', '朝比奈、5人確保！　全員帰宅部、全員うちのクラス'),
      voice('帰宅部の男子', '…放課後ひまだし、まあいいけど。ボール、当たると痛い？'),
      voice('帰宅部の男子たち', '大地がしつこいからさ。…ま、やるだけやってみるよ'),
      nagi('smile', 'ようこそ、野球部へ'),
      think('9人まで、あと少しだ。勧誘は1週間がかりの仕事だ。行き先の部活に、誰がいるか見てから決める。…あとは、通い詰めることだ', 'serious'),
    ],
    onEnd: (c) => {
      const joined = Array.from({ length: 5 }, () => addFriendOfDaichi(c.save, c.rng))
      startGuide(c, 'recruit')
      return [`${joined.map(fullName).join('、')}が入部した！（部員 ${rosterCount(c.save)}人）`, ...evals(c, [['daichi', 2]])]
    },
  },
  {
    id: 'c1_hokenshitsu',
    title: '保健室の先生',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 3,
    steps: () => [
      bg('bg_infirmary_day'),
      n('練習中に足首をひねった{フォーカス}に付き添って、ナギは保健室を訪れた'),
      hasumi('smile', 'あら、野球部さん。…はい、冷やすわね。大丈夫、軽いひねりよ'),
      fv('いってえ…'),
      hasumi('normal', '養護教諭の蓮見です。ケガをしたら、遠慮なくここへ連れてきてね。夏の合宿にも、ついていってあげる'),
      makabe('surprise', 'あ、朝比奈さん、ここにいたんだ。…あ、蓮見先生'),
      hasumi('tease', '真壁先生、今日も寝ぐせがはねてるわよ？　監督さんがそれじゃ、締まらないわね'),
      makabe('troubled', 'え、えっ！？'),
      hasumi('smile', '…ねえ、朝比奈さん。あなた、ときどき、ずいぶん年上の人みたいな目をするのね'),
      think('…！', 'surprise'),
      hasumi('smile', 'ふふ。わたしもね、よく言われるの。…「年のわりに」って'),
      think('この先生、いくつなんだ…？', 'serious'),
    ],
    onEnd: (c) => {
      const f = focus(c)
      if (f) f.condition.stamina = clamp(f.condition.stamina + 20, 0, 100)
      return [...evals(c, [['hasumi', 5]]), '蓮見先生が、練習のマスに顔を出すようになった。']
    },
  },
  {
    id: 'c1_9nin',
    title: '9人そろう',
    chapter: 1,
    when: (c) => Y(c) <= 3 && rosterCount(c.save) >= 9,
    steps: () => [
      bg('bg_ground_day'),
      n('グラウンドに、初めて9人の部員が並んだ'),
      cap1('…9人。本当に、そろった'),
      daichiSay('smile', 'これで試合ができるな！'),
      n('初めての全員での練習は、ちぐはぐだった。ボールはこぼれ、声はかぶり、誰かが転んだ'),
      think('ひどいものだ。…だが、悪くない', 'smile'),
      n('そこへ、法被姿の大柄な男が乗り込んでくる'),
      genzo('angry', 'おう、真壁先生！　商店会長で、OB会長の日向だ。…野球部が9人そろったと聞いてな'),
      daichiSay('troubled', '親父…声でかいって'),
      nagi('surprise', '…日向くんの、お父さん？'),
      genzo('smile', '差し入れだ！　わしもOBでな。この部が消えるのは、寂しかったんだ'),
      think('どうりで声が大きいと思った'),
      makabe('smile', '近くの学校が、練習試合を受けてくれたよ！　9人そろったって聞いてね'),
    ],
    onEnd: (c) => {
      c.st.flags.join9 = Y(c)
      const own = c.save.schools[c.save.playerSchoolId]!
      own.funds += 20
      startGuide(c, 'order')
      startGuide(c, 'funds')
      return ['練習試合と大会に出られるようになった！', 'OB会から差し入れが届いた（部費 +20万円）。', '源造が、練習のマスに顔を出すようになった。', ...evals(c, [['genzo', 5], ['team', 3]])]
    },
  },
  {
    id: 'c1_ryugamine',
    title: '龍ヶ峰',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 15,
    steps: (c) => [
      bg('bg_stadium_day'),
      ...(rosterCount(c.save) >= 9 && flag(c, 'join9')
        ? [n('夏の大会。初戦を終えた球場の通路で、紺のユニフォームの一団とすれ違う')]
        : [n('夏の大会。9人そろわず出場できなかったナギたちは、スタンドから試合を見ていた'), daichiSay('frustrated', '…来年は、絶対あそこに立つ')]),
      n('{ライバル}。この県の、絶対王者'),
      n('ベンチから監督が出てくる。ナギは息をのんだ'),
      kuga('normal', '…'),
      think('久我…！　俺が育てた捕手が、こんなところで監督をしているのか', 'surprise'),
      reika('normal', 'あなたたち、{学校名}？　…その人数で野球部？'),
      reika('serious', '白鳥レイカ。{ライバル}のマネージャーよ。せいぜい、9人で試合ができるようにがんばって'),
      daichiSay('angry', '…なんだと'),
      fv('…上等だ'),
      think('いい顔になった。悔しさは、一番の練習薬だ', 'smile'),
    ],
    onEnd: (c) => {
      motivation(regulars(c.save), 12)
      return ['挑発に奮起した！部員全員のやる気が上がった。']
    },
  },
  {
    id: 'c1_sofu',
    title: '祖父の病室',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 24,
    steps: () => [
      bg('bg_hospital_room'),
      n('秋。検査で入院した祖父を、ナギは一人で見舞った'),
      say('grandpa_hosp', 'smile', 'ナギが野球部のマネージャーだと？　…いまだに信じられんなあ'),
      say('grandpa_hosp', 'smile', 'あの夜は「野球の何が楽しいの」と言っとったのに。どういう風の吹き回しだ'),
      think('…まずい', 'surprise'),
      nagi('troubled', 'お、おじいちゃんの影響だよ。あの試合を見てたら、なんだか…'),
      say('grandpa_hosp', 'smile', 'そうか、そうか。…なんだか、急に大人びたなあ、お前は'),
      think('冷や汗が止まらん', 'surprise'),
      say('grandpa_hosp', 'smile', '…あの夜の宝物はな、大事な友達に、ちゃんと預けてある。わしより長生きしそうなやつにな'),
      nagi('surprise', '宝物？'),
      n('祖父は笑うだけで、それ以上は何も言わなかった'),
    ],
  },
  {
    id: 'c1_fuyu',
    title: '冬の帰り道',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 36,
    steps: (c) => [
      bg('bg_street_winter_night'),
      n('年の瀬の商店街。飾りの明かりの下を、ナギと大地が並んで歩く'),
      daichiSay('normal', '秋の大会、悔しかったな。…でも、去年の今ごろは、部員3人だったんだぜ'),
      nagi('smile', 'はい。この1年で、ずいぶん変わりました'),
      ...confessSteps(c, 1),
    ],
    onEnd: (c) => confessEnd(c, 1),
  },

  // ======================================== 2年目
  {
    id: 'c1_y2_nakama',
    title: '新しい仲間',
    chapter: 1,
    when: (c) => Y(c) === 2,
    steps: () => [
      bg('bg_clubroom_day'),
      n('部室の前に、入部を希望する新入生が並んでいる'),
      voice('新入生', '去年の秋、ここの試合を見て…なんか、楽しそうだったので'),
      makabe('smile', '部員、{部員数}人か。去年の春は3人だったのにね'),
      makabe('normal', '新しい主将は…日向くん、頼めるかな'),
      daichiSay('surprise', '俺っすか！？　…まあ、やりますけど'),
      think('何十年も監督をやった俺が、2年生のマネージャー扱いか。…悪くない', 'smile'),
    ],
    onEnd: (c) => {
      c.st.captainId = c.st.daichiId
      motivation(regulars(c.save), 5)
      return ['大地が主将になった。', '部員全員のやる気が上がった。']
    },
  },
  {
    id: 'c1_hariai',
    title: '張り合い',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 5,
    steps: () => [
      bg('bg_stadium_day'),
      n('春の県大会。スタンドで、日傘を差した少女がスコアブックを広げている'),
      reika('normal', 'あら、{学校名}のマネージャーさん。偵察に来たのよ。去年の秋から、急に勝ち始めたでしょう？'),
      n('レイカが、ナギのデータノートをのぞき込む'),
      reika('serious', '…ふうん。ベンチでサインを出しているの、監督じゃなくてあなたね'),
      think('…この娘、目がいい', 'surprise'),
      nagi('smile', '何のことでしょう？　…本当のデータは、お見せしませんよ'),
      reika('normal', 'とぼけるのね。いいわ、夏になれば分かるもの'),
    ],
    onEnd: (c) => evals(c, [['nagi', 2]]),
  },
  {
    id: 'c1_shuzai',
    title: '取材',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 10,
    steps: () => [
      bg('bg_newspaper_room'),
      n('新聞部の部室。地元新聞の記者も同席している'),
      voice('記者', '最近の{学校名}さんは、采配が面白いと評判でして。…昔の{球団}の鬼頭監督のようだと、うちの年配の記者が言うんですよ'),
      nagi('surprise', 'ごほっ！　ごほっ！'),
      makabe('surprise', '朝比奈さん、大丈夫？'),
      voice('記者', 'そういえば鬼頭監督は、記憶をなくされてから表に出てこられませんね'),
      think('記憶をなくした「俺」が、どこかにいる。…会ってみたい気もするし、怖くもある', 'serious'),
      voice('記者', 'ところで、注目の選手は？'),
      {
        kind: 'choice',
        options: [
          {
            label: '{フォーカス}くんです（売り込む）',
            reply: [voice('記者', 'なるほど、{フォーカス}くんですね。写真も載せましょう')],
            apply: (x) => {
              const own = x.save.schools[x.save.playerSchoolId]!
              own.reputation = clamp(own.reputation + 2, 0, 100)
              return ['新聞に載った（評判が上がった）。', ...evals(x, [['scout', 3]])]
            },
          },
          {
            label: 'チーム全員です',
            reply: [voice('記者', 'いいですね。チームの記事にしましょう')],
            apply: (x) => {
              const own = x.save.schools[x.save.playerSchoolId]!
              own.reputation = clamp(own.reputation + 4, 0, 100)
              return ['新聞に載った（評判が上がった）。', ...evals(x, [['team', 3]])]
            },
          },
        ],
      },
    ],
  },
  {
    id: 'c1_gasshuku_junbi',
    title: '合宿の準備',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 14,
    steps: () => [
      bg('bg_clubroom_day'),
      makabe('troubled', '夏の合宿、引率は僕一人で大丈夫かな。ケガ人が出たら…'),
      hasumi('smile', 'あら、わたしが行くって言ったでしょう？　去年も行ったじゃない'),
      makabe('surprise', '蓮見先生！　…いつからそこに'),
      hasumi('tease', 'ずっといたわよ？　…ふふ、真壁先生って、からかいがいがあるわね'),
      think('この先生、本当に年を取っているのか…？', 'serious'),
    ],
    onEnd: (c) => evals(c, [['hasumi', 3]]),
  },
  {
    id: 'c1_ouja_mae',
    title: '王者との対戦',
    chapter: 1,
    when: (c) => {
      const p = pendingGame(c.save)
      return Y(c) >= 2 && Y(c) <= 3 && !!p && p.opponentId === c.st.rivalId
    },
    steps: () => [
      bg('bg_stadium_day'),
      n('試合前の整列。相手ベンチの前に、久我が立っている'),
      kuga('normal', '真壁監督ですね。{ライバル}の久我です。今日はよろしくお願いします'),
      makabe('surprise', 'よ、よろしくお願いします！'),
      kuga('normal', '…マネージャーさんも'),
      think('背が伸びたな、久我。…いや、俺が縮んだのか'),
      nagi('serious', '相手は王者です。失うものはありません。一つずつ取りにいきましょう'),
    ],
  },
  {
    id: 'c1_ouja_ato',
    title: '王者との対戦（試合後）',
    chapter: 1,
    when: (c) => seen(c, 'c1_ouja_mae') && rivalResult(c) !== null,
    steps: (c) =>
      rivalResult(c) === 'win'
        ? [
            bg('bg_stadium_day'),
            kuga('surprise', '完敗です。3回のあの盗塁、あれはどなたの指示ですか'),
            makabe('troubled', 'え、ええと、チームの…総意です'),
            n('久我が、ナギのほうを見た'),
            reika('serious', '…次は負けないから'),
            nagi('smile', 'はい。次も勝ちます'),
          ]
        : [
            bg('bg_stadium_day'),
            kuga('smile', 'いいチームです。守備位置の指示が細かい。…懐かしいくらいだ'),
            reika('normal', '今回はうちの勝ち。でも、次も同じだとは思っていないわ'),
            think('教え子に負けるのは、嬉しいのか悔しいのか。…悔しいに決まっている', 'frustrated'),
          ],
    onEnd: (c) => {
      if (rivalResult(c) === 'win') {
        motivation(regulars(c.save), 15)
        const own = c.save.schools[c.save.playerSchoolId]!
        own.reputation = clamp(own.reputation + 8, 0, 100)
        return ['王者を倒した！評判が大きく上がった。', ...evals(c, [['scout', 5], ['team', 3]]), ...addAchievement(c.st, '王者撃破')]
      }
      motivation(regulars(c.save), 8)
      return ['部員全員のやる気が上がった。']
    },
  },
  {
    id: 'c1_best4',
    title: 'ベスト4',
    chapter: 1,
    when: (c) => flag(c, 'best4'),
    steps: () => [
      bg('bg_liquor_day'),
      n('校門に「祝 県大会ベスト4」の垂れ幕。商店街のあちこちから声がかかる'),
      genzo('smile', 'おう、野球部！　うちのラムネだ。飲んでいけ！'),
      daichiSay('smile', '去年までは、誰も声なんてかけてこなかったのにな'),
      nagi('smile', '次は、もっと上ですよ'),
    ],
    onEnd: (c) => {
      const own = c.save.schools[c.save.playerSchoolId]!
      own.funds += 30
      return ['部費 +30万円。', ...evals(c, [['genzo', 5], ['scout', 4]]), ...addAchievement(c.st, '県ベスト4'), ...addCostume(c.st, '県ベスト4')]
    },
  },
  {
    id: 'c1_ato_ippo',
    title: 'あと一歩',
    chapter: 1,
    when: (c) => Y(c) === 2 && !flag(c, 'best4') && ownOut(c.save, 2, 'summerPref'),
    steps: () => [
      bg('bg_stadium_day'),
      daichiSay('frustrated', '…また、あと一歩か'),
      nagi('normal', '去年は、その「あと一歩」すらありませんでした。距離は確実に縮んでいます'),
    ],
  },
  {
    id: 'c1_natsumatsuri',
    title: '夏祭り',
    chapter: 1,
    when: (c) => {
      if (Y(c) !== 2 || W(c) < 18) return false
      const nat = findTournament(c.save, 2, 'summerNational')
      return W(c) >= SEASON_WEEKS.thirdYearRetire || !nat || !ownAlive(c.save, nat)
    },
    steps: (c) => [
      bg('bg_summer_festival_night'),
      n('合宿を終えた週末。商店街の奥、白球稲荷の夏祭り'),
      daichiSay('smile', '射的、勝負な。負けたほうがかき氷おごり'),
      fv('乗った。…ナギも見てろよ'),
      n('二人は全弾を外し、仲良く二人分のかき氷をナギにおごることになった'),
      think('勝負の意味が分からん…', 'surprise'),
      ...(luck(c, 7, 0.25)
        ? [
            n('人混みの向こうから、浴衣姿の女性が手を振っている'),
            say('hasumi_yukata', 'smile', 'あら、野球部のみなさん。お祭り、楽しんでる？'),
            fv('は、蓮見先生！？'),
            say('hasumi_yukata', 'tease', 'ふふ、夜更かしはほどほどにね。…明日の練習、寝坊したら保健室で説教よ？'),
          ]
        : []),
      n('花火が上がる。大地が、ちらりとナギの横顔を見た'),
      ...confessSteps(c, 2),
    ],
    onEnd: (c) => {
      const out: string[] = []
      const f = focus(c)
      if (f) {
        f.condition.stamina = clamp(f.condition.stamina + 20, 0, 100)
        out.push(`${f.surname}の体力が回復した。`)
      }
      if (luck(c, 7, 0.25)) {
        for (const p of regulars(c.save)) p.condition.stamina = clamp(p.condition.stamina + 10, 0, 100)
        out.push('部員全員の体力が回復した。', ...evals(c, [['hasumi', 3]]))
      }
      return [...out, ...confessEnd(c, 2)]
    },
  },
  {
    id: 'c1_mae_no_kantoku',
    title: '前の監督',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 23,
    steps: () => [
      bg('bg_sports_shop'),
      n('夕方。商店街のスポーツ用品店で、ナギが練習球を選んでいる'),
      say('okochi', 'normal', '…{学校名}の、マネージャーさん？'),
      nagi('normal', 'はい。…どこかでお会いしましたか'),
      say('okochi', 'smile', 'いや…。夏の試合、見てたよ。いいチームになった'),
      say('okochi', 'serious', 'あいつらに、伝えて――'),
      say('okochi', 'normal', '…いや、いい。俺が言えることじゃない。ボール、少しおまけしておくよ'),
      n('男は店の奥へ引っ込んだ。レジ横の名札には「大河内」'),
      think('大河内。…部費の件で辞めた、前の監督か。あれは、逃げた人間の顔ではなかった', 'serious'),
    ],
  },
  {
    id: 'c1_y2_end',
    title: '2年目の締めくくり',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 50,
    steps: (c) => [
      bg('bg_ground_sunset'),
      n('春休み。夕暮れのグラウンド'),
      ...(flag(c, 'best4')
        ? [makabe('smile', 'ベスト4か。2年前の僕に言っても、信じないだろうな'), makabe('smile', 'それと、インフィールドフライ、分かるようになったよ'), nagi('smile', '先生、それは去年の4月の話です')]
        : [makabe('normal', '目標には届かなかったけど…この部は、確実に強くなったよ'), think('王者の背中は見えた', 'serious')]),
      nagi('serious', '来年が、私たちの最後の年です'),
    ],
    onEnd: (c) => evals(c, [['makabe', 3]]),
  },

  // ======================================== 3年目
  {
    id: 'c1_saigo_no_ichinen',
    title: '最後の1年',
    chapter: 1,
    when: (c) => Y(c) === 3,
    steps: () => [
      bg('bg_school_gate_sakura'),
      n('桜の咲く校門。ナギが、新しい部員名簿を眺めている'),
      makabe('normal', '朝比奈さんも、もう3年生か。早いね'),
      think('高校生活も残り1年。…この体のまま年を重ねるのか。それとも、ある朝また別の誰かになっているのか', 'serious'),
      think('…考えても仕方がない。監督は、目の前の試合しか采配できん'),
      nagi('serious', '先生。今年は、全国に行きます。そして{フォーカス}くんを、プロに送ります'),
      makabe('smile', '…うん。そう言うと思った'),
    ],
    onEnd: (c) => {
      motivation(regulars(c.save), 5)
      return ['部員全員のやる気が上がった。']
    },
  },
  {
    id: 'c1_haru_scout',
    title: '春の大会のスカウト',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 5,
    steps: (c) => [
      bg('bg_stadium_stands'),
      n('春の県大会。バックネット裏に、スピードガンを構えた男がいる'),
      think('…あの男、知っている。監督時代、何度もドラフトの席で顔を合わせた。プロの球団のスカウトだ', 'surprise'),
      think('甘いもの好きで、球場の売店の芋ようかんに目がなかった。…まだ売っているか', 'smile'),
      n('ナギは売店で芋ようかんを買い、男の隣に座った'),
      nagi('smile', 'お疲れさまです。よろしければ、どうぞ'),
      say('pro_scout', 'surprise', 'おっ、芋ようかん。これ、好きなんだよ。ありがとう'),
      nagi('normal', 'ところで…うちの{フォーカス}は、どうですか？'),
      say('pro_scout', 'normal', `{フォーカス}くんか。…正直に言うと、今の評価は「${['まだ名前を知っている程度', '少し気になる', '追いかける価値はある', 'かなり有望', '上位で指名したい'][evalStars(S(c).eval.scout) - 1]}」だな`),
      say('pro_scout', 'surprise', '…あれ？　なんで私がこれを好きだと知っているんだ？'),
      nagi('troubled', 'えっ！？　あ、その…勘です'),
      say('pro_scout', 'smile', '…まあいっか。君の学校、これから気にして見ておくよ'),
    ],
    onEnd: (c) => {
      S(c).scoutFocus = true
      return [...evals(c, [['scout', 5]]), 'スカウトがこの学校に注目した！（スカウトのマスの評価の上がり幅が大きくなる）']
    },
  },
  {
    id: 'c1_soudan',
    title: '大地への相談',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 9,
    steps: (c) => [
      bg('bg_clubroom_night'),
      n('練習のあと。ナギは、ひとり部室で練習計画を見つめていた'),
      think('…最近、どうも1年生が乗ってこない。俺の言葉は、正しいが、遠いのかもしれん', 'frustrated'),
      think('高校生のことは、高校生のほうがよく分かっている。…思い切って、聞いてみるか'),
      nagi('normal', '日向くん。…相談、してもいいですか'),
      daichiSay('surprise', 'お前が俺に相談！？　…なんだよ、何でも言えよ！'),
      ...(luck(c, 11, 0.85)
        ? [daichiSay('smile', 'よし、分かった。1年のことは俺に任せろ！'), n('翌日から、練習の空気が変わった')]
        : [daichiSay('smile', 'よし、分かった。全員、気合いだあっ！'), n('翌日、大地の気合いの空回りで、練習の空気がぎくしゃくしてしまった'), think('…相談相手を間違えたか', 'frustrated')]),
    ],
    onEnd: (c) => {
      if (luck(c, 11, 0.85)) {
        ;(c.save.modifiers ??= []).push({ key: 'practice', until: absWeek(c.save, 3, 52), label: '大地への相談' })
        return ['チーム全体の練習の効果が上がった（第1章のあいだ続く）。', ...evals(c, [['daichi', 5]])]
      }
      motivation(regulars(c.save), -10)
      return ['部員全員のやる気が下がった…。', ...evals(c, [['team', -2]])]
    },
  },
  {
    id: 'c1_kouhai',
    title: '後輩の指導',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 11,
    steps: () => [
      bg('bg_ground_day'),
      n('{フォーカス}が、1年生に基本を教えている'),
      voice('1年生', '先輩、どうしてそこで一歩下がるんですか？'),
      fv('え？　…なんでだっけ。ナギに言われて、ずっとそうしてたから'),
      think('教えることで、自分の動きの意味に気づく。…いい機会だ', 'smile'),
      {
        kind: 'choice',
        options: [
          {
            label: '一緒に理由を考えてみる',
            reply: [fv('…そうか。次の動きに入りやすいからだ')],
            apply: (x) => {
              const f = focus(x)
              if (!f) return []
              const skill = luck(x, 13, 0.4) ? learnable(x.rng, f) : null
              if (skill) {
                f.skills.push(skill)
                return [`${f.surname}が特殊能力「${skillName(skill)}」を身につけた！`, ...evals(x, [['team', 2]])]
              }
              return ['後輩たちとの距離が縮まった。', ...evals(x, [['team', 3]])]
            },
          },
          {
            label: '自分の練習を優先させる',
            reply: [fv('悪い、今日はこっちに集中させてくれ')],
            apply: (x) => {
              const f = focus(x)
              if (!f) return []
              const keys = mainKeys(f).slice(0, 2)
              for (const k of keys) {
                const [g, key] = k.split('.') as [string, string]
                const obj = (f as unknown as Record<string, Record<string, number>>)[g]!
                obj[key] = clamp(obj[key]! + 2, 1, key === 'velocity' ? 163 : 99)
              }
              return [`${f.surname}の${keys.map((k) => ABILITY_LABEL[k]).join('と')}が上がった。`, ...evals(x, [['team', -1]])]
            },
          },
        ],
      },
    ],
  },
  {
    id: 'c1_shi_no_omokage',
    title: '師の面影',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 12 && W(c) <= 16 && (flag(c, 'metRival_3') || W(c) >= 14),
    steps: () => [
      bg('bg_stadium_day'),
      n('球場の通路。久我が一人で待っていた'),
      kuga('normal', '朝比奈さん、だったね。少しいいかな'),
      kuga('normal', '君の采配は、ある人にそっくりなんだ。僕が現役だったころの監督に'),
      kuga('normal', '1点が欲しい場面ほど、打者に任せる。…それに、ピンチで帽子のつばを二回触る癖'),
      think('…しまった。癖は、体が変わっても抜けないのか', 'surprise'),
      {
        kind: 'choice',
        options: [
          { label: '祖父が、その方の大ファンだったので', reply: [kuga('smile', '…そうか。いいおじいさんだね')], apply: (x) => void (x.st.flags.kugaTalk = 'fan') },
          {
            label: 'その監督さんは、どんな人でしたか？',
            reply: [kuga('smile', '怖い人だったよ。でも、選手を一度も見捨てなかった'), think('…覚えていたのか', 'frustrated')],
            apply: (x) => void (x.st.flags.kugaTalk = 'ask'),
          },
        ],
      },
      kuga('normal', '夏、決勝で会おう'),
    ],
  },
  {
    id: 'c1_kessen_zenya',
    title: '決戦前夜',
    chapter: 1,
    when: (c) => {
      const p = pendingGame(c.save)
      return Y(c) === 3 && !!p && p.t.kind === 'summerPref' && p.round === p.t.rounds.length - 1
    },
    steps: () => [
      bg('bg_clubroom_night'),
      n('決勝の前の晩。部室に、部員が全員集まっている'),
      daichiSay('normal', '朝比奈、何か言ってくれよ'),
      nagi('normal', '…2年前、この部には3人しかいませんでした。グラウンドは荒れていて、練習試合も断られて'),
      nagi('normal', 'それでも、誰も辞めなかった。だから今、ここにいます'),
      nagi('serious', '明日は、勝ち方を知っているチームとして、試合をしてきてください'),
      fv('…大地。小学校のとき、約束したよな。いつか一緒に、でかい舞台に立とうって'),
      daichiSay('smile', '覚えてるに決まってんだろ'),
    ],
    onEnd: (c) => {
      form(regulars(c.save), 1)
      const f = focus(c)
      if (f) f.condition.motivation = 100
      return ['試合に出る選手の調子が上がった。', ...(f ? [`${f.surname}のやる気が最大になった！`] : [])]
    },
  },
  {
    id: 'c1_saigo_gasshuku',
    title: '最後の合宿',
    chapter: 1,
    when: (c) => Y(c) === 3 && (c.save.sugoroku?.campWeeks ?? 0) > 0,
    steps: () => [
      bg('bg_ground_day'),
      n('最後の夏合宿。日が暮れても、誰もグラウンドから出ようとしない'),
      hasumi('smile', 'はい、休憩。…あなたたち、3年間でずいぶん大きくなったわね'),
      makabe('smile', '僕も、少しは監督らしくなったかな'),
      hasumi('tease', '寝ぐせは相変わらずよ、真壁先生'),
    ],
    onEnd: (c) => {
      for (const p of regulars(c.save)) {
        for (const k of mainKeys(p).slice(0, 2)) {
          const [g, key] = k.split('.') as [string, string]
          const obj = (p as unknown as Record<string, Record<string, number>>)[g]!
          obj[key] = clamp(obj[key]! + 1, 1, key === 'velocity' ? 163 : 99)
        }
      }
      return ['部員全員の能力が上がった！', ...evals(c, [['hasumi', 3]])]
    },
  },
  {
    id: 'c1_zenkoku',
    title: '全国へ',
    chapter: 1,
    when: (c) => national(c) && Y(c) <= 3,
    steps: () => [
      bg('bg_stadium_day'),
      n('優勝が決まった瞬間。ベンチから部員たちが飛び出していく'),
      makabe('surprise', '朝比奈さん！　全国、全国だよ！'),
      daichiSay('smile', '朝比奈！　…約束、守ったぞ'),
      title('全国大会　開会式'),
      bg('bg_national_stadium'),
      n('入場行進する部員たちを、ナギはスタンドから見つめている。そっと、涙をぬぐった'),
      think('プロで日本一になった夜より、なぜか胸が熱い', 'smile'),
    ],
    onEnd: (c) => [...evals(c, [['scout', 10], ['genzo', 5]]), ...addAchievement(c.st, '全国初出場'), ...addCostume(c.st, '応援')],
  },
  {
    id: 'c1_todokanakatta',
    title: '届かなかった夏',
    chapter: 1,
    when: (c) => Y(c) === 3 && !national(c) && ownOut(c.save, 3, 'summerPref'),
    steps: () => [
      bg('bg_stadium_day'),
      n('最後の夏が終わった。誰もいなくなったベンチ'),
      daichiSay('frustrated', 'ごめん、朝比奈。お前を全国に連れて行けなかった'),
      nagi('frustrated', '連れて行ってもらうつもりなんて、ありませんでした。一緒に行きたかったんです'),
      nagi('normal', '…信じてくれて、ありがとうございました'),
      think('選手の夏は、毎年必ず終わる。…だが、こいつの野球は、まだ終わらせん', 'serious'),
    ],
  },
  {
    id: 'c1_shinro',
    title: '進路',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 27,
    steps: () => [
      bg('bg_clubroom_day'),
      n('放課後の部室。机の上に、プロ志望届の用紙'),
      fv('…出すよ、これ。ナギと大地と、ここまで来たんだ。上でも、やってみたい'),
      nagi('smile', 'はい。あとは、スカウトの皆さんが決めることです'),
      makabe('normal', '朝比奈さんは？　進路、まだ出してないんだって？'),
      nagi('serious', '…教員になります。ここに戻ってきて、この部の監督になります'),
      makabe('smile', 'じゃあ、それまで監督の名前は僕が預かっておくよ。卒業したら、外部コーチとして来ればいい'),
      think('…この人が監督で、本当によかった', 'smile'),
    ],
  },
  {
    id: 'c1_draft',
    title: 'ドラフト会議',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 32,
    steps: (c) => {
      const f = focus(c)
      const d = f?.drafted
      return [
        bg('bg_clubroom_tv'),
        n('部室のテレビの前に、部員全員が集まっている'),
        voice('アナウンサー', '続いて、各球団の指名です――'),
        ...(d
          ? [
              voice('アナウンサー', `${d.team}、${d.round}位指名。{フォーカス名}、{学校名}`),
              n('部室が、歓声で揺れた'),
              bg('bg_ground_sunset', 'ev_c1_draft'),
              n('気がつけば、グラウンドで胴上げが始まっていた'),
              daichiSay('cry', 'やった…やったな、お前！'),
              fv('…ナギ。ありがとう'),
              nagi('smile', 'おめでとうございます。…ここからが、本当の勝負ですよ'),
              think('一から育てた選手が、プロへ行く。…あの夜に願ったことは、これだったのかもしれん', 'smile'),
            ]
          : [
              n('最後の球団の指名が終わっても、{フォーカス}の名前は呼ばれなかった'),
              fv('…まあ、こんなもんだよな'),
              daichiSay('frustrated', '…'),
              think('俺の力不足だ。…すまん', 'frustrated'),
            ]),
      ]
    },
    onEnd: (c) => {
      const f = focus(c)
      if (f?.drafted) {
        savePlayer(f, 1)
        unlockScenario(2)
        return [`${fullName(f)}がプロ入り！選手を保存した。`, '第2章「ナギ大学編」が解禁された！']
      }
      return ['指名はなかった…。（育成失敗）']
    },
  },
  {
    id: 'c1_sotsugyou',
    title: '卒業式',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= SEASON_WEEKS.graduation,
    steps: (c) => {
      const f = focus(c)
      const pro = !!f?.drafted
      return [
        bg('bg_school_gate_sakura'),
        n('卒業式のあと。後輩たちが、校門の前で整列している'),
        voice('後輩の主将', '朝比奈先輩！　3年間、ありがとうございました！'),
        nagi('normal', '…来週からも、外部コーチとして普通に来ますけどね'),
        voice('部員一同', '感動を返してください！'),
        genzo('smile', '卒業おめでとう！　うちのバカ息子も、よく卒業できたもんだ！'),
        ...(pro ? [genzo('cry', '{フォーカス}がプロか…。わしは、商店街総出で応援に行くぞ！')] : [genzo('serious', '{フォーカス}、大学で野球を続けるんだってな。…胸を張れ')]),
        n('校門の外で、{ライバル}の制服を着たレイカが待っていた'),
        reika('normal', '卒業おめでとう。…大学に行っても、あなたとは張り合うから'),
        title('帰り道'),
        bg('bg_liquor_day'),
        ...confessSteps(c, 3),
        bg(null),
        title('第1章「ナギ現役編」　完', pro ? 'プロ入り' : '育成失敗'),
        n(pro ? '{フォーカス名}はプロの世界へ。選手は保存され、第2章「ナギ大学編」が解禁されました。' : '{フォーカス名}はプロに届かなかった。もう一度、最初から育ててみよう。'),
      ]
    },
    onEnd: (c) => {
      const s = S(c)
      const out = confessEnd(c, 3)
      s.ended = focus(c)?.drafted ? 'pro' : 'fail'
      c.st.chapter = 2
      return [...out, ...addCostume(c.st, '卒業式'), s.ended === 'pro' ? '第1章をクリアした！' : '第1章が終わった。']
    },
  },
  ...joinScenes,
]

/** 今年の大会でライバル校と当たった試合の結果。まだなら null */
function rivalResult(c: StoryContext): 'win' | 'lose' | null {
  const rival = c.st.rivalId
  if (!rival) return null
  const own = c.save.playerSchoolId
  for (const t of c.save.tournaments ?? []) {
    if (t.year !== Y(c)) continue
    for (const games of t.rounds) {
      for (const g of games) {
        if (!g.winner || g.bye) continue
        const pair = (g.a === own && g.b === rival) || (g.b === own && g.a === rival)
        if (pair) return g.winner === own ? 'win' : 'lose'
      }
    }
  }
  return null
}

