const S = { h2: { marginTop: 32 }, h3: { marginTop: 20, marginBottom: 4 }, p: { lineHeight: 1.7, color: “#444” }, ul: { lineHeight: 1.7, color: “#444” } };

export default function Legal() {
  return (
    <div style={{ padding: 40, fontFamily: “system-ui, Arial, sans-serif”, maxWidth: 900, margin: “0 auto” }}>
      <h1 style={{ marginBottom: 10 }}>Legal</h1>
      <p style={{ color: “#555”, marginTop: 0 }}>Last updated: April 3, 2026</p>

      <hr style={{ margin: “24px 0” }} />

      {/* ============ PRIVACY POLICY ============ */}
      <h2 id=”privacy” style={S.h2}>Privacy Policy</h2>
      <p style={S.p}>Greet-Me&trade; (&ldquo;we,&rdquo; &ldquo;us&rdquo;) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use greet-me.com and related services.</p>

      <h3 style={S.h3}>Information We Collect</h3>
      <ul style={S.ul}>
        <li><strong>Account information:</strong> name, email address, and password when you register.</li>
        <li><strong>Recipient information:</strong> names and email addresses of people you send greetings to.</li>
        <li><strong>Uploaded content:</strong> photos you upload for greeting creation.</li>
        <li><strong>Voice recordings:</strong> audio samples you provide so we can generate a voice-cloned greeting using AI.</li>
        <li><strong>Payment information:</strong> processed by Stripe; we do not store card numbers.</li>
        <li><strong>Usage data:</strong> pages visited, features used, and device/browser information for service improvement.</li>
      </ul>

      <h3 style={S.h3}>How We Use Information</h3>
      <p style={S.p}>We use your information to: generate and deliver personalized greetings (including AI-generated text, audio, and video); process payments and credits; send transactional emails (delivery confirmations, receipts, account notifications); send growth and engagement emails (tips, reminders, follow-ups) which you may opt out of; and improve and maintain the service.</p>

      <h3 style={S.h3}>Voice Cloning &amp; AI Processing</h3>
      <p style={S.p}>When you provide a voice sample, we use third-party AI services to generate speech that approximates your voice. Voice samples and generated audio are stored to deliver your greetings. You may request deletion of your voice data at any time by contacting support@greet-me.com.</p>

      <h3 style={S.h3}>Third-Party Processors</h3>
      <p style={S.p}>We use the following categories of third-party services to operate Greet-Me:</p>
      <ul style={S.ul}>
        <li><strong>Payment processing:</strong> Stripe (payment, subscription, and payout handling)</li>
        <li><strong>Email delivery:</strong> SendGrid (transactional and engagement emails)</li>
        <li><strong>AI voice synthesis:</strong> ElevenLabs (voice cloning and text-to-speech)</li>
        <li><strong>AI video generation:</strong> D-ID (photo animation)</li>
        <li><strong>Cloud storage:</strong> Microsoft Azure (photos, voice recordings, greeting media, and application data)</li>
      </ul>
      <p style={S.p}>These providers only receive information necessary to perform their function and are subject to their own privacy policies.</p>

      <h3 style={S.h3}>Data Retention &amp; Deletion</h3>
      <p style={S.p}>We retain your account information and greeting data for as long as your account is active or as needed to provide the service. Greeting media (photos, voice, generated video) is retained for up to 12 months after creation to allow recipients to view greetings. You may request deletion of your account and all associated data by emailing support@greet-me.com. We will process deletion requests within 30 days.</p>

      <h3 style={S.h3}>Recipient Data</h3>
      <p style={S.p}>When you send a Greet-Me, we store the recipient&rsquo;s name and email address to deliver the greeting and send related notifications. Recipients may request removal of their data by contacting support@greet-me.com.</p>

      <h3 style={S.h3}>Children&rsquo;s Privacy</h3>
      <p style={S.p}>Greet-Me is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has provided us with personal information, please contact us immediately at support@greet-me.com so we can remove the information.</p>

      <h3 style={S.h3}>Your Rights</h3>
      <p style={S.p}>You may request access to, correction of, or deletion of your personal information by emailing support@greet-me.com. California residents and EEA residents may have additional rights under applicable law.</p>

      <h3 style={S.h3}>Contact</h3>
      <p style={S.p}>For privacy questions: support@greet-me.com</p>

      <hr style={{ margin: “28px 0” }} />

      {/* ============ TERMS OF SERVICE ============ */}
      <h2 id=”terms” style={S.h2}>Terms of Service</h2>
      <p style={S.p}>By creating an account or using Greet-Me&trade; (&ldquo;the Service&rdquo;), you agree to these Terms.</p>

      <h3 style={S.h3}>Eligibility</h3>
      <p style={S.p}>You must be at least 13 years old to use Greet-Me. By registering, you confirm that you meet this age requirement. If you are under 18, you represent that a parent or guardian has reviewed and agreed to these Terms on your behalf.</p>

      <h3 style={S.h3}>Service Description</h3>
      <p style={S.p}>Greet-Me allows users to create and send personalized digital greetings using uploaded photos, voice recordings, AI-generated text, and AI-generated video. Greetings are delivered via email and viewable through a web link.</p>

      <h3 style={S.h3}>User Content &amp; Permissions</h3>
      <p style={S.p}>You represent that you own or have obtained all necessary rights and permissions to submit any photo, voice recording, or other content. You grant Greet-Me a limited, non-exclusive license to process submitted content solely for generating and delivering your requested greetings. We do not claim ownership of your content.</p>

      <h3 style={S.h3}>Voice Cloning Consent</h3>
      <p style={S.p}>By submitting a voice sample, you consent to AI-based voice synthesis to create greeting audio that approximates your voice. You confirm you are submitting your own voice or have obtained explicit permission from the voice owner.</p>

      <h3 style={S.h3}>Payments, Subscriptions &amp; Credits</h3>
      <p style={S.p}>Paid subscriptions are billed through Stripe. Subscription terms, pricing, and renewal periods are displayed at checkout. Credits ($5 courtesy credits, $10 referral credits) are promotional, non-transferable, and may expire. Credits have no cash value and cannot be redeemed for cash. Refund requests should be directed to support@greet-me.com.</p>

      <h3 style={S.h3}>QR Cash&trade; Gifts</h3>
      <p style={S.p}>QR Cash is a digital gifting feature that allows senders to include a monetary gift with a greeting. QR Cash is a gift from sender to recipient, facilitated by Greet-Me using Stripe for payment processing. Greet-Me is not a bank, money transmitter, or stored-value provider. A service fee applies to each gift. Unclaimed gifts expire after 30 days. Greet-Me is not responsible for incorrect payout details provided by recipients.</p>

      <h3 style={S.h3}>Greet One, Give One&trade; (G1G1)</h3>
      <p style={S.p}>Full-price subscription purchases may include a complimentary gift subscription for one recipient. G1G1 gifts are not available on discounted purchases. Gift subscriptions are non-transferable and subject to these Terms.</p>

      <h3 style={S.h3}>Prohibited Use</h3>
      <p style={S.p}>You may not: upload content you do not have rights to use; submit voice recordings of others without their consent; use the service for harassment, spam, or illegal purposes; attempt to circumvent security measures, rate limits, or usage restrictions; create accounts for the purpose of abuse or fraud.</p>

      <h3 style={S.h3}>No Guarantees</h3>
      <p style={S.p}>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, express or implied.</p>

      <h3 style={S.h3}>Limitation of Liability</h3>
      <p style={S.p}>To the maximum extent permitted by law, Greet-Me and its operators shall not be liable for indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, arising from your use of the Service.</p>

      <h3 style={S.h3}>Termination</h3>
      <p style={S.p}>We may suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time by contacting support@greet-me.com.</p>

      <h3 style={S.h3}>Governing Law</h3>
      <p style={S.p}>These Terms are governed by the laws of the State of Florida, United States, without regard to conflict-of-law principles.</p>

      <h3 style={S.h3}>Changes</h3>
      <p style={S.p}>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance. Material changes will be communicated via email or in-app notice.</p>

      <h3 style={S.h3}>Contact</h3>
      <p style={S.p}>Questions: support@greet-me.com</p>

      <hr style={{ margin: “28px 0” }} />
      <a href=”/” style={{ textDecoration: “none” }}>&larr; Back to app</a>
    </div>
  );
}
