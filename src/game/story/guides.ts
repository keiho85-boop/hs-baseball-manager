// 操作のチュートリアル（ストーリーありのとき）
// 実際の画面の上に、説明したい場所だけを明るく残して、ナギが順に案内する。
// 場面（scene）の効果で st.flags['guide:〇〇'] = 'todo' にすると始まり、終わると 'done' になる。

import type { Face } from './types'

export interface GuideStep {
  /** ナギの台詞 */
  text: string
  face?: Face
  /** 明るく残す場所（画面の要素に付けた data-tut の値）。なければ画面の中央に台詞だけ出す */
  target?: string
  /** この画面で案内する（タブの画面なら切り替える。試合の画面は、移るまで待つ） */
  route?: string
  /** 'tap'：どこを押しても次へ　'target'：明るい場所を実際に押すと次へ */
  on: 'tap' | 'target'
  /** 週の処理やイベントが終わってから出す */
  idle?: boolean
}

/** 始める順番（同時に待っているときは、この順に流す） */
export const GUIDE_ORDER = ['practice', 'recruit', 'funds', 'order', 'scout'] as const
export type GuideId = (typeof GUIDE_ORDER)[number]

export const GUIDES: Record<GuideId, GuideStep[]> = {
  /** 練習（すごろく）の進め方：作戦ノートの場面のあと */
  practice: [
    { route: 'home', target: 'board', on: 'tap', text: 'これが練習の盤面です。コマが止まったマスの練習を、その週にみんなでやります。' },
    { target: 'hand', on: 'target', text: '下のカードの数字だけ、コマが進みます。まず、カードを1枚選んでみてください。' },
    { target: 'board', on: 'tap', face: 'smile', text: '止まるマスが光りました。狙ったマスでなければ、別のカードを選び直してもかまいません。' },
    { target: 'go', on: 'target', text: 'よければ、このボタンで進みます。押してみてください。' },
    {
      idle: true,
      on: 'tap',
      face: 'smile',
      text: 'これで1週間の練習が終わりです。カードは毎週配られます。狙ったマスに止まれるよう、先を読んで選んでくださいね。',
    },
  ],

  /** 勧誘（サクセス）：はじめての勧誘の場面のあと */
  recruit: [
    { route: 'home', target: 'recruit-btn', on: 'target', text: '部員集めは「勧誘」からです。練習の代わりに1週間を使います。押してみてください。' },
    {
      target: 'recruit-list',
      on: 'tap',
      text: '今週、それぞれの部活に誰がいるかが分かります。★の人は、ほかの部のエース。いつもいるとは限りません。いる週に行けば、必ず話はできます。',
    },
    {
      target: 'recruit-list',
      on: 'tap',
      face: 'smile',
      text: 'エースは一度では入ってくれません。話すたびに、気持ちが動いていきますよ。9人そろえば、練習試合と大会に出られますよ。今日は閉じて、練習から始めましょう。',
    },
  ],

  /** 部費の使い道：商店会長の差し入れのあと */
  funds: [
    { route: 'home', target: 'club-btn', on: 'target', text: '部費が入りました。使い道を説明しますね。「部の様子」を押してください。' },
    {
      target: 'facilities',
      on: 'tap',
      text: '部費は、設備を整えるのに使います。設備が良くなるほど、対応する練習の伸びが良くなります。',
    },
    {
      target: 'facilities',
      on: 'tap',
      face: 'smile',
      text: '部費は、夏合宿の行き先にも使います。合宿の前に行き先を決めるので、少し残しておくといいですよ。部費は毎月の収入と、大会の寄付で増えます。',
    },
  ],

  /** オーダーと練習試合：9人そろったあと */
  order: [
    { route: 'home', target: 'tab-team', on: 'target', text: 'まずは、試合に出るメンバーを決めましょう。「チーム」を押してください。' },
    {
      route: 'team',
      target: 'order-board',
      on: 'tap',
      text: 'これが打順と守備位置です。2人の名前を続けてタップすると、入れ替わります。守備位置の札どうしなら、守備位置だけが入れ替わります。',
    },
    {
      target: 'order-board',
      on: 'tap',
      face: 'smile',
      text: '名前の下が守備の適性（◎○△）、右側が主な能力のランクです。どこを守れて、どれくらいの力かがひと目で分かります。',
    },
    {
      target: 'order-auto',
      on: 'tap',
      text: '迷ったら「おまかせ」です。試合のたびに、調子やケガを見て組み直します。自分で入れ替えると、おまかせは解除されます。',
    },
    { target: 'tab-home', on: 'target', text: 'オーダーが決まったら、練習試合です。「ホーム」に戻りましょう。' },
    { route: 'home', target: 'practice-match', on: 'target', text: 'ここから練習試合を申し込めます。押してみてください。' },
    {
      target: 'opp-list',
      on: 'target',
      text: '相手を選んでください。強い相手ほど学ぶことは多いですが、最初は勝てそうな相手から選ぶのがおすすめです。',
    },
    {
      route: 'match',
      target: 'match-controls',
      on: 'tap',
      text: '試合は自動で進みます。チャンスや、育成中の選手の打席・登板では、私がサインを出すので、その中から選んでください。',
    },
    {
      target: 'match-controls',
      on: 'tap',
      face: 'smile',
      text: '「継投」で投手を代えられます。「この回まで」「結果へ」で先へ進めることもできます。では、プレイボールです！',
    },
  ],

  /** スカウト：5月になったら */
  scout: [
    { route: 'home', target: 'tab-school', on: 'target', text: '来年の部員を集める、スカウトのやり方です。「学校」を押してください。' },
    { route: 'school', target: 'scout-btn', on: 'target', text: '「スカウト」を押してください。' },
    {
      target: 'scout-list',
      on: 'tap',
      text: '来年入学する、県内の中学3年生のリストです。まず「視察」で力を確かめて、来てほしい選手を「勧誘」します。',
    },
    {
      target: 'scout-points',
      on: 'tap',
      text: '活動できる回数には限りがあります。毎月補充され、スカウトのマスに止まると増えます。足りないときは部費でも行えます。',
    },
    {
      target: 'scout-list',
      on: 'tap',
      face: 'smile',
      text: '12月の終わりに進学先が決まります。関心が高い選手ほど、うちに来てくれますよ。',
    },
  ],
}
