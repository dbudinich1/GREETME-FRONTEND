## SYSTEM STATE (LOCKED)

### Core Loop Status
- End-to-end loop verified working
- ThankYouFlow crash resolved (root cause: useState declared after useEffect reference — minifier TDZ)
- CTA routing to /thank-you working (sourceGreetingJobId linked on gift record)
- Prefill working (thankyou-prefill endpoint returns script, names, emails)
- Exponential Moment rendering (post-send celebration screen)
- Share trigger functioning (reward unlock, idempotent, capped)

### Known Working Components
- GiftClaim.jsx (CTA + routing, fallback to /dashboard/send for legacy gifts)
- ThankYouFlow.jsx (render + prefill + inline registration + send + Exponential Moment)
- FinaleSpread.jsx (clean layout, QR logic for qrcash, courtesy CTA for non-gift)
- Exponential Moment screen (share reward, dismiss logging, 90-min gate)
- Share trigger + reward wiring (idempotent, QR Cash match capped at $10)

### Backend State
- sourceGreetingJobId linking implemented (index.js, post-job-enqueue)
- Gift claim flow working (Venmo/PayPal/Debit options)
- Event logging active (eventsService.js, deterministic dedupe)
- thankyou-prefill endpoint active (eventRoutes.js, public, returns script + names + gift context)
- share-reward endpoint active (eventRoutes.js, authenticated, idempotent)
- Loop-send text-only fallback active (skipVideo for missing photo)
- Literal text preservation for loop sends (no AI rewrite)
- Name normalization (capitalize first letter, sender/recipient consistent)

### Known Gaps / TODO (DO NOT FORGET)
- AZURE_STORAGE_QUEUE env var not set on API App Service (blocks T7 delayed follow-up queue)
- Loop-send cap exemption NOT implemented (sourceJobId sends still count against greeting cap)
- TEMP entitlements override (999 cap) still present in entitlements.js line 27 — MUST revert before production
- CAP_DEBUG log still present in index.js — remove after loop testing complete
- Legacy gifts missing sourceGreetingJobId / hasGift (pre-deploy data, new gifts are linked)
- Desktop share UX needs clipboard-copy confirmation feedback
- GIFT_DELIVERED growth email has bug: "pl is not defined" (non-fatal, does not block delivery)
- T7 delayed follow-up not yet live-tested (requires AZURE_STORAGE_QUEUE + 1-hour wait)

### Verification Snapshot
Date: 2026-03-21
Result: FULL LOOP PASS (7/7)

Loop steps verified:
1. Send greeting with QR Cash gift
2. Recipient receives and opens greeting
3. Recipient claims gift via QR
4. "Say thanks on us" CTA appears on Gift Claimed screen
5. CTA routes to ThankYouFlow with prefilled script
6. Recipient sends thank-you greeting
7. Exponential Moment screen renders with share trigger

### Recovery Instruction
If regression occurs:
- revert to this commit
- re-test 7-step loop
- isolate breaking commit after this point
