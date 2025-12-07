import './LandingPage.css';

interface LandingPageProps {
  onStart?: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="landing-page">
      <main className="landing-content">
        <h1 className="headline">Chalkboard</h1>
        <p className="subheader">
          Speak your thoughts. Draw your work. Get unstuck.
        </p>
        <button className="cta-button" onClick={onStart}>
          Start Learning
        </button>
      </main>
    </div>
  );
}
