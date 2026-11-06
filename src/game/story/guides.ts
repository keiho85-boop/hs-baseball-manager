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
export const GUIDE_ORDER = ['practice', 'funds', 'order', 'scout'] as const
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

  /** 部費の使い道：商店会長の差し入れのあと */
  funds: [
    { route: 'home', target: 'tab-school', on: 'target', text: '部費が入りました。使い道を説明しますね。「学校」を押してください。' },
    { route: 'school', target: 'funds', on: 'tap', text: '今の部費はここです。毎月の収入や、差し入れ、大会の結果で増えていきます。' },
    {
      target: 'facilities',
      on: 'tap',
      text: '部費は、設備を整えるのに使います。設備が良くなるほど、対応する練習の伸びが良くなります。',
    },
    {
      target: 'facilities',
      on: 'tap',
      face: 'smile',
      text: 'どれを強化するかは、チームの弱いところと、よく止まるマスで決めましょう。スカウトで足りない回数を補うのにも使えます。',
    },
  ],

  /** オーダーと練習試合：初めての練習試合の場面のあと */
  order: [
    { route: 'home', target: 'tab-team', on: 'target', text: 'まずは、試合に出るメンバーを決めましょう。「チーム」を押してください。' },
    {
      route: 'team',
      target: 'order-board',
      on: 'tap',
      text: 'これが打順と守備位置です。名前をドラッグして別の選手に重ねると、入れ替わります。',
    },
    { target: 'order-apt', on: 'target', text: '「守備位置」を押してみてください。' },
    {
      target: 'order-board',
      on: 'tap',
      face: 'smile',
      text: '名前の下が、守備の適性の表示に変わりました。◎○△×で、どこを守れるかがひと目で分かります。もう一度押すと能力の表示に戻ります。',
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
      target: 'match-command',
      on: 'tap',
      text: '試合中は、ここから作戦を出せます。「おまかせ」なら、選手の判断に任せます。',
    },
    {
      target: 'match-controls',
      on: 'tap',
      face: 'smile',
      text: '「1打席」で1打席ずつ、「この回」でその回の終わりまで進みます。「自動」にすると、最後まで見守れます。では、プレイボールです！',
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
