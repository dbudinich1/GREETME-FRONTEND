// src/pages/RedeemQRCash.jsx
//
// W44 — RETIRED legacy recipient deposit route.
//
// This page used to "redeem" a QR Cash gift entirely in the browser: it read a gift record out of
// localStorage (`greetme_qrcash_gifts`), waited 1.5s on a timer, then marked it redeemed and bumped
// a localStorage "balance". Nothing was ever charged, claimed, or paid out — a second, simulated
// claim system that told the recipient "Your cash has been successfully delivered".
//
// There is exactly ONE QR Cash claim flow: the backend-wired /gift/:claimToken page (GiftClaim),
// with founder-executed manual payout. This route now only forwards any old
// /redeem/qr-cash/:id link to that canonical page. It reads and writes no storage, mints no gift,
// moves no money. Old simulation records are never read, so they can never be shown as real.
import { Navigate, useParams } from 'react-router-dom';

export default function RedeemQRCash() {
  const { id } = useParams();
  const token = typeof id === 'string' ? id.trim() : '';
  if (!token) return <Navigate to="/" replace />;
  return <Navigate to={`/gift/${encodeURIComponent(token)}`} replace />;
}
