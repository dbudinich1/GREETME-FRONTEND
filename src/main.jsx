import React from "react";
import ReactDOM from "react-dom/client";

// TEMPORARY DIAGNOSTIC — remove after confirming Safari executes bundle
ReactDOM.createRoot(document.getElementById("root")).render(
  <div style={{ padding: '4rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
    <h1 style={{ color: '#10b981' }}>Greet-Me Boot Test</h1>
    <p>If you can see this, the JS bundle is executing correctly.</p>
    <p style={{ fontSize: '0.75rem', color: '#999' }}>{navigator.userAgent}</p>
  </div>
);
