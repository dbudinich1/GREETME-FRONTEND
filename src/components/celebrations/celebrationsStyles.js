// src/components/celebrations/celebrationsStyles.js
// Celebrations page (Report 135), following the founder's Base44 reference (ref-3/ref-5): a white header card with a
// thin purple top rule, a serif title with the script tagline, outlined actions; a "Start from" toggle card; a
// recipients card with chips, search and rows with occasion chips. Scoped under .cx; the dashboard's tokens.
export const CELEBRATIONS_CSS = `
.cx { --p900:#2C1D46; --p800:#3E2A63; --p700:#4A3273; --p600:#5A3E8A; --p500:#7C63AE; --p200:#DBC9F0; --p100:#EDE4F8; --p50:#F7F3FC;
  --g400:#E0BE55; --g100:#FBF0D2; --ink:#2C1D46; --body:#4A3F5C; --muted:#6B6079; --line:#E9E1F2; --ok:#2C6A4B; --okT:#EAF4EE; --red:#B4232F; --redT:#FDECEE;
  --amber:#8A4B0F; --amberT:#FDF1E4; --ivory:#FBF9F6;
  --serif:"Playfair Display", Georgia, serif; --script:"Great Vibes", "Segoe Script", cursive; --sans:'Inter', -apple-system, "Segoe UI", Roboto, sans-serif;
  font-family:var(--sans); color:var(--body); display:grid; gap:14px; grid-template-columns:minmax(0,1fr); }
.cx * { box-sizing:border-box; }
.cx h1, .cx h2, .cx h3 { font-family:var(--serif); color:var(--ink); font-weight:600; margin:0; }
.cx p { margin:0; line-height:1.5; color:inherit; }
.cx button { font-family:var(--sans); min-height:0; }
.cx .card { background:#fff; border:1px solid var(--line); border-radius:22px; box-shadow:0 24px 56px -50px rgba(44,29,70,.55); }
.cx .nextup { font-size:13px; color:var(--muted); padding:0 4px; }
.cx .nextup b { color:var(--p700); font-weight:600; }
.cx .head { position:relative; overflow:hidden; display:flex; align-items:center; gap:18px; padding:22px 24px 20px; }
.cx .head::before { content:""; position:absolute; left:0; right:0; top:0; height:4px; background:linear-gradient(90deg,var(--p800),var(--p500)); }
.cx .thumb { width:58px; height:58px; flex:none; border-radius:14px; background:var(--p50); border:1px solid var(--p100); display:grid; place-items:center; overflow:hidden; }
.cx .thumb img { width:100%; height:100%; object-fit:contain; }
.cx .titlerow { display:flex; align-items:baseline; gap:12px; flex-wrap:wrap; }
.cx .titlerow h1 { font-size:30px; line-height:1.15; }
.cx .script { font-family:var(--script); font-size:24px; color:var(--p600); line-height:1; }
.cx .sub { font-size:14px; color:var(--muted); margin-top:4px; max-width:46rem; }
.cx .hacts { margin-left:auto; display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.cx .btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; height:40px; padding:0 16px; border-radius:999px; font:600 14px var(--sans); cursor:pointer; white-space:nowrap; border:1px solid transparent; }
.cx .btn-out { background:#fff; color:var(--p800); border-color:var(--p200); }
.cx .btn-out:hover { background:var(--p50); }
.cx .btn-pri { background:var(--p800); color:#fff; box-shadow:0 14px 30px -18px rgba(44,29,70,.9); }
.cx .btn-pri:hover { background:var(--p900); }
.cx .btn-pri[disabled] { background:var(--p100); color:var(--p600); box-shadow:none; cursor:not-allowed; }
.cx .btn-sm { height:34px; padding:0 12px; font-size:13px; }
.cx .btn:focus-visible, .cx .seg button:focus-visible, .cx .chip:focus-visible, .cx .occbtn:focus-visible, .cx .person:focus-visible { outline:3px solid #c9b8f2; outline-offset:2px; }
.cx .navcard { padding:14px 18px; display:grid; gap:10px; }
.cx .navrow { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.cx .eyebrow { font:700 12px/1.2 var(--sans); letter-spacing:.14em; text-transform:uppercase; color:var(--p600); }
.cx .seg { display:inline-flex; gap:4px; background:var(--p50); border:1px solid var(--p100); border-radius:999px; padding:4px; }
.cx .seg button { border:none; background:none; border-radius:999px; padding:8px 18px; font:600 14px var(--sans); color:rgba(44,29,70,.7); cursor:pointer; white-space:nowrap; }
.cx .seg button[aria-selected="true"] { background:var(--p800); color:#fff; box-shadow:0 8px 18px -12px rgba(44,29,70,.9); }
.cx .seg.small button { padding:6px 14px; font-size:13.5px; }
.cx .seg.small button[aria-selected="true"] { background:#fff; color:var(--p900); box-shadow:0 1px 3px rgba(44,29,70,.15); }
.cx .hint { font-size:13.5px; color:var(--muted); }
.cx .listcard { padding:18px 20px 16px; }
.cx .cardhead { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.cx .cardhead h2 { font-size:24px; }
.cx .cardhead p { font-size:13.5px; color:var(--muted); margin-top:2px; }
.cx .chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:14px; background:var(--p50); border:1px solid var(--p100); border-radius:14px; padding:4px; }
.cx .chips button { border:none; background:none; border-radius:10px; padding:7px 14px; font:600 13.5px var(--sans); color:rgba(44,29,70,.66); cursor:pointer; }
.cx .chips button[aria-selected="true"] { background:#fff; color:var(--p900); box-shadow:0 1px 3px rgba(44,29,70,.12); }
.cx .chips .n { font-weight:500; color:var(--muted); margin-left:4px; }
.cx .search { display:flex; align-items:center; gap:8px; height:40px; margin-top:10px; padding:0 14px; border-radius:12px; background:rgba(15,23,42,.035); border:1px solid transparent; }
.cx .search:focus-within { background:#fff; border-color:var(--p200); }
.cx .search input { flex:1; min-width:0; border:none; background:none; outline:none; font:14.5px var(--sans); color:var(--ink); height:100%; }
.cx .rows { margin-top:10px; height:min(520px, 58dvh); overflow:auto; padding-right:4px; }
.cx .row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px 14px; align-items:center; padding:12px 6px; border-top:1px solid var(--line); }
.cx .row:first-child { border-top:none; }
.cx .person { display:flex; align-items:center; justify-content:flex-start; justify-self:start; gap:12px; min-width:0; max-width:100%; width:auto; border:none; background:none; padding:0; margin:0; text-align:left; cursor:pointer; white-space:normal; }
.cx .av { width:40px; height:40px; flex:none; border-radius:50%; display:grid; place-items:center; color:#fff; font:700 13px var(--sans); }
.cx .pname { font:600 15px var(--sans); color:var(--ink); }
.cx .pmeta { font-size:13px; color:var(--muted); }
.cx .pdate { font-size:12.5px; color:var(--muted); }
.cx .occchips { grid-column:1 / -1; display:flex; gap:6px; flex-wrap:wrap; padding-left:52px; }
.cx .chip { position:relative; display:inline-flex; align-items:center; gap:5px; border-radius:999px; padding:3px 10px; font:600 12px var(--sans); border:1px solid transparent; cursor:pointer; background:#fff; }
.cx .chip .dot { width:6px; height:6px; border-radius:50%; background:currentColor; }
.cx .chip.planned { color:var(--ok); background:var(--okT); border-color:#cfe6d8; }
.cx .chip.open { color:var(--red); background:var(--redT); border-color:#f3cdd1; }
.cx .chip.amber { color:var(--amber); background:var(--amberT); border-color:#f1d9bd; }
.cx .chip.muted { color:#475569; background:#f1f5f9; border-color:#e2e8f0; }
.cx .chip[data-note]:hover::after, .cx .chip[data-note]:focus-visible::after { content:attr(data-note); position:absolute; left:0; bottom:calc(100% + 8px); z-index:20; width:max-content; max-width:260px; white-space:normal; background:var(--p900); color:#fff; font:500 12.5px/1.4 var(--sans); padding:7px 10px; border-radius:10px; box-shadow:0 12px 28px -14px rgba(0,0,0,.6); pointer-events:none; }
.cx .racts { display:flex; gap:6px; align-items:center; }
.cx .iconbtn { width:34px; height:34px; display:grid; place-items:center; border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--p700); cursor:pointer; padding:0; }
.cx .iconbtn:hover { background:var(--p50); }
.cx .iconbtn.del:hover { background:#fee2e2; color:#dc2626; border-color:#fca5a5; }
.cx .sendbtn { display:inline-flex; align-items:center; gap:6px; height:34px; padding:0 12px; border-radius:10px; border:1px solid #cfe6d8; background:var(--okT); color:var(--ok); font:600 13px var(--sans); cursor:pointer; }
.cx .empty { padding:36px 12px; text-align:center; color:var(--muted); font-size:14px; }
.cx .occgrid { display:grid; grid-template-columns:minmax(260px, 340px) minmax(0,1fr); gap:16px; margin-top:14px; }
.cx .occlist { border:1px solid var(--line); border-radius:16px; padding:8px; height:min(560px, 62dvh); overflow:auto; background:var(--ivory); }
.cx .ogroup { font:700 11.5px var(--sans); letter-spacing:.12em; text-transform:uppercase; color:var(--p600); padding:10px 8px 4px; }
.cx .occbtn { width:100%; display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:2px 10px; align-items:center; text-align:left; border:1px solid transparent; background:none; border-radius:12px; padding:8px; cursor:pointer; }
.cx .occbtn:hover { background:#fff; }
.cx .occbtn[aria-selected="true"] { background:#fff; border-color:var(--p200); box-shadow:0 1px 3px rgba(44,29,70,.12); }
.cx .occbtn .ic { font-size:18px; grid-row:span 2; }
.cx .occbtn .ol { font:600 14px var(--sans); color:var(--ink); }
.cx .occbtn .os { font-size:12px; color:var(--muted); grid-column:2; }
.cx .occbtn .cnt { grid-row:span 2; font:600 12px var(--sans); color:var(--p700); background:var(--p50); border-radius:999px; padding:2px 8px; }
.cx .kind { display:inline-flex; align-items:center; gap:5px; font:600 11.5px var(--sans); border-radius:999px; padding:2px 9px; }
.cx .kind.shared { color:#1e4f8a; background:#e7f0fb; }
.cx .kind.personal { color:#7a3e8a; background:#f5e9f8; }
.cx .roster { border:1px solid var(--line); border-radius:16px; padding:14px 16px; min-width:0; }
.cx .roster h3 { font-size:21px; display:flex; align-items:center; gap:8px; }
.cx .rule { margin-top:6px; font-size:13.5px; color:var(--body); background:var(--p50); border:1px solid var(--p100); border-radius:12px; padding:8px 10px; }
.cx .rsec { margin-top:12px; font:700 11.5px var(--sans); letter-spacing:.12em; text-transform:uppercase; color:var(--muted); }
.cx .rrow { display:grid; grid-template-columns:auto auto minmax(0,1fr) auto; gap:4px 10px; align-items:center; padding:9px 4px; border-top:1px solid var(--line); }
.cx .rrow .who { min-width:0; }
.cx .rrow .line { font-size:12.5px; color:var(--muted); }
.cx .src { font:600 11px var(--sans); border-radius:999px; padding:1px 7px; margin-left:6px; white-space:nowrap; }
.cx .src.saved { color:var(--p600); background:var(--p50); }
.cx .src.shared { color:#1e4f8a; background:#e7f0fb; }
.cx .src.missing { color:var(--amber); background:var(--amberT); }
.cx .rrow input[type=checkbox] { width:18px; height:18px; accent-color:var(--p800); }
.cx .bulk { margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:var(--p50); border:1px solid var(--p100); border-radius:14px; padding:10px 12px; }
.cx .bulk p { font-size:12.5px; color:var(--muted); max-width:34rem; }
.cx .rosterbody { max-height:min(430px, 50dvh); overflow:auto; margin-top:6px; }
@media (max-width: 760px) {
  .cx { gap:10px; }
  .cx .head { flex-wrap:wrap; padding:18px 14px 16px; gap:12px; }
  .cx .thumb { width:48px; height:48px; }
  .cx .titlerow h1 { font-size:25px; }
  .cx .script { font-size:21px; }
  .cx .hacts { margin-left:0; width:100%; justify-content:flex-start; }
  .cx .hacts .btn { flex:1 1 auto; }
  .cx .navcard { padding:12px; }
  .cx .seg { width:100%; }
  .cx .seg button { flex:1 1 0; padding:8px 6px; }
  .cx .listcard { padding:14px 12px; }
  .cx .chips button { flex:1 1 0; padding:7px 4px; font-size:12.5px; }
  .cx .chips .n { display:none; }
  .cx .row { grid-template-columns:minmax(0,1fr); }
  .cx .racts { justify-content:flex-start; padding-left:52px; }
  .cx .occgrid { grid-template-columns:minmax(0,1fr); }
  .cx .occlist { height:auto; max-height:300px; }
  .cx .roster { padding:12px 10px; }
  .cx .rrow { grid-template-columns:auto minmax(0,1fr) auto; }
  .cx .rrow .stat { grid-column:2 / -1; }
}
`;
