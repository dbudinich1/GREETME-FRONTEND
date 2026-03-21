// MINIMAL TEST — prove route works
import { useSearchParams } from 'react-router-dom';

export default function ThankYouFlow() {
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>ThankYouFlow Works</h1>
      <p>jobId: {jobId || 'missing'}</p>
      <p>If you see this, the route is working.</p>
    </div>
  );
}
