import './LandingPage.css';

interface LandingPageProps {
  onStart?: () => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="landing-page">
      <main className="landing-content">
        <h1 className="headline">Chalkboard</h1>
        <p className="tagline">
          Your AI math tutor that sees what you write,
          hears what you say, and guides you to understanding.
        </p>
        <button className="cta-button" onClick={onStart}>
          Start Learning
        </button>
      </main>
    </div>
  );
}
