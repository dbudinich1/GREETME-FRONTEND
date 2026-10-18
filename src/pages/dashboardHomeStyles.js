// src/pages/dashboardHomeStyles.js
// Styles for the personal dashboard (Base44 direction, founder-approved rendering, Report 103). Scoped under .gx.
// Several rules deliberately override the global index.css button defaults (nowrap, centred content, the 44px
// mobile minimum and the 0.5 disabled opacity), which otherwise clip and stretch these custom controls.
export const DASHBOARD_HOME_CSS = `
.gx { --ivory:#FBF9F6; --ivory2:#F4F0E9; --p900:#2C1D46; --p800:#3E2A63; --p700:#4A3273; --p600:#5A3E8A; --p500:#7C63AE;
  --p200:#DBC9F0; --p100:#EDE4F8; --p50:#F7F3FC; --g600:#B8942A; --g500:#D4AF37; --g400:#E0BE55; --g300:#EBD07A; --g100:#FBF0D2; --g50:#FDF9EC;
  --ink:#2C1D46; --body:#4A3F5C; --muted:#6B6079; --line:#E9E1F2; --goldInk:#7A5B0C; --ok:#2C6A4B; --okT:#EAF4EE; --amber:#8A4B0F; --amberT:#FDF1E4;
  --serif:"Playfair Display", Georgia, serif; --script:"Great Vibes", "Segoe Script", cursive; --sans:'Inter', -apple-system, "Segoe UI", Roboto, sans-serif;
  font-family:var(--sans); color:var(--body); background:var(--ivory); border-radius:28px; padding:24px; display:grid; grid-template-columns:minmax(0,1fr); gap:18px; }
.gx * { box-sizing:border-box; }
.gx h1, .gx h2, .gx h3 { font-family:var(--serif); color:var(--ink); font-weight:600; margin:0; letter-spacing:-.005em; }
.gx p { margin:0; line-height:1.55; color:inherit; }
.gx .card { background:#fff; border:1px solid var(--line); border-radius:26px; box-shadow:0 28px 64px -56px rgba(44,29,70,.55); }
.gx .eyebrow { font:700 12px/1.2 var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--goldInk); }
.gx .btn { font:600 15px/1 var(--sans); display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:999px; cursor:pointer; padding:0 18px; height:44px; border:1px solid transparent; white-space:nowrap; transition:background .2s, box-shadow .2s, transform .2s, color .2s; }
.gx .btn:focus-visible, .gx .pick:focus-visible, .gx .chip-btn:focus-visible, .gx .mode:focus-visible { outline:3px solid #c9b8f2; outline-offset:2px; }
.gx .btn-primary { background:var(--p800); color:#fff; box-shadow:0 16px 35px -18px rgba(44,29,70,.9); height:52px; padding:0 28px; font-size:16px; }
.gx .btn-primary:hover { background:var(--p900); }
.gx .btn-primary[disabled] { background:#E9E1F2; color:#5A3E8A; box-shadow:none; cursor:not-allowed; opacity:1; }
.gx .mode, .gx .chip-btn, .gx .pick, .gx .link { white-space:normal; min-height:0; }
.gx .mode { justify-content:flex-start; width:100%; }
.gx .mode > span:last-child { flex:1; min-width:0; }
.gx .dot { min-height:0 !important; flex:none; }
.gx .arrow { min-height:0 !important; flex:none; }
.gx .pair { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:0 32px; border-top:1px solid var(--line); }
.gx .pair .step { border-top:none; }
.gx .btn-gold { background:var(--g400); color:var(--p900); }
.gx .btn-gold:hover { background:var(--g300); }
.gx .btn-line { background:#fff; color:var(--p800); border-color:var(--p200); }
.gx .btn-line:hover { background:var(--p50); }
.gx .btn-ghost-w { background:rgba(255,255,255,.12); color:#fff; border-color:rgba(255,255,255,.35); }
.gx .btn-ghost-w:hover { background:rgba(255,255,255,.22); }
.gx .btn-sm { height:38px; font-size:14px; padding:0 14px; }
.gx .link { background:none; border:none; padding:0; cursor:pointer; font:600 14px var(--sans); color:var(--p700); text-decoration:underline; text-decoration-color:var(--g300); text-underline-offset:4px; }
.gx .link:hover { color:var(--p900); }
.gx .hero { position:relative; overflow:hidden; border-radius:30px; padding:30px 34px; color:#fff; background-image:linear-gradient(135deg,#3E2A63 0%,#4A3273 45%,#2C1D46 100%); }
.gx .hero .glow1 { position:absolute; right:-90px; top:-110px; width:280px; height:280px; border-radius:50%; background:rgba(224,190,85,.18); filter:blur(48px); pointer-events:none; }
.gx .hero .glow2 { position:absolute; left:40px; bottom:-130px; width:250px; height:250px; border-radius:50%; background:rgba(154,124,203,.25); filter:blur(48px); pointer-events:none; }
.gx .hero-top { position:relative; display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; align-items:flex-start; }
.gx .script { font-family:var(--script); font-size:30px; line-height:1; color:var(--g300); }
.gx .hero h1 { color:#fff; font-size:38px; line-height:1.18; margin-top:12px; max-width:44rem; }
.gx .hero .lede { margin-top:10px; font-size:16px; color:rgba(247,243,252,.9); max-width:40rem; }
.gx .people-label { margin-top:20px; font:700 12px var(--sans); letter-spacing:.16em; text-transform:uppercase; color:rgba(237,228,248,.82); }
.gx .people { margin-top:10px; display:flex; flex-wrap:wrap; gap:10px; }
.gx .pick { display:flex; align-items:center; gap:10px; border-radius:999px; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.07); padding:6px 16px 6px 6px; cursor:pointer; color:#fff; text-align:left; transition:background .2s, border-color .2s; font-family:var(--sans); }
.gx .pick:hover { background:rgba(255,255,255,.14); border-color:rgba(235,208,122,.6); }
.gx .pick[aria-pressed="true"] { background:rgba(255,255,255,.2); border-color:var(--g300); }
.gx .pick .av { width:34px; height:34px; border-radius:50%; background:var(--g400); color:var(--p900); display:grid; place-items:center; font:700 13px var(--sans); flex:none; }
.gx .pick b { display:block; font:600 14px/1.2 var(--sans); }
.gx .pick small { display:block; font:400 12.5px/1.2 var(--sans); color:rgba(237,228,248,.85); }
.gx .hero-foot { position:relative; margin-top:20px; display:flex; align-items:center; gap:10px 22px; flex-wrap:wrap; }
.gx .status-pill { display:inline-flex; align-items:center; gap:8px; border-radius:999px; padding:7px 14px; font:600 13.5px var(--sans); }
.gx .status-ok { background:rgba(255,255,255,.12); color:#fff; }
.gx .status-todo { background:var(--g100); color:#5c430a; }
.gx .hero .link { color:#fff; text-decoration-color:var(--g300); }
.gx .flow { padding:26px 30px 0; }
.gx .flow-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; flex-wrap:wrap; }
.gx .flow-head h2 { font-size:28px; margin-top:6px; }
.gx .flow-head p { font-size:14px; color:var(--muted); max-width:22rem; }
.gx .step { border-top:1px solid var(--line); padding:18px 0; }
.gx .step:first-of-type { border-top:none; }
.gx .step-label { display:flex; align-items:center; gap:10px; font:700 12px var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--p600); }
.gx .num { width:24px; height:24px; border-radius:50%; display:grid; place-items:center; font:700 12px var(--sans); letter-spacing:0; background:var(--p50); color:var(--p700); border:1px solid var(--p200); flex:none; }
.gx .num.done { background:var(--ok); color:#fff; border-color:var(--ok); }
.gx .summary { display:flex; align-items:center; gap:10px; justify-content:space-between; flex-wrap:wrap; margin-top:10px; padding:10px 14px; border-radius:16px; background:var(--ivory); border:1px solid var(--line); font:500 15px var(--sans); color:var(--ink); animation:gxIn .25s ease-out; }
.gx .modes { margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.gx .mode { position:relative; overflow:hidden; text-align:left; border-radius:22px; border:1px solid var(--p200); background:var(--p50); padding:16px 18px; cursor:pointer; display:flex; gap:14px; align-items:flex-start; font-family:var(--sans); transition:background .25s, border-color .25s, box-shadow .25s; }
.gx .mode:hover { border-color:var(--p500); }
.gx .mode[aria-pressed="true"] { background:var(--p800); border-color:var(--p700); box-shadow:0 20px 45px -24px rgba(44,29,70,.75); }
.gx .mode[aria-pressed="true"]::after { content:""; position:absolute; left:0; right:0; bottom:0; height:3px; background:var(--g400); }
.gx .mode .ico { width:42px; height:42px; border-radius:14px; display:grid; place-items:center; background:#fff; color:var(--p700); flex:none; }
.gx .mode[aria-pressed="true"] .ico { background:var(--g400); color:var(--p900); }
.gx .mode .k { font:700 11.5px var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--p600); }
.gx .mode[aria-pressed="true"] .k { color:var(--g300); }
.gx .mode .t { display:block; font:600 21px/1.2 var(--serif); color:var(--ink); margin-top:4px; }
.gx .mode[aria-pressed="true"] .t { color:#fff; }
.gx .mode .b { display:block; font:400 14px/1.45 var(--sans); color:var(--muted); margin-top:4px; }
.gx .mode[aria-pressed="true"] .b { color:rgba(237,228,248,.9); }
.gx .chips { margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; }
.gx .chip-btn { display:inline-flex; align-items:center; gap:8px; border-radius:999px; border:1px solid var(--line); background:var(--ivory); padding:8px 14px; font:500 14.5px var(--sans); color:var(--ink); cursor:pointer; transition:border-color .2s, background .2s; }
.gx .chip-btn:hover { border-color:var(--p500); }
.gx .chip-btn[aria-pressed="true"] { border-color:var(--p600); background:var(--p50); color:var(--p800); font-weight:600; }
.gx .chip-btn .av { width:26px; height:26px; border-radius:50%; color:#fff; display:grid; place-items:center; font:700 11px var(--sans); }
.gx .media { margin-top:12px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.gx .mrow { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px; border:1px solid var(--line); background:var(--ivory); }
.gx .mrow .ico { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; flex:none; background:var(--p50); color:var(--p700); overflow:hidden; }
.gx .mrow b { display:block; font:600 15px var(--sans); color:var(--ink); }
.gx .tag { display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:4px 10px; font:600 12.5px var(--sans); white-space:nowrap; }
.gx .tag-in { display:none; }
.gx .tag.ok { background:var(--okT); color:var(--ok); }
.gx .tag.amber { background:var(--amberT); color:var(--amber); }
.gx .tag.muted { background:var(--ivory2); color:var(--muted); }
.gx .tag.plum { background:var(--p50); color:var(--p700); border:1px solid var(--p100); }
.gx .warn { margin-top:10px; display:flex; gap:10px; align-items:flex-start; padding:12px 14px; border-radius:16px; background:var(--g50); border:1px solid #F1E2B3; color:#5c430a; font-size:14px; line-height:1.5; }
.gx .giftband { margin:4px -30px 0; padding:24px 30px 30px; background-image:linear-gradient(135deg,#E0BE55 0%,#EBD07A 50%,#D4AF37 100%); }
.gx .giftband .step-label { color:#4a3606; }
.gx .giftband .num { background:rgba(255,255,255,.7); color:var(--p900); border-color:rgba(44,29,70,.15); }
.gx .giftband .num.done { background:var(--p800); color:#fff; border-color:var(--p800); }
.gx .carousel { margin-top:14px; display:grid; grid-template-columns:150px 1fr auto; gap:22px; align-items:center; background:#fff; border:none; border-radius:22px; padding:16px 22px 16px 16px; box-shadow:0 20px 44px -26px rgba(44,29,70,.5); }
.gx .art { position:relative; height:110px; border-radius:16px; background:none; overflow:hidden; }
.gx .art img, .gx .art .qr { position:absolute; inset:6px; width:calc(100% - 12px); height:calc(100% - 12px); object-fit:contain; transition:opacity .6s ease-in-out; }
.gx .art .qr { display:grid; place-items:center; align-content:center; gap:4px; color:var(--p800); font:700 13px var(--sans); }
.gx .slide-t { font:600 20px/1.2 var(--serif); color:var(--p900); }
.gx .slide-l { font-size:14.5px; color:#3d3249; margin-top:4px; }
.gx .dots { display:flex; align-items:center; gap:6px; margin-top:10px; }
.gx .dot { height:6px; width:6px; border-radius:999px; background:rgba(44,29,70,.3); border:none; padding:0; cursor:pointer; transition:width .3s, background .3s; }
.gx .dot[aria-current="true"] { width:18px; background:var(--p900); }
.gx .arrow { width:34px; height:34px; border-radius:50%; border:1px solid rgba(44,29,70,.2); background:rgba(255,255,255,.7); display:grid; place-items:center; cursor:pointer; color:var(--p900); padding:0; }
.gx .cta-col { display:grid; gap:8px; justify-items:end; }
.gx .footbar { margin:0 -30px; padding:16px 30px; display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; background:var(--p50); border-top:1px solid var(--line); border-radius:0 0 26px 26px; }
.gx .footbar .sum { font:600 15.5px var(--sans); color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.gx .footbar > div:first-child { flex:1 1 280px; }
.gx .footbar .fine { font-size:13.5px; color:var(--muted); margin-top:3px; min-height:3em; }
.gx .guide { margin-top:12px; background:var(--p50); border:1px solid var(--p100); border-radius:18px; padding:14px 16px; }
.gx .guide ol { margin:8px 0 0; padding-left:20px; font-size:14.5px; line-height:1.6; color:var(--body); }
.gx .duo { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.gx .tile { padding:22px 24px; display:grid; grid-template-columns:auto 1fr; gap:16px; align-items:start; }
.gx .medal { width:52px; height:52px; border-radius:50%; display:grid; place-items:center; flex:none; }
.gx .tile h3 { font-size:22px; margin-top:4px; }
.gx .tile p { font-size:15px; margin-top:4px; }
.gx .tile .acts { display:flex; gap:12px; margin-top:14px; flex-wrap:wrap; align-items:center; }
.gx .two { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:18px; align-items:start; }
.gx .sec { padding:22px 24px; }
.gx .sec-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.gx .sec-head h3 { font-size:23px; }
.gx .sub { font-size:14px; color:var(--muted); margin-top:3px; }
.gx .search { display:flex; align-items:center; gap:8px; border:1px solid var(--line); border-radius:999px; padding:0 14px; height:42px; background:var(--ivory); margin:14px 0 4px; }
.gx .search input { border:none; outline:none; font:15px var(--sans); flex:1; background:transparent; color:var(--ink); min-width:0; }
.gx .scroll { max-height:330px; overflow:auto; padding-right:4px; }
.gx .row { display:flex; align-items:center; gap:12px; padding:11px 0; border-top:1px solid var(--line); }
.gx .row:first-child { border-top:none; }
.gx .avatar { width:40px; height:40px; border-radius:50%; display:grid; place-items:center; color:#fff; font:700 14px var(--sans); flex:none; }
.gx .name { font:600 15.5px/1.25 var(--sans); color:var(--ink); }
.gx .meta { font-size:13.5px; color:var(--muted); margin-top:2px; }
.gx .datebox { width:48px; flex:none; text-align:center; border:1px solid var(--line); border-radius:14px; padding:6px 0; background:var(--g50); }
.gx .datebox b { display:block; font:700 18px/1 var(--serif); color:var(--ink); }
.gx .datebox span { font:700 10.5px/1 var(--sans); letter-spacing:.1em; color:var(--goldInk); }
.gx .iconbtn { min-height:0 !important; width:38px; height:38px; border-radius:50%; border:1px solid var(--line); background:#fff; display:grid; place-items:center; cursor:pointer; color:var(--p700); padding:0; flex:none; }
.gx .iconbtn:hover { background:var(--p50); }
.gx .empty { text-align:center; padding:24px 12px; border:1px dashed #DCCFEA; border-radius:20px; background:var(--ivory); margin-top:14px; }
.gx .empty .ico { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; margin:0 auto 10px; background:#fff; border:1px solid var(--line); color:var(--goldInk); }
.gx .empty .t { font:600 18px var(--serif); color:var(--ink); }
.gx .empty p { font-size:14.5px; color:var(--muted); margin:6px auto 14px; max-width:30rem; }
.gx .install { padding:14px 22px; display:flex; align-items:center; gap:16px; }
.gx .modes.top { margin-top:16px; }
.gx .occ { border-color:#DBC9F0; background:#fff; color:rgba(44,29,70,.78); }
.gx .occ[aria-pressed="true"] { border-color:var(--p700); background:var(--p700); color:#fff; font-weight:500; }
.gx .occ .cnt { font:700 11px var(--sans); background:var(--g300); color:var(--p900); border-radius:999px; padding:1px 7px; }
.gx .relpop { position:relative; display:inline-block; }
.gx .menu { position:absolute; z-index:40; top:calc(100% + 6px); left:0; min-width:220px; background:#fff; border:1px solid var(--line); border-radius:16px; box-shadow:0 24px 50px -24px rgba(44,29,70,.45); padding:6px; }
.gx .menu button { display:flex; width:100%; align-items:center; gap:10px; border:none; background:none; border-radius:10px; padding:9px 10px; font:500 14.5px var(--sans); color:var(--ink); cursor:pointer; text-align:left; white-space:normal; min-height:0; justify-content:flex-start; }
.gx .menu button:hover { background:var(--p50); }
.gx .box { width:18px; height:18px; border-radius:6px; border:1.5px solid #BEA6E0; display:grid; place-items:center; flex:none; color:transparent; background:#fff; }
.gx .box.on { background:var(--p800); border-color:var(--p800); color:#fff; }
.gx .whobox { margin-top:12px; height:330px; display:flex; flex-direction:column; border:1px solid var(--p100); background:rgba(247,243,252,.55); border-radius:20px; padding:14px; }
.gx .mini { font:700 11.5px var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--p600); }
.gx .track { margin-top:8px; display:flex; flex-wrap:wrap; gap:4px; background:#fff; border-radius:14px; padding:4px; box-shadow:0 1px 2px rgba(44,29,70,.06); }
.gx .track button { border:none; background:none; border-radius:11px; padding:8px 14px; font:500 14px var(--sans); color:rgba(44,29,70,.7); cursor:pointer; min-height:0; white-space:nowrap; }
.gx .track button:hover { background:var(--p50); color:var(--p900); }
.gx .track button[aria-pressed="true"] { background:var(--p800); color:#fff; box-shadow:0 10px 22px -16px rgba(44,29,70,.95); }
.gx .track .n { margin-left:6px; color:var(--g300); }
.gx .cap { margin-top:10px; padding-top:10px; border-top:1px solid var(--p100); font-size:13.5px; color:var(--muted); min-height:42px; }
.gx .whobody { position:relative; flex:1; min-height:0; margin-top:8px; display:flex; flex-direction:column; }
.gx .whoscroll { flex:1; min-height:0; overflow:auto; padding-right:4px; }
.gx .addsome { width:100%; display:flex; align-items:center; gap:12px; border:1px solid var(--p200); background:#fff; border-radius:16px; padding:10px 14px; cursor:pointer; text-align:left; font-family:var(--sans); white-space:normal; min-height:0; justify-content:flex-start; flex:none; }
.gx .addsome:hover { border-color:var(--p500); }
.gx .addsome .pl { width:34px; height:34px; border-radius:50%; background:var(--p50); color:var(--p700); display:grid; place-items:center; flex:none; }
.gx .picker { position:absolute; z-index:40; left:0; right:0; top:58px; background:#fff; border:1px solid var(--line); border-radius:18px; box-shadow:0 24px 50px -24px rgba(44,29,70,.5); padding:8px; }
.gx .picker .find { display:flex; align-items:center; gap:8px; background:rgba(247,243,252,.8); border-radius:12px; padding:8px 12px; }
.gx .picker .find input { border:none; outline:none; background:transparent; font:14.5px var(--sans); width:100%; color:var(--ink); }
.gx .picker .list { margin-top:6px; max-height:170px; overflow:auto; }
.gx .prow { display:flex; width:100%; align-items:center; gap:10px; border:none; background:none; border-radius:12px; padding:7px 9px; cursor:pointer; text-align:left; font-family:var(--sans); min-height:0; justify-content:flex-start; white-space:normal; }
.gx .prow:hover, .gx .prow[aria-pressed="true"] { background:var(--p50); }
.gx .pchip { display:inline-flex; align-items:center; gap:7px; border:1px solid var(--p200); background:#fff; border-radius:999px; padding:4px 10px 4px 4px; font:500 13.5px var(--sans); color:var(--ink); }
.gx .pchip button { border:none; background:none; padding:0; min-height:0; color:var(--p500); cursor:pointer; display:grid; place-items:center; }
.gx .grow { display:flex; width:100%; align-items:center; gap:10px; border:none; border-radius:12px; padding:7px 9px; cursor:pointer; text-align:left; background:transparent; font-family:var(--sans); min-height:0; justify-content:flex-start; white-space:normal; }
.gx .grow[aria-pressed="true"] { background:#fff; box-shadow:0 1px 2px rgba(44,29,70,.06); }
.gx .ptiles { margin-top:12px; display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:14px; }
.gx .ptile { border:1px solid var(--p100); background:rgba(247,243,252,.45); border-radius:18px; padding:16px; display:flex; gap:12px; align-items:flex-start; }
.gx .ptile .ic { width:44px; height:44px; border-radius:50%; display:grid; place-items:center; flex:none; overflow:hidden; }
.gx .ptile .ic.hero { background-image:linear-gradient(135deg,#3E2A63 0%,#4A3273 45%,#2C1D46 100%); color:#fff; }
.gx .ptile .ic.okc { background:var(--g100); color:#8a6a12; }
.gx .ptile .ic.cam { border-radius:14px; border:1px solid var(--p200); background:#fff; color:var(--p600); }
.gx .ptile b { font:600 15px var(--sans); color:var(--ink); }
.gx .ptile .sub2 { font-size:13.5px; color:var(--muted); margin-top:3px; line-height:1.45; }
.gx .ptile .acts2 { display:flex; flex-wrap:wrap; gap:8px 14px; align-items:center; margin-top:10px; }
.gx .btn-xs { height:34px; font-size:13.5px; padding:0 14px; }
.gx .words { margin-top:14px; }
.gx .words textarea { margin-top:6px; width:100%; resize:none; border:1px solid var(--p200); border-radius:16px; padding:12px 14px; font:15px/1.5 var(--sans); color:var(--ink); background:#fff; outline:none; height:84px; }
.gx .words textarea:focus { border-color:var(--p500); }
.gx .moments { margin-top:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; border:2px dashed var(--p200); background:rgba(247,243,252,.4); border-radius:18px; padding:18px; cursor:pointer; }
.gx .moments, .gx .moments span { white-space:normal; }
.gx .quick { display:inline-flex; align-items:center; gap:7px; border:none; cursor:pointer; border-radius:999px; background:var(--g400); color:var(--p900); font:700 14px var(--sans); padding:9px 16px; box-shadow:0 18px 40px -22px rgba(0,0,0,.75); white-space:nowrap; min-height:0; vertical-align:middle; transform:translateY(-4px); margin-left:8px; }
.gx .quick:hover { background:var(--g300); }
.gx .moments:hover { border-color:var(--p500); }
.gx .fieldlabel { font:600 13.5px var(--sans); color:var(--p700); }
.gx .carousel > div:nth-child(2) { min-height:96px; display:flex; flex-direction:column; justify-content:center; }
.gx .scriptrow { display:flex; align-items:center; gap:12px; }
.gx .heroicon { position:relative; width:32px; height:32px; border-radius:50%; border:1px solid rgba(235,208,122,.55); background:rgba(255,255,255,.08); color:var(--g300); display:grid; place-items:center; cursor:pointer; padding:0; min-height:0; transition:background .2s, border-color .2s; }
.gx .heroicon:hover, .gx .heroicon:focus-visible { background:rgba(255,255,255,.18); border-color:var(--g300); outline:none; }
.gx .heroicon .tip { position:absolute; left:calc(100% + 8px); top:50%; transform:translateY(-50%); white-space:nowrap; background:#fff; color:var(--p900); font:600 12.5px var(--sans); padding:5px 10px; border-radius:8px; box-shadow:0 10px 24px -12px rgba(0,0,0,.5); opacity:0; pointer-events:none; transition:opacity .15s; z-index:5; }
.gx .heroicon:hover .tip, .gx .heroicon:focus-visible .tip { opacity:1; }
.gx .donerow { display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:12px; }
.gx .donerow .btn { min-width:128px; }
.gx .donerow .hint { font-size:13px; color:var(--muted); }
.gx .tabcard { padding:18px 22px 20px; }
.gx .tabhead { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; min-height:46px; }
.gx .tabs { display:flex; gap:4px; background:var(--p50); border:1px solid var(--p100); border-radius:14px; padding:4px; }
.gx .tabs button { border:none; background:none; border-radius:11px; padding:9px 16px; font:600 14.5px var(--sans); color:rgba(44,29,70,.66); cursor:pointer; min-height:0; white-space:nowrap; }
.gx .tabs button:hover { color:var(--p900); }
.gx .tabs button[aria-selected="true"] { background:#fff; color:var(--p900); box-shadow:0 1px 3px rgba(44,29,70,.12); }
.gx .tabact { height:40px; display:flex; align-items:center; }
.gx .tabbody { margin-top:14px; height:420px; overflow:auto; padding-right:4px; }
.gx .nudge { margin:0 0 4px; font:italic 600 16px var(--serif); color:var(--p700); }
.gx .uprow .sched { height:34px; font-size:13.5px; padding:0 12px; flex:none; }
.gx .locked { opacity:.45; cursor:not-allowed; }
.gx .rule { margin:10px 0 0; font-size:13.5px; color:var(--muted); min-height:1.6em; }
.gx .rule.warn2 { color:#8a4b0f; font-weight:600; }
.gx .resolver { margin-top:12px; height:250px; display:flex; flex-direction:column; border:1px solid var(--p100); background:#fff; border-radius:18px; padding:12px 14px; }
.gx .rhead { display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.gx .rnote { margin:8px 0 0; font-size:13.5px; color:#5c430a; background:var(--g50); border:1px solid #F1E2B3; border-radius:12px; padding:8px 10px; }
.gx .rrows { flex:1; min-height:0; overflow:auto; margin-top:8px; display:grid; gap:8px; align-content:start; }
.gx .rrow { display:grid; grid-template-columns:auto minmax(110px,1fr) 150px 200px; gap:6px 10px; align-items:center; border:1px solid var(--line); border-radius:14px; padding:8px 10px; background:var(--ivory); }
.gx .rname { font:600 14.5px var(--sans); color:var(--ink); display:flex; align-items:center; gap:6px; }
.gx .rpre { font:600 11px var(--sans); color:var(--p600); background:var(--p50); border-radius:999px; padding:1px 7px; }
.gx .rdate, .gx .rgift { height:36px; border:1px solid var(--p200); border-radius:10px; padding:0 8px; font:14px var(--sans); color:var(--ink); background:#fff; min-width:0; width:100%; }
.gx .rline { grid-column:2 / -1; font-size:12.5px; color:var(--muted); min-height:1.2em; }
.gx .rempty { margin:10px 0 0; font-size:14px; color:var(--muted); }
.gx .moments { height:119px; overflow:hidden; }
.gx .madd { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; background:none; border:none; padding:0; cursor:pointer; font-family:var(--sans); white-space:normal; min-height:0; }
.gx .madd span { white-space:normal; }
.gx .mthumbs { display:flex; gap:8px; overflow-x:auto; max-width:100%; height:52px; align-items:center; }
.gx .mthumb { position:relative; width:48px; height:48px; flex:none; border-radius:12px; overflow:hidden; border:1px solid var(--p200); }
.gx .qrbtn { background:none; border:none; padding:0; min-height:0 !important; cursor:pointer; flex:none; border-radius:8px; }
.gx .mthumb img { width:100%; height:100%; object-fit:cover; display:block; }
.gx .mthumb button { position:absolute; top:2px; right:2px; width:20px; height:20px; min-height:0; border-radius:50%; border:none; padding:0; background:rgba(44,29,70,.75); color:#fff; display:grid; place-items:center; cursor:pointer; }
.gx .saveerr { color:#9b1c1c; }
.gx .rmore { grid-column:2 / -1; justify-self:start; }
.gx .rgroupdefault { display:grid; grid-template-columns:auto minmax(0,220px); gap:6px 10px; align-items:center; margin-top:8px; }
.gx .grv-backdrop { position:fixed; inset:0; z-index:2500; background:rgba(44,29,70,.45); display:grid; place-items:center; padding:16px; }
.gx .grv { width:100%; max-width:720px; max-height:calc(100vh - 32px); overflow:auto; background:#fff; border-radius:24px; border:1px solid var(--line); box-shadow:0 30px 70px -30px rgba(44,29,70,.6); padding:22px 24px; display:grid; gap:14px; }
.gx .grv-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.gx .grv-head h2 { font-size:24px; margin-top:4px; }
.gx .grv-rules { display:grid; gap:6px; font-size:14px; color:var(--body); background:var(--p50); border:1px solid var(--p100); border-radius:16px; padding:12px 14px; }
.gx .grv-rules > div { display:flex; gap:8px; align-items:flex-start; }
.gx .grv-default { display:grid; grid-template-columns:auto minmax(0,220px); gap:6px 12px; align-items:center; }
.gx .grv-default .sub { grid-column:1 / -1; margin-top:0; }
.gx .grv select { height:38px; border:1px solid var(--p200); border-radius:10px; padding:0 8px; font:14px var(--sans); color:var(--ink); background:#fff; min-width:0; width:100%; }
.gx .grv-list { display:grid; gap:8px; max-height:320px; overflow:auto; padding-right:4px; }
.gx .grv-row { display:grid; grid-template-columns:auto minmax(0,1fr) minmax(0,190px) minmax(0,150px); gap:8px 12px; align-items:center; border:1px solid var(--line); border-radius:14px; padding:8px 12px; background:var(--ivory); }
.gx .grv-row.out { opacity:.55; }
.gx .grv-row .box { cursor:pointer; padding:0; min-height:0; }
.gx .grv-who { min-width:0; display:grid; }
.gx .grv-who b { font:600 14.5px var(--sans); color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gx .grv-who span { font-size:12.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.gx .grv-cost { font-size:13px; color:var(--body); text-align:right; }
.gx .grv-total { display:grid; gap:2px; font:600 15px var(--sans); color:var(--ink); border-top:1px solid var(--line); padding-top:10px; }
.gx .grv-actions { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
@keyframes gxIn { from { opacity:0; transform:translateY(-3px); } to { opacity:1; transform:none; } }
@media (prefers-reduced-motion: reduce) { .gx *, .gx *::after { transition:none !important; animation:none !important; } }
@media (max-width: 900px) {
  .gx .two, .gx .pair { grid-template-columns:minmax(0,1fr); }
  .gx .pair .step + .step { border-top:1px solid var(--line); }
}
@media (max-width: 640px) {
  .gx { padding:12px; border-radius:20px; gap:14px; }
  .gx .hero { padding:22px 18px; border-radius:24px; }
  .gx .script { font-size:25px; }
  .gx .hero h1 { font-size:26px; margin-top:10px; }
  .gx .hero .lede { font-size:15px; }
  .gx .hero-top .acts { width:100%; flex-wrap:nowrap !important; }
  .gx .hero-top .acts .btn { flex:1 1 0; min-width:0; padding:0 10px; font-size:13.5px; }
  .gx .whochips { flex-wrap:nowrap; overflow-x:auto; margin-right:-16px; padding:2px 16px 4px 0; scrollbar-width:none; }
  .gx .whochips .chip-btn { flex:none; white-space:nowrap; }
  .gx .chip-btn { padding:7px 12px; font-size:14px; }
  .gx .medal { width:42px; height:42px; }
  .gx .tile { gap:12px; }
  .gx .tile p { font-size:14.5px; }
  .gx .uprow .tag-side { display:none; }
  .gx .uprow .tag-in { display:inline-flex; margin-top:6px; }
  .gx .people { flex-wrap:nowrap; overflow-x:auto; margin-right:-18px; padding-right:18px; scrollbar-width:none; }
  .gx .pick { flex:none; }
  .gx .flow { padding:20px 16px 0; }
  .gx .flow-head h2 { font-size:24px; }
  .gx .duo { grid-template-columns:minmax(0,1fr); }
  .gx .media { grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:8px; }
  .gx .mrow { padding:10px; gap:8px; }
  .gx .mrow .ico { width:32px; height:32px; }
  .gx .modes { grid-template-columns:minmax(0,1fr) minmax(0,1fr) !important; gap:10px; }
  .gx .mode { padding:12px; flex-direction:column; gap:8px; border-radius:18px; }
  .gx .mode .ico { width:34px; height:34px; border-radius:11px; }
  .gx .mode .k { display:none; }
  .gx .mode .t { font-size:17px; margin-top:0; }
  .gx .mode .b { font-size:13px; }
  .gx .step { padding:14px 0; }
  .gx .tile .eyebrow { display:none; }
  .gx .tile .acts { margin-top:10px; }
  .gx .giftband { margin:4px -16px 0; padding:18px 16px 22px; }
  .gx .ptiles { grid-template-columns:minmax(0,1fr); gap:10px; }
  .gx .whobox { height:340px; padding:12px; }
  .gx .tabcard { padding:14px 12px 16px; }
  .gx .tabs { width:100%; }
  .gx .tabs button { flex:1 1 0; padding:8px 4px; font-size:12.5px; white-space:normal; line-height:1.2; }
  .gx .tabact { width:100%; justify-content:flex-end; }
  .gx .tabbody { height:440px; }
  .gx .moments { height:135px; }
  .gx .rgroupdefault, .gx .grv-default { grid-template-columns:minmax(0,1fr); }
  .gx .grv { padding:16px; border-radius:20px; }
  .gx .grv-row { grid-template-columns:auto minmax(0,1fr); }
  .gx .grv-row select, .gx .grv-row .grv-cost, .gx .grv-row .tag { grid-column:2 / -1; text-align:left; justify-self:start; }
  .gx .grv-actions .btn-primary { width:100%; }
  .gx .resolver { height:330px; padding:10px; }
  .gx .rrow { grid-template-columns:auto 1fr; }
  .gx .rdate, .gx .rgift, .gx .rline { grid-column:1 / -1; }
  .gx .rule { min-height:4.8em; }
  .gx .cap { min-height:62px; }
  .gx .uprow { flex-wrap:wrap; }
  .gx .uprow > div:nth-child(2) { flex:1 1 calc(100% - 110px) !important; }
  .gx .uprow .tag, .gx .uprow .sched { margin-left:60px; }
  .gx .track button { padding:7px 10px; font-size:13px; }
  .gx .carousel { grid-template-columns:96px 1fr; gap:14px; padding:10px; }
  .gx .carousel .cta-col { grid-column:1 / -1; justify-items:stretch; grid-template-columns:1fr 1fr; }
  .gx .carousel .cta-col .link { grid-column:1 / -1; justify-self:center; }
  .gx .quick { margin-left:0; display:flex; width:max-content; margin-top:12px; transform:none; }
  .gx .art { height:88px; }
  .gx .slide-t { font-size:17px; }
  .gx .carousel > div:nth-child(2) { min-height:160px; }
  .gx .footbar .fine { min-height:6em; }
  .gx .footbar { margin:0 -16px; padding:14px 16px; }
  .gx .footbar .btn-primary { width:100%; }
  .gx .tile, .gx .sec { padding:18px 16px; }
  .gx .tile h3 { font-size:20px; }
  .gx .scroll { max-height:252px; }
}
`;
