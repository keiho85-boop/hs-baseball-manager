// 固有キャラの出来事（続きもの3話＋ただの出来事2つ。神代は一発イベント）
// 台本：「転生名将ナギ 固有キャラの出来事 台本（第1章）」11月19日
// ・入部しているキャラが練習マスに付く。止まると40%で続きの話、60%でただの出来事
// ・各話の選択肢は「終了」「正解」「別の道」の3つ。並び順は毎回変える
// ・一度「別の道」に入ると別の道のまま。3話で別の終わり方になる
// ・3話の正解：50%でそのキャラの能力（三木・東雲はさらに30%で共通の能力）。別の終わり方：50%でゆかりのある能力
// ・どの選択肢でも、何かしら変化がある（「変化なし」はない）

import type { Rng } from '../rng'
import { ABILITY_LABEL, eid, mainKeys } from '../events'
import { absWeek } from '../modifiers'
import { canHave, getSkill } from '../skills'
import type { EffectOp, EventInstance, Player, SaveData } from '../types'
import { CHAR_SKILLS, charSkillFor } from './charSkills'
import { pitcherDelta } from './personEvents'
import { EVAL_LABEL, focusPlayer, successOf } from './state'
import type { EvalKey, FixedId } from './types'

export type CharKey = FixedId | 'daichi' | 'tenkosei'

/**
 * 止まったときに続きの話が起きる確率（残りはただの出来事）。11月19日：
 * 入部している固有キャラが少ないほど、一人ひとりと深く付き合えるので続きの話が起きやすい。
 * 3〜5人に絞ると完走しやすく、全員を集めると完走はまれになる
 */
export const CHAIN_RATE_BY_COUNT = [0.7, 0.7, 0.7, 0.7, 0.65, 0.6, 0.45, 0.35, 0.3, 0.3]
export function chainRate(save: SaveData): number {
  const n = Object.values(successOf(save)?.joined ?? {}).filter(Boolean).length
  return CHAIN_RATE_BY_COUNT[Math.min(n, CHAIN_RATE_BY_COUNT.length - 1)]!
}
/** 大地のマスで、★イベントの代わりに続きの話が起きる確率 */
export const DAICHI_CHAIN_RATE = 0.25
/** 3話で、そのキャラの能力が取れる確率 */
export const CHAR_SKILL_RATE = 0.5
/** 三木・東雲の共通の能力が、さらに取れる確率 */
export const CHAR_COMMON_RATE = 0.3
/** 神代の一発イベント：起きる確率と、正解で能力が取れる確率 */
export const TENKOSEI_RATE = 0.4
export const TENKOSEI_RATE_SINGLE = 0.2
export const TENKOSEI_SKILL_RATE = 0.35

type Kind = 'end' | 'ok' | 'alt'
/**
 * 効果の書き方：
 * st±N 体力 / mo±N 調子 / all.st±N・all.mo±N 部員全員 / rep±N 評判 / ev.<評価>±N /
 * ab.<能力>±N 能力 / abF.<能力>±N 野手のときだけ / abP.<能力>±N 投手のときだけ / ab.main±N 主な能力から2つ
 */
type Fx = string[]
interface Choice {
  label: string
  text: string
  kind: Kind
  fx: Fx
}
interface Ep3Choice extends Choice {
  /** main：そのキャラの能力 alt：ゆかりのある能力 */
  skill?: 'main' | 'alt'
}
interface Ep {
  title: string
  bg: string
  lines: string[]
  choices: Choice[]
}
interface Ep3 {
  title: string
  bg: string
  lines: string[]
  choices: Ep3Choice[]
}
interface Filler {
  title: string
  bg: string
  lines: string[]
  choices: { label: string; text: string; fx: Fx }[]
}
interface CharScript {
  name: string
  portrait: string
  ep1: Ep
  ep2: Ep
  ep3F: Ep3
  ep3P: Ep3
  alt: { title: string; bg: string; lines: string[]; label: string; text: string; fb: Fx }
  fillers: Filler[]
}

const c = (label: string, text: string, kind: Kind, fx: Fx): Choice => ({ label, text, kind, fx })
const s3 = (label: string, text: string, kind: Kind, fx: Fx, skill?: 'main' | 'alt'): Ep3Choice => ({ label, text, kind, fx, skill })
const f2 = (label: string, text: string, fx: Fx) => ({ label, text, fx })

// ---------------------------------------------------------------- 台本
export const CHAR_SCRIPTS: Record<CharKey, CharScript> = {
  sumo: {
    name: '塩見',
    portrait: 'shiomi',
    ep1: {
      title: 'ちゃんこと遅刻',
      bg: 'bg_ground_day',
      lines: ['練習に遅れてきた塩見。口の端に、日向酒店のちゃんこの汁がついている。', '塩見「…おかわり自由だったんです」', 'ナギ（心の声）「…少しも悪びれていない」'],
      choices: [
        c('遅れた理由をじっくり聞く', '「…おいしかったんです」それ以上の話は出なかった。', 'end', ['st+6']),
        c('一緒に日向酒店へ行く', '源造と塩見のちゃんこ談義が止まらない。', 'alt', ['ev.genzo+3']),
        c('罰として四股を百回踏ませる', '地面が揺れるたびに、塩見の腰の低さが目についた。', 'ok', ['st-4', 'ab.common.durability+1']),
      ],
    },
    ep2: {
      title: '四股と素振り',
      bg: 'bg_ground_day',
      lines: ['塩見が素振りの列で、なぜか四股を踏んでいる。', '塩見「腰を落とすと、重いものも軽くなるんです」'],
      choices: [
        c('「その足、野球に使えるな」と言う', '塩見「…相撲は相撲です」と首をかしげた。', 'end', ['ab.common.durability+1']),
        c('何も言わず隣で四股を踏む', '太ももが悲鳴をあげた。塩見が初めて笑った。', 'ok', ['st-6', 'abF.batting.power+1', 'abP.pitching.stamina+1']),
        c('「先に飯にしよう」', '塩見の目が輝いた。', 'alt', ['st+8']),
      ],
    },
    ep3F: {
      title: 'うっちゃりの一振り',
      bg: 'bg_sumo_room',
      lines: ['塩見に連れられて、相撲部の土俵へ。', '塩見「土俵際では、下から持ち上げて、ひっくり返すんです」'],
      choices: [
        s3('腰を据えて、低く強く振る', '塩見は黙ってうなずき、もう一度四股を踏んだ。', 'alt', ['ab.batting.power+2'], 'alt'),
        s3('いつもの振りを崩さない', '「…それも、一つの型です」', 'end', ['ab.batting.contact+1']),
        s3('下から持ち上げるように振る', '打球が、土俵の外まで飛んでいった。', 'ok', ['ab.batting.power+3'], 'main'),
      ],
    },
    ep3P: {
      title: '立ち合い',
      bg: 'bg_sumo_room',
      lines: ['塩見に連れられて、相撲部の土俵へ。', '塩見「立ち合いは、ぶつかる前に勝負が決まってるんです」'],
      choices: [
        s3('まず相手の当たりを受け止める', '塩見の体当たりを、正面から受け止めた。', 'alt', ['ab.pitching.velocity+2'], 'alt'),
        s3('ぶつかる前に気持ちで押し切る', '塩見が、一歩だけ下がった。「…今のは、効きました」', 'ok', ['ab.pitching.velocity+3'], 'main'),
        s3('「相撲と野球は違う」', '塩見「…そうですね」少しだけ寂しそうだった。', 'end', ['ab.pitching.control+1']),
      ],
    },
    alt: {
      title: '日向酒店の大鍋',
      bg: 'bg_liquor_day',
      lines: ['源造・塩見と三人で、日向酒店の大鍋を囲む。', '源造「よう食う奴は、よう飛ばす！ よう投げる！ ほれ、もっと食え！」'],
      label: 'いただきます',
      text: '鍋は、三回空になった。',
      fb: ['st+100', 'abF.batting.power+1', 'abP.pitching.velocity+1'],
    },
    fillers: [
      {
        title: '三杯目のおかわり',
        bg: 'bg_clubroom_day',
        lines: ['昼休み。塩見が、自分の弁当箱を差し出してきた。', '塩見「…多めに作ってもらったので」'],
        choices: [f2('もらう', 'おにぎりが、こぶしより大きかった。', ['st+10']), f2('断る', '塩見は全部ひとりで食べて、満足そうだった。', ['ev.team+1'])],
      },
      {
        title: '土俵の掃除',
        bg: 'bg_sumo_room',
        lines: ['練習のあと、塩見がほうきを持って相撲部の土俵へ向かっていく。'],
        choices: [f2('手伝う', '土俵を掃き終えると、塩見が深く頭を下げた。', ['st-5', 'mo+4']), f2('見送る', '先に帰って、ゆっくり休んだ。', ['st+5'])],
      },
      {
        title: 'ちゃんこの研究',
        bg: 'bg_clubroom_day',
        lines: ['部室に、大鍋と湯気。塩見が、エプロン姿で鍋をかき混ぜている。', '塩見「…研究しました。野球部のための、ちゃんこです」'],
        choices: [f2('みんなでいただく', '一口食べた瞬間、部員全員の目が見開いた。おかわりの列が、部室の外まで続いた。', ['all.st+100'])],
      },
    ],
  },
  soccer: {
    name: '天羽',
    portrait: 'amou',
    ep1: {
      title: '見学席の人だかり',
      bg: 'bg_ground_day',
      lines: ['フェンスの外に、女子生徒の人だかり。天羽は手を振りながら、走り込みを歩いている。', '天羽「本気で走るのは、試合だけでいいだろ」'],
      choices: [
        c('「せっかくだ。いいところを見せてやれ」', '天羽は見学席にだけ手を振った。', 'end', ['rep+1']),
        c('ナギに見学席の整理を頼む', 'ナギが見学者を並ばせ、天羽と何か話し込んでいる。', 'alt', ['ev.nagi+2']),
        c('その日の見学を断る', '天羽「…へえ。本気でやれってこと？」', 'ok', ['mo+3', 'ab.running.speed+1']),
      ],
    },
    ep2: {
      title: '50メートルの勝負',
      bg: 'bg_ground_day',
      lines: ['グラウンドの端から端まで。天羽がスタートのラインに立つ。', '天羽「サッカーは、最初の三歩で決まるんだ」'],
      choices: [
        c('全力で走る', '半歩差で負けた。天羽「…やるじゃん」', 'ok', ['st-6', 'ab.running.speed+1']),
        c('「勝ち負けより、フォームを見てくれ」', '天羽はつまらなそうに、アドバイスを一つだけくれた。', 'end', ['abF.running.speed+1', 'abP.pitching.stamina+1']),
        c('わざと半歩遅れてスタートする', '天羽「…今、手加減しただろ」なぜか面白がっている。', 'alt', ['mo+3']),
      ],
    },
    ep3F: {
      title: 'ゴール前の加速',
      bg: 'bg_soccer_field',
      lines: ['サッカー部のグラウンドで、天羽がボールを足元に置く。', '天羽「足の速い奴じゃなくて、加速の速い奴が勝つんだ」'],
      choices: [
        s3('「俺は俺の走り方でいく」', '天羽「…ま、それもいいんじゃない」', 'end', ['ab.fielding.range+1']),
        s3('「走りながら考える方法を教えてくれ」', '天羽は初めて、本気の顔で教えてくれた。', 'ok', ['ab.running.speed+3'], 'main'),
        s3('「最初の一歩だけ教えてくれ」', '天羽「一歩目は、前じゃなくて下に踏むんだ」', 'alt', ['ab.running.speed+2'], 'alt'),
      ],
    },
    ep3P: {
      title: 'ロスタイム',
      bg: 'bg_soccer_field',
      lines: ['サッカー部の試合の、終了間際。天羽が息を切らしながら戻ってきた。', '天羽「90分走ったあとに、もう一回全力で走れる奴が点を取る」'],
      choices: [
        s3('後半に強くなる体の使い方を聞く', '天羽は、走り込みのメニューを書いてくれた。', 'alt', ['ab.pitching.stamina+2'], 'alt'),
        s3('「ペース配分が大事だ」', '天羽「…まじめだな」', 'end', ['ab.pitching.stamina+1']),
        s3('「空っぽになっても、もう一球」', '天羽「…いいね。そういうの、嫌いじゃない」', 'ok', ['ab.pitching.stamina+3'], 'main'),
      ],
    },
    alt: {
      title: 'ナギとの賭け',
      bg: 'bg_ground_sunset',
      lines: [
        '天羽がナギに「次の練習試合で盗塁を決めたら、打順を一番にしてもらう」と持ちかけた。',
        '結果は引き分け。天羽は、練習で使ったスタートのコツを、こっそり教えてくれた。',
      ],
      label: '「…ありがとう」',
      text: '天羽「礼なら、ナギに言えよ」',
      fb: ['abF.running.speed+2', 'abP.pitching.stamina+2', 'ev.nagi+2'],
    },
    fillers: [
      {
        title: 'ファンレター',
        bg: 'bg_classroom_day',
        lines: ['天羽の下駄箱から、手紙があふれて床に落ちている。'],
        choices: [f2('拾うのを手伝う', '天羽「悪い、助かる」', ['ev.team+1']), f2('見なかったことにする', 'そのまま練習へ向かい、いつもより集中できた。', ['mo+2'])],
      },
      {
        title: 'サッカー部からの呼び出し',
        bg: 'bg_soccer_field',
        lines: ['サッカー部の部員が「試合に助っ人で出てくれ」と、天羽を呼びに来た。'],
        choices: [f2('行かせる', '天羽がハットトリックを決め、校内で話題になった。', ['rep+2']), f2('野球部を優先させる', '天羽「…しょうがないな」', ['mo+4'])],
      },
    ],
  },
  shogi: {
    name: '千手',
    portrait: 'senju',
    ep1: {
      title: '部室の詰将棋',
      bg: 'bg_clubroom_day',
      lines: ['部室の隅で、千手が詰将棋の本を開いている。', '千手「一手で、相手の読みを外す。野球も同じですよ」'],
      choices: [
        c('「その本、貸してくれないか」', '本は難しすぎて、三日で返した。', 'end', ['ev.nagi+1']),
        c('ナギとの対局を頼む', 'ナギと千手の対局が始まった。横で見守るしかない。', 'alt', ['ev.nagi+2']),
        c('一局、指してもらう', '30手で詰まされた。千手「…最後の一手は、悪くなかった」', 'ok', ['mo+3']),
      ],
    },
    ep2: {
      title: '感想戦',
      bg: 'bg_clubroom_day',
      lines: ['練習試合のあと、千手がスコアブックを広げて「感想戦」を始める。', '千手「この一球。相手はもう、勝ちを確信していました」'],
      choices: [
        c('黙って最後まで聞く', '千手「…感想戦は、二人でやるものです」少し寂しそうに、ノートを閉じた。', 'end', ['mo+4']),
        c('「ナギなら、ここでどう指す？」', '千手の目が、ナギのほうへ向いた。', 'alt', ['ev.nagi+2']),
        c('「その読みは違うと思う」と反論する', '千手「…面白い。続けてください」', 'ok', ['abF.batting.eye+1', 'abP.pitching.control+1']),
      ],
    },
    ep3F: {
      title: '逆転の一手',
      bg: 'bg_shogi_room',
      lines: ['将棋部の部室。千手が盤の前で、駒を一つだけ動かした。', '千手「勝負は、相手が勝ちを確信した瞬間に決まります」'],
      choices: [
        s3('「毎打席が勝負だ」', '千手「…それも一つの指し方です」', 'end', ['ab.batting.contact+1']),
        s3('「終盤まで、力を残しておく」', '千手「…なるほど。終盤に強い人は、怖い」', 'alt', ['ab.batting.power+2'], 'alt'),
        s3('「相手が油断する一打席を待つ」', '千手が、初めて声を出して笑った。', 'ok', ['ab.batting.contact+2', 'ab.batting.power+2'], 'main'),
      ],
    },
    ep3P: {
      title: '一手に全部を',
      bg: 'bg_shogi_room',
      lines: ['将棋部の部室。千手が盤をはさんで座る。', '千手「僕は長くは指せない。だから、一手ごとに全部を賭ける。…君は、どう指しますか」'],
      choices: [
        s3('「一番苦しい場面で、任せてほしい」', '千手「…その場面は、僕も好きです」', 'alt', ['ab.pitching.control+2'], 'alt'),
        s3('「一球ごとに、全部を賭ける」', '千手は黙って、王手をかけた。', 'ok', ['ab.pitching.control+2', 'ab.pitching.kire+2'], 'main'),
        s3('「長く投げてこそ投手だ」', '千手「…僕には、できない指し方です」', 'end', ['ab.pitching.stamina+1']),
      ],
    },
    alt: {
      title: 'ナギと千手の一局',
      bg: 'bg_shogi_room',
      lines: ['ナギと千手の対局は、ついに千手の勝ちで終わった。', 'ナギ（心の声）「…終盤で負けたか。この歳になって、まだ学ぶことがある」', '千手は、勝ち筋を一つずつ説明してくれた。'],
      label: '最後まで聞く',
      text: '下校の放送が鳴っても、千手の説明は続いた。',
      fb: ['ab.main+2', 'ev.nagi+2'],
    },
    fillers: [
      {
        title: '詰将棋の宿題',
        bg: 'bg_clubroom_day',
        lines: ['千手が「明日までに解いてきてください」と、紙を一枚渡してきた。'],
        choices: [f2('自分で解く', '夜遅くまでかかったが、解けた。', ['st-5', 'ev.nagi+1']), f2('大地に任せる', '大地が頭を抱えている。二人で笑いながら考えた。', ['ev.daichi+1'])],
      },
      {
        title: '長考',
        bg: 'bg_ground_day',
        lines: ['ベンチで、千手が動かない。何か考えごとをしているようだ。'],
        choices: [f2('声をかける', '千手「…あ。練習中でした」', ['mo+4']), f2('そっとしておく', 'その間に、自分の練習に集中した。', ['ab.main+1'])],
      },
    ],
  },
  tennis: {
    name: '久遠',
    portrait: 'kuon',
    ep1: {
      title: '壁打ち',
      bg: 'bg_tennis_court',
      lines: ['校舎の裏。久遠がテニスボールを壁に打ち続けている。一度も落とさない。', '久遠「…返し続ければ、相手が先に崩れる」'],
      choices: [
        c('ナギを呼んでくる', 'ナギ「…その手首、バットでも使えますね」久遠が、少しだけ手を止めた。', 'alt', ['ev.nagi+2']),
        c('隣で、一緒に壁打ちを始める', '久遠「…一人でやりたい」その場を離れてしまった。', 'end', ['ab.fielding.catching+1']),
        c('声をかけずに、終わるまで見ている', '一時間後。久遠「…いつまで見てる」「最後まで」', 'ok', ['mo+3']),
      ],
    },
    ep2: {
      title: 'ラリーの極意',
      bg: 'bg_clubroom_day',
      lines: ['雨の日の室内練習。久遠がラケットで、回転のかかった球を打ってみせる。', '久遠「速い球より、回る球のほうが返しにくい」'],
      choices: [
        c('「本当は、テニスに戻りたいんじゃないか」', '久遠は答えず、ラケットをしまった。', 'end', ['mo+2']),
        c('「その回転、もう一球見せてくれ」', '久遠は五十球打った。何も言わなかったが、嫌そうではなかった。', 'ok', ['abF.batting.contact+1', 'abP.pitching.kire+1']),
        c('「ナギと、どっちが読みが鋭い？」', '久遠「…あいつには、まだ勝てない」', 'alt', ['ev.nagi+2']),
      ],
    },
    ep3F: {
      title: 'どこへ来ても',
      bg: 'bg_tennis_court',
      lines: ['テニスコートで、久遠がラケットを構える。', '久遠「追い込まれてからが、ラリーの本番だ」'],
      choices: [
        s3('追い込まれても、当てて粘る', '久遠「…しつこいな。いい意味で」', 'alt', ['ab.batting.contact+2'], 'alt'),
        s3('好きな球だけを待つ', '久遠「…それじゃ、ラリーは続かない」', 'end', ['ab.batting.power+1']),
        s3('どの球が来ても、強く返す', '久遠の打った球を、すべて打ち返した。', 'ok', ['ab.batting.contact+3'], 'main'),
      ],
    },
    ep3P: {
      title: '回転の秘密',
      bg: 'bg_tennis_court',
      lines: ['テニスコートで、久遠がサーブを打ってみせる。', '久遠「指先で、球に最後の一回転を乗せろ。サーブと同じだ」'],
      choices: [
        s3('全部の球に、最後の一回転を', '久遠「…今の球、俺でも返せない」', 'ok', ['ab.pitching.kire+3'], 'main'),
        s3('一つの球種だけを磨き抜く', '久遠「…一つで足りるなら、それでいい」', 'alt', ['ab.pitching.kire+2'], 'alt'),
        s3('球の速さを優先する', '久遠「…速いだけの球は、慣れられる」', 'end', ['ab.pitching.velocity+1']),
      ],
    },
    alt: {
      title: '三人のラリー',
      bg: 'bg_ground_sunset',
      lines: ['久遠がナギに「読みで勝負」を挑んだ。打球がどこへ飛ぶかを、二人で当てあう。', '勝負はナギの勝ち。久遠「…お前の打球（球）が、一番読めなかった」'],
      label: '「じゃあ、またやろう」',
      text: '久遠が、小さく笑った。',
      fb: ['abF.batting.contact+2', 'abP.pitching.kire+2', 'ev.nagi+2'],
    },
    fillers: [
      {
        title: 'ガットの張り替え',
        bg: 'bg_clubroom_day',
        lines: ['久遠が部室で、ラケットの糸を張り替えている。'],
        choices: [
          f2('見学する', '久遠「…道具の手入れも、練習だ」', ['abF.fielding.catching+1', 'abP.pitching.control+1']),
          f2('先に帰る', '家でゆっくり休んだ。', ['st+5']),
        ],
      },
      {
        title: '無口な昼休み',
        bg: 'bg_classroom_day',
        lines: ['屋上で一人、久遠がパンをかじっている。'],
        choices: [f2('隣に座る', '何も話さなかったが、居心地は悪くなかった。', ['mo+4']), f2('そっとしておく', '教室で、少し昼寝をした。', ['st+5'])],
      },
    ],
  },
  rikujo: {
    name: '岩城',
    portrait: 'iwaki',
    ep1: {
      title: '砲丸の重さ',
      bg: 'bg_clubroom_day',
      lines: ['岩城が部室に砲丸を持ち込み、目の前に置いた。', '岩城「…持ってみろ」'],
      choices: [
        c('「投げるところを見せてくれ」', '岩城は無言で外へ出て、砲丸を投げた。見とれているうちに、日が暮れた。', 'alt', ['mo+3']),
        c('両手で持ち上げてみる', '想像よりずっと重い。岩城「…片手だ」', 'ok', ['st-4', 'abF.fielding.arm+1', 'abP.pitching.velocity+1']),
        c('「部室に置いておくと危ないよ」', '岩城はうなずき、砲丸を持ち帰った。', 'end', ['ev.team+1']),
      ],
    },
    ep2: {
      title: '遠投勝負',
      bg: 'bg_ground_day',
      lines: ['外野のフェンス際から、岩城がホームまで一直線に投げ返す。', '岩城「…勝負だ」'],
      choices: [
        c('届かなくても、まっすぐ投げる', 'ワンバウンドで届いた。岩城「…曲がらない球だ」', 'ok', ['ab.fielding.arm+1']),
        c('高く山なりに投げて、飛距離で勝つ', '岩城より遠くに落ちた。岩城は何も言わず、もう投げなかった。', 'end', ['ab.fielding.arm+1']),
        c('「勝負はお前の勝ちでいい」', '岩城「…じゃあ、教えてやる」', 'alt', ['mo+3']),
      ],
    },
    ep3F: {
      title: '一直線',
      bg: 'bg_track_field',
      lines: ['陸上部の投てき場。岩城が、遠くの的を指さした。', '岩城「狙ったところへ、まっすぐ投げる。それだけだ」'],
      choices: [
        s3('捕ってから投げるまでを速くする', '岩城「…悪くない」', 'alt', ['ab.fielding.arm+2'], 'alt'),
        s3('的を一つ決めて、そこだけを狙う', '十球目で、的の真ん中に当たった。', 'ok', ['ab.fielding.arm+3'], 'main'),
        s3('一球でも強い球を投げる', '岩城「…それは、砲丸の投げ方だ」', 'end', ['ab.fielding.arm+1']),
      ],
    },
    ep3P: {
      title: '芯に重さを',
      bg: 'bg_track_field',
      lines: ['陸上部の投てき場。岩城が砲丸を手に、構えてみせる。', '岩城「砲丸は、腰から押す。腕で投げると、軽くなる」'],
      choices: [
        s3('腕の振りを速くする', '岩城「…それでは、軽い」', 'end', ['ab.pitching.velocity+1']),
        s3('低めへ、押し込むように投げる', '岩城「…重い球だ」', 'alt', ['ab.pitching.control+2'], 'alt'),
        s3('腰から体ごと投げ込む', 'ミットが鳴る音に、岩城が目を細めた。', 'ok', ['ab.pitching.velocity+2', 'ab.pitching.stamina+2'], 'main'),
      ],
    },
    alt: {
      title: '陸上部のグラウンド',
      bg: 'bg_track_field',
      lines: ['岩城に連れられて、陸上部の投てき場へ。', '岩城「…投げるのは、足からだ」', '二人で日が暮れるまで、足の運びだけを繰り返した。'],
      label: '「また来ていいか」',
      text: '岩城は、黙ってうなずいた。',
      fb: ['abF.fielding.arm+2', 'abP.pitching.velocity+2'],
    },
    fillers: [
      {
        title: '陸上部の記録会',
        bg: 'bg_track_field',
        lines: ['陸上部から「砲丸だけ出てくれ」と頼まれた岩城が、こちらを見ている。'],
        choices: [f2('応援に行く', '岩城が大会記録を出し、校内で話題になった。', ['rep+2']), f2('練習を優先する', '岩城「…それでいい」', ['mo+4'])],
      },
      {
        title: '黙々と',
        bg: 'bg_ground_sunset',
        lines: ['暮れたグラウンドで、岩城が一人でトンボをかけている。'],
        choices: [
          f2('一緒にやる', '二人とも、一言もしゃべらなかった。', ['st-6', 'abF.running.speed+1', 'abP.pitching.stamina+1']),
          f2('先に帰る', '家でゆっくり休んだ。', ['st+5']),
        ],
      },
    ],
  },
  takkyu: {
    name: '小早川',
    portrait: 'kobayakawa',
    ep1: {
      title: '部室の卓球大会',
      bg: 'bg_clubroom_day',
      lines: ['いつの間にか、部室に卓球台が運び込まれている。', '小早川「休憩中にやるだけだって。…ちょっとだけ」'],
      choices: [
        c('「どうせなら部員全員でやろう」', '大盛り上がりの末、真壁先生に見つかって卓球台は没収された。', 'end', ['ev.team+2']),
        c('「片付けろ。勝負ならグラウンドで」', '小早川「…言ったな。野球で勝負だ」', 'ok', ['mo+3']),
        c('一局だけ付き合う', '1点も取れなかった。小早川はご機嫌だ。', 'alt', ['ev.team+1']),
      ],
    },
    ep2: {
      title: '逆モーション',
      bg: 'bg_gym_table_tennis',
      lines: ['小早川が、打つ瞬間まで向きを見せない「逆モーション」を披露する。一球も反応できない。', '小早川「相手が構えたときには、もう終わってる」'],
      choices: [
        c('「もう一回、ゆっくり見せてくれ」', '小早川は何度もやってみせた。だんだん派手になっていく。', 'alt', ['mo+3']),
        c('「それ、野球でも使えるのか」', '小早川「…使えなきゃ、やってない」それきり黙ってしまった。', 'end', ['mo+2']),
        c('反応できなかった球を、もう一球だけ頼む', '五球目で、初めて体が勝手に動いた。', 'ok', ['abF.fielding.catching+1', 'abP.pitching.quick+1']),
      ],
    },
    ep3F: {
      title: '台の上の聖域',
      bg: 'bg_gym_table_tennis',
      lines: ['卓球場。小早川が台の向こうで、ラケットを構える。', '小早川「自分の守る場所は、一球も通さない」'],
      choices: [
        s3('打球をよく見てから動く', '小早川「…それじゃ、間に合わない」', 'end', ['ab.fielding.catching+1']),
        s3('見る前に、体を先に動かす', '小早川の球を、三球続けて止めた。小早川「…嘘だろ」', 'ok', ['ab.fielding.range+3'], 'main'),
        s3('飛びついてでも止める', '床に転がりながら、球を拾った。', 'alt', ['ab.fielding.range+2'], 'alt'),
      ],
    },
    ep3P: {
      title: '間合いを盗む',
      bg: 'bg_gym_table_tennis',
      lines: ['卓球場。小早川が、サーブの構えのまま止まっている。', '小早川「走者がスタートを切るのは、お前の間合いを読んだときだ」'],
      choices: [
        s3('走者をじっと見て縛る', '小早川「…そうされると、走れない」', 'alt', ['ab.pitching.quick+2'], 'alt'),
        s3('走者のことは忘れて、打者に集中する', '小早川「…それも、ありだな」', 'end', ['ab.pitching.velocity+1']),
        s3('一球ごとに間合いを変える', '小早川が、初めてサーブを空振りした。', 'ok', ['ab.pitching.quick+3'], 'main'),
      ],
    },
    alt: {
      title: '卓球台の復活',
      bg: 'bg_clubroom_day',
      lines: ['小早川が真壁先生を説得し、「反射神経の練習用」として卓球台が部室に戻ってきた。', '小早川「先生、意外と話が分かるな」'],
      label: '「今度は一点取る」',
      text: '小早川「いいね。そう来なくちゃ」',
      fb: ['abF.fielding.catching+2', 'abP.pitching.quick+2', 'ev.makabe+2'],
    },
    fillers: [
      {
        title: 'ピンポン玉の雨',
        bg: 'bg_clubroom_day',
        lines: ['小早川がピンポン玉をばらまいて、「全部つかめるか」と勝負を挑んできた。'],
        choices: [f2('受ける', '半分もつかめなかったが、妙に楽しかった。', ['mo+4']), f2('掃除をさせる', '小早川は文句を言いながら、全部拾った。', ['ev.team+1'])],
      },
      {
        title: '反射神経テスト',
        bg: 'bg_ground_day',
        lines: ['小早川が、部員全員の反応の速さを測り始めた。'],
        choices: [f2('参加する', '部員みんなで盛り上がった。', ['all.mo+2']), f2('練習に戻る', 'その間に、自分の練習に集中した。', ['ab.main+1'])],
      },
    ],
  },
  shinbun: {
    name: '三木',
    portrait: 'miki',
    ep1: {
      title: '取材のお願い',
      bg: 'bg_classroom_day',
      lines: ['三木がメモ帳を手に、目の前に現れた。', '三木「校内新聞で、きみの特集を組みたい。…一年かけて」'],
      choices: [
        c('「チーム全体の記事にしてくれ」', '野球部の特集が載った。', 'end', ['rep+1', 'ev.team+1']),
        c('「記事より、結果で見せる」と断る', '三木「…いいね。その言葉、見出しにする」', 'ok', ['mo+3']),
        c('その場で取材を受ける', '質問は三十個を超えた。三木は、ナギにも話を聞きに行った。', 'alt', ['ev.nagi+2']),
      ],
    },
    ep2: {
      title: 'データの山',
      bg: 'bg_newspaper_room',
      lines: ['三木のノートには、これまでの全打席（全投球）が書き込まれている。', '三木「きみが打てない（打たれる）のは、いつも同じ場面だ。…知りたい？」'],
      choices: [
        c('「ナギにも見せてやってくれ」', 'ナギと三木の話は、チームの作戦の話に広がっていった。', 'alt', ['ev.nagi+2']),
        c('「自分でも分かってる」', '三木「…そうかい」ノートを閉じた。', 'end', ['mo+2']),
        c('耳の痛い話を、最後まで聞く', '話が終わったのは、下校時刻だった。', 'ok', ['abF.batting.eye+1', 'abP.pitching.control+1']),
      ],
    },
    ep3F: {
      title: '見えているもの',
      bg: 'bg_newspaper_room',
      lines: ['新聞部の部室。三木が、赤ペンで丸をつけたノートを広げる。', '三木「余計なものを捨てると、本当のことが見える」'],
      choices: [
        s3('打つ球を一つに絞る', '三木「…記事にするなら、そこだね」', 'alt', ['ab.batting.contact+2'], 'alt'),
        s3('振らない球を決める', '三木のペンが、ノートの上で止まった。', 'ok', ['ab.batting.contact+2', 'ab.batting.power+2'], 'main'),
        s3('「もう記事にしなくていい」', '三木「…そうかい。じゃあ、最後の一本にする」', 'end', ['ab.batting.contact+1']),
      ],
    },
    ep3P: {
      title: '詰みの一球',
      bg: 'bg_newspaper_room',
      lines: ['新聞部の部室。三木が、投球の記録を指でなぞる。', '三木「2ストライクからの被打率が、一番高いんだ」'],
      choices: [
        s3('「もう記事にしなくていい」', '三木「…そうかい。じゃあ、最後の一本にする」', 'end', ['ab.pitching.control+1']),
        s3('追い込んだら、勝負球を決めておく', '三木「…数字が変わるのが、楽しみだ」', 'alt', ['ab.pitching.velocity+2'], 'alt'),
        s3('打者の読みから、最後の一球を逆算する', '三木が、ペンを置いて拍手した。', 'ok', ['ab.pitching.velocity+2', 'ab.pitching.control+2'], 'main'),
      ],
    },
    alt: {
      title: 'ナギの戦術記事',
      bg: 'bg_newspaper_room',
      lines: ['校内新聞に「野球部マネージャーの戦術講座」の連載が始まった。', '第一回の題材は、自分の打席（投球）だった。'],
      label: '記事を読む',
      text: '自分では気づかなかったことが、たくさん書いてあった。',
      fb: ['ab.main+2', 'ev.nagi+2'],
    },
    fillers: [
      {
        title: '号外',
        bg: 'bg_school_gate_sakura',
        lines: ['試合の翌朝。三木が校門で号外を配っている。'],
        choices: [f2('配るのを手伝う', '号外は、昼までになくなった。', ['rep+2']), f2('練習に行く', '朝練に、いつもより早く着いた。', ['mo+4'])],
      },
      {
        title: '誤植',
        bg: 'bg_classroom_day',
        lines: ['校内新聞で、自分の名前が一文字間違っている。'],
        choices: [f2('笑って許す', '三木「…すまない。次は気をつける」', ['ev.team+1']), f2('訂正を頼む', '翌週、なぜか一面に大きな訂正記事が出た。', ['rep+1'])],
      },
    ],
  },
  seitokai: {
    name: '東雲',
    portrait: 'shinonome',
    ep1: {
      title: '生徒会の仕事',
      bg: 'bg_ground_day',
      lines: ['東雲が練習に遅れてきた。腕には、書類の束。', '東雲「すまない。予算の資料が終わらなくて。…大丈夫、一人でやれる」'],
      choices: [
        c('「部活のことは気にするな」', '東雲は少しだけ救われた顔をして、生徒会室に戻った。', 'end', ['st+5']),
        c('その場で書類を半分受け取る', '二人で片付けた。東雲「…助かる。次も頼む」', 'alt', ['st-4', 'ev.makabe+2']),
        c('「一人でやるのをやめろ」とだけ言う', '東雲は黙って書類を見つめ、翌日、真壁先生に仕事を分けてもらっていた。', 'ok', ['ev.makabe+1', 'mo+2']),
      ],
    },
    ep2: {
      title: '壮行会',
      bg: 'bg_entrance_ceremony',
      lines: ['大会前の全校集会。壇上の東雲が、こちらを前に呼んだ。', '東雲「野球部から、一言。…頼む」'],
      choices: [
        c('東雲に「お前が話してくれ」と返す', '東雲の話に体育館が沸いた。東雲はそれから、ベンチで声を出すようになった。', 'alt', ['ev.team+2']),
        c('大地にマイクを渡す', '大地が大声で笑いを取った。', 'end', ['ev.daichi+2']),
        c('「勝ちます」とだけ言って壇を降りる', '一瞬の静けさのあと、体育館が揺れた。東雲「…それでいい」', 'ok', ['rep+1', 'mo+3']),
      ],
    },
    ep3F: {
      title: '一打で空気を変える',
      bg: 'bg_student_council',
      lines: ['生徒会室。東雲が、窓からグラウンドを見下ろしている。', '東雲「人は言葉では動かない。結果を見て動く」'],
      choices: [
        s3('「自分のことで精一杯だ」', '東雲「…それも正直でいい」', 'end', ['ab.batting.contact+1']),
        s3('一打で、ベンチを黙らせる', '東雲「…その一打を、見せてくれ」', 'ok', ['ab.batting.contact+2', 'ab.batting.power+2'], 'main'),
        s3('声でチームを引っ張る', '東雲「…お前の声は、よく通る」', 'alt', ['ev.team+3'], 'alt'),
      ],
    },
    ep3P: {
      title: 'マウンドの真ん中',
      bg: 'bg_student_council',
      lines: ['生徒会室。東雲が、窓からマウンドを見下ろしている。', '東雲「マウンドに立つ人間が、チームの顔だ」'],
      choices: [
        s3('何があっても表情を変えない', '東雲「…頼もしいな」', 'alt', ['ab.pitching.control+2'], 'alt'),
        s3('打たれても、自分から守備に声をかける', '東雲「…それができる投手は、少ない」', 'ok', ['ab.pitching.control+2', 'ab.pitching.stamina+2'], 'main'),
        s3('「自分のことで精一杯だ」', '東雲「…それも正直でいい」', 'end', ['ab.pitching.control+1']),
      ],
    },
    alt: {
      title: '生徒会室の夕方',
      bg: 'bg_student_council',
      lines: ['生徒会室で、東雲が野球部の応援の企画書を書いている。', '東雲「…お前らが勝つと、学校が明るくなるんだ」'],
      label: '企画書を手伝う',
      text: '企画書は、その日のうちに通った。',
      fb: ['rep+2', 'ev.team+2'],
    },
    fillers: [
      {
        title: '生徒会の差し入れ',
        bg: 'bg_ground_day',
        lines: ['生徒会から、部活応援のスポーツドリンクが箱で届いた。'],
        choices: [f2('みんなで飲む', '部員全員が、一息ついた。', ['all.st+5']), f2('試合の日まで取っておく', '次の試合を、少し楽しみにした。', ['mo+3'])],
      },
      {
        title: '校則の相談',
        bg: 'bg_student_council',
        lines: ['東雲に「丸刈りは、校則で決めるべきだろうか」と、真面目に相談された。'],
        choices: [f2('「自由でいい」', '東雲「…やはり、そうか」', ['ev.team+1']), f2('「気合が入る」', '東雲「…なるほど。そういう考え方もある」', ['mo+4'])],
      },
    ],
  },
  daichi: {
    name: '大地',
    portrait: 'daichi',
    ep1: {
      title: '古い写真',
      bg: 'bg_liquor_day',
      lines: ['日向酒店の店先。片付けを手伝っていると、小学生のころの少年野球の写真が出てきた。', '大地「うわ、懐かしいな。このころ、いつも強いチームに負けてたよな」'],
      choices: [
        c('「このころの大地、よく泣いてたよな」', '大地「うるせぇ」照れ笑いのまま、思い出話が止まらない。', 'alt', ['ev.daichi+2']),
        c('「もう昔の話だろ」', '大地は少しだけ寂しそうに、写真をしまった。', 'end', ['st+5']),
        c('「いつか倒すって言ってたな」', '大地がニヤリと笑った。「…覚えてたのかよ」', 'ok', ['mo+3']),
      ],
    },
    ep2: {
      title: '格上と戦った夜',
      bg: 'bg_street_sunset',
      lines: ['格上の相手との試合のあとの帰り道。大地が口を開いた。', '大地「…今日の相手、どうだった？」'],
      choices: [
        c('「次は勝つ」', '大地「…簡単に言うなよ」それきり、その話はしなかった。', 'end', ['mo+2']),
        c('黙ってラムネを二本買う', '二人でラムネを飲みながら、負けた試合の話ばかりした。', 'alt', ['ev.daichi+2']),
        c('「今のままじゃ無理だ」', '大地「…だよな。だから、変わろうぜ」', 'ok', ['ab.main+1']),
      ],
    },
    ep3F: {
      title: '下から行く奴',
      bg: 'bg_ground_sunset',
      lines: ['居残り練習のあと。大地がマスクを外して、ベンチに座った。', '大地「下から行く奴のほうが、怖いもんなしだ」'],
      choices: [
        s3('負けていても、最後の一球まで諦めない', '大地「…お前、昔からそうだったな」', 'alt', ['ab.batting.contact+2'], 'alt'),
        s3('勝てる相手に、確実に勝つ', '大地「…まあ、それも大事だな」', 'end', ['ab.batting.contact+1']),
        s3('強い相手ほど、初球から振りにいく', '大地が、腹を抱えて笑った。「そういうとこだよ」', 'ok', ['ab.batting.contact+2', 'ab.batting.power+2'], 'main'),
      ],
    },
    ep3P: {
      title: '王者の構え',
      bg: 'bg_ground_sunset',
      lines: ['ブルペンのあと。大地がミットを外して、ベンチに座った。', '大地「お前が堂々としてりゃ、打者は勝手に縮こまる」'],
      choices: [
        s3('打たれても、胸を張って次の打者へ', '大地「…そう。それでいい」', 'ok', ['ab.pitching.velocity+2', 'ab.pitching.control+2'], 'main'),
        s3('打者をよく観察して投げる', '大地「…そこは、俺の仕事だろ」', 'end', ['ab.pitching.control+1']),
        s3('走者が出てからが本番だと思う', '大地「…変わってんな。でも、頼もしい」', 'alt', ['ab.pitching.kire+2'], 'alt'),
      ],
    },
    alt: {
      title: '日向酒店の屋上',
      bg: 'bg_liquor_day',
      lines: ['店の屋上で、大地が小学生のころのスコアブックを広げている。', '大地「負けた試合のほうが、よく覚えてるんだよな」'],
      label: '一緒にページをめくる',
      text: '日が沈むまで、二人でページをめくった。',
      fb: ['mo+5', 'ev.daichi+3'],
    },
    fillers: [],
  },
  tenkosei: {
    name: '神代',
    portrait: 'tenkosei',
    // 神代は一発イベントだけ（buildTenkosei を使う）
    ep1: { title: '', bg: '', lines: [], choices: [] },
    ep2: { title: '', bg: '', lines: [], choices: [] },
    ep3F: { title: '', bg: '', lines: [], choices: [] },
    ep3P: { title: '', bg: '', lines: [], choices: [] },
    alt: { title: '', bg: '', lines: [], label: '', text: '', fb: [] },
    fillers: [],
  },
}

/**
 * 各話の選択肢の出し方（11月19日）。3択ばかりにならないよう、選択肢のない回（['ok']）と2択の回を混ぜる。
 * 並びは [1話, 2話, 3話]。'ok' 正解、'end' 終了、'alt' 別の道（3話では別の終わり方）
 */
const ALL: Kind[] = ['ok', 'end', 'alt']
export const EP_FORMAT: Record<CharKey, Kind[][]> = {
  sumo: [ALL, ['ok'], ['ok', 'end']],
  soccer: [['ok', 'alt'], ALL, ALL],
  shogi: [['ok'], ALL, ['ok', 'alt']],
  tennis: [ALL, ['ok', 'end'], ALL],
  rikujo: [['ok', 'alt'], ['ok'], ALL],
  takkyu: [['ok'], ALL, ['ok', 'end']],
  shinbun: [ALL, ['ok', 'alt'], ['ok', 'alt']],
  seitokai: [['ok', 'alt'], ['ok'], ALL],
  daichi: [['ok'], ALL, ['ok', 'end']],
  tenkosei: [ALL, ALL, ALL],
}

// ---------------------------------------------------------------- 進み具合（save.flags に持つ）
type Route = 'ok' | 'alt' | 'end' | 'done'
function routeOf(save: SaveData, key: CharKey): Route {
  return (save.flags?.[`chr_${key}`] as Route | undefined) ?? 'ok'
}
function epOf(save: SaveData, key: CharKey): number {
  return Number(save.flags?.[`che_${key}`] ?? 0)
}
const flag = (k: string, v: string | number): EffectOp => ({ op: 'flag', key: k, value: v })

/** 入部しているキャラ（大地・神代は除く）と、その選手 */
export function joinedChars(save: SaveData): { key: CharKey; player: Player }[] {
  const s = successOf(save)
  if (!s) return []
  const out: { key: CharKey; player: Player }[] = []
  for (const [id, pid] of Object.entries(s.joined)) {
    if (id === 'tenkosei') continue
    const p = pid ? save.players[pid] : undefined
    if (p && !p.retired) out.push({ key: id as CharKey, player: p })
  }
  if (s.joinedTransfer && routeOf(save, 'tenkosei') !== 'done') {
    const p = save.players[s.joinedTransfer]
    if (p && !p.retired) out.push({ key: 'tenkosei', player: p })
  }
  return out
}

// ---------------------------------------------------------------- 効果
const ABIL_LABEL = (k: string): string => (k === 'pitching.velocity' ? '球速' : (ABILITY_LABEL[k] ?? k))

interface Built {
  ops: EffectOp[]
  notes: string[]
}

function buildFx(f: Player, fx: Fx, rng: Rng): Built {
  const pitcher = f.mainPosition === 'P'
  const ops: EffectOp[] = []
  const up: Record<number, string[]> = {}
  const notes: string[] = []
  const addAb = (key: string, d: number) => {
    const delta = key.startsWith('pitching.') && key !== 'pitching.velocity' && pitcher ? pitcherDelta(d) : d
    ops.push({ op: 'ability', playerId: f.id, key, delta })
    ;(up[d] ??= []).push(ABIL_LABEL(key))
  }
  for (const t of fx) {
    const m = /^([a-zA-Z.]+?)([+-]\d+)$/.exec(t)
    if (!m) continue
    const k = m[1]!
    const n = Number(m[2])
    if (k === 'st') {
      ops.push({ op: 'condition', playerId: f.id, key: 'stamina', delta: n })
      notes.push(n >= 100 ? '体力が全回復した' : n > 0 ? '体力が回復した' : '体力が減った')
    } else if (k === 'mo') {
      ops.push({ op: 'condition', playerId: f.id, key: 'motivation', delta: n })
      notes.push(n > 0 ? '調子が上がった' : '調子が下がった')
    } else if (k === 'all.st') {
      ops.push({ op: 'condition', playerId: 'all', key: 'stamina', delta: n })
      notes.push('部員全員の体力が回復した')
    } else if (k === 'all.mo') {
      ops.push({ op: 'condition', playerId: 'all', key: 'motivation', delta: n })
      notes.push('部員全員の調子が上がった')
    } else if (k === 'rep') {
      ops.push({ op: 'school', key: 'reputation', delta: n })
      notes.push('評判が上がった')
    } else if (k.startsWith('ev.')) {
      const key = k.slice(3) as EvalKey
      ops.push({ op: 'eval', key, delta: n })
      notes.push(`${EVAL_LABEL[key]}の評価が${n > 0 ? '上がった' : '下がった'}`)
    } else if (k === 'ab.main') {
      for (const key of rng.shuffle(mainKeys(f)).slice(0, 2)) addAb(key, n)
    } else if (k.startsWith('abF.')) {
      if (!pitcher) addAb(k.slice(4), n)
    } else if (k.startsWith('abP.')) {
      if (pitcher) addAb(k.slice(4), n)
    } else if (k.startsWith('ab.')) {
      addAb(k.slice(3), n)
    }
  }
  const abNotes = Object.entries(up)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([d, names]) => `${[...new Set(names)].join('と')}が${Number(d) >= 3 ? '大きく' : Number(d) <= 1 ? '少し' : ''}上がった`)
  return { ops, notes: [...abNotes, ...notes] }
}

function withNotes(text: string, notes: string[], extra = ''): string {
  return `${text}${notes.length ? `（${notes.join('。')}）` : ''}${extra}`
}

/** 能力を取る（取れなければ null） */
function trySkill(f: Player, id: string | undefined, rate: number, rng: Rng): string | null {
  if (!id) return null
  const def = getSkill(id)
  if (!def || !canHave(f, def)) return null
  return rng.chance(rate) ? id : null
}

// ---------------------------------------------------------------- イベントを作る
function speakerOf(sc: CharScript) {
  return { kind: 'local' as const, name: sc.name, portrait: sc.portrait }
}

function finish(e: Omit<EventInstance, 'id' | 'speaker'>, sc: CharScript, key: CharKey, f: Player): EventInstance {
  return { id: eid(`ch_${key}`), speaker: speakerOf(sc), relatedPlayerIds: [f.id], cast: [{ char: sc.portrait }], ...e }
}

/** 続きの話（1話・2話） */
function chainEp(save: SaveData, rng: Rng, key: CharKey, f: Player, n: 1 | 2): EventInstance {
  const sc = CHAR_SCRIPTS[key]
  const ep = n === 1 ? sc.ep1 : sc.ep2
  const route = routeOf(save, key)
  const kinds = EP_FORMAT[key][n - 1]!
  const choices = rng.shuffle(ep.choices.filter((ch) => kinds.includes(ch.kind))).map((ch) => {
    const b = buildFx(f, ch.fx, rng)
    // 一度「別の道」に入ったら、そのあと正解を選んでも別の道のまま
    const next: Route = ch.kind === 'end' ? 'end' : ch.kind === 'alt' || route === 'alt' ? 'alt' : 'ok'
    return { label: ch.label, result: withNotes(ch.text, b.notes), ops: [...b.ops, flag(`chr_${key}`, next), flag(`che_${key}`, n)], tag: ch.kind }
  })
  return finish({ title: `${sc.name}「${ep.title}」（${n}話）`, bg: ep.bg, lines: ep.lines, choices }, sc, key, f)
}

/** 3話（正解のまま来たとき：育成選手が投手か野手かで中身が変わる） */
function chainEp3(save: SaveData, rng: Rng, key: CharKey, f: Player): EventInstance {
  const sc = CHAR_SCRIPTS[key]
  const set = CHAR_SKILLS[key]!
  const ep = f.mainPosition === 'P' ? sc.ep3P : sc.ep3F
  const kinds = EP_FORMAT[key][2]!
  const choices = rng.shuffle(ep.choices.filter((ch) => kinds.includes(ch.kind))).map((ch) => {
    const done = [flag(`chr_${key}`, 'done'), flag(`che_${key}`, 3)]
    if (!ch.skill) {
      const b = buildFx(f, ch.fx, rng)
      return { label: ch.label, result: withNotes(ch.text, b.notes), ops: [...b.ops, ...done], tag: ch.kind }
    }
    const got = trySkill(f, charSkillFor(key, f, ch.skill === 'alt'), CHAR_SKILL_RATE, rng)
    const common = ch.skill === 'main' && set.common ? trySkill(f, set.common, CHAR_COMMON_RATE, rng) : null
    const skills = [got, common].filter((x): x is string => !!x)
    const b = got ? { ops: [], notes: [] } : buildFx(f, ch.fx, rng)
    const extra = skills.map((id) => `特殊能力「${getSkill(id)!.name}」を身につけた！`).join('')
    return {
      label: ch.label,
      result: withNotes(ch.text, b.notes, extra),
      ops: [...b.ops, ...skills.map((id): EffectOp => ({ op: 'skill', playerId: f.id, add: id })), ...done],
      tag: ch.kind,
    }
  })
  return finish({ title: `${sc.name}「${ep.title}」（最終話）`, bg: ep.bg, lines: ep.lines, choices, bgm: 'rare' }, sc, key, f)
}

/** 3話（別の道） */
function chainAlt(rng: Rng, key: CharKey, f: Player): EventInstance {
  const sc = CHAR_SCRIPTS[key]
  const got = trySkill(f, charSkillFor(key, f, true), CHAR_SKILL_RATE, rng)
  const b = got ? { ops: [], notes: [] } : buildFx(f, sc.alt.fb, rng)
  const extra = got ? `特殊能力「${getSkill(got)!.name}」を身につけた！` : ''
  return finish(
    {
      title: `${sc.name}「${sc.alt.title}」（最終話）`,
      bg: sc.alt.bg,
      lines: sc.alt.lines,
      choices: [
        {
          label: sc.alt.label,
          result: withNotes(sc.alt.text, b.notes, extra),
          ops: [...b.ops, ...(got ? [{ op: 'skill' as const, playerId: f.id, add: got }] : []), flag(`chr_${key}`, 'done'), flag(`che_${key}`, 3)],
        },
      ],
    },
    sc,
    key,
    f,
  )
}

/** 続きの話を作る（もう起きないときは null） */
export function chainEvent(save: SaveData, rng: Rng, key: CharKey): EventInstance | null {
  const f = focusPlayer(save)
  if (!f) return null
  const route = routeOf(save, key)
  if (route === 'end' || route === 'done') return null
  const n = epOf(save, key)
  // 大地の2話は、自校より総合の高い相手と戦った週だけ
  if (key === 'daichi' && n === 1) {
    const w = Number(save.flags?.strongFought ?? -99)
    if (absWeek(save) - w > 1) return null
  }
  if (n === 0) return chainEp(save, rng, key, f, 1)
  if (n === 1) return chainEp(save, rng, key, f, 2)
  return route === 'alt' ? chainAlt(rng, key, f) : chainEp3(save, rng, key, f)
}

/** ただの出来事 */
function fillerEvent(rng: Rng, key: CharKey, f: Player): EventInstance | null {
  const sc = CHAR_SCRIPTS[key]
  if (!sc.fillers.length) return null
  const fl = rng.pick(sc.fillers)
  const choices = fl.choices.map((ch) => {
    const b = buildFx(f, ch.fx, rng)
    return { label: ch.label, result: withNotes(ch.text, b.notes), ops: b.ops }
  })
  return finish({ title: `${sc.name}「${fl.title}」`, bg: fl.bg, lines: fl.lines, choices }, sc, key, f)
}

/** 神代の一発イベント（入部から4週以上たってから、止まると40%） */
function tenkoseiEvent(save: SaveData, rng: Rng, f: Player): EventInstance | null {
  const joined = Number(save.flags?.chj_tenkosei ?? absWeek(save))
  // 大地とナギが付き合っていれば40%、そうでなければ20%
  const rate = successOf(save)?.dating != null ? TENKOSEI_RATE : TENKOSEI_RATE_SINGLE
  if (absWeek(save) - joined < 4 || !rng.chance(rate)) return null
  const sc = CHAR_SCRIPTS.tenkosei
  const done = [flag('chr_tenkosei', 'done')]
  const alt = trySkill(f, charSkillFor('tenkosei', f, true), CHAR_SKILL_RATE, rng)
  const main = trySkill(f, charSkillFor('tenkosei', f), TENKOSEI_SKILL_RATE, rng)
  const altB = alt ? { ops: [], notes: [] } : buildFx(f, ['mo+5'], rng)
  const mainB = main ? { ops: [], notes: [] } : buildFx(f, ['ab.main+2'], rng)
  const endB = buildFx(f, ['mo+4'], rng)
  const name = (id: string) => `特殊能力「${getSkill(id)!.name}」を身につけた！`
  const choices = rng.shuffle([
    {
      label: '「こっちでは、誰もそんなこと言わない」',
      result: withNotes('神代「…そうだな。ここは、空気が軽い」', altB.notes, alt ? name(alt) : ''),
      ops: [...altB.ops, ...(alt ? [{ op: 'skill' as const, playerId: f.id, add: alt }] : []), ...done],
      tag: 'alt',
    },
    { label: '「前の学校のことは、もう忘れろ」', result: withNotes('神代は「…そうだな」とだけ言った。', endB.notes), ops: [...endB.ops, ...done], tag: 'end' },
    {
      label: '「それでも、打つのは好きなんだろ」',
      result: withNotes('神代は長いあいだ黙って、小さくうなずいた。', mainB.notes, main ? name(main) : ''),
      ops: [...mainB.ops, ...(main ? [{ op: 'skill' as const, playerId: f.id, add: main }] : []), ...done],
      tag: 'ok',
    },
  ])
  return finish(
    {
      title: `神代「前の学校の話」`,
      bg: 'bg_clubroom_day',
      lines: [
        '雨の日の部室。二人きりになったとき、神代が初めて自分から話し始めた。',
        '神代「前の学校じゃ、打っても打っても、『次も打て』しか言われなかった。…いつの間にか、打つのが怖くなってた」',
        'ナギ（心の声）「…結果しか見られない場所は、人をすり減らす」',
      ],
      choices,
      bgm: 'rare',
    },
    sc,
    'tenkosei',
    f,
  )
}

/** 練習マスに付いたキャラに止まったときのイベント（起きないときは null） */
export function charEvent(save: SaveData, rng: Rng, key: CharKey): EventInstance | null {
  const f = focusPlayer(save)
  if (!f) return null
  if (key === 'tenkosei') return tenkoseiEvent(save, rng, f)
  if (rng.chance(chainRate(save))) {
    const e = chainEvent(save, rng, key)
    if (e) return e
  }
  return fillerEvent(rng, key, f)
}

/** 盤面に出す、キャラの短い名前と色 */
export const CHAR_BADGE: Record<CharKey, { short: string; label: string; color: string }> = {
  sumo: { short: '塩', label: '塩見', color: '#8a5a2b' },
  soccer: { short: '天', label: '天羽', color: '#1f9d6b' },
  shogi: { short: '千', label: '千手', color: '#6b4fa0' },
  tennis: { short: '久', label: '久遠', color: '#2a8fb8' },
  rikujo: { short: '岩', label: '岩城', color: '#7a7a7a' },
  takkyu: { short: '小', label: '小早川', color: '#d0662f' },
  shinbun: { short: '三', label: '三木', color: '#3d5a80' },
  seitokai: { short: '東', label: '東雲', color: '#9b2d4a' },
  daichi: { short: '大', label: '大地', color: '#2f6fe0' },
  tenkosei: { short: '神', label: '神代', color: '#444c5c' },
}
