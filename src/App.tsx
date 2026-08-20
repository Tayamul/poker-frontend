import PlayingCard from "./components/PlayingCard";
import "./App.css";


function App() {
  return (
    <div className="game">
      <header className="game-header">
        <h1>♠ Nepalese Poker ♥</h1>
        <p>Private Table</p>
      </header>

      <main className="poker-table">

        {/* Top player */}
        <div className="player player-top">
          <div className="avatar">P2</div>
          <div className="player-info">
            <h2>Player 2</h2>
            <p>💰 1,000</p>
          </div>
        </div>

        {/* Left player */}
        <div className="player player-left">
          <div className="avatar">P1</div>
          <div className="player-info">
            <h2>Player 1</h2>
            <p>💰 1,000</p>
          </div>
        </div>

        {/* Right player */}
        <div className="player player-right">
          <div className="avatar">P3</div>
          <div className="player-info">
            <h2>Player 3</h2>
            <p>💰 1,000</p>
          </div>
        </div>

        {/* Poker table centre */}
        <div className="table-centre">

          <div className="pot">
            <span>Pot</span>
            <strong>💰 500</strong>
          </div>

          <div className="community-cards">
            <div className="card-placeholder">?</div>
            <div className="card-placeholder">?</div>
            <div className="card-placeholder">?</div>
            <div className="card-placeholder">?</div>
            <div className="card-placeholder">?</div>
          </div>

        </div>

        {/* Your player */}
        <div className="player player-bottom active-player">
          <div className="avatar">YOU</div>
          <div className="player-info">
            <h2>You</h2>
            <p>💰 1,000</p>
          </div>
        </div>

        {/* Your cards */}
        <div className="hand">

          <PlayingCard rank="A" suit="♥"/>
          <PlayingCard rank="10" suit="♠"/>
          <PlayingCard rank="A" suit="♥" />
          <PlayingCard rank="K" suit="♠" />
          <PlayingCard rank="10" suit="♦" />
          <PlayingCard rank="5" suit="♣" />

        </div>

        {/* Betting controls */}
        <div className="controls">
          <button className="fold-button">Fold</button>
          <button className="check-button">Check</button>
          <button className="bet-button">Bet</button>
        </div>

      </main>
    </div>
  );
}

export default App;