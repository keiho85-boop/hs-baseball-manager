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
import type { CharId, Face, NarrStep, BgStep, Scene, SayStep, StoryContext, TitleStep } from './types'
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
  grandpa_hosp: '祖父',
  mob_cap: '{主将}',
  nagi_beach: 'ナギ',
  reika_beach: 'レイカ',
}

function say(char: CharId, face: Face, text: string): SayStep {
  return { kind: 'say', char, name: NAMES[char], face, text }
}
/** ナギの心の声（中身は鉄郎） */
function think(text: string, face: Face = 'normal', char: CharId = 'nagi'): SayStep {
  return { kind: 'say', char, name: 'ナギ（心）', face, text, think: true }
}
/** 中学生のナギの心の声 */
function thinkJh(text: string, face: Face = 'normal'): SayStep {
  return think(text, face, 'nagi_jh')
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
/** 画面中央のタイトルコール（時間や場所が飛ぶところ） */
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
const cap = (text: string): SayStep => voice('{主将}', text)
/** 1年目の3年生の主将（帽子を深くかぶったモブ。立ち絵あり） */
const cap1 = (text: string, face: Face = 'normal'): SayStep => say('mob_cap', face, text)
const grandpa = (text: string): SayStep => say('grandpa', 'smile', text)

/** 場面のあとに、操作のチュートリアルを始める */
function startGuide(c: StoryContext, id: 'practice' | 'funds' | 'order' | 'scout'): void {
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
    sub: '第1章「再建」',
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
      n('右手を上げる。鏡の中の少女も、右手を上げる'),
      n('左手を上げる。少女も、左手を上げる。頬をつねる。少女も、頬をつねる'),
      thinkJh('…痛い。夢ではない', 'surprise'),
      nagiJh('surprise', 'な、なんだこれはあああっ！？'),
      thinkJh('声が高い！　腕が細い！　背が低い！　…腰が、痛くない！？', 'surprise'),
      thinkJh('三十年来の腰痛が消えている…。いや、喜んでいる場合ではない', 'surprise'),
      voice('母親（声）', 'ナギー！　起きてるのー？　学校に遅れるわよー！'),
      thinkJh('ナギ？　学校？　…落ち着け。監督というのは、想定外のときほど冷静であるべきだ。…いや、これは無理だ！', 'surprise'),
      bg('bg_living_morning'),
      n('台所。テレビが朝のニュースを流している'),
      voice('アナウンサー', '昨夜、祝勝会のあとに倒れた鬼頭監督は意識を取り戻しましたが、記憶に障害が残っているとのことです'),
      nagiJh('surprise', '…え？'),
      thinkJh('俺は、生きているのか。…では、ここにいる俺は誰だ', 'surprise'),
      voice('母親', 'あら、ナギがニュースを見てるなんて珍しい。野球なんて興味なかったでしょう'),
      voice('母親', 'おじいちゃんなんて昨日、スタンドで大はしゃぎして、今朝からぎっくり腰で寝込んでるわよ'),
      thinkJh('…スタンド？'),
      voice('母親', 'ほら、早く食べて。受験生なんだから、遅刻なんてしてられないでしょう'),
      thinkJh('考えるのは後回しだ。分からないことは保留にして、目の前の試合をこなす。…監督の鉄則だ', 'serious'),
    ],
  },
  {
    id: 'c1_jukensei',
    title: '受験生',
    chapter: 1,
    sub: '中学3年の秋',
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_classroom_day'),
      n('中学校の教室。配られた進路希望の用紙。第一志望の欄には、元のナギの丸い字で「{学校名}」'),
      voice('担任', '朝比奈、志望校は変わらずでいいな。家から近いし、今の成績なら心配ない'),
      thinkJh('…この娘が、自分で決めた学校か'),
      bg('bg_nagi_room_jh_night'),
      n('その夜。スマートフォンに、地元のニュースが届く'),
      voice('ニュース', '{学校名}野球部の監督が部費を私的に使っていたとして解任。野球部は春まで、対外試合を自粛'),
      thinkJh('…よりによって、ここか', 'surprise'),
      thinkJh('強い私立へ行けば、野球はいくらでもできる。…だが、これはこの娘の人生だ。俺の都合で行き先を変えるわけにはいかん'),
      title('冬', '受験勉強'),
      n('深夜の勉強机。開いたままの数学の参考書'),
      thinkJh('連立方程式…。四十年ぶりだ。…采配より、よほど難しい', 'surprise'),
      voice('母親（扉の外から）', 'ナギ、最近ずいぶん勉強してるのねえ。…お母さんの言うこと、やっと聞く気になったのね'),
      thinkJh('すまん、母上。中身は、あなたより年上だ'),
      title('合格発表の日', '3月'),
      bg('bg_exam_board'),
      n('掲示板の前に、受験生と保護者の人だかり'),
      nagiJh('normal', '…あった'),
      thinkJh('これで、この娘の行き先は守った。…ただし高校の3年間は、野球部に使わせてもらう。そこは許してくれ'),
    ],
  },
  {
    id: 'c1_haibu',
    title: '廃部寸前',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      title('入学の日', '1年目 4月'),
      bg('bg_entrance_ceremony'),
      n('{学校名}の入学式。校長の長い話のあいだ、ナギは窓の外のグラウンドばかり見ていた'),
      title('放課後'),
      bg('bg_ground_sunset'),
      n('荒れたグラウンドに、練習着の生徒が数人'),
      think('体が勝手にここへ来てしまうな。…それにしてもひどい。ベースは破れ、ネットは穴だらけ、ノックの声もばらばらだ', 'serious'),
      cap1('…見学？　悪いけど、うちはもうすぐなくなるかもしれないよ'),
      nagi('surprise', 'なくなるって…どういうことですか？'),
      cap1('前の監督が部費を使い込んでさ。冬のあいだ対外試合は禁止で、部員も半分辞めた。新しい監督も、まだ決まってない'),
      cap1('それでも、最後の夏くらいは…一回でいいから、勝ちたいんだ'),
      think('…その目だ。勝ったことのない選手が、それでも諦めていない目。俺はこの目に弱い', 'serious'),
      nagi('serious', '…マネージャーは、募集していますか？'),
    ],
  },
  {
    id: 'c1_doukyuusei',
    title: '同級生',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) === 1,
    steps: () => [
      bg('bg_ground_sunset'),
      n('グラウンドの隅。制服のまま、一人で壁当てをしている男子がいる'),
      daichiSay('surprise', '…あ、同じクラスの。朝比奈、だっけ'),
      daichiSay('smile', '俺、日向。今日入部した。9人目な。俺が入らないと試合もできないって、先輩たちに拝まれてさ'),
      nagi('normal', 'ポジションは？'),
      daichiSay('normal', 'キャッチャー。中学でもやってたけど、一回も勝ったことねえよ'),
      think('いい肩だ。壁に当たる球が最後まで伸びている。…だが構えが正直すぎる。次に何を投げさせたいか、全部顔に出る型だ', 'serious'),
      daichiSay('smile', 'お前、マネージャーやるの？　物好きだな。こんな部で'),
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
      n('部室。分厚い『野球入門』を抱えた、若い先生が座っている'),
      makabe('normal', 'あ、新しいマネージャーさん？　助かるよ。国語の真壁です。この春から、この部の監督…ということになってるんだけど'),
      makabe('troubled', '正直、ルールもよく分からなくて。…インフィールドフライって、何？'),
      think('…終わった', 'surprise'),
      title('その夜'),
      bg('bg_nagi_room_hs_night'),
      n('ナギは一晩で、部員9人の分析と練習計画、そして采配のノートを書き上げた'),
      n('1ページ目には、太い字で「3年目の夏、全国へ」'),
      title('翌日'),
      bg('bg_clubroom_day'),
      makabe('surprise', '…朝比奈さん。これ、君が書いたの？'),
      nagi('smile', 'はい。その、野球が好きで…祖父が監督をしていたので！'),
      think('嘘だ。祖父どころか、俺本人だ'),
      makabe('serious', '僕には、この半分も分からない。でも、本気なことだけは分かる'),
      makabe('serious', '監督の名前は僕が背負うよ。責任も。だから…練習と試合の指示、君に任せてもいいかな'),
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
            label: '…先生も、一緒に覚えてくださいね',
            reply: [makabe('troubled', 'うっ…がんばります')],
            apply: (x) => {
              x.save.managerExperience += 1
              return ['監督の経験が増えた（見立てが少し正確になる）。']
            },
          },
        ],
      },
      think('女子高生の体で、公立の弱小校か。鬼頭鉄郎、二度目の監督人生だ。…いや、マネージャー人生だな', 'smile'),
      nagi('smile', '先生、さっそく練習を始めましょう。練習の決め方、お見せしますね'),
    ],
    onEnd: (c) => {
      startGuide(c, 'practice')
    },
  },

  // ======================================== 1年目
  {
    id: 'c1_renshujiai',
    title: '初めての練習試合',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 2,
    steps: () => [
      bg('bg_ground_day'),
      makabe('smile', '近くの学校が、練習試合を受けてくれたよ！　自粛のことがあって、どこにも断られてたんだけど'),
      nagi('smile', 'ありがとうございます！　…では、まずオーダーを組んで、それから申し込みましょう'),
      nagi('smile', '先生は…ベンチでどっしり構えていてください'),
      makabe('troubled', 'は、はい…'),
    ],
    onEnd: (c) => {
      startGuide(c, 'order')
    },
  },
  {
    id: 'c1_renshujiai_after',
    title: '練習試合のあと',
    chapter: 1,
    when: (c) => Y(c) <= 3 && flag(c, 'firstPractice'),
    steps: (c) =>
      c.st.flags.firstPractice === 'win'
        ? [
            bg('bg_ground_sunset'),
            cap1('…勝った。練習試合だけど、勝ったぞ！'),
            think('練習試合一つでこの喜びようか。…悪くない', 'smile'),
            daichiSay('surprise', '…お前のサイン、全部当たってたな。なんで分かるんだよ'),
            nagi('smile', '日向くんの顔に、全部書いてありましたから'),
            daichiSay('frustrated', '…それ、褒めてないよな'),
          ]
        : [
            bg('bg_ground_sunset'),
            cap1('やっぱり…俺たちじゃ無理なのかな', 'frustrated'),
            nagi('serious', '今日の失点の半分は、練習で消せます。残りの半分は、私の采配で消します'),
            think('さあ、ここからだ', 'serious'),
            daichiSay('normal', '…でもお前のサイン、ほとんど当たってたな。なんで分かるんだよ'),
            nagi('smile', '日向くんの顔に、全部書いてありましたから'),
            daichiSay('frustrated', '…それ、褒めてないよな'),
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
      cap1('人が増えたな。…これで、やっと紅白戦ができる'),
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
      genzo('angry', 'おう、真壁先生！　商店会長で、野球部OB会の会長もやっとる日向だ。…マネージャーが采配しとるという噂、本当か'),
      makabe('troubled', 'あ、あの、それは…'),
      genzo('angry', '女の子に何ができる。野球ってのはな、根性と――'),
      nagi('normal', 'どうぞ'),
      n('ナギが作戦ノートを差し出す。ページをめくる源造の手が、途中で止まった'),
      genzo('serious', '…この打順。2番に、一番いい打者を置いとるな'),
      nagi('normal', 'はい。打席がよく回ってきて、得点に一番からむ打順ですから'),
      genzo('serious', '…'),
      genzo('serious', '…まあ、根性も大事だからな'),
      title('翌週'),
      bg('bg_clubroom_day'),
      n('部室の前に、スポーツドリンクの箱が山積みになっている。伝票には「日向酒店」'),
      daichiSay('smile', '親父が口で負けて帰ってきたの、初めて見た'),
      nagi('surprise', '…日向くんの、お父さん？'),
      think('どうりで声が大きいと思った'),
    ],
    onEnd: (c) => {
      const own = c.save.schools[c.save.playerSchoolId]!
      own.funds += 20
      startGuide(c, 'funds')
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
      cap1('初戦の相手、{相手校}だって。…正直、勝てる気がしない'),
      nagi('normal', '勝てないのではありません。まだ、勝ち方を知らないだけです'),
      nagi('smile', 'だから今日は、勝ち方を一つだけ覚えて帰りましょう'),
      think('…今のは、かなり監督らしかったな。気をつけねば', 'surprise'),
    ],
  },
  {
    id: 'c1_scout',
    title: '中学生を見に行く',
    chapter: 1,
    // 5月になったら（それより先にスカウトを開いたら、そのとき）
    when: (c) => (Y(c) === 1 && W(c) >= 6) || flag(c, 'scoutOpened'),
    steps: () => [
      bg('bg_jh_ground'),
      n('近くの中学校のグラウンド。ナギは保護者席の端に座っている'),
      nagi('serious', '…あのショート、一歩目が速い。肩はまだ弱いけど、ひと冬で化ける'),
      voice('保護者', '…お嬢さん、ずいぶん詳しいね。プロのスカウトみたいだ'),
      nagi('surprise', 'えっ！　いえ、その、野球中継をよく見ていて…！'),
      think('独り言の癖を直さんとまずいな'),
      nagi('serious', '…来年の部員集め、本格的に始めないと'),
    ],
    onEnd: (c) => {
      addScoutPoints(c.save, 1)
      startGuide(c, 'scout')
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
      n('夏の大会の前日。部室に、3年生の主将が残っている'),
      cap1('朝比奈。…この3か月で、俺たち本当に強くなったと思う'),
      cap1('だから、頼む。一回でいい。勝たせてくれ'),
      {
        kind: 'choice',
        options: [
          {
            label: '一回と言わず、勝てるだけ勝ちましょう',
            reply: [cap1('…欲張りだな、お前')],
            apply: (x) => {
              form(byGrade(x.save, [3]), 1)
              return ['3年生の調子が上がった。']
            },
          },
          {
            label: '勝つのは先輩たちです。私は道を示すだけです',
            reply: [cap1('はは。かっこいいな')],
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
      n('試合のあと。部員たちが校歌を歌う。音程は外れている'),
      makabe('surprise', '勝っ…たんだよね？　これ、勝ったんだよね！？'),
      think('俺が初めて勝った日も、こんなふうだった。勝ったのに、どんな顔をすればいいのか分からなかった', 'smile'),
      nagi('smile', 'はい。この部の、新しい一勝目です'),
      daichiSay('smile', '…校歌って、こんなに声が出るもんなんだな'),
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
      n('試合のあと。球場の外で、3年生が泣いている'),
      cap1('…悪い、朝比奈。せっかく作戦を立ててくれたのに', 'frustrated'),
      nagi('frustrated', '謝らないでください。負けたのは、私の采配です'),
      cap1('…来年は、こいつらを勝たせてやってくれ', 'frustrated'),
      think('何度経験しても、この場面だけは慣れんな', 'frustrated'),
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
      bg('bg_hospital_room'),
      n('夏休み。検査で入院した祖父を、母親と見舞う'),
      say('grandpa_hosp', 'smile', 'ナギが野球部のマネージャーで、しかも作戦まで立てとるだと！？　いやあ、長生きはするもんだ'),
      nagi('normal', 'おじいちゃんは、本当に野球が好きなんですね'),
      say('grandpa_hosp', 'smile', 'なんだ、そのよそ行きの言葉づかいは。…あの夜のこと、覚えとるか。お前、ずっと退屈そうにしとったなあ'),
      think('あの夜？　…この娘は、あの日、球場にいたのか', 'surprise'),
      say('grandpa_hosp', 'smile', 'あの夜の宝物はな、一番の友達に預けてある。わしより長生きしそうなやつにな'),
      nagi('surprise', '宝物？'),
      n('祖父は笑うだけで、それ以上は何も言わなかった'),
      say('grandpa_hosp', 'smile', '勝てよ、ナギ'),
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
          reply: [nagi('smile', '一番声が出ているのは、あの人です')],
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
          reply: [nagi('serious', '試合を一番よく見ているのは、捕手ですから'), ...(isDaichi ? [daichiSay('surprise', '俺かよ…。まあ、やるけどさ')] : [])],
          apply: (x: StoryContext) => {
            x.st.captainId = catcher.id
            catcher.common.clutch = clamp(catcher.common.clutch + 3, 1, 99)
            return [`${catcher.surname}が主将になった。チャンスでの強さが上がった。`]
          },
        })
      }
      return [
        bg('bg_clubroom_day'),
        n('3年生が引退し、新しいチームが始まる'),
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
      n('秋の県大会。偵察に来た別の球場で、{ライバル}が大差をつけて勝っている'),
      makabe('normal', '{ライバル}。この県の、絶対王者だって'),
      think('穴のないチームだ。捕手を中心に、全員が一つの生き物のように動く。…この守り方、どこかで', 'serious'),
      n('ベンチから監督が出てくる。ナギは息をのんだ'),
      kuga('normal', '…'),
      think('久我…！　俺が育てた捕手が、こんなところで監督をしているのか', 'surprise'),
      think('…どうりで。あの守りは、俺が教えた守りだ', 'serious'),
      nagi('serious', '…先生。いつか、あの学校に勝ちます'),
    ],
  },
  {
    id: 'c1_y1_end',
    title: '1年目の終わり',
    chapter: 1,
    when: (c) => Y(c) === 1 && W(c) >= 52,
    steps: (c) =>
      flag(c, 'firstWin')
        ? [
            bg('bg_ground_sunset'),
            n('春休み。夕暮れのグラウンド'),
            makabe('smile', '1年前は、この部が残るなんて誰も思ってなかったよ'),
            nagi('smile', '残っただけではありません。ここから上がっていくんです'),
          ]
        : [
            bg('bg_ground_sunset'),
            n('春休み。夕暮れのグラウンド'),
            think('勝てなかった。だが、最初の1年はどこでもそういうものだ。土を耕す年だ', 'serious'),
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
        n('部室の前に、入部を希望する新入生が並んでいる'),
        ...(scouted
          ? [
              voice('{新入生}', '去年、中学の試合を見に来てた人ですよね？　「一歩目が速い」って言ってたの、聞こえてました'),
              think('聞こえていたのか。…独り言の癖、本当に直さんとまずい', 'surprise'),
              nagi('smile', 'ようこそ、{学校名}野球部へ'),
            ]
          : [
              voice('{新入生}', '去年の秋、ここの試合を見て…なんか、楽しそうだったので'),
              think('スカウトより口コミが効くこともある。結果を出せば、人は自然と集まる', 'smile'),
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
    title: 'ライバルのマネージャー',
    chapter: 1,
    when: (c) => Y(c) === 2 && kindAtWeek(W(c)) === 'springPref',
    steps: () => [
      bg('bg_stadium_day'),
      n('春の県大会。スタンドで、日傘を差した少女がスコアブックを広げている'),
      reika('normal', 'あなたが{学校名}のマネージャー？　白鳥レイカ。{ライバル}のマネージャーよ'),
      reika('normal', 'つい最近まで1勝もできなかった学校が、急に勝ち始めた。偵察に来る理由としては十分でしょう？'),
      nagi('smile', 'わざわざありがとうございます。…でも、本当のデータはお見せしませんよ'),
      reika('serious', 'ふうん。ベンチでサインを出しているの、監督じゃなくてあなたね'),
      think('…この娘、目がいい', 'surprise'),
      {
        kind: 'choice',
        options: [
          {
            label: '何のことでしょう？',
            reply: [reika('normal', 'とぼけるのね。いいわ、夏になれば分かるもの')],
            apply: (x) => {
              const p = captain(x.save, x.st)
              if (p) form([p], 1)
              return p ? [`${p.surname}の調子が上がった。`] : []
            },
          },
          {
            label: 'ええ。夏を楽しみにしていてください',
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
      voice('記者', '地元新聞の者です。最近の{学校名}さんは采配が面白いと評判でして'),
      makabe('troubled', 'さ、采配ですか。ええと、それは、その…'),
      think('先生、目が泳いでいる'),
      voice('記者', '送りバントをほとんどしない。初回から走ってくる。昔の{球団}の鬼頭監督のようだと、うちの年配の記者が言うんですよ'),
      nagi('surprise', 'ごほっ！　ごほっ！'),
      makabe('surprise', '朝比奈さん、大丈夫？'),
      nagi('surprise', 'だ、大丈夫です！　先生は、鬼頭監督の大ファンなんですよね！　ねっ！'),
      makabe('troubled', 'え？　あ、う、うん…？'),
      voice('記者', 'そういえば鬼頭監督は、記憶をなくされてから表に出てこられませんね。今はどうされているのか'),
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
      n('試合前の整列。相手ベンチの前に、久我が立っている'),
      kuga('normal', '真壁監督ですね。{ライバル}の久我です。今日はよろしくお願いします'),
      makabe('surprise', 'よ、よろしくお願いします！'),
      kuga('normal', '…マネージャーさんも'),
      think('背が伸びたな、久我。…いや、俺が縮んだのか'),
      nagi('serious', '相手は王者です。こちらに失うものはありません。一つずつ取りにいきましょう'),
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
            n('久我が、ナギのほうを見た'),
            reika('serious', '…次は負けないから'),
            nagi('smile', 'はい。次も勝ちます'),
            kuga('smile', '君、いい肩だね。ただ、構えが正直すぎる'),
            daichiSay('surprise', '…それ、うちのマネージャーにも言われました'),
          ]
        : [
            bg('bg_stadium_day'),
            kuga('smile', 'いいチームです。守備位置の指示が細かい。…懐かしいくらいだ'),
            reika('normal', '今回はうちの勝ち。でも、次も同じだとは思っていないわ'),
            nagi('frustrated', '…次は、必ず'),
            think('教え子に負けるのは、嬉しいのか悔しいのか。…悔しいに決まっている', 'frustrated'),
            kuga('normal', '君、いい肩だね。ただ、構えが正直すぎる'),
            daichiSay('surprise', '…それ、うちのマネージャーにも言われました'),
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
      n('校門に「祝 県大会ベスト4」の垂れ幕。商店街のあちこちから声がかかる'),
      genzo('smile', 'おう、野球部！　うちのラムネだ。飲んでいけ！'),
      cap('去年までは、誰も声なんてかけてこなかったのにな'),
      title('翌日', '校長室'),
      bg('bg_classroom_day'),
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
      cap('…また、あと一歩か'),
      nagi('normal', '去年は、その「あと一歩」すらありませんでした。距離は確実に縮んでいます'),
    ],
  },
  {
    id: 'c1_mae_no_kantoku',
    title: '前の監督',
    chapter: 1,
    when: (c) => Y(c) === 2 && month(c.save) === 9,
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
    id: 'c1_daichi_ketsui',
    title: '大地の決意',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 31,
    steps: (c) => [
      bg('bg_street_sunset'),
      n('練習の帰り道。夕暮れのアーケードを、二人で歩く'),
      daichiSay('normal', 'なあ、朝比奈'),
      ...(national(c)
        ? [daichiSay('smile', '全国、行けちまったな。…じゃあ次は、全国で勝つ。お前と'), nagi('smile', '欲張りですね。…約束です')]
        : [
            daichiSay('normal', '俺さ、中学で一回も勝てなかったから、高校も適当にやって終わるんだと思ってた'),
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
    title: '2年目の終わり',
    chapter: 1,
    when: (c) => Y(c) === 2 && W(c) >= 52,
    steps: (c) => [
      title('別れ', '冬'),
      bg('bg_street_sunset'),
      n('冬のはじめ、祖父が眠るように息を引き取った。葬儀の帰り道'),
      think('宝物のことは、結局聞けずじまいだった。…この娘のおじいさんに、勝つところを見せてやりたかった', 'frustrated'),
      title('春休み'),
      bg('bg_ground_sunset'),
      ...(flag(c, 'best4')
        ? [
            makabe('smile', 'ベスト4か。1年前の僕に言っても、信じないだろうな'),
            makabe('smile', 'それと、インフィールドフライ、分かるようになったよ'),
            nagi('smile', '先生、それは去年の4月の話です'),
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
      bg('bg_school_gate_sakura'),
      n('桜の咲く校門。ナギが、新しい部員名簿を眺めている'),
      makabe('normal', '朝比奈さんも、もう3年生か。早いね'),
      think('高校生活も残り1年。…その先はどうなる。この体のまま年を重ねるのか。それとも、ある朝また別の誰かになっているのか', 'serious'),
      think('…考えても仕方がない。監督は、目の前の試合しか采配できん'),
      nagi('serious', '先生。今年は、全国に行きます'),
      makabe('smile', '…うん。そう言うと思った'),
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
      n('球場の通路。久我が一人で待っていた'),
      kuga('normal', '朝比奈さん、だったね。少しいいかな'),
      kuga('normal', '君の采配は、ある人にそっくりなんだ。僕が現役だったころの監督に'),
      kuga('normal', '1点が欲しい場面ほど、打者に任せる。守備位置は打者ごとに一歩ずつ動かす。…それに、ピンチで帽子のつばを二回触る癖'),
      think('…しまった。癖は、体が変わっても抜けないのか', 'surprise'),
      {
        kind: 'choice',
        options: [
          {
            label: '祖父が、その方の大ファンだったので',
            reply: [kuga('smile', '…そうか。いいおじいさんだね')],
            apply: (x) => {
              x.st.flags.kugaTalk = 'fan'
            },
          },
          {
            label: 'その監督さんは、どんな人でしたか？',
            reply: [
              kuga('smile', '怖い人だったよ。でも、選手を一度も見捨てなかった。僕が肩を壊して引退したとき、最初に電話をくれたのもあの人だった'),
              think('…覚えていたのか、そんなことを', 'frustrated'),
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
      bg('bg_clubroom_night'),
      n('決勝の前の晩。部室に、部員が全員集まっている'),
      daichiSay('normal', '朝比奈、何か言ってくれよ'),
      nagi('normal', '…2年前、この部には9人しかいませんでした。グラウンドは荒れていて、練習試合も断られて'),
      nagi('normal', 'それでも、誰も辞めなかった。だから今、ここにいます'),
      nagi('serious', '明日は、勝ち方を知っているチームとして、試合をしてきてください'),
      think('日本一の前の晩、俺は選手に何と言ったのだったか。…忘れた。今日の言葉のほうが、ずっと大事だ'),
      daichiSay('smile', '明日の俺の構えは、正直じゃないぞ'),
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
        n('優勝が決まった瞬間。ベンチから部員たちが飛び出していく'),
        makabe('surprise', '朝比奈さん！　全国、全国だよ！'),
        nagi('normal', '…はい'),
        n('マウンドの輪から抜け出して、大地がベンチへ駆けてくる'),
        daichiSay('smile', '朝比奈！'),
        ...(early
          ? [daichiSay('smile', '…約束、1年早く守っちまったな'), nagi('smile', 'では来年、もう一度守ってください')]
          : [
              daichiSay('smile', '…約束、守ったぞ'),
              nagi('smile', '…はい。守ってもらいました'),
              think('選手に約束を守ってもらったことは、何度もある。…だが、こんなに視界がにじんだことはない', 'smile'),
            ]),
        title('全国大会　開会式'),
        bg('bg_national_stadium'),
        n('入場行進する部員たちを、ナギはスタンドから見つめている。そっと、涙をぬぐった'),
        think('プロで日本一になった夜より、なぜか胸が熱い。…年のせいか。いや、今は高校生だった', 'smile'),
        voice('久我（電話）', 'おめでとう。君たちの勝ちだ。全国でも、あの野球を見せてくれ'),
      ]
    },
    onEnd: (c) => [...addAchievement(c.st, '全国初出場'), ...addCostume(c.st, '応援')],
  },
  {
    id: 'c1_zenkoku_renzoku',
    title: '2年連続の全国',
    chapter: 1,
    when: (c) => Y(c) === 3 && seen(c, 'c1_zenkoku') && Number(c.st.flags.national) < 3 && (flag(c, 'national_3_summerNational') || flag(c, 'national_3_springNational')),
    steps: () => [
      bg('bg_national_stadium'),
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
      n('最後の夏が終わった。誰もいなくなったベンチ'),
      daichiSay('frustrated', 'ごめん、朝比奈。お前を全国に連れて行けなかった'),
      nagi('frustrated', '連れて行ってもらうつもりなんて、ありませんでした。一緒に行きたかったんです'),
      nagi('normal', '…信じてくれて、ありがとうございました'),
      think('選手の夏は、毎年必ず終わる。だから監督は、続けなければならん', 'frustrated'),
      daichiSay('frustrated', '…約束、守れなかったな'),
      nagi('frustrated', '守れなかったのは、私も同じです'),
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
      n('放課後の部室。机の上に、白紙の進路希望調査票'),
      makabe('normal', '進路、まだ出してないんだって？　担任の先生が困ってたよ'),
      nagi('serious', '…教員になります。ここに戻ってきて、この部の監督になります'),
      makabe('serious', '…そうか'),
      makabe('smile', 'じゃあ、それまで監督の名前は僕が預かっておくよ。卒業したら、外部コーチとして来ればいい。校長には僕から話しておく'),
      nagi('surprise', '先生…'),
      makabe('smile', 'その代わり、大学ではちゃんと勉強すること。インフィールドフライは、僕が教えてあげるから'),
      think('…この人が監督で、本当によかった', 'smile'),
      title('帰り道', '日向酒店'),
      bg('bg_liquor_day'),
      n('店先で、大地が空き瓶のケースを運んでいる'),
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
      bg('bg_school_gate_sakura'),
      n('卒業式のあと。後輩たちが、校門の前で整列している'),
      voice('後輩の主将', '朝比奈先輩！　3年間、ありがとうございました！'),
      voice('部員一同', 'ありがとうございました！'),
      nagi('normal', '…来週からも、普通に来ますけどね'),
      voice('後輩の主将', '…え？'),
      makabe('smile', '外部コーチとして、来週から来てもらうことになったんだ'),
      voice('部員一同', '感動を返してください！'),
      nagi('smile', '…でも、ありがとう。みんな'),
      genzo('smile', '卒業おめでとう！　うちのバカ息子も、よく卒業できたもんだ！'),
      daichiSay('troubled', '親父、声がでかいって…'),
      genzo('serious', '朝比奈さん、あんたのおかげでこの部は生き返った。OB会を代表して礼を言う'),
      genzo('normal', '…それとな。あんたのおじいさんとは、昔からの飲み仲間だったんだ'),
      nagi('surprise', '祖父と？'),
      genzo('cry', 'あいつが生きとったら、今日は大泣きだったろうなあ'),
      think('…一番の友達。まさかな', 'serious'),
      n('校門の外で、{ライバル}の制服を着たレイカが待っていた'),
      reika('normal', '卒業おめでとう。…大学に行っても、あなたとは張り合うから'),
      nagi('smile', '望むところです'),
      bg(null),
      title('第1章「再建」　完'),
      n('第2章「外部コーチ」は、次のアップデートで公開します。それまでは、このまま部を育て続けられます'),
    ],
    onEnd: (c) => {
      const msgs = [...addCostume(c.st, '卒業式')]
      c.st.chapter = 2
      return [...msgs, '第1章「再建」をクリアした！']
    },
  },
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
