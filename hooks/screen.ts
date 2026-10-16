// Mac の画面全体に、おかんのカットインを数秒だけ出す
// osascript の JavaScript で、枠なし・透明・最前面の窓を作り、HTML を表示する
// 引数：表示する HTML ファイル、読み込みを許すフォルダ、表示する秒数

export const SCREEN_SCRIPT = `
ObjC.import('Cocoa');
ObjC.import('WebKit');
function run(argv) {
  var page = $.NSURL.fileURLWithPath(argv[0]);
  var root = $.NSURL.fileURLWithPath(argv[1]);
  var seconds = parseFloat(argv[2] || '4.5');
  var app = $.NSApplication.sharedApplication;
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  var frame = $.NSScreen.mainScreen.frame;
  var win = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(frame, $.NSWindowStyleMaskBorderless, $.NSBackingStoreBuffered, false);
  win.setLevel($.NSScreenSaverWindowLevel);
  win.setOpaque(false);
  win.setBackgroundColor($.NSColor.clearColor);
  win.setIgnoresMouseEvents(true);
  win.setCollectionBehavior($.NSWindowCollectionBehaviorCanJoinAllSpaces | $.NSWindowCollectionBehaviorFullScreenAuxiliary);
  var conf = $.WKWebViewConfiguration.alloc.init;
  var web = $.WKWebView.alloc.initWithFrameConfiguration($.NSMakeRect(0, 0, frame.size.width, frame.size.height), conf);
  web.setValueForKey(false, 'drawsBackground');
  web.loadFileURLAllowingReadAccessToURL(page, root);
  win.setContentView(web);
  win.orderFrontRegardless;
  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(seconds));
  win.orderOut($.nil);
}
`

export type ScreenTheme = { band: string; band2: string; top: string; bottom: string; badge: string }

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 見出しの改行位置（言葉の途中で折れないよう、決まったセリフは区切りを指定する）
const BREAKS: Record<string, string[]> = {
  'はよ寝なさい！！': ['はよ', '寝なさい！！'],
  'さっきも言うてたやん！': ['さっきも', '言うてたやん！'],
  'どこ見てんの！！': ['どこ', '見てんの！！'],
  '寝るなら布団！！': ['寝るなら', '布団！！'],
  'ご飯できたで！！': ['ご飯', 'できたで！！'],
  'お風呂入りなさい！！': ['お風呂', '入りなさい！！'],
  'おやつやで！！': ['おやつ', 'やで！！'],
  '起きなさい！！': ['起きなさい', '！！'],
  '仕様変更の鬼': ['仕様変更', 'の鬼'],
}

// 見出しを行に分ける。7文字以内は1行、決まったセリフは BREAKS、それ以外は真ん中あたりで分ける
const titleLines = (title: string): string[] => {
  if (BREAKS[title]) return BREAKS[title]
  const yappari = title.match(/^(やっぱり)(\d+回目)$/)
  if (yappari) return [yappari[1], yappari[2]]
  const chars = [...title]
  if (chars.length <= 7) return [title]
  const mid = Math.ceil(chars.length / 2)
  return [chars.slice(0, mid).join(''), chars.slice(mid).join('')]
}

// 下のセリフは「！」「？」の後ろで改行する
const subLines = (sub: string): string[] => sub.split(/(?<=[！？])(?=[^！？])/).filter(Boolean)

// 画面いっぱいのカットイン（写真＋集中線＋極太文字）
// image は screen フォルダから見た写真の場所。無ければ写真なしで、おかんの絵文字を出す
export const screenPage = (t: ScreenTheme, title: string, sub: string, image: string | null) => {
  const rays = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2 + (i % 3) * 0.01
    const b = a + 0.012 + (i % 4) * 0.006
    // 真ん中（顔のあたり）は空けて、外側だけに線を引く
    const r0 = 520
    const r = 3000
    return `<polygon points="${Math.cos(a) * r0},${Math.sin(a) * r0} ${Math.cos(a) * r},${Math.sin(a) * r} ${Math.cos(b) * r},${Math.sin(b) * r} ${Math.cos(b) * r0},${Math.sin(b) * r0}"/>`
  }).join('')
  // 文字は左の38%の中だけ。いちばん長い行が収まる大きさにする（行の途中では折り返さない）
  const lines = titleLines(title)
  const longest = Math.max(...lines.map(l => [...l].length))
  const size = `min(${(36.5 / Math.max(longest, 4)).toFixed(2)}vw, ${lines.length > 1 ? 18 : 22}vh)`
  const subs = subLines(sub)
  const subLongest = Math.max(1, ...subs.map(l => [...l].length))
  const subSize = `min(5.4vh, ${(30 / Math.max(subLongest, 8)).toFixed(2)}vw)`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;overflow:hidden;background:transparent;font-family:"Hiragino Sans",sans-serif}
#all{position:fixed;inset:0;animation:life 4.5s ease-in-out forwards}
@keyframes life{0%{opacity:0}3%{opacity:1}90%{opacity:1}100%{opacity:0}}
#shake{position:absolute;inset:0;animation:shake .09s linear 12 .15s}
@keyframes shake{0%,100%{transform:translate(0,0)}25%{transform:translate(-22px,14px) rotate(-.4deg)}50%{transform:translate(18px,-12px)}75%{transform:translate(-14px,-18px) rotate(.4deg)}}
#photo{position:absolute;top:-4%;bottom:-4%;left:36%;right:-4%;background:#111 ${image ? `url("${image}")` : ''} 72% 30%/cover no-repeat;transform-origin:65% 40%;
  animation:punch 4.5s cubic-bezier(.1,.9,.2,1) forwards, impact .32s steps(1) 1}
@keyframes punch{0%{transform:scale(1.6)}8%{transform:scale(1.02)}100%{transform:scale(1.14)}}
@keyframes impact{0%{filter:invert(1) contrast(3) saturate(0)}35%{filter:contrast(2.2) saturate(2)}70%{filter:invert(1) contrast(3) saturate(0)}100%{filter:contrast(1.15) saturate(1.3)}}
#okan{position:absolute;right:6vw;bottom:4vh;font-size:60vh;line-height:1;${image ? 'display:none' : ''}}
#tint{position:absolute;top:0;bottom:0;left:0;width:44vw;background:linear-gradient(160deg,#000 0%,${t.band2} 140%);clip-path:polygon(0 0,100% 0,88% 100%,0 100%);
  box-shadow:0 0 0 1px #000;animation:panel .3s cubic-bezier(.2,1.3,.4,1) both}
#edge{position:absolute;top:0;bottom:0;left:0;width:44vw;background:${t.band};clip-path:polygon(97% 0,100% 0,88% 100%,85% 100%);animation:panel .3s cubic-bezier(.2,1.3,.4,1) both}
@keyframes panel{from{transform:translateX(-100%)}}
#rays{position:absolute;left:70%;top:45%;width:0;height:0;overflow:visible;animation:spin 8s linear infinite}
#rays svg{overflow:visible}
@keyframes spin{to{transform:rotate(360deg)}}
#flash{position:absolute;inset:0;background:#fff;animation:flash .7s steps(1) forwards}
@keyframes flash{0%{opacity:1}12%{opacity:0}20%{opacity:.8}30%{opacity:0}100%{opacity:0}}
#pulse{position:absolute;inset:0;background:${t.band};mix-blend-mode:overlay;animation:pulse .28s ease-in-out infinite .7s;opacity:0}
@keyframes pulse{50%{opacity:.55}}
.band{position:absolute;left:-10%;width:50%;opacity:.92;transform:skewY(-6deg)}
#b1{top:17%;height:1.6vh;background:${t.band};animation:slideL .35s cubic-bezier(.2,1.4,.4,1) both}
#b2{top:73%;height:1.6vh;background:${t.band};animation:slideR .35s cubic-bezier(.2,1.4,.4,1) .08s both}
@keyframes slideL{from{transform:skewY(-6deg) translateX(-130%)}}
@keyframes slideR{from{transform:skewY(-6deg) translateX(130%)}}
.tape{position:absolute;left:0;right:0;height:5vh;background:repeating-linear-gradient(-55deg,#111 0 3vh,#ffd500 3vh 6vh);background-size:200% 100%;animation:tape .5s linear infinite}
#t1{top:0}#t2{bottom:0;animation-direction:reverse}
@keyframes tape{to{background-position:-12vh 0}}
#badge{position:absolute;left:3vw;top:8vh;padding:1vh 2vw;background:#000;border:.5vh solid #ffd500;color:#ffd500;font-weight:900;font-size:5vh;animation:blink .3s steps(1) infinite}
@keyframes blink{50%{opacity:.15}}
#title{position:absolute;left:3vw;top:21vh;width:37vw;white-space:nowrap;font-family:"Hiragino Sans",sans-serif;font-weight:900;font-size:${size};line-height:1.12;
  color:#fff200;paint-order:stroke fill;-webkit-text-stroke:1.6vh #000;
  filter:drop-shadow(.8vh .8vh 0 #000) drop-shadow(0 0 2.5vh rgba(0,0,0,.9));
  transform-origin:left center;animation:slam .42s cubic-bezier(.2,1.6,.4,1) .12s both, wobble .16s linear infinite .6s}
@keyframes slam{from{transform:scale(4) rotate(-8deg);opacity:0}}
@keyframes wobble{0%,100%{transform:translate(0,0)}33%{transform:translate(-.5vh,.4vh)}66%{transform:translate(.4vh,-.5vh)}}
#sub{position:absolute;left:2vw;bottom:9vh;padding:1.4vh 2vw;background:#fff;color:#000;font-weight:900;font-size:${subSize};line-height:1.35;white-space:nowrap;transform:skewX(-10deg);
  border-left:1.2vh solid ${t.band};animation:subin .25s ease-out .5s both}
@keyframes subin{from{transform:skewX(-10deg) translateX(-120%)}}
</style></head><body><div id="all"><div id="shake">
<div id="photo"></div><div id="okan">👵</div>
<div id="rays"><svg width="1" height="1"><g fill="rgba(255,255,255,.45)">${rays}</g></svg></div>
<div id="tint"></div><div id="edge"></div>
<div id="pulse"></div>
<div class="band" id="b1"></div><div class="band" id="b2"></div>
<div id="title">${lines.map(escape).join('<br>')}</div>
<div id="sub">${subs.map(escape).join('<br>')}</div>
<div id="badge">⚠ ${escape(t.badge)} ⚠</div>
<div class="tape" id="t1"></div><div class="tape" id="t2"></div>
<div id="flash"></div>
</div></div></body></html>`
}
