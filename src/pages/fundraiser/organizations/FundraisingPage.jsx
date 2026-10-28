// src/pages/fundraiser/organizations/FundraisingPage.jsx
// "Greet-Me for Organizations" — the dashboard's Fundraisers page content (founder handoff 2026-10-28). It renders
// inside the existing DashboardLayout (the real navigation; the prototype's static header is not reproduced).
//   * Every "Let’s Grow Together" (and "Start the conversation") opens the organization inquiry form, which uses the
//     existing /api/contact-sales route with source "fundraiser" (InquiryDialog.jsx).
//   * "See the Greet-Me Experience" opens the EXISTING working sample — the landing page's Sample Greet-Me viewer
//     (SampleGreetingOverlay: the real card player fed fixed sample content; no charge, order, send or claimable
//     credit) — offered only once its talking-photo video is confirmed to load, exactly as the landing does.
import { lazy, Suspense, useCallback, useState } from 'react';
import { FRP_CSS } from './fundraisingStyles';
import {
  HeroSection, BridgeSection, PossibilitiesSection, GrowthSection, SupporterSection, HowItWorksSection, WhoItsForSection, ClosingSection,
} from './sections';
import InquiryDialog from './InquiryDialog';
import { SAMPLE_ENTRY_ENABLED, SAMPLE_TALKING_PHOTO_URL } from '../../../components/sample/sampleGreeting.js';
import useSampleMediaAvailable from '../../../components/sample/useSampleMediaAvailable.js';
import { showManualToast } from '../../../utils/notify';
import { COMMS_CATEGORIES } from '../../../utils/commsCatalog';

const SampleGreetingOverlay = lazy(() => import('../../../components/sample/SampleGreetingOverlay.jsx'));

export default function FundraisingPage({ partnerNote = null }) {
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const sampleMedia = useSampleMediaAvailable(SAMPLE_TALKING_PHOTO_URL, SAMPLE_ENTRY_ENABLED);

  const onInquire = useCallback(() => { setSampleOpen(false); setInquiryOpen(true); }, []);
  const closeInquiry = useCallback(() => setInquiryOpen(false), []);
  const onExperience = useCallback(() => {
    if (SAMPLE_ENTRY_ENABLED && sampleMedia === 'available') { setInquiryOpen(false); setSampleOpen(true); return; }
    // The sample's video is still being checked, or could not be loaded: say so instead of opening an empty viewer.
    showManualToast(
      'Sample Greet-Me not ready',
      sampleMedia === 'checking' ? 'The sample is still loading. Please try again in a moment.' : 'The sample Greet-Me is not available right now. Please try again later.',
      COMMS_CATEGORIES.SYSTEM,
    );
  }, [sampleMedia]);

  return (
    <div className="frp" data-testid="fundraising-page">
      <style>{FRP_CSS}</style>
      <HeroSection onInquire={onInquire} onExperience={onExperience} />
      <BridgeSection />
      <PossibilitiesSection />
      <GrowthSection />
      <SupporterSection />
      <HowItWorksSection onInquire={onInquire} />
      <WhoItsForSection />
      <ClosingSection onInquire={onInquire} onExperience={onExperience} partnerNote={partnerNote} />
      {inquiryOpen ? <InquiryDialog onClose={closeInquiry} /> : null}
      {sampleOpen ? (
        <Suspense fallback={null}>
          <SampleGreetingOverlay onClose={() => setSampleOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
