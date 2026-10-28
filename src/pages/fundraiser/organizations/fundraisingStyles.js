// src/pages/fundraiser/organizations/fundraisingStyles.js
// Styles for the Fundraisers page ("Greet-Me for Organizations", founder handoff 2026-10-28). This app has no Tailwind,
// so the reference's utility classes are translated here, value for value (plum / gold / ivory palette, the reference's
// type sizes, spacing and its sm 640 / md 768 / lg 1024 breakpoints), under one `.frp` scope so nothing reaches the rest
// of the dashboard. Class selectors are used throughout so they win over index.css's element rules (p, h1–h3, button,
// input). Fonts: Playfair Display and Great Vibes are already loaded by index.html; body text uses the app's own font.
export const FRP_CSS = `
.frp { --p50:#F7F3FC; --p100:#EDE4F8; --p200:#DBC9F0; --p300:#BEA6E0; --p500:#7C63AE; --p600:#5A3E8A; --p700:#4A3273; --p800:#3E2A63; --p900:#2C1D46;
  --g50:#FDF9EC; --g100:#FBF0D2; --g300:#EBD07A; --g400:#E0BE55; --g500:#D4AF37; --g600:#B8942A; --ivory:#FBF9F6; --ivory-deep:#F4F0E9;
  --serif:'Playfair Display', 'Iowan Old Style', Georgia, serif; --script:'Great Vibes', 'Segoe Script', cursive;
  background:var(--ivory); color:var(--p900); overflow:hidden; width:100%; -webkit-font-smoothing:antialiased;
  /* Inside the dashboard's content column (not edge to edge): one contained page with rounded corners. */
  border-radius:16px; box-shadow:0 1px 3px rgba(44,29,70,.06); }
.frp *, .frp *::before, .frp *::after { box-sizing:border-box; }
.frp p, .frp h1, .frp h2, .frp h3, .frp ul { margin:0; }
.frp ul { padding:0; list-style:none; }
.frp img { display:block; }
.frp button { font-family:inherit; min-height:0; }
/* Grid children may shrink below their content's width (default min-width:auto let the hero's buttons widen its column past
   the card at 320px); long button labels wrap instead. */
.frp [class*="frp-"] { min-width:0; }
.frp .frp-btn { white-space:normal; text-align:center; max-width:100%; }
.frp button:focus-visible, .frp-dialog button:focus-visible { outline:2px solid var(--g500); outline-offset:2px; }
.frp .frp-display { font-family:var(--serif); }
.frp .frp-script { font-family:var(--script); font-weight:400; }
.frp .frp-wrap { max-width:1280px; margin:0 auto; padding:0 20px; }
.frp .frp-sec { padding:64px 0; position:relative; }
.frp .frp-ivory { background:var(--ivory); } .frp .frp-white { background:#fff; } .frp .frp-ivory-deep { background:var(--ivory-deep); }
.frp .frp-plum { background:var(--p900); position:relative; overflow:hidden; }
.frp .frp-blob { position:absolute; border-radius:50%; filter:blur(64px); pointer-events:none; }
.frp .frp-eyebrow { display:flex; align-items:center; gap:12px; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.22em; color:var(--p500); line-height:1.4; }
.frp .frp-eyebrow::before { content:''; width:32px; height:1px; background:var(--g500); flex:none; }
.frp .frp-h2 { margin-top:20px; font-family:var(--serif); font-size:30px; font-weight:500; line-height:1.14; letter-spacing:0; color:var(--p900); }
.frp .frp-h2 .frp-em { font-style:italic; color:var(--p700); }
.frp .frp-h2 .frp-em-block { display:block; margin-top:4px; font-style:italic; color:var(--p700); }
.frp .frp-p { margin-top:16px; max-width:58ch; font-size:14.5px; line-height:1.8; color:rgba(44,29,70,.65); }
.frp .frp-fine { margin-top:16px; font-size:11.5px; line-height:1.6; color:rgba(44,29,70,.4); }

/* buttons */
.frp .frp-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; border-radius:999px; font-size:14px; font-weight:600; line-height:1.2; cursor:pointer; transition:background .2s, border-color .2s, color .2s; }
.frp .frp-btn-primary { background:var(--p900); color:#fff; border:none; padding:14px 28px; box-shadow:0 18px 40px -22px rgba(44,29,70,.8); }
.frp .frp-btn-primary:hover { background:var(--p800); }
.frp .frp-btn-ghost { gap:10px; background:rgba(255,255,255,.7); color:var(--p900); border:1px solid rgba(44,29,70,.15); padding:14px 24px; }
.frp .frp-btn-ghost:hover { background:#fff; border-color:var(--p300); }
.frp .frp-btn-gold { background:var(--g500); color:var(--p900); border:none; padding:14px 28px; width:100%; }
.frp .frp-btn-gold:hover { background:var(--g400); }
.frp .frp-btn-ondark { gap:10px; background:transparent; color:#fff; border:1px solid rgba(255,255,255,.25); padding:14px 24px; width:100%; }
.frp .frp-btn-ondark:hover { background:rgba(255,255,255,.1); }
.frp .frp-play { width:24px; height:24px; border-radius:50%; display:grid; place-items:center; background:var(--p100); color:var(--p800); flex:none; }
.frp .frp-btn-ondark .frp-play { background:rgba(255,255,255,.15); color:#fff; }
.frp .frp-link { display:inline-flex; align-items:center; gap:8px; background:none; border:none; padding:0; font-size:13px; font-weight:600; color:var(--p900); cursor:pointer; }
.frp .frp-link:hover { color:var(--p600); }

/* voice wave (decorative) */
.frp .frp-wave { display:flex; align-items:flex-end; gap:3px; height:24px; flex:1; min-width:0; }
.frp .frp-wave span { width:3px; border-radius:999px; background:var(--p300); flex:none; }
.frp .frp-time { font-size:10.5px; font-weight:500; font-variant-numeric:tabular-nums; color:rgba(44,29,70,.45); }

/* hero */
.frp .frp-hero-grid { display:grid; gap:40px; align-items:center; padding:36px 0 56px; position:relative; }
.frp .frp-h1 { margin-top:20px; font-family:var(--serif); font-size:34px; font-weight:500; line-height:1.06; letter-spacing:-0.01em; color:var(--p900); }
.frp .frp-h1 .frp-em-block { display:block; margin-top:8px; font-style:italic; color:var(--p700); }
.frp .frp-h1 .frp-gold { color:var(--g600); }
.frp .frp-lead { margin-top:20px; max-width:54ch; font-size:15px; line-height:1.7; color:rgba(44,29,70,.75); }
.frp .frp-sub { margin-top:14px; max-width:54ch; font-size:14px; line-height:1.75; color:rgba(44,29,70,.6); }
.frp .frp-actions { margin-top:36px; display:flex; flex-direction:column; gap:12px; }
.frp .frp-for { margin-top:28px; max-width:46ch; font-size:12.5px; line-height:1.6; color:rgba(44,29,70,.45); }
.frp .frp-hero-media { position:relative; }
.frp .frp-hero-img { overflow:hidden; border-radius:32px; box-shadow:0 50px 100px -50px rgba(44,29,70,.65); }
.frp .frp-hero-img img { width:100%; aspect-ratio:4/3; object-fit:cover; object-position:50% 35%; }
.frp .frp-badge { position:absolute; right:16px; top:16px; border-radius:999px; background:rgba(255,255,255,.9); padding:6px 12px; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.14em; color:var(--p700); box-shadow:0 1px 2px rgba(0,0,0,.06); }
.frp .frp-hero-card { position:absolute; bottom:16px; left:16px; width:calc(100% - 2rem); max-width:272px; border-radius:16px; border:1px solid var(--p100); background:rgba(255,255,255,.95); padding:16px; box-shadow:0 20px 50px -24px rgba(44,29,70,.5); }
.frp .frp-hero-card .frp-script { font-size:26px; line-height:1; color:var(--p800); }
.frp .frp-hero-card .frp-card-note { margin-top:8px; font-size:11.5px; line-height:1.35; color:rgba(44,29,70,.55); }
.frp .frp-wave-row { margin-top:12px; display:flex; align-items:center; gap:10px; }

/* bridge */
.frp .frp-bridge-inner { position:relative; max-width:1080px; margin:0 auto; padding:64px 20px; text-align:center; }
.frp .frp-bridge-inner .frp-script { font-size:25px; line-height:1; color:var(--g300); }
.frp .frp-bridge-quote { margin:20px auto 0; max-width:24ch; font-family:var(--serif); font-size:27px; font-weight:500; line-height:1.28; color:#fff; }
.frp .frp-bridge-quote span { color:var(--g300); }
.frp .frp-bridge-cols { margin:48px auto 0; max-width:780px; display:grid; gap:32px; text-align:left; }
.frp .frp-kicker { font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.2em; color:var(--g300); line-height:1.4; }
.frp .frp-ondark { margin-top:12px; font-size:13.5px; line-height:1.8; color:rgba(237,228,248,.7); }

/* possibilities */
.frp .frp-feat-grid { margin-top:44px; display:grid; gap:16px; }
.frp .frp-feat { position:relative; overflow:hidden; border-radius:26px; }
.frp .frp-feat img { width:100%; aspect-ratio:16/10; object-fit:cover; object-position:50% 45%; }
.frp .frp-feat.frp-tall img { aspect-ratio:16/12; }
.frp .frp-feat::after { content:''; position:absolute; inset:0; background:linear-gradient(to top, rgba(44,29,70,.95), rgba(44,29,70,.35) 50%, rgba(44,29,70,0)); }
.frp .frp-feat-text { position:absolute; left:0; right:0; bottom:0; padding:24px; z-index:1; }
.frp .frp-feat-text h3 { margin-top:8px; font-family:var(--serif); font-size:22px; font-weight:500; line-height:1.2; color:#fff; }
.frp .frp-feat-text p { margin-top:8px; max-width:34ch; font-size:13px; line-height:1.6; color:rgba(237,228,248,.8); }
.frp .frp-rows { margin-top:16px; border-radius:26px; border:1px solid var(--p100); background:#fff; padding:24px; }
.frp .frp-rows-grid { display:grid; column-gap:48px; }
.frp .frp-row { padding:16px 0; border-top:1px solid var(--p100); }
.frp .frp-row:first-child { border-top:none; }
.frp .frp-row-inner { display:flex; align-items:baseline; gap:12px; }
.frp .frp-num { font-family:var(--serif); font-size:12px; font-variant-numeric:tabular-nums; color:var(--g600); }
.frp .frp-row h3 { font-family:var(--serif); font-size:17px; font-weight:500; line-height:1.35; color:var(--p900); }
.frp .frp-row p { margin-top:4px; font-size:13px; line-height:1.6; color:rgba(44,29,70,.55); }
.frp .frp-rows .frp-note { margin-top:24px; border-top:1px solid var(--p100); padding-top:20px; font-size:11.5px; line-height:1.6; color:rgba(44,29,70,.4); }

/* growth */
.frp .frp-growth-head { display:grid; gap:32px; }
.frp .frp-growth-head .frp-lede { font-size:14.5px; line-height:1.8; color:rgba(44,29,70,.7); }
.frp .frp-growth-head .frp-lede2 { margin-top:14px; font-size:13.5px; line-height:1.8; color:rgba(44,29,70,.55); }
.frp .frp-band { margin-top:44px; position:relative; overflow:hidden; border-radius:32px; padding:24px; color:#fff; background-image:linear-gradient(135deg, #3E2A63 0%, #4A3273 45%, #2C1D46 100%); }
.frp .frp-nodes { position:relative; display:grid; gap:28px; }
.frp .frp-node-top { display:flex; align-items:center; gap:12px; }
.frp .frp-node-num { width:36px; height:36px; flex:none; border-radius:50%; border:1px solid rgba(235,208,122,.7); background:rgba(255,255,255,.05); display:grid; place-items:center; font-family:var(--serif); font-size:12px; font-weight:600; color:var(--g300); }
.frp .frp-node-line { height:1px; flex:1; background:linear-gradient(to right, rgba(235,208,122,.5), rgba(255,255,255,.1)); }
.frp .frp-node-line.frp-last { background:rgba(255,255,255,.1); }
.frp .frp-node h3 { margin-top:16px; font-family:var(--serif); font-size:18px; font-weight:500; line-height:1.35; color:#fff; }
.frp .frp-node p { margin-top:8px; font-size:12.5px; line-height:1.7; color:rgba(237,228,248,.65); }
.frp .frp-band-foot { position:relative; margin-top:36px; display:grid; gap:24px; border-top:1px solid rgba(255,255,255,.15); padding-top:28px; }
.frp .frp-band-foot .frp-big { font-family:var(--serif); font-size:22px; font-weight:500; line-height:1.3; color:#fff; }
.frp .frp-band-foot .frp-big span { font-style:italic; color:var(--g300); }
.frp .frp-band-foot .frp-small { font-size:13px; line-height:1.8; color:rgba(237,228,248,.7); }

/* supporter */
.frp .frp-sup { display:grid; gap:56px; align-items:center; }
.frp .frp-pillars { margin-top:36px; display:flex; flex-direction:column; gap:24px; }
.frp .frp-pillar { display:flex; gap:16px; }
.frp .frp-icon40 { margin-top:2px; width:40px; height:40px; flex:none; border-radius:50%; border:1px solid rgba(235,208,122,.7); background:var(--g50); color:var(--p700); display:grid; place-items:center; }
.frp .frp-pillar h3 { font-family:var(--serif); font-size:17px; font-weight:500; line-height:1.35; color:var(--p900); }
.frp .frp-pillar p { margin-top:4px; font-size:13.5px; line-height:1.75; color:rgba(44,29,70,.6); }
.frp .frp-aside { margin-top:32px; max-width:52ch; border-radius:16px; border:1px solid var(--p100); background:#fff; padding:12px 16px; font-size:12px; line-height:1.6; color:rgba(44,29,70,.55); }
.frp .frp-sup-media { position:relative; }
.frp .frp-sup-card { border-radius:30px; border:1px solid var(--p100); background:#fff; padding:12px; box-shadow:0 40px 90px -50px rgba(44,29,70,.55); }
.frp .frp-sup-card .frp-sup-img { overflow:hidden; border-radius:22px; }
.frp .frp-sup-card .frp-sup-img img { width:100%; aspect-ratio:16/11; object-fit:cover; object-position:50% 40%; }
.frp .frp-sup-body { padding:20px 16px; }
.frp .frp-sup-body .frp-script { font-size:30px; line-height:1; color:var(--p800); }
.frp .frp-sup-body .frp-quote { margin-top:12px; font-size:13px; line-height:1.75; color:rgba(44,29,70,.65); }
.frp .frp-voice { margin-top:16px; display:flex; align-items:center; gap:12px; border-radius:12px; background:var(--p50); padding:10px 12px; }
.frp .frp-mic { width:28px; height:28px; flex:none; border-radius:50%; background:var(--p900); color:#fff; display:grid; place-items:center; }
.frp .frp-sup-foot { margin-top:16px; display:flex; align-items:center; justify-content:space-between; gap:8px; border-top:1px solid var(--p100); padding-top:12px; }
.frp .frp-sup-foot span { font-size:10.5px; color:rgba(44,29,70,.4); }
.frp .frp-sup-foot .frp-caps { font-weight:600; text-transform:uppercase; letter-spacing:.16em; }
.frp .frp-caption { position:absolute; bottom:-16px; left:50%; transform:translateX(-50%); width:max-content; max-width:100%; border-radius:999px; border:1px solid var(--p100); background:#fff; padding:6px 16px; font-size:10.5px; font-weight:500; color:rgba(44,29,70,.5); box-shadow:0 1px 2px rgba(0,0,0,.06); text-align:center; }

/* how it works */
.frp .frp-how-head { display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:24px; }
.frp .frp-steps { margin-top:44px; display:grid; gap:32px; }
.frp .frp-step { border-top:1px solid var(--p200); padding-top:24px; }
.frp .frp-step-num { font-family:var(--serif); font-size:34px; font-weight:500; line-height:1; color:var(--g500); }
.frp .frp-step h3 { margin-top:16px; font-family:var(--serif); font-size:19px; font-weight:500; line-height:1.35; color:var(--p900); }
.frp .frp-step p { margin-top:10px; font-size:13.5px; line-height:1.8; color:rgba(44,29,70,.6); }

/* who it's for */
.frp .frp-chips { margin-top:32px; display:flex; flex-wrap:wrap; gap:8px; }
.frp .frp-chip { border-radius:999px; border:1px solid var(--p200); background:rgba(255,255,255,.7); padding:8px 16px; font-size:12.5px; font-weight:500; line-height:1.3; color:rgba(44,29,70,.65); cursor:pointer; transition:border-color .2s, color .2s, background .2s; }
.frp .frp-chip:hover { border-color:var(--p300); color:var(--p900); }
.frp .frp-chip[aria-pressed="true"] { border-color:var(--p900); background:var(--p900); color:#fff; }
.frp .frp-org { margin-top:24px; display:grid; gap:32px; border-radius:26px; border:1px solid var(--p100); background:#fff; padding:24px; }
.frp .frp-org .frp-script { font-size:26px; line-height:1; color:var(--p600); }
.frp .frp-org .frp-org-line { margin-top:12px; max-width:38ch; font-family:var(--serif); font-size:17px; line-height:1.6; color:var(--p900); }
.frp .frp-uses li { display:flex; align-items:flex-start; gap:12px; border-bottom:1px solid var(--p100); padding-bottom:14px; margin-bottom:14px; }
.frp .frp-uses li:last-child { border-bottom:none; padding-bottom:0; margin-bottom:0; }
.frp .frp-check { margin-top:2px; width:20px; height:20px; flex:none; border-radius:50%; background:var(--g100); color:var(--p800); display:grid; place-items:center; }
.frp .frp-uses span.frp-use { font-size:13.5px; line-height:1.6; color:rgba(44,29,70,.7); }

/* closing */
.frp .frp-close-inner { position:relative; max-width:820px; margin:0 auto; padding:80px 20px; text-align:center; }
.frp .frp-close-inner .frp-script { font-size:28px; line-height:1; color:var(--g300); }
.frp .frp-close-h { margin-top:24px; font-family:var(--serif); font-size:30px; font-weight:500; line-height:1.2; color:#fff; }
.frp .frp-close-h span { display:block; margin-top:8px; font-style:italic; color:var(--g300); }
.frp .frp-close-p { margin:24px auto 0; max-width:54ch; font-size:14.5px; line-height:1.8; color:rgba(237,228,248,.7); }
.frp .frp-close-actions { margin-top:36px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; }
.frp .frp-foot { position:relative; border-top:1px solid rgba(255,255,255,.1); }
.frp .frp-foot-inner { max-width:1280px; margin:0 auto; padding:24px 20px; display:flex; flex-direction:column; gap:8px; font-size:11px; line-height:1.6; color:rgba(237,228,248,.45); }
.frp .frp-foot-brand { font-family:var(--serif); font-size:12.5px; font-weight:500; color:rgba(237,228,248,.6); }
.frp .frp-foot sup, .frp .frp-tm { font-size:.62em; vertical-align:super; line-height:0; color:var(--g600); }
.frp .frp-foot .frp-tm { color:var(--g300); }
.frp .frp-partner { margin-top:4px; }
.frp .frp-partner a, .frp .frp-partner button { color:rgba(237,228,248,.7); text-decoration:underline; text-underline-offset:3px; background:none; border:none; padding:0; font:inherit; cursor:pointer; }

/* inquiry dialog */
.frp-backdrop { position:fixed; inset:0; z-index:1000; background:rgba(17,12,30,.55); }
.frp-dialog { --p100:#EDE4F8; --p200:#DBC9F0; --p500:#7C63AE; --p600:#5A3E8A; --p800:#3E2A63; --p900:#2C1D46; --ivory:#FBF9F6;
  position:fixed; z-index:1001; top:50%; left:50%; transform:translate(-50%,-50%); width:min(92vw, 560px); max-height:90vh; overflow-y:auto; overscroll-behavior:contain;
  background:var(--ivory); color:var(--p900); border:1px solid var(--p100); border-radius:24px; padding:24px; box-shadow:0 40px 90px -30px rgba(17,12,30,.6); }
.frp-dialog * { box-sizing:border-box; }
.frp-dialog p, .frp-dialog h2 { margin:0; }
.frp-dialog .frp-x { position:absolute; top:14px; right:14px; width:36px; height:36px; min-height:0; padding:0; border-radius:50%; border:1px solid var(--p100); background:#fff; color:var(--p900); display:grid; place-items:center; cursor:pointer; }
.frp-dialog .frp-script { font-family:'Great Vibes', 'Segoe Script', cursive; font-size:24px; line-height:1; color:var(--p600); }
.frp-dialog .frp-dlg-title { margin-top:8px; padding-right:36px; font-family:'Playfair Display', Georgia, serif; font-size:24px; font-weight:500; line-height:1.2; color:var(--p900); }
.frp-dialog .frp-dlg-desc { margin-top:6px; font-size:13px; line-height:1.7; color:rgba(44,29,70,.6); }
.frp-dialog form { margin-top:24px; display:flex; flex-direction:column; gap:16px; }
.frp-dialog .frp-form-row { display:grid; gap:16px; }
.frp-dialog .frp-field { display:flex; flex-direction:column; gap:6px; min-width:0; }
.frp-dialog .frp-field label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.12em; color:rgba(44,29,70,.5); }
.frp-dialog .frp-field input, .frp-dialog .frp-field select, .frp-dialog .frp-field textarea { width:100%; border-radius:12px; border:1px solid var(--p200); background:#fff; color:var(--p900); padding:10px 12px; font-size:16px; font-family:inherit; line-height:1.4; }
.frp-dialog .frp-field textarea { resize:none; }
.frp-dialog .frp-field input:focus, .frp-dialog .frp-field select:focus, .frp-dialog .frp-field textarea:focus { outline:none; border-color:var(--p500); box-shadow:0 0 0 3px rgba(124,99,174,.15); }
.frp-dialog .frp-field [aria-invalid="true"] { border-color:#b91c1c; }
.frp-dialog .frp-field-err { font-size:12px; font-weight:500; color:#b91c1c; }
.frp-dialog .frp-form-err { font-size:12.5px; font-weight:500; line-height:1.5; color:#b91c1c; }
.frp-dialog .frp-submit { display:inline-flex; width:100%; align-items:center; justify-content:center; gap:8px; border-radius:999px; border:none; background:var(--p900); color:#fff; padding:12px 24px; font-size:13.5px; font-weight:600; cursor:pointer; min-height:44px; }
.frp-dialog .frp-submit:hover { background:var(--p800); }
.frp-dialog .frp-submit:disabled { background:#BEA6E0; cursor:not-allowed; opacity:1; pointer-events:none; }
.frp-dialog .frp-hp { position:absolute; left:-10000px; width:1px; height:1px; overflow:hidden; }

@media (min-width: 640px) {
  .frp .frp-h1 { font-size:40px; }
  .frp .frp-h2 { font-size:40px; }
  .frp .frp-h2.frp-h2-38 { font-size:38px; }
  .frp .frp-actions { flex-direction:row; align-items:center; }
  .frp .frp-bridge-quote { max-width:38ch; font-size:34px; }
  .frp .frp-bridge-cols { grid-template-columns:1fr 1fr; gap:0; }
  .frp .frp-bridge-cols > div:first-child { border-right:1px solid rgba(255,255,255,.15); padding-right:32px; }
  .frp .frp-bridge-cols > div:last-child { padding-left:32px; }
  .frp .frp-rows-grid { grid-template-columns:1fr 1fr; }
  .frp .frp-row:nth-child(2) { border-top:none; }
  .frp .frp-nodes { grid-template-columns:1fr 1fr; }
  .frp .frp-close-h { font-size:42px; }
  .frp .frp-close-actions { flex-direction:row; }
  .frp .frp-btn-gold, .frp .frp-btn-ondark { width:auto; }
  .frp .frp-foot-inner { flex-direction:row; align-items:center; justify-content:space-between; }
  .frp .frp-foot-note { text-align:right; max-width:64ch; }
  .frp-dialog .frp-form-row { grid-template-columns:1fr 1fr; }
  .frp-dialog .frp-field input, .frp-dialog .frp-field select, .frp-dialog .frp-field textarea { font-size:13.5px; }
}
@media (min-width: 768px) {
  .frp { border-radius:24px; }
  .frp .frp-hero-grid { grid-template-columns:1.06fr .94fr; gap:36px; }
  .frp .frp-hero-img img { aspect-ratio:4/5; }
}
@media (min-width: 1024px) {
  .frp .frp-wrap { padding:0 32px; }
  .frp .frp-sec { padding:96px 0; }
  .frp .frp-hero-grid { gap:64px; padding:56px 0 96px; }
  .frp .frp-h1 { font-size:54px; }
  .frp .frp-lead { font-size:15.5px; }
  .frp .frp-bridge-inner { padding:96px 32px; }
  .frp .frp-bridge-quote { font-size:40px; }
  .frp .frp-feat-grid { grid-template-columns:7fr 5fr; }
  .frp .frp-feat-text { padding:32px; }
  .frp .frp-feat-text h3 { font-size:26px; }
  .frp .frp-rows { padding:36px; }
  .frp .frp-growth-head { grid-template-columns:.92fr 1.08fr; align-items:end; }
  .frp .frp-growth-head > div:last-child { padding-bottom:8px; }
  .frp .frp-band { padding:40px; }
  .frp .frp-nodes { grid-template-columns:repeat(4, 1fr); }
  .frp .frp-band-foot { grid-template-columns:1.05fr .95fr; gap:48px; }
  .frp .frp-band-foot .frp-big { font-size:26px; }
  .frp .frp-sup { grid-template-columns:1fr 1fr; gap:64px; }
  .frp .frp-steps { grid-template-columns:repeat(3, 1fr); gap:40px; }
  .frp .frp-org { grid-template-columns:.9fr 1.1fr; gap:48px; padding:36px; }
  .frp .frp-close-inner { padding:112px 32px; }
  .frp .frp-foot-inner { padding:24px 32px; }
}
@media (prefers-reduced-motion: reduce) { .frp *, .frp-dialog * { transition:none !important; } }
/* Phones: inside the dashboard's padded column a 4:3 photo is short enough that the message card covers the faces and the
   badge; the reference's own taller 4:5 crop (used from 1024px) keeps them clear. */
@media (max-width:639px) { .frp .frp-hero-img img { aspect-ratio:4/5; } }
@media (max-width:359px) { .frp .frp-hero-card { padding:12px; bottom:12px; left:12px; width:calc(100% - 24px); } .frp .frp-hero-card .frp-script { font-size:21px; } }
`;
