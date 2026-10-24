// src/components/giftPlace/GiftPlaceHeroIcon.jsx
// The Greet-Me Hero icon beside "American Gift Place" (founder 2026-10-24, walkthrough §5: "just like home screen .. the
// little Greet-Me Hero icon with the hover reveal"). Exactly the Home page's icon (DashboardHome .gx .heroicon, styled in
// dashboardHomeStyles.js): the same 32px gold-ringed circle and Award mark at every width, nothing beside it at rest, the
// "Greet-Me Hero" label revealed only on hover or keyboard focus, and the same destination (/dashboard/hero). The Home
// rules are repeated here, with Home's own values, because the Home stylesheet is scoped to the Home page.
import { Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CSS = `
.gp-heroicon { position:relative; flex:none; width:32px; height:32px; border-radius:50%; border:1px solid rgba(235,208,122,.55); background:rgba(255,255,255,.08); color:#EBD07A; display:grid; place-items:center; cursor:pointer; padding:0; min-height:0; transition:background .2s, border-color .2s; }
.gp-heroicon:hover, .gp-heroicon:focus-visible { background:rgba(255,255,255,.18); border-color:#EBD07A; outline:none; }
.gp-heroicon .gp-tip { position:absolute; left:calc(100% + 8px); top:50%; transform:translateY(-50%); white-space:nowrap; background:#fff; color:#2C1D46; font:600 12.5px 'Inter', -apple-system, "Segoe UI", Roboto, sans-serif; padding:5px 10px; border-radius:8px; box-shadow:0 10px 24px -12px rgba(0,0,0,.5); opacity:0; pointer-events:none; transition:opacity .15s; z-index:5; }
.gp-heroicon:hover .gp-tip, .gp-heroicon:focus-visible .gp-tip { opacity:1; }
`;

export default function GiftPlaceHeroIcon() {
  const navigate = useNavigate();
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="gp-heroicon" data-testid="gift-place-hero-icon" aria-label="Greet-Me Hero"
        onClick={() => navigate('/dashboard/hero')}>
        <Award size={17} />
        <span className="gp-tip" aria-hidden="true">Greet-Me Hero</span>
      </button>
    </>
  );
}
