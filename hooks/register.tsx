import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Cutin, CutinKind, NightMode } from '../types'
import { SCREEN_SCRIPT, screenPage } from './screen'
import { VOICES } from './voices'

const nightMode = atom({ plugin: 'okan', key: 'nightMode' } as const, 'auto' as NightMode)
const recent = atom({ plugin: 'okan', key: 'recent' } as const, [] as string[])
const tsukkomi = atom({ plugin: 'okan', key: 'tsukkomi' } as const, null as string | null)
const yappariCount = atom({ plugin: 'okan', key: 'yappariCount' } as const, 0)
const cutin = atom({ plugin: 'okan', key: 'cutin' } as const, null as Cutin | null)
const isMuted = atom({ plugin: 'okan', key: 'isMuted' } as const, false)
const isZengamen = atom({ plugin: 'okan', key: 'isZengamen' } as const, true)
const firedSlots = atom({ plugin: 'okan', key: 'firedSlots' } as const, [] as string[])

const VOICE = 'Grandma (Japanese (Japan))'
const CUTIN_MS = 4500

const HOMERU = [
  'ご飯できてるで',
  'お風呂わいてるで',
  '近所に自慢しとくわ',
  'みかん食べ',
  'アメちゃんあげよか',
]

const YAPPARI = [
  'またかいな…',
  'あんた何回変えんの',
  'お父さんそっくりやわ',
  'おかん、もう覚えられへんで',
]

const RANYU: [string, string][] = [
  ['ちょっと！！', '洗濯物取り込んで！'],
  ['ご飯は！？', 'ちゃんと食べたん？'],
  ['電気！！', 'つけっぱなしやで！'],
  ['背中！！', 'まがってるで！'],
  ['それ何！？', 'おかんにも教えて'],
  ['宅配便！！', 'ハンコどこやった？'],
  ['掃除機！！', 'そこどいて！'],
  ['お風呂！！', 'はよ入りなさい！'],
  ['水分！！', 'ちゃんと飲んどる？'],
  ['画面近い！！', '目ぇ悪なるで！'],
  ['お隣さん！！', 'みかんくれはったで！'],
  ['靴下！！', '裏返しのまま出さんといて！'],
]

const YORU_SUB = [
  '明日も早いんやろ',
  'パソコンは逃げへんで',
  'お肌に悪いで',
  'AIも寝かせたり',
  '電気代もったいない！',
]

const SAKKI: [string, string][] = [
  ['さっきも言うてたやん！', '同じこと何回言うの'],
  ['それ聞いた！！', 'おかん耳ついとるで'],
  ['デジャヴか！？', 'さっきとおんなじやん'],
  ['2回目やで！！', 'メモしとき！'],
]

// 種類ごとの色（背景・帯・文字のグラデーション）
const THEME: Record<CutinKind, { bg: string; band: string; band2: string; top: string; bottom: string; badge: string }> = {
  yoru: { bg: '#12001f', band: '#ff0055', band2: '#7a00ff', top: '#fff6a8', bottom: '#ff9d00', badge: '深夜警報' },
  tsukkomi: { bg: '#1a0000', band: '#ff2a00', band2: '#ffcc00', top: '#ffffff', bottom: '#ffe14d', badge: 'ツッコミ' },
  homeru: { bg: '#2a1600', band: '#ffb300', band2: '#ff4fd8', top: '#fffbe0', bottom: '#ffc400', badge: '大絶賛' },
  ranyu: { bg: '#001a12', band: '#00e5ff', band2: '#ff00a8', top: '#ffffff', bottom: '#7dff4d', badge: 'おかん乱入' },
  seikatsu: { bg: '#1f0f00', band: '#ff7a00', band2: '#00b3ff', top: '#ffffff', bottom: '#ffd84d', badge: 'おかんの時報' },
}

// 声に出すセリフ（voices.ts の見出しと同じ形）
const SPEAK: Record<CutinKind, (title: string, sub: string) => string> = {
  yoru: (title, sub) => `はよ寝なさい！${sub.replace(/^もう\d+時やで！/, '')}`,
  tsukkomi: title => title,
  homeru: (title, sub) => `えらいなぁ！${sub.replace(/^\d+分もがんばったんか！/, '')}`,
  ranyu: (title, sub) => `${title}${sub}`,
  seikatsu: (title, sub) => `${title}${sub}`,
}

const SOUND: Record<CutinKind, string> = {
  yoru: 'sounds/cutin.wav',
  tsukkomi: 'sounds/bashi.wav',
  homeru: 'sounds/kira.wav',
  ranyu: 'sounds/cutin.wav',
  seikatsu: 'sounds/cutin.wav',
}

// おかんの1日：この時刻になったら、写真の種類（scene）で全画面乱入する
const SCHEDULE: { at: number; scene: string; title: string; sub: string }[] = [
  { at: 7 * 60, scene: 'asa', title: '起きなさい！！', sub: '遅刻するで！' },
  { at: 12 * 60, scene: 'hiru', title: 'お昼やで！！', sub: 'ちゃんと食べなさい！' },
  { at: 15 * 60, scene: 'oyatsu', title: 'おやつやで！！', sub: 'ちょっと休憩し！' },
  { at: 18 * 60 + 30, scene: 'yuhan', title: 'ご飯できたで！！', sub: '冷めるやろ！はよ来なさい！' },
  { at: 20 * 60, scene: 'furo', title: 'お風呂入りなさい！！', sub: 'お湯冷めるで！' },
]
const BEDTIME = 21

// 日本時間の「何時か」「何分か（0時からの分）」「何日か」
const tokyo = (ms: number) => new Date(ms + 9 * 3600 * 1000)
const hourInTokyo = (ms: number) => tokyo(ms).getUTCHours()
const minuteOfDay = (ms: number) => tokyo(ms).getUTCHours() * 60 + tokyo(ms).getUTCMinutes()
const dayKey = (ms: number) => tokyo(ms).toISOString().slice(0, 10)

const isLate = (hour: number) => hour >= BEDTIME || hour < 5

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 空白や記号を取って比べやすくする
const normalize = (text: string) =>
  text.toLowerCase().replace(/[\s、。！？!?.,・「」『』（）()…ー〜~]/g, '')

// 2文字ずつの組がどれだけ重なるか（0〜1）
const similarity = (a: string, b: string) => {
  const grams = (s: string) => {
    const set = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
    return set
  }
  const x = grams(a)
  const y = grams(b)
  if (x.size === 0 || y.size === 0) return 0
  let both = 0
  for (const g of x) if (y.has(g)) both++
  return both / (x.size + y.size - both)
}

// ギラギラのカットイン画面（SVG）
// W・H は画面の形。中身（帯・文字・おかん）は 1200×360 で描いて、画面に収まるよう拡大する
export const cutinSvg = (c: Cutin, W = 1200, H = 360) => {
  const t = THEME[c.kind]
  const cx = 600
  const s = Math.min(W / 1200, H / 360)
  const content = `translate(${(W - 1200 * s) / 2} ${(H - 360 * s) / 2}) scale(${s})`
  const rx = W / 2
  const ry = H / 2
  const rays = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2
    const b = a + 0.05
    const r = Math.max(W, H) * 1.5
    return `<polygon points="${rx},${ry} ${rx + Math.cos(a) * r},${ry + Math.sin(a) * r} ${rx + Math.cos(b) * r},${ry + Math.sin(b) * r}" />`
  }).join('')
  const titleFit = [...c.title].length > 7 ? ` textLength="1000" lengthAdjust="spacingAndGlyphs"` : ''
  const tape = Array.from({ length: Math.ceil(W / 60) + 4 },(_, i) => `<rect x="${i * 60}" y="0" width="30" height="34" transform="skewX(-30)" />`).join('')
  const badge = escape(t.badge)
  const sparkles = c.kind === 'homeru'
    ? Array.from({ length: 18 }, (_, i) => {
      const x = 60 + ((i * 263) % 1080)
      const y = 40 + ((i * 131) % 280)
      return `<text x="${x}" y="${y}" font-size="${28 + (i % 3) * 14}" fill="#fff">✦<animate attributeName="opacity" values="0;1;0" dur="${0.6 + (i % 4) * 0.2}s" begin="${(i % 5) * 0.1}s" repeatCount="indefinite"/></text>`
    }).join('')
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.top}"/>
    <stop offset="0.55" stop-color="${t.bottom}"/>
    <stop offset="1" stop-color="#b34700"/>
  </linearGradient>
  <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/>
    <stop offset="0.5" stop-color="#fff" stop-opacity="0.9"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="titleClip"><rect x="0" y="80" width="${W}" height="170"/></clipPath>
</defs>
<rect width="${W}" height="${H}" fill="${t.bg}"/>
<g fill="${t.band}" opacity="0.35">
  ${rays}
  <animateTransform attributeName="transform" type="rotate" from="0 ${rx} ${ry}" to="360 ${rx} ${ry}" dur="6s" repeatCount="indefinite"/>
</g>
<rect width="${W}" height="${H}" fill="#fff">
  <animate attributeName="opacity" values="1;0;0.6;0;0" keyTimes="0;0.1;0.15;0.3;1" dur="0.8s" fill="freeze"/>
</rect>
<rect width="${W}" height="${H}" fill="${t.band}" opacity="0">
  <animate attributeName="opacity" values="0;0.35;0" dur="0.3s" begin="0.8s" repeatCount="indefinite"/>
</rect>
<g transform="${content}"><g>
  <polygon points="-3000,95 4200,55 4200,145 -3000,185" fill="${t.band2}"/>
  <polygon points="-3000,205 4200,165 4200,265 -3000,305" fill="${t.band}"/>
  <animateTransform attributeName="transform" type="translate" values="-1500 0;40 0;0 0" keyTimes="0;0.7;1" dur="0.35s" fill="freeze"/>
</g></g>
<g fill="#ffd500">
  <rect y="0" width="${W}" height="34" fill="#111"/>
  <g>${tape}<animateTransform attributeName="transform" type="translate" from="0 0" to="-60 0" dur="0.4s" repeatCount="indefinite"/></g>
  <rect y="${H - 34}" width="${W}" height="34" fill="#111"/>
  <g transform="translate(0 ${H - 34})">${tape}<animateTransform attributeName="transform" type="translate" from="-60 ${H - 34}" to="0 ${H - 34}" dur="0.4s" repeatCount="indefinite"/></g>
</g>
<g>
  <rect x="24" y="44" width="250" height="56" rx="6" fill="#000" stroke="#ffd500" stroke-width="4"/>
  <text x="149" y="84" text-anchor="middle" font-family="Hiragino Sans, sans-serif" font-weight="900" font-size="32" fill="#ffd500">⚠ ${badge} ⚠</text>
  <animate attributeName="opacity" values="1;0.2;1" dur="0.35s" repeatCount="indefinite"/>
</g>
<g transform="${content}">
${sparkles}
<g transform="translate(1060 200)">
  <text x="0" y="0" text-anchor="middle" dominant-baseline="middle" font-size="200">👵</text>
  <animateTransform attributeName="transform" type="translate" values="1500 200;1040 200;1060 200;1060 190;1060 200" keyTimes="0;0.15;0.25;0.6;1" dur="1s" fill="freeze"/>
</g>
<g transform="translate(${cx - 60} 180)"><g>
<g transform="translate(${-(cx - 60)} -180)">
  <g>
    <text x="${cx - 60}" y="205" text-anchor="middle" font-family="Hiragino Mincho ProN, Hiragino Sans, serif" font-weight="900" font-size="140" fill="#000" stroke="#000" stroke-width="28" stroke-linejoin="round"${titleFit}>${escape(c.title)}</text>
    <text x="${cx - 60}" y="205" text-anchor="middle" font-family="Hiragino Mincho ProN, Hiragino Sans, serif" font-weight="900" font-size="140" fill="url(#gold)" stroke="#fff" stroke-width="4"${titleFit}>${escape(c.title)}</text>
    <rect x="-300" y="80" width="200" height="170" fill="url(#shine)" clip-path="url(#titleClip)" transform="skewX(-20)">
      <animate attributeName="x" values="-300;1500" dur="1.2s" begin="0.4s" repeatCount="indefinite"/>
    </rect>
    <animateTransform attributeName="transform" type="translate" values="0 0;-6 4;5 -3;-4 -4;6 3;0 0" dur="0.18s" begin="0.45s" repeatCount="indefinite"/>
  </g>
</g>
<animateTransform attributeName="transform" type="scale" values="4;0.9;1.05;1" keyTimes="0;0.6;0.8;1" dur="0.45s" fill="freeze"/>
</g></g>
<g opacity="0">
  <rect x="${cx - 400}" y="262" width="680" height="54" fill="#000" opacity="0.75" transform="skewX(-12)"/>
  <text x="${cx - 60}" y="301" text-anchor="middle" font-family="Hiragino Sans, sans-serif" font-weight="900" font-size="38" fill="#fff">${escape(c.sub)}</text>
  <animate attributeName="opacity" values="0;1" dur="0.15s" begin="0.5s" fill="freeze"/>
</g>
</g>
</svg>`
}

// Mac の画面全体をおかんで埋める（scenes フォルダの写真から、種類に合う1枚を選ぶ）
async function zengamen($: EngineInterface, id: number, kind: CutinKind, title: string, sub: string, scene: string) {
  if (!(await read($, isZengamen))) {
    return
  }
  const root = $.plugin.root
  // 写真はキャラクターシートで揃えたおかん（scenes/okan）から、場面名で始まるものを選ぶ
  const files = await $.fs.list(`${root}/scenes/okan`).catch(() => [])
  const pics = files.filter(f => f.kind === 'file' && f.name.startsWith(scene) && /\.(jpe?g|png|webp)$/i.test(f.name))
  const pic = pics.length > 0 ? `../scenes/okan/${pick(pics).name}` : null
  const page = `${root}/screen/now-${id % 4}.html`
  await $.fs.write(page, screenPage(THEME[kind], title, sub, pic))
  await $.process.run(['osascript', '-l', 'JavaScript', '-e', SCREEN_SCRIPT, page, root, '4.6'], { timeoutMs: 20000 })
}

// 内カメラで見張る。顔が近すぎる・猫背になったら、おかんが乱入する
// 止めるときは stop() を呼ぶ（子のプログラムも止まる）
// カメラの知らせ → おかんのセリフ
const CAMERA: Record<string, [string, string]> = {
  near: ['画面近い！！', '目ぇ悪なるで！'],
  slouch: ['背中！！', 'まがってるで！'],
  yoso: ['どこ見てんの！！', 'こっち見なさい！'],
  nemuri: ['寝るなら布団！！', '風邪ひくで！'],
}

// カメラの小さなアプリ（おかんカメラ）を起動し、知らせのファイルを0.7秒ごとに読む
// カメラの許可を正しく聞けるよう、アプリとして別に動かしている
async function watchCamera($: EngineInterface) {
  const dir = `${$.plugin.root}/camera`
  const log = `${dir}/events.log`
  await $.process.run(['pkill', '-f', 'OkanCam.app/Contents/MacOS/okancam']).catch(() => undefined)
  await $.fs.write(log, '')
  await $.process.run(['open', '-g', '-n', `${dir}/OkanCam.app`, '--args', log, '0.42'])
  let seen = 0
  const timer = $.clock.every(700, () => {
    void (async () => {
      const lines = (await $.fs.read(log)).split('\n').filter(Boolean)
      const fresh = lines.slice(seen)
      seen = lines.length
      for (const word of fresh) {
        const line = CAMERA[word]
        if (line) await cutIn($, 'ranyu', line[0], line[1])
      }
    })().catch(() => undefined)
  })

  return () => {
    timer.cancel()
    void $.process.run(['pkill', '-f', 'OkanCam.app/Contents/MacOS/okancam']).catch(() => undefined)
  }
}

// 時刻を見て、その日まだ出していない時報があれば乱入する（時刻から10分以内だけ）
async function checkSchedule($: EngineInterface) {
  const now = await $.clock.now()
  const minute = minuteOfDay(now)
  const today = dayKey(now)
  const fired = await read($, firedSlots)
  const slots = [...SCHEDULE, { at: BEDTIME * 60, scene: 'yoru', title: 'はよ寝なさい！！', sub: '' }]
  const due = slots.find(s => minute >= s.at && minute < s.at + 10 && !fired.includes(`${today}-${s.scene}`))
  if (!due) {
    return
  }
  await update($, firedSlots, list => [...list.filter(k => k.startsWith(today)), `${today}-${due.scene}`])
  if (due.scene === 'yoru') {
    await cutIn($, 'yoru', due.title, `もう${hourInTokyo(now)}時やで！${pick(YORU_SUB)}`)
    return
  }
  await cutIn($, 'seikatsu', due.title, due.sub, due.scene)
}

// デモ画面のボタン：押すとその場面のカットインが出る
const DEMO: { key: string; label: string; kind: CutinKind; title: string; sub: string; scene?: string }[] = [
  { key: 'asa', label: '⏰ 7時 起床', kind: 'seikatsu', title: '起きなさい！！', sub: '遅刻するで！', scene: 'asa' },
  { key: 'hiru', label: '🍙 12時 お昼', kind: 'seikatsu', title: 'お昼やで！！', sub: 'ちゃんと食べなさい！', scene: 'hiru' },
  { key: 'oyatsu', label: '🍵 15時 おやつ', kind: 'seikatsu', title: 'おやつやで！！', sub: 'ちょっと休憩し！', scene: 'oyatsu' },
  { key: 'yuhan', label: '🍚 18時半 晩ご飯', kind: 'seikatsu', title: 'ご飯できたで！！', sub: '冷めるやろ！はよ来なさい！', scene: 'yuhan' },
  { key: 'furo', label: '🛁 20時 お風呂', kind: 'seikatsu', title: 'お風呂入りなさい！！', sub: 'お湯冷めるで！', scene: 'furo' },
  { key: 'yoru', label: '🌙 21時 おやすみ', kind: 'yoru', title: 'はよ寝なさい！！', sub: 'もう21時やで！明日も早いんやろ' },
  { key: 'sakki', label: '🔁 同じお願い', kind: 'tsukkomi', title: 'さっきも言うてたやん！', sub: '同じこと何回言うの' },
  { key: 'yappari', label: '🤦 やっぱり', kind: 'tsukkomi', title: 'やっぱり3回目', sub: 'お父さんそっくりやわ' },
  { key: 'oni', label: '👹 仕様変更の鬼', kind: 'tsukkomi', title: '仕様変更の鬼', sub: '「やっぱり」10回目' },
  { key: 'homeru', label: '🎉 作業完了', kind: 'homeru', title: 'えらいっ！！', sub: 'ご飯できてるで' },
  { key: 'ranyu', label: '🧺 乱入', kind: 'ranyu', title: 'ちょっと！！', sub: '洗濯物取り込んで！' },
  { key: 'near', label: '📷 画面に近い', kind: 'ranyu', title: '画面近い！！', sub: '目ぇ悪なるで！' },
  { key: 'slouch', label: '📷 猫背', kind: 'ranyu', title: '背中！！', sub: 'まがってるで！' },
  { key: 'yoso', label: '📷 よそ見', kind: 'ranyu', title: 'どこ見てんの！！', sub: 'こっち見なさい！' },
  { key: 'nemuri', label: '📷 居眠り', kind: 'ranyu', title: '寝るなら布団！！', sub: '風邪ひくで！' },
]

// カットインを出し、音と声を鳴らし、数秒後に消す
// scene は写真の種類（省略すると kind と同じ。生活の時報は asa・hiru など）
async function cutIn($: EngineInterface, kind: CutinKind, title: string, sub: string, scene: string = kind) {
  const id = await $.clock.now()
  await update($, cutin, () => ({ id, kind, title, sub }))
  void zengamen($, id, kind, title, sub, scene).catch(() => undefined)
  $.clock.after(CUTIN_MS, () => {
    void update($, cutin, now => (now?.id === id ? null : now))
  })

  if (await read($, isMuted)) {
    return
  }
  void $.audio.play({ asset: SOUND[kind] }, { gain: 1.4 }).catch(() => undefined)
  const line = SPEAK[kind](title, sub)
  const voice = VOICES[line]
  $.clock.after(kind === 'homeru' ? 300 : 650, () => {
    if (voice) {
      void $.audio.play({ asset: voice }, { gain: 1.6 }).catch(() => undefined)
      return
    }
    void $.audio.speak(line, { voice: VOICE })
      .catch(() => $.audio.speak(line, { voice: 'Kyoko' }))
      .catch(() => undefined)
  })
}

// 入力を見て、同じお願い・「やっぱり」・夜更かしにツッコむ
async function react($: EngineInterface, raw: string) {
  const text = raw.trim()
  if (text.startsWith('/')) {
    return
  }

  const now = normalize(text)
  const before = await read($, recent)
  const isRepeat = now.length >= 4 && before.some(old => similarity(old, now) >= 0.6)

  let line: string | null = null
  let big: [string, string] | null = null
  if (/やっぱり|やっぱ/.test(text)) {
    const count = (await read($, yappariCount)) + 1
    await update($, yappariCount, () => count)
    line = count >= 10
      ? `「やっぱり」${count}回目！あんたは仕様変更の鬼や`
      : `「やっぱり」${count}回目やで。${pick(YAPPARI)}`
    big = count >= 10 ? ['仕様変更の鬼', `「やっぱり」${count}回目`] : [`やっぱり${count}回目`, pick(YAPPARI)]
  } else if (isRepeat) {
    line = 'それさっきも言うてたやん'
    big = pick(SAKKI)
  }

  await update($, tsukkomi, () => line)
  await update($, recent, list => [...list, now].slice(-20))

  if (big) {
    await cutIn($, 'tsukkomi', big[0], big[1])
    return
  }
  const mode = await read($, nightMode)
  const hour = hourInTokyo(await $.clock.now())
  if (mode === 'on' || (mode === 'auto' && isLate(hour))) {
    await cutIn($, 'yoru', 'はよ寝なさい！！', `もう${hour}時やで！${pick(YORU_SUB)}`)
  }
}

export const register: Register = on => {
  // 作業中の乱入は40秒に1回まで
  let lastRanyu = 0
  // 見張りカメラを止める関数（動いていないときは null）
  let stopCamera: (() => void) | null = null

  on('command.run', { command: 'okan-demo' }, async $ => {
    await $.ui.open({ id: 'okan-demo', title: 'おかんデモ' })

    return { text: 'おかん：ボタン押してみ！' }
  })

  on('ui.render', { component: 'Pane', requestId: 'okan-demo' }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const isCameraOn = stopCamera !== null
    const toggleCamera = async () => {
      stopCamera?.()
      stopCamera = isCameraOn ? null : await watchCamera($)
      $.ui.invalidate({ requestId: 'okan-demo' })
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Text bold>👵 おかんデモ　押すと全画面で乱入します</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {DEMO.map(d => (
            <Button key={d.key} label={d.label} onPress={() => cutIn($, d.kind, d.title, d.sub, d.scene)} />
          ))}
        </Box>
        <Box flexDirection="row" gap={1}>
          <Button key="camera" label={isCameraOn ? '📷 カメラ見張り：オン（押すと止める）' : '📷 カメラ見張りを始める'} onPress={toggleCamera} />
          <Button key="reset" label="🧹 記憶リセット" onPress={async () => {
            await update($, recent, () => [])
            await update($, tsukkomi, () => null)
            await update($, yappariCount, () => 0)
          }} />
        </Box>
      </Box>
    )
  })

  on('command.run', { command: 'okan-camera' }, async ($, e) => {
    const arg = e.args.trim()
    const isOn = arg === 'on' ? true : arg === 'off' ? false : stopCamera === null
    stopCamera?.()
    stopCamera = isOn ? await watchCamera($) : null

    return { text: isOn ? 'おかん：ずっと見てるからな！近づいたらあかんで' : 'おかん：見張りはやめといたるわ' }
  })

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'okan', description: 'おかんを今すぐ乱入させる' })
    await $.command.register({ name: 'okan-yoru', description: 'おかんの夜モードを切り替える（on / off / auto）' })
    await $.command.register({ name: 'okan-oto', description: 'おかんの音と声を切り替える（on / off）' })
    await $.command.register({ name: 'okan-demo', description: 'おかんのデモ画面を開く（ボタンで全部の演出を試せる）' })
    await $.command.register({ name: 'okan-camera', description: '内カメラで見張る（画面に近い・猫背でおかん乱入）on / off' })
    await $.command.register({ name: 'okan-zengamen', description: 'おかんの全画面乱入を切り替える（on / off）' })
    await $.command.register({ name: 'okan-reset', description: 'おかんの記憶（ツッコミ・やっぱり回数）を消す' })
    // おかんの1日：30秒ごとに時計を見て、時報の時間なら乱入する
    $.clock.every(30000, () => {
      void checkSchedule($).catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'okan' }, async $ => {
    const [title, sub] = pick(RANYU)
    await cutIn($, 'ranyu', title, sub)

    return { text: 'おかん：呼んだ？' }
  })

  on('command.run', { command: 'okan-yoru' }, async ($, e) => {
    const arg = e.args.trim()
    const mode: NightMode = arg === 'on' || arg === 'off' || arg === 'auto'
      ? arg
      : (await read($, nightMode)) === 'on' ? 'off' : 'on'
    await update($, nightMode, () => mode)
    const words = {
      on: 'おかん：夜モードにしたで。はよ寝なさいよ',
      off: 'おかん：今日は大目に見たるわ',
      auto: 'おかん：21時過ぎたら言うからな',
    }
    if (mode === 'on') {
      const hour = hourInTokyo(await $.clock.now())
      await cutIn($, 'yoru', 'はよ寝なさい！！', `もう${hour}時やで！${pick(YORU_SUB)}`)
    }

    return { text: words[mode] }
  })

  on('command.run', { command: 'okan-oto' }, async ($, e) => {
    const arg = e.args.trim()
    const muted = arg === 'off' ? true : arg === 'on' ? false : !(await read($, isMuted))
    await update($, isMuted, () => muted)

    return { text: muted ? 'おかん：ほな黙っとくわ' : 'おかん：声出していくでー！' }
  })

  on('command.run', { command: 'okan-zengamen' }, async ($, e) => {
    const arg = e.args.trim()
    const isOn = arg === 'on' ? true : arg === 'off' ? false : !(await read($, isZengamen))
    await update($, isZengamen, () => isOn)

    return { text: isOn ? 'おかん：画面ぜんぶ使わせてもらうで！' : 'おかん：ほな、端っこにおるわ' }
  })

  on('command.run', { command: 'okan-reset' }, async $ => {
    await update($, recent, () => [])
    await update($, tsukkomi, () => null)
    await update($, yappariCount, () => 0)
    await update($, cutin, () => null)

    return { text: 'おかん：ほな、全部忘れたるわ' }
  })

  on('prompt.submit', async ($, e, next) => {
    // おかんが失敗しても、お願い自体は必ず通す
    await react($, e.text).catch(() => undefined)

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // 作業の途中で、たまにおかんが乱入する（失敗しても作業は止めない）
    const now = await $.clock.now().catch(() => 0)
    if (!e.agentId && now - lastRanyu > 40000 && Math.random() < 0.25) {
      lastRanyu = now
      const [title, sub] = pick(RANYU)
      void cutIn($, 'ranyu', title, sub).catch(() => undefined)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId && !e.isAborted && e.reason === 'answer') {
      const minutes = Math.round(e.durationMs / 60000)
      const sub = minutes >= 3 ? `${minutes}分もがんばったんか！${pick(HOMERU)}` : pick(HOMERU)
      await cutIn($, 'homeru', 'えらいっ！！', sub).catch(() => undefined)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const mode = await read($, nightMode)
    const hour = hourInTokyo(await $.clock.now())
    const isNight = mode === 'on' || (mode === 'auto' && isLate(hour))
    const line = await read($, tsukkomi)
    const show = await read($, cutin)

    if (!isNight && !line && !show) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    // 絵が出せる画面ではギラギラのSVG、ターミナルでは派手な文字
    let banner = null
    if (show && (e.surface === 'desktop' || e.surface === 'mobile')) {
      const { Svg } = $.ui.resolve(e)
      banner = (
        <Svg
          source={cutinSvg(show)}
          alt={`おかん：${show.title} ${show.sub}`}
          isInteractive
        />
      )
    } else if (show) {
      banner = (
        <Box borderStyle="double" borderColor="yellow" paddingX={2}>
          <Text color="yellow" bold inverse>
            {' '}👵 {THEME[show.kind].badge}！ {show.title} {show.sub}{' '}
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {banner}
        {isNight && (
          <Text color="yellow" bold>
            👵 おかん：もう{hour}時やで！はよ寝なさい！明日も早いんやろ
          </Text>
        )}
        {line && (
          <Box>
            <Text color="magenta">👵 おかん：{line} </Text>
            <Button
              key="hai"
              label="はいはい"
              onPress={() => update($, tsukkomi, () => null)}
            />
          </Box>
        )}
      </Box>
    )
  })
}
