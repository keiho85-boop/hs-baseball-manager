// 第1章「再建」（1〜3年目）の台本
// 構想書18節（新しい軸）と、そこから使う16節の場面をデータにしたもの

import { clamp } from '../rng'
import { SEASON_WEEKS } from '../constants'
import { kindAtWeek, ownAlive, findTournament } from '../tournament'
import { addScoutPoints } from '../scout'
import { playerRating } from '../player'
import type { Player, SaveData } from '../types'
import { activeOwn, captain, daichi, month, ownOut, pendingGame, week, year } from './query'
import { addTrialMembers } from './setup'
import type { CharId, Face, NarrStep, BgStep, Scene, SayStep, StoryContext } from './types'
import { addAchievement, addCostume } from './rewards'

// ---------------------------------------------------------------- 台本を書くための短い関数

const NAMES: Record<CharId, string> = {
  nagi: 'ナギ',
  nagi_jh: 'ナギ',
  daichi: '大地',
  reika: 'レイカ',
  genzo: '源造',
  makabe: '真壁',
  kuga: '久我',
  tetsuro: '鉄郎',
  okochi: '大河内',
  grandpa: '祖父',
}

function say(char: CharId, face: Face, text: string): SayStep {
  return { kind: 'say', char, name: NAMES[char], face, text }
}
/** ナギの心の声（中身は鉄郎） */
function think(text: string, face: Face = 'normal', char: CharId = 'nagi'): SayStep {
  return { kind: 'say', char, name: 'ナギ（心）', face, text, think: true }
}
/** 鉄郎の心の声（入れ替わる前） */
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

const nagi = (face: Face, text: string): SayStep => say('nagi', face, text)
const daichiSay = (face: Face, text: string): SayStep => say('daichi', face, text)
const makabe = (face: Face, text: string): SayStep => say('makabe', face, text)
const genzo = (face: Face, text: string): SayStep => say('genzo', face, text)
const kuga = (face: Face, text: string): SayStep => say('kuga', face, text)
const reika = (face: Face, text: string): SayStep => say('reika', face, text)
const cap = (text: string): SayStep => voice('{主将}', text)

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
function byGrade(save: SaveData, grades: number[]): Player[] {
  return activeOwn(save).filter((p) => grades.includes(p.grade))
}

// ---------------------------------------------------------------- 条件

const Y = (c: StoryContext): number => year(c.save)
const W = (c: StoryContext): number => week(c.save)
const flag = (c: StoryContext, k: string): boolean => c.st.flags[k] !== undefined
const seen = (c: StoryContext, id: string): boolean => c.st.seen.includes(id)
/** 今週、自校がこの大会の初戦を戦う */
function firstGameOf(c: StoryContext, kind: string): boolean {
  const p = pendingGame(c.save)
  return !!p && p.t.kind === kind && p.round === 0
}
/** 自校がこれまでに全国大会に出たか */
const national = (c: StoryContext): boolean => flag(c, 'national')
/** 章の目標（3年目の夏までに全国出場）を達成したか */
const goalDone = (c: StoryContext): boolean => national(c)

// ---------------------------------------------------------------- 場面

export const CHAPTER1: Scene[] = [
  // ======================================== 序章（ゲーム開始）
  {
    id: 'c1_ano_yoru',
    title: 'あの夜',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg(null),
      n('黒い画面。地鳴りのような歓声'),
      voice('実況', '東京スカイライツ、日本一！　鬼頭監督、就任10年目でついに頂点へ！'),
      bg('bg_prostadium_night'),
      n('胴上げのあと。鉄郎がウイニングボールを右翼スタンドへ放る'),
      bg(null, 'ev_ano_yoru'),
      n('スタンドで、老人がそれを素手でつかみ取る'),
      tetsuroThink('やっと取った。…だが、選手を一から育てる時間は、もう俺には残っておらん', 'smile'),
      bg('bg_hotel_night'),
      n('その夜。祝勝会の後のホテルの廊下。鉄郎が一人、壁に手をついている'),
      tetsuroThink('もう一度、最初からやり直せたら――', 'frustrated'),
      bg('bg_street_sunset'),
      n('同じころ。球場からの帰り道。上機嫌の老人と、そのボールを持たされて退屈そうな少女'),
      voice('少女', '…野球の何が、そんなに楽しいの'),
      n('少女の手の中で、ボールが一瞬、白く光る'),
      tetsuroThink('…胸が、苦しい…', 'frustrated'),
      bg(null),
      n('画面が白くなる'),
    ],
  },
  {
    id: 'c1_mezame',
    title: '目覚め',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_nagi_room_jh_night'),
      n('目覚まし時計の音。見知らぬ女の子の部屋'),
      think('…ここはどこだ。病院じゃないな。やけに部屋がピンクい', 'normal', 'nagi_jh'),
      n('鏡に映る、セーラー服姿の少女'),
      say('nagi_jh', 'surprise', 'な、なんじゃこりゃあああっ！！'),
      voice('母親（声）', 'ナギー！　学校に遅れるわよー！'),
      think('ナギ？　学校？　…待て、落ち着け。監督というのは、想定外の事態でこそ冷静であれ。…無理だろ、これは！', 'surprise', 'nagi_jh'),
      n('台所。テレビが朝のニュースを流している'),
      voice('アナウンサー', '昨夜、祝勝会の後に倒れた鬼頭監督は意識を回復しましたが、記憶に障害が残っているとのことです'),
      say('nagi_jh', 'surprise', '…え？'),
      think('俺は、生きている？　じゃあ…ここにいる俺は、誰だ', 'surprise', 'nagi_jh'),
      voice('母親', 'あら、ナギがニュースなんて珍しい。野球なんて興味なかったでしょう'),
      voice('母親', 'おじいちゃんなんて昨日、スタンドで大はしゃぎして、今朝からぎっくり腰で寝込んでるわよ'),
      think('…スタンド？', 'normal', 'nagi_jh'),
      voice('母親', 'ほら、学校！　早く！　受験生なんだから'),
      think('考えるのは後だ。…監督というのは、分からんことは保留にして、目の前の試合をやるもんだ', 'normal', 'nagi_jh'),
    ],
  },
  {
    id: 'c1_jukensei',
    title: '受験生',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_classroom_day'),
      n('中学校の教室。進路希望の用紙。第一志望の欄に、元のナギの丸い字で「{学校名}」'),
      voice('担任', '朝比奈、志望校は変わらずでいいな。家から近いし、お前の成績なら大丈夫だ'),
      think('…この娘が、自分で決めた学校か', 'normal', 'nagi_jh'),
      bg('bg_nagi_room_jh_night'),
      n('その夜。台所のテレビ。地元のニュース'),
      voice('アナウンサー', '{学校名}の野球部で、監督が部費を使い込んだとして解任されました。野球部は半年間、対外試合を自粛するということです'),
      think('…よりによって、ここか', 'surprise', 'nagi_jh'),
      think('強い私立に行けば、野球はいくらでもできる。…だが、これはこの娘の人生だ。俺が勝手に行き先を変えるわけにはいかん', 'normal', 'nagi_jh'),
      n('冬。深夜の勉強机。連立方程式の参考書'),
      think('連立方程式…四十年ぶりだ。…采配より難しい', 'surprise', 'nagi_jh'),
      voice('母親（扉の外から）', 'ナギ、最近えらいそうねえ。…私の言うこと、やっと聞くようになったのねえ'),
      bg('bg_ground_day'),
      n('春。合格発表の掲示板'),
      say('nagi_jh', 'normal', '…あった'),
      think('これでこの娘の行き先は守った。…ただし高校生活は、勝手に野球部に捧げることになる。そこは許してもらおう', 'normal', 'nagi_jh'),
      n('1年目 4月。入学式の朝'),
    ],
  },
  {
    id: 'c1_haibu',
    title: '廃部寸前',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_ground_sunset'),
      n('放課後。荒れたグラウンドに、練習着の生徒が数人'),
      think('体は勝手にここへ来ちまうんだな。…ひどい。ベースは破れ、ネットは穴だらけ。ノックもバラバラだ', 'serious'),
      cap('…見学？　悪いけど、うちもうすぐなくなるかもしれないよ'),
      nagi('surprise', 'なくなるって…どういうことですか？'),
      cap('前の監督が部費を使い込んでさ。半年、対外試合禁止。俺たちも半分辞めて、今は8人しかいない。今日、やっと9人目が入った。監督もいない'),
      cap('それでも、最後の夏くらいは…一回でいいから、勝ちたいんだ'),
      think('…その目だ。優勝を知らない選手が、それでも諦めていない目。俺はこの目に弱いんだ', 'serious'),
      nagi('serious', '…マネージャー、募集してますか？'),
    ],
  },
  {
    id: 'c1_doukyuusei',
    title: '同級生',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_ground_sunset'),
      n('グラウンドの隅。制服のまま、一人で壁当てをしている男子'),
      daichiSay('surprise', '…あ、同じクラスの。朝比奈、だっけ'),
      daichiSay('smile', '俺、日向。今日入部した。9人目な。俺が入らなきゃ試合もできねえって拝まれてさ'),
      nagi('normal', 'ポジションは？'),
      daichiSay('normal', 'キャッチャー。中学でもやってたけど、一回も勝ったことねえよ'),
      think('いい肩だ。壁に当たる球が伸びている。…だが構えが正直すぎる。次に何を投げさせるか、全部顔に出る類いだ', 'serious'),
      daichiSay('smile', 'お前、マネージャーやんの？　変わってんな。こんな部で'),
      nagi('smile', 'こんな部だから、です'),
    ],
    onEnd: () => ['1年生の捕手、日向大地が部員に加わった。'],
  },
  {
    id: 'c1_sakusen_note',
    title: '作戦ノート',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_clubroom_day'),
      n('部室。分厚い『野球入門』を抱えた、若い先生'),
      makabe('normal', 'あ、新しいマネージャーさん？　助かるよ。僕、国語の真壁。この春から、この部の監督…ってことになってるんだけど'),
      makabe('troubled', '正直、ルールもよく分からなくて。インフィールドフライって、何？'),
      think('…終わった。', 'surprise'),
      n('その夜。ナギは一晩で、部員9人の分析と、練習計画と、采配のノートを書き上げる'),
      n('ノートの1ページ目には、太い字で「3年目の夏、全国へ連れていく」'),
      n('翌日。ノートを読んだ真壁が顔を上げる'),
      makabe('surprise', '…朝比奈さん。これ、君が書いたの？'),
      nagi('smile', 'はい。その、野球が好きで…祖父が監督をしていたので！'),
      think('嘘だ。祖父どころか俺本人だ'),
      makabe('serious', '僕には、この半分も分からない。でも、本気なことだけは分かる'),
      makabe('serious', '監督の名前は僕が背負う。責任も。だから…練習と試合の指示、君に任せてもいいかな'),
      {
        kind: 'choice',
        options: [
          {
            label: '任せてください。必ず勝たせます',
            reply: [makabe('smile', 'はは、頼もしいな')],
            apply: (x) => {
              motivation(regulars(x.save), 10)
              return ['部員全員のやる気が上がった。']
            },
          },
          {
            label: '…先生も一緒に覚えてくださいね',
            reply: [makabe('troubled', 'うっ、がんばります…')],
            apply: (x) => {
              x.save.managerExperience += 1
              return ['監督の経験が増えた（見立てが少し正確になる）。']
            },
          },
        ],
      },
      think('女子高生の体で、公立の弱小校。この鬼頭鉄郎、二度目の監督人生だ。…いや、マネージャー人生か', 'smile'),
      nagi('normal', '練習は、手札のカードで進むマスを選んで決めます。止まったマスの練習を、みんなでやるんです'),
      think('狙ったマスに止まるよう、数字を選べ。練習も采配も、先を読んだ奴が勝つ', 'serious'),
    ],
  },

  // ======================================== 1年目
  {
    id: 'c1_renshujiai',
    title: '初めての練習試合',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 2,
    steps: () => [
      bg('bg_ground_day'),
      makabe('smile', '近所の学校が、練習試合を引き受けてくれたよ！　自粛明けでどこも断られてたんだけど'),
      nagi('smile', 'ありがとうございます！　…じゃあまず、オーダーを組みましょう'),
      nagi('normal', '「チーム」の画面で、選手をつまんで打順を入れ替えます。守備位置は、札をつまむと入れ替えられます'),
      nagi('normal', '練習試合は「学校」の画面から申し込めます。試合が始まったら、作戦はいつでもボタンから出せます'),
      nagi('smile', '先生は…ベンチで堅く座っていてください'),
      makabe('troubled', 'は、はい…'),
    ],
  },
  {
    id: 'c1_renshujiai_after',
    title: '初めての練習試合（試合後）',
    chapter: 1,
    when: (c) => Y(c) <= 3 && flag(c, 'firstPractice'),
    steps: (c) =>
      c.st.flags.firstPractice === 'win'
        ? [
            bg('bg_ground_sunset'),
            cap('…勝った。練習試合だけど、勝ったぞ！'),
            think('練習試合でこの喜びようか。…悪くない', 'smile'),
            daichiSay('surprise', '…お前のサイン、全部当たってたな。なんで分かんの'),
            nagi('smile', '日向くんの顔に、全部書いてありましたから'),
          ]
        : [
            bg('bg_ground_sunset'),
            cap('やっぱり…俺たちじゃ'),
            nagi('serious', '今日の失点、半分は練習で消せます。残りの半分は、私の采配で消します'),
            think('さあ、ここからだ', 'serious'),
            daichiSay('normal', '…お前のサイン、ほとんど当たってたな。なんで分かんの'),
            nagi('smile', '日向くんの顔に、全部書いてありましたから'),
          ],
  },
  {
    id: 'c1_karinyubu',
    title: '仮入部',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 4,
    steps: () => [
      bg('bg_ground_day'),
      n('4月の終わり。仮入部の1年生が、グラウンドに顔を出すようになった'),
      cap('…やっと、紅白戦ができるな'),
      think('人数は力だ。…まずは、辞めさせないことからだな', 'smile'),
    ],
    onEnd: (c) => [`仮入部の1年生${addTrialMembers(c.save, c.rng)}人が入部した。`],
  },
  {
    id: 'c1_shoutenkai',
    title: '商店会長',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 5,
    steps: () => [
      bg('bg_ground_day'),
      n('練習中のグラウンドに、法被姿の大柄な男が乗り込んでくる'),
      genzo('angry', 'おう、真壁先生！　OB会長の日向だ。…マネージャーが采配しとるって噂、本当か'),
      makabe('troubled', 'あ、あの、それは…'),
      genzo('angry', '女の子に何ができる。野球ってのはな、根性と――'),
      nagi('normal', 'どうぞ'),
      n('ナギが作戦ノートを差し出す。源造がページをめくる手が、途中で止まる'),
      genzo('serious', '…この打順。2番に一番いい打者を置いとるな'),
      nagi('normal', 'はい。打席が多く回ってきて、一番点に絡む場所ですから'),
      genzo('serious', '…'),
      genzo('serious', '…根性も、大事だからな'),
      n('翌週。部室の前に、段ボールいっぱいのスポーツドリンク。伝票には「日向酒店」'),
      daichiSay('smile', '親父が口で負けて帰ってきたの、初めて見た'),
      nagi('surprise', '…日向くんの、お父さん？'),
      think('どうりで声が大きいと思った'),
    ],
    onEnd: (c) => {
      const own = c.save.schools[c.save.playerSchoolId]!
      own.funds += 20
      return ['OB会から差し入れが届いた（部費 +20万円）。']
    },
  },
  {
    id: 'c1_hajimete_koushiki',
    title: '初めての公式戦',
    chapter: 1,
    when: (c) => Y(c) <= 3 && !!pendingGame(c.save),
    steps: () => [
      bg('bg_stadium_day'),
      cap('初戦の相手、{相手校}だって。…正直、勝てる気がしない'),
      nagi('normal', '勝てないんじゃないです。まだ、勝ち方を知らないだけです'),
      nagi('smile', 'だから明日は、勝ち方を一つだけ覚えて帰りましょう'),
      think('…今の、かなり監督っぽかったな。気をつけねば', 'surprise'),
    ],
  },
  {
    id: 'c1_scout',
    title: '中学生を見に行く',
    chapter: 1,
    when: (c) => flag(c, 'scoutOpened'),
    steps: () => [
      bg('bg_ground_day'),
      n('中学校のグラウンド。保護者席'),
      nagi('serious', '…あのショート、一歩目が速い。肩はまだ弱いけど、冬で化ける'),
      voice('保護者の父親', '…お嬢ちゃん、えらい詳しいね。プロのスカウトみたいだ'),
      nagi('surprise', 'えっ！　いえ、その、野球中継をよく見ていて…！'),
      think('独り言の癖、直さんとまずいな'),
      nagi('normal', 'スカウトでは、中学生を「視察」して能力を確かめ、「勧誘」でうちに来てもらいます'),
    ],
    onEnd: (c) => {
      addScoutPoints(c.save, 1)
      return ['スカウトの回数が1回増えた。']
    },
  },
  {
    id: 'c1_saigo_no_natsu',
    title: '最後の夏',
    chapter: 1,
    when: (c) => Y(c) === 1 && firstGameOf(c, 'summerPref'),
    steps: () => [
      bg('bg_clubroom_day'),
      cap('朝比奈。…この3か月で、俺たち本当に強くなったと思う'),
      cap('だから、頼む。一回でいい。勝たせてくれ'),
      {
        kind: 'choice',
        options: [
          {
            label: '一回じゃなくて、勝てるだけ勝ちましょう',
            reply: [cap('…欲張りだな、お前')],
            apply: (x) => {
              form(byGrade(x.save, [3]), 1)
              return ['3年生の調子が上がった。']
            },
          },
          {
            label: '勝つのは先輩たちです。私は道を示すだけ',
            reply: [cap('はは、かっこいいな')],
            apply: (x) => {
              motivation(byGrade(x.save, [3]), 15)
              return ['3年生のやる気が上がった。']
            },
          },
        ],
      },
    ],
  },
  {
    id: 'c1_hatsushouri',
    title: '初勝利',
    chapter: 1,
    when: (c) => flag(c, 'firstWin'),
    steps: () => [
      bg('bg_stadium_day'),
      n('試合後。部員が校歌を歌う。音程は外れている'),
      makabe('surprise', '勝っ…たんだよね？　これ、勝ったんだよね！？'),
      think('初めて采配した試合も、こんな風だった。ベンチで、しょうもなく踏ん張っていた', 'smile'),
      nagi('smile', 'はい。この部の、新しい一勝目です'),
      daichiSay('smile', '…校歌って、こんなに声出るもんなんだな'),
    ],
    onEnd: (c) => {
      motivation(regulars(c.save), 10)
      return ['部員全員のやる気が上がった。', ...addAchievement(c.st, 'はじめての一勝'), ...addCostume(c.st, 'はじめての一勝')]
    },
  },
  {
    id: 'c1_namida',
    title: '3年生の涙',
    chapter: 1,
    when: (c) => Y(c) === 1 && !flag(c, 'firstWin') && ownOut(c.save, 1, 'summerPref'),
    steps: () => [
      bg('bg_stadium_day'),
      cap('…悪い、朝比奈。せっかく作戦、立ててくれたのに'),
      nagi('frustrated', '謝らないでください。負けたのは、私の采配です'),
      cap('…来年は、こいつらに勝たせてやってくれ'),
      think('何度たっても、この場面だけは慣れんな', 'frustrated'),
      daichiSay('frustrated', '…来年は、俺たちの番だ'),
    ],
    onEnd: (c) => {
      motivation(byGrade(c.save, [1, 2]), 10)
      return ['1・2年生のやる気が上がった。']
    },
  },
  {
    id: 'c1_sofu',
    title: '祖父',
    chapter: 1,
    when: (c) => {
      if (Y(c) !== 1 || W(c) < 18) return false
      const nat = findTournament(c.save, 1, 'summerNational')
      return W(c) >= SEASON_WEEKS.thirdYearRetire || !nat || !ownAlive(c.save, nat)
    },
    steps: () => [
      bg(null),
      n('母親に連れられて行った病室。ベッドの上で、老人が笑っている'),
      say('grandpa', 'smile', 'ナギが野球部だと！？　いやあ、長生きはするもんだ'),
      nagi('normal', 'おじいちゃん、野球が好きなんですね'),
      say('grandpa', 'smile', 'なんだ、そのよそ行きの言葉づかいは。…あの夜のこと、覚えとるか。お前、退屈そうにしとったなあ'),
      think('あの夜？　…この娘は、あの日、球場にいたのか', 'surprise'),
      say('grandpa', 'smile', 'あの夜の宝物はな、一番の友達に預けた。わしより長生きしそうなやつにな'),
      nagi('surprise', '宝物？'),
      n('祖父は笑って、それ以上は言わない'),
      say('grandpa', 'smile', '勝てよ、ナギ'),
    ],
  },
  {
    id: 'c1_shin_team',
    title: '新チーム',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) > SEASON_WEEKS.thirdYearRetire,
    steps: (c) => {
      const list = activeOwn(c.save).filter((p) => !p.helper)
      const used = new Set<string>()
      const top = [...list].sort((a, b) => playerRating(b) - playerRating(a)).find((p) => !used.has(p.id))
      if (top) used.add(top.id)
      const loud = [...list].sort((a, b) => b.condition.motivation - a.condition.motivation).find((p) => !used.has(p.id))
      if (loud) used.add(loud.id)
      const d = daichi(c.save, c.st)
      const catcher = d && !d.retired && !used.has(d.id) ? d : list.find((p) => p.mainPosition === 'C' && !used.has(p.id))
      const options = []
      if (top) {
        options.push({
          label: `実力で引っ張る${top.surname}`,
          reply: [nagi('normal', '背中で引っ張ってほしいんです')],
          apply: (x: StoryContext) => {
            x.st.captainId = top.id
            if (!top.skills.includes('pillar') && x.rng.chance(0.5)) {
              top.skills.push('pillar')
              return [`${top.surname}が主将になった。「チームの大黒柱」を身に付けた！`]
            }
            return [`${top.surname}が主将になった。`]
          },
        })
      }
      if (loud) {
        options.push({
          label: `声で引っ張る${loud.surname}`,
          reply: [nagi('smile', '一番声が出てるのは、あの人です')],
          apply: (x: StoryContext) => {
            x.st.captainId = loud.id
            motivation(regulars(x.save), 5)
            return [`${loud.surname}が主将になった。部員全員のやる気が上がった。`]
          },
        })
      }
      if (catcher) {
        const isDaichi = catcher.id === c.st.daichiId
        options.push({
          label: `守備の要の${catcher.surname}${isDaichi ? '（大地）' : ''}`,
          reply: [nagi('serious', '試合を一番見ているのは、捕手ですから'), ...(isDaichi ? [daichiSay('surprise', '俺かよ…。まあ、やるけどさ')] : [])],
          apply: (x: StoryContext) => {
            x.st.captainId = catcher.id
            catcher.common.clutch = clamp(catcher.common.clutch + 3, 1, 99)
            return [`${catcher.surname}が主将になった。チャンスへの強さが上がった。`]
          },
        })
      }
      return [
        bg('bg_clubroom_day'),
        n('3年生が引退し、新チームが始まる'),
        makabe('normal', '新しい主将、どうしようか。朝比奈さんは誰がいいと思う？'),
        ...(options.length ? [{ kind: 'choice' as const, options }] : []),
      ]
    },
  },
  {
    id: 'c1_zettai_ouja',
    title: '絶対王者',
    chapter: 1,
    when: (c) => Y(c) === 1 && kindAtWeek(W(c)) === 'autumnPref',
    steps: () => [
      bg('bg_stadium_day'),
      n('別の球場。{ライバル}が大差で勝っている'),
      makabe('normal', '{ライバル}。この県の、絶対王者だって'),
      think('穴のないチームだ。捕手を中心に、全員が一つの生き物みたいに動く。…この守り方、どこかで', 'serious'),
      n('ベンチから出てくる監督。ナギが息をのむ'),
      kuga('normal', '…'),
      think('久我…！　俺が育てた捕手が、こんなところで監督を？', 'surprise'),
      think('…どうりで。あの守りは、俺が教えた守りだ', 'serious'),
      nagi('serious', '…先生。いつか、あの学校に勝ちます'),
    ],
  },
  {
    id: 'c1_y1_end',
    title: '1年目の締めくくり',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 52,
    steps: (c) =>
      flag(c, 'firstWin')
        ? [
            bg('bg_ground_sunset'),
            makabe('smile', '1年前、この部が残るなんて誰も思ってなかったよ'),
            nagi('smile', '残っただけじゃありません。これから上がるんです'),
          ]
        : [
            bg('bg_ground_sunset'),
            think('勝てなかった。だが、はじめの1年はどこでもそうだ。土を耕す年だ', 'serious'),
            nagi('serious', '来年は、勝ちます'),
          ],
  },

  // ======================================== 2年目
  {
    id: 'c1_atarashii_nakama',
    title: '新しい仲間',
    chapter: 1,
    when: (c) => Y(c) === 2,
    steps: (c) => {
      const scouted = c.save.log.some((l) => l.year === 2 && l.text.includes('スカウトした'))
      return [
        bg('bg_clubroom_day'),
        n('部室の前に、入部希望の新入生が並んでいる'),
        ...(scouted
          ? [
              voice('{新入生}', '去年、中学の試合を見に来てた人ですよね？　「一歩目が速い」って言ってたの、聞こえてました'),
              think('聞こえていたのか。…独り言の癖、本当に直さんとまずい', 'surprise'),
              nagi('smile', 'ようこそ、{学校名}野球部へ'),
            ]
          : [
              voice('{新入生}', '去年の秋、ここの試合を見て…なんか、楽しそうだったんで'),
              think('スカウトより口コミが効くこともある。結果を出せば、人は勝手に集まる', 'smile'),
            ]),
        makabe('smile', '部員、{部員数}人か。去年の春は9人だったのにね'),
      ]
    },
    onEnd: (c) => {
      motivation(byGrade(c.save, [1]), 10)
      return ['新入生のやる気が上がった。']
    },
  },
  {
    id: 'c1_hariai',
    title: '張り合い',
    chapter: 1,
    when: (c) => Y(c) === 2 && kindAtWeek(W(c)) === 'springPref',
    steps: () => [
      bg('bg_stadium_day'),
      n('スタンド。日傘を差した少女が、スコアブックを広げている'),
      reika('normal', 'あなたが{学校名}のマネージャー？　白鳥レイカ。{ライバル}のマネージャーよ'),
      reika('normal', 'ついこの前まで1勝もできなかった学校が、急に勝ち始めた。偵察に来る理由としては十分でしょう？'),
      nagi('smile', 'わざわざありがとうございます。…でも、本当のデータは見せませんよ'),
      reika('serious', 'ふうん。ベンチでサインを出しているの、監督じゃなくてあなたね'),
      think('…この娘、目がいい', 'surprise'),
      {
        kind: 'choice',
        options: [
          {
            label: '何のことでしょう？',
            reply: [reika('normal', 'とぼけるのね。いいわ、夏に分かるもの')],
            apply: (x) => {
              const p = captain(x.save, x.st)
              if (p) form([p], 1)
              return p ? [`${p.surname}の調子が上がった。`] : []
            },
          },
          {
            label: 'ええ。夏、楽しみにしていてください',
            reply: [reika('serious', '…宣戦布告と受け取っておくわ')],
            apply: (x) => {
              motivation(regulars(x.save), 5)
              return ['部員全員のやる気が上がった。']
            },
          },
        ],
      },
      think('あの年で、ここまで相手を見るか。久我の仕込みだな。…悪くない', 'smile'),
    ],
  },
  {
    id: 'c1_shuzai',
    title: '取材',
    chapter: 1,
    when: (c) => Y(c) === 2 && month(c.save) === 6 && (flag(c, 'firstWin') || (c.save.schools[c.save.playerSchoolId]?.reputation ?? 0) >= 30),
    steps: () => [
      bg('bg_clubroom_day'),
      voice('記者', '地元新聞の者です。最近の{学校名}さん、采配が面白いと評判でして'),
      makabe('troubled', 'さ、采配ですか。ええと、それは、その…'),
      think('先生、目が泳いでいる'),
      voice('記者', '送りバントをほとんどしない。初回から走る。昔のスカイライツの鬼頭監督みたいだって、うちの年配の記者が言うんですよ'),
      nagi('surprise', 'ごほっ！　ごほっ！'),
      makabe('surprise', '朝比奈さん、大丈夫？'),
      nagi('surprise', 'だ、大丈夫です！　先生、鬼頭監督の大ファンなんですよね！　ねっ！'),
      makabe('troubled', 'え？　あ、う、うん…？'),
      voice('記者', '…昔の鬼頭監督みたいだって。あの方も記憶をなくされて、今はどこでどうされているのやら'),
      think('記憶をなくした俺が、どこかにいる。…会ってみたい気もするし、怖くもある', 'serious'),
    ],
    onEnd: (c) => {
      const own = c.save.schools[c.save.playerSchoolId]!
      own.reputation = clamp(own.reputation + 3, 0, 100)
      return ['新聞に載った（評判が上がった）。']
    },
  },
  {
    id: 'c1_ouja_mae',
    title: '王者との対戦',
    chapter: 1,
    when: (c) => {
      const p = pendingGame(c.save)
      return Y(c) <= 3 && !!p && p.opponentId === c.st.rivalId && seen(c, 'c1_zettai_ouja')
    },
    steps: () => [
      bg('bg_stadium_day'),
      n('整列の前。相手ベンチの前に、久我が立っている'),
      kuga('normal', '真壁監督ですね。{ライバル}の久我です。今日はよろしくお願いします'),
      makabe('surprise', 'よ、よろしくお願いします！'),
      kuga('normal', '…マネージャーさんも'),
      think('背が伸びたな、久我。…いや、俺が縮んだのか'),
      nagi('serious', '相手は王者です。だから、失うものはありません。一つずつ取りに行きましょう'),
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
            kuga('normal', 'そうですか'),
            n('久我が、ナギのほうを見る'),
            reika('serious', '…次は負けないから'),
            nagi('smile', 'はい。次も勝ちます'),
            kuga('smile', '君、いい肩だね。ただ、構えが正直すぎる'),
            daichiSay('surprise', '…それ、マネージャーにも言われました'),
          ]
        : [
            bg('bg_stadium_day'),
            kuga('smile', 'いいチームです。守備位置の指示が細かい。…懐かしいくらいだ'),
            reika('normal', '今年はうちの勝ち。でも、来年も同じだとは思ってないわ'),
            nagi('frustrated', '…来年、必ず'),
            think('教え子に負けるのは、嬉しいのか悔しいのか。…悔しいに決まっている', 'frustrated'),
            kuga('normal', '君、いい肩だね。ただ、構えが正直すぎる'),
            daichiSay('surprise', '…それ、マネージャーにも言われました'),
          ],
    onEnd: (c) => {
      if (rivalResult(c) === 'win') {
        motivation(regulars(c.save), 15)
        return ['部員全員のやる気が上がった。', ...addAchievement(c.st, '王者撃破')]
      }
      motivation(byGrade(c.save, [1, 2]), 10)
      return ['1・2年生のやる気が上がった。']
    },
  },
  {
    id: 'c1_best4',
    title: 'ベスト4',
    chapter: 1,
    when: (c) => flag(c, 'best4'),
    steps: () => [
      bg('bg_liquor_day'),
      n('校門に「祝 県ベスト4」の垂れ幕。商店街から差し入れが届く'),
      genzo('smile', 'おう、野球部！　これ、うちのラムネだ。飲んでけ！'),
      cap('去年までは、誰も声なんてかけてこなかったのにな'),
      voice('校長', '真壁先生、いやあ素晴らしい。来年度の部費、少し考えましょう'),
      makabe('smile', 'あ、ありがとうございます！'),
      makabe('smile', '（小声で）…朝比奈さんのおかげだよ'),
      nagi('smile', '次は、もっと上ですよ'),
    ],
    onEnd: (c) => {
      const own = c.save.schools[c.save.playerSchoolId]!
      own.funds += 30
      return ['部費 +30万円。', ...addAchievement(c.st, '県ベスト4'), ...addCostume(c.st, '県ベスト4')]
    },
  },
  {
    id: 'c1_ato_ippo',
    title: 'あと一歩',
    chapter: 1,
    when: (c) => Y(c) === 2 && !flag(c, 'best4') && ownOut(c.save, 2, 'summerPref'),
    steps: () => [
      bg('bg_stadium_day'),
      cap('…またあと一歩か'),
      nagi('normal', '去年は、あと一歩すらありませんでした。距離は確実に縮んでいます'),
    ],
  },
  {
    id: 'c1_mae_no_kantoku',
    title: '前の監督',
    chapter: 1,
    when: (c) => Y(c) === 2 && month(c.save) === 9,
    steps: () => [
      bg('bg_street_sunset'),
      n('夕方の商店街。スポーツ用品店で、ナギがボールを選んでいる'),
      say('okochi', 'normal', '…{学校名}の、マネージャーさん？'),
      nagi('normal', 'はい。…どこかでお会いしましたか'),
      say('okochi', 'smile', 'いや…。夏、見てたよ。いいチームになった'),
      say('okochi', 'serious', 'あいつらに、伝えて――'),
      say('okochi', 'normal', '…いや、いい。俺が言えることじゃない。ボール、少しまけとくよ'),
      n('男が奥へ引っ込む。レジ横の名札に「大河内」'),
      think('大河内。…使い込みで辞めた前の監督か。あの顔は、逃げた人間の顔じゃなかった', 'serious'),
    ],
  },
  {
    id: 'c1_daichi_ketsui',
    title: '大地の決意',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 31,
    steps: (c) => [
      bg('bg_street_sunset'),
      n('夕暮れの商店街。アーケードを二人で歩く'),
      daichiSay('normal', 'なあ、朝比奈'),
      ...(national(c)
        ? [daichiSay('smile', '全国、行けちまったな。…じゃあ次は、全国で勝つ。お前と'), nagi('smile', '欲張りですね。…約束です')]
        : [
            daichiSay('normal', '俺さ、中学のとき一回も勝てなかったから、高校も適当にやって終わるんだと思ってた'),
            daichiSay('serious', 'でも今は、勝ちたい。3年の夏、絶対に全国に行く'),
            daichiSay('serious', '…お前と'),
            nagi('surprise', '…私と、ですか'),
            daichiSay('smile', 'お前が書いたんだろ。ノートの1ページ目に、でっかい字で'),
            think('見られていたのか', 'surprise'),
            nagi('smile', 'はい。約束です'),
          ]),
      think('青春だな。…俺のではないが', 'smile'),
    ],
    onEnd: (c) => {
      const d = daichi(c.save, c.st)
      if (!d) return []
      motivation([d], 10)
      form([d], 1)
      return ['大地のやる気と調子が上がった。']
    },
  },
  {
    id: 'c1_y2_end',
    title: '2年目の締めくくり',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 52,
    steps: (c) => [
      bg('bg_street_sunset'),
      n('冬。祖父の葬儀の帰り道'),
      think('宝物のことは、結局聞けずじまいだった。…この娘の祖父に、勝つところを見せたかった', 'frustrated'),
      bg('bg_ground_sunset'),
      ...(flag(c, 'best4')
        ? [
            makabe('smile', 'ベスト4か。1年前の僕に言っても信じないだろうな'),
            makabe('smile', 'あと、インフィールドフライ、分かるようになったよ'),
            nagi('smile', '先生、それ去年の4月の話です'),
          ]
        : [think('目標には届かなかった。だが、王者の背中は見えた', 'serious')]),
      nagi('serious', '来年が、私の最後の年です'),
    ],
  },

  // ======================================== 3年目
  {
    id: 'c1_saigo_no_ichinen',
    title: '最後の1年',
    chapter: 1,
    when: (c) => Y(c) === 3,
    steps: () => [
      bg('bg_ground_day'),
      n('桜の下。ナギが部員名簿を眺めている'),
      makabe('normal', '朝比奈さんも3年生か。早いね'),
      think('高校生活もあと1年。…その先はどうなる。この体のまま年を重ねるのか。それとも、ある朝また別の誰かになっているのか', 'serious'),
      think('…考えても仕方ない。監督は、目の前の試合しか采配できん'),
      nagi('serious', '先生。今年は、全国に行きます'),
      makabe('smile', '…うん。言うと思った'),
    ],
    onEnd: (c) => {
      motivation(regulars(c.save), 5)
      return ['部員全員のやる気が上がった。']
    },
  },
  {
    id: 'c1_shi_no_omokage',
    title: '師の面影',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 10 && W(c) <= 14 && (flag(c, 'metRival_3') || W(c) >= 13),
    steps: () => [
      bg('bg_stadium_day'),
      n('球場の通路。久我が一人で待っている'),
      kuga('normal', '朝比奈さん、だったね。少しいいかな'),
      kuga('normal', '君の采配は、ある人にそっくりなんだ。僕が現役だった頃の監督に'),
      kuga('normal', '1点が欲しい場面ほど、打者に任せる。守備位置は打者ごとに一歩単位で動かす。…それに、ピンチで帽子のつばを二回触る癖'),
      think('…しまった。癖は体が変わっても抜けないのか', 'surprise'),
      {
        kind: 'choice',
        options: [
          {
            label: '祖父が、その方の大ファンだったので',
            reply: [kuga('smile', '…そうか。いいお祖父さんだね')],
            apply: (x) => {
              x.st.flags.kugaTalk = 'fan'
            },
          },
          {
            label: 'その監督さんは、どんな人でしたか？',
            reply: [
              kuga('smile', '怖い人だったよ。でも、選手を一度も見捨てなかった。僕が肩を壊して辞めたとき、最初に電話をくれたのもあの人だった'),
              think('…覚えていたのか、そんなこと', 'frustrated'),
            ],
            apply: (x) => {
              x.st.flags.kugaTalk = 'ask'
            },
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
      bg('bg_clubroom_day'),
      n('決勝前夜の部室。部員が全員集まっている'),
      daichiSay('normal', '朝比奈、何か言ってくれよ'),
      nagi('normal', '…2年前、この部には9人しかいませんでした。グラウンドは荒れて、練習試合も断られて'),
      nagi('normal', 'それでも、誰も辞めなかった。だから今、ここにいます'),
      nagi('serious', '明日は、勝ち方を知っているチームとして試合をしてきてください'),
      think('日本一の前の晩、俺は選手に何を言ったんだったか。…忘れた。今日の言葉のほうが、ずっと大事だ'),
      daichiSay('smile', '明日は、俺の構え、正直じゃないぞ'),
      nagi('smile', '知っています。この1年、全然読めなくなりましたから'),
    ],
    onEnd: (c) => {
      form(regulars(c.save), 1)
      return ['試合に出る選手の調子が上がった。']
    },
  },
  {
    id: 'c1_zenkoku',
    title: '全国へ',
    chapter: 1,
    when: (c) => national(c) && Y(c) <= 3,
    steps: (c) => {
      const early = Number(c.st.flags.national) < 3
      return [
        bg('bg_stadium_day'),
        n('優勝の瞬間。ベンチを飛び出す部員たち'),
        makabe('surprise', '朝比奈さん！　全国、全国だよ！'),
        nagi('normal', '…はい'),
        n('マウンドの輪から抜け出して、大地がベンチに駆けてくる'),
        daichiSay('smile', '朝比奈！'),
        ...(early
          ? [daichiSay('smile', '…約束、1年早く守っちまったな'), nagi('smile', 'じゃあ来年は、もう一度守ってください')]
          : [
              daichiSay('smile', '…約束、守ったぞ'),
              nagi('smile', '…はい。守ってもらいました'),
              think('選手に約束を守られたことは、何度もある。…だが、こんなに視界がにじんだことはない', 'smile'),
            ]),
        bg('bg_prostadium_night'),
        n('全国大会の開会式。入場行進する部員を、スタンドから見るナギ'),
        nagi('smile', '（涙をぬぐう）'),
        think('プロで日本一になった夜より、なぜか胸が熱い。…年のせいか。いや、今は17だった', 'smile'),
        kuga('smile', '（電話）おめでとう。君たちの勝ちだ。全国でも、あの野球を見せてくれ'),
      ]
    },
    onEnd: (c) => [...addAchievement(c.st, '全国初出場'), ...addCostume(c.st, '応援')],
  },
  {
    id: 'c1_zenkoku_renzoku',
    title: '全国へ（連続出場）',
    chapter: 1,
    when: (c) => Y(c) === 3 && seen(c, 'c1_zenkoku') && Number(c.st.flags.national) < 3 && (flag(c, 'national_3_summerNational') || flag(c, 'national_3_springNational')),
    steps: () => [
      bg('bg_stadium_day'),
      daichiSay('smile', '2年連続だぞ。…これで文句ないだろ'),
      nagi('smile', '文句は、全国で勝ってから考えます'),
    ],
    onEnd: (c) => addAchievement(c.st, '全国連続出場'),
  },
  {
    id: 'c1_todokanakatta',
    title: '届かなかった夏',
    chapter: 1,
    when: (c) => Y(c) === 3 && !goalDone(c) && ownOut(c.save, 3, 'summerPref'),
    steps: () => [
      bg('bg_stadium_day'),
      daichiSay('frustrated', 'ごめん、朝比奈。お前を全国に連れて行けなかった'),
      nagi('frustrated', '連れて行ってもらうつもりなんて、ありませんでした。一緒に行きたかったんです'),
      nagi('normal', '…信じてくれて、ありがとうございました'),
      think('選手の夏は、毎年必ず終わる。だから監督は、続けなきゃならん', 'frustrated'),
      daichiSay('frustrated', '…約束、守れなかったな'),
      nagi('frustrated', '破ったのは、私も同じです'),
      daichiSay('smile', '…じゃあ、貸し借りなしだな'),
      think('こいつは、負けた日に人を励まそうとする。…捕手に向いている', 'smile'),
    ],
    onEnd: (c) => {
      motivation(byGrade(c.save, [1, 2]), 10)
      return ['1・2年生のやる気が上がった。']
    },
  },
  {
    id: 'c1_shinro',
    title: '進路',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= 44,
    steps: () => [
      bg('bg_clubroom_day'),
      n('放課後の部室。机の上に白紙の進路希望調査票'),
      makabe('normal', '進路、まだ出してないんだって？　担任の先生が困ってたよ'),
      nagi('serious', '…教員になります。ここに戻ってきて、この部の監督になります'),
      makabe('serious', '…そうか'),
      makabe('smile', 'じゃあ、それまで監督の名前は僕が預かっておくよ。君は外部コーチとして来ればいい。校長には僕から話す'),
      nagi('surprise', '先生…'),
      makabe('smile', 'その代わり、大学ではちゃんと勉強すること。インフィールドフライは、僕が教えてあげるから'),
      think('…この人が監督で、本当によかった', 'smile'),
      bg('bg_liquor_day'),
      n('日向酒店の店先。大地が空き瓶のケースを運んでいる'),
      daichiSay('normal', '俺は店を継ぐ。野球は…草野球でいいや'),
      nagi('normal', 'もったいないですね。いい捕手なのに'),
      daichiSay('smile', 'お前は先生になるんだろ。…戻ってきたら、店に寄れよ。ラムネくらい出してやる'),
      think('この男は、大事なことをだいたいラムネで済ませる', 'smile'),
    ],
  },
  {
    id: 'c1_sotsugyou',
    title: '卒業式',
    chapter: 1,
    when: (c) => Y(c) === 3 && W(c) >= SEASON_WEEKS.graduation,
    steps: () => [
      bg('bg_ground_day'),
      n('卒業式の後のグラウンド。後輩たちが整列している'),
      voice('後輩の主将', '朝比奈先輩！　3年間、ありがとうございました！'),
      voice('部員一同', 'ありがとうございました！'),
      nagi('normal', '…来月からも普通に来ますけどね'),
      voice('後輩の主将', '…え？'),
      makabe('smile', '外部コーチとして、来週から来てもらうんだ'),
      voice('部員一同', '感動を返してください！'),
      nagi('smile', '…でも、ありがとう。みんな'),
      genzo('smile', '卒業おめでとう！　うちのバカ息子も、よう卒業できた！'),
      daichiSay('troubled', '親父、声でけえよ…'),
      genzo('serious', '朝比奈さん、あんたのおかげでこの部は生き返った。OB会を代表して礼を言う'),
      genzo('normal', '…それとな、あんたのおじいさんとは、昔からの飲み仲間だったんだ'),
      nagi('surprise', '祖父と？'),
      genzo('cry', 'あいつが生きてたら、今日は大泣きだったろうなあ'),
      think('…一番の友達。まさかな', 'serious'),
      n('校門。{ライバル}の制服のレイカが待っている'),
      reika('normal', '卒業おめでとう。…大学に行っても、あなたとは張り合うから'),
      nagi('smile', '望むところです'),
      bg(null),
      n('第1章「再建」　完'),
      n('第2章「外部コーチ」は、次のアップデートで公開します。それまでは、このまま部を育て続けられます'),
    ],
    onEnd: (c) => {
      const msgs = [...addCostume(c.st, '卒業式')]
      c.st.chapter = 2
      return [...msgs, '第1章「再建」をクリアした！']
    },
  },
]

/** 夏の県大会（2年目）でライバル校と当たった試合の結果。まだなら null */
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

