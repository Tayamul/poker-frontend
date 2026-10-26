import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="welcome-screen">
      <div className="welcome-card">
        <div className="poker-logo">♠</div>
        <h2>Welcome to Nepalese Poker</h2>
        <p>Texas Hold'em · No Limit</p>

        <div className="home-menu">
            <Link className="start-button" to="/computer">
                Play against a computer
            </Link>

            <Link className="start-button" to="/room/new">
                Play online
            </Link>

            <Link className="start-button" to="/room/join">
                Join a game
            </Link>
        </div>
      </div>
    </main>
  );
}