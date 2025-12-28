export default function Legal() {
  return (
    <div style={{ padding: 40, fontFamily: "system-ui, Arial, sans-serif", maxWidth: 900 }}>
      <h1 style={{ marginBottom: 10 }}>Legal</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        Last updated: {new Date().toISOString().slice(0, 10)}
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>Privacy Policy</h2>
      <p>
        Greet-Me.com respects your privacy. This Privacy Policy explains how we collect, use, and
        handle information when you use our service.
      </p>

      <h3>Information We Collect</h3>
      <p>We collect information that you voluntarily provide, including:</p>
      <ul>
        <li>Recipient name and email address</li>
        <li>Greeting text and optional notes</li>
        <li>Photos and content you upload for greeting creation</li>
      </ul>
      <p>We do not require user accounts to use the service.</p>

      <h3>How We Use Information</h3>
      <p>
        Information you provide is used solely to generate personalized greetings, deliver greetings
        to the intended recipient, and operate and improve the Greet-Me service.
      </p>
      <p>
        Uploaded content may be processed by automated systems to generate audio and video greetings.
      </p>

      <h3>Third-Party Services</h3>
      <p>
        We use trusted third-party services to process media and deliver emails. These services only
        receive the information necessary to perform their function.
      </p>

      <h3>Data Retention</h3>
      <p>We retain information only as long as necessary to provide the service and operate the platform.</p>

      <h3>Your Responsibility</h3>
      <p>
        You are responsible for ensuring you have the right to upload and use any content submitted
        through the service.
      </p>

      <h3>Contact</h3>
      <p>For questions about this policy, contact: support@greet-me.com</p>

      <hr style={{ margin: "28px 0" }} />

      <h2>Terms of Service</h2>
      <p>By using Greet-Me.com, you agree to the following terms.</p>

      <h3>Service Description</h3>
      <p>Greet-Me allows users to create and send personalized digital greetings using submitted content.</p>

      <h3>User Content &amp; Permissions</h3>
      <p>
        You represent and warrant that you own or have obtained all necessary rights and permissions
        to submit any photo, voice, or content used with the service.
      </p>
      <p>
        You grant Greet-Me permission to process submitted content solely for the purpose of generating
        and delivering the requested greeting.
      </p>

      <h3>Prohibited Use</h3>
      <p>
        You may not use the service to upload content you do not have permission to use, or to violate
        the rights of others.
      </p>

      <h3>No Guarantees</h3>
      <p>The service is provided “as is” without warranties of any kind.</p>

      <h3>Limitation of Liability</h3>
      <p>Greet-Me is not liable for damages arising from use of the service or from content submitted by users.</p>

      <h3>Changes</h3>
      <p>These terms may be updated from time to time.</p>

      <h3>Contact</h3>
      <p>Questions regarding these terms may be sent to: support@greet-me.com</p>

      <hr style={{ margin: "28px 0" }} />

      <a href="/" style={{ textDecoration: "none" }}>← Back to app</a>
    </div>
  );
}
