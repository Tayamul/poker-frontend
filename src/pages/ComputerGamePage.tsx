import { useEffect, useState } from "react";
import "../App.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

type Card = {
  rank: string | number;
  suit: "Hearts" | "Diamonds" | "Clubs" | "Spades";
};

type Player = {
  id: string;
  name: string;
  chips: number;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  currentBet: number;
};

type GameState = {
  players: Player[];
  currentPlayerId: string;
  dealerPlayerId: string;
  bigBlind: number;
  minimumRaise: number;
  phase: string;
  pot: number;
  communityCards: Card[];
  lastAction?: string | null;
  winnerPlayerIds?: string[];
  winnerPlayerId?: string | null;
  winningHand?: string | null;
};

type PokerAction = "fold" | "check" | "call" | "bet" | "raise";

type PlayingCardProps = {
  card?: Card;
  hidden?: boolean;
};

type PlayerSeatProps = {
  player: Player;
  isYou: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
};

function cardSymbol(card: Card): string {
  const suitSymbols = {
    Hearts: "♥",
    Diamonds: "♦",
    Clubs: "♣",
    Spades: "♠",
  };

  return suitSymbols[card.suit] || card.suit;
}

function cardRankLabel(card: Card): string {
  const rankLabels: Record<string, string> = {
    Ace: "A",
    King: "K",
    Queen: "Q",
    Jack: "J",
    Ten: "10",
    Two: "2",
    Three: "3",
    Four: "4",
    Five: "5",
    Six: "6",
    Seven: "7",
    Eight: "8",
    Nine: "9",
  };

  const rank = String(card.rank);

  return rankLabels[rank] ?? rank;
}

function cardColor(card: Card): string  {
  if (card.suit === "Hearts" || card.suit === "Diamonds") {
    return "red";
  }

  return "black";
}

function PlayingCard({ card, hidden = false }: PlayingCardProps) {
  if (hidden) {
    return (
      <div className="playing-card card-back">
        <div className="card-back-pattern">
          <span>♠</span>
          <span className="back-center">✦</span>
          <span>♠</span>
        </div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  const suit = cardSymbol(card);
  const color = cardColor(card);
  const rank = cardRankLabel(card);

  return (
    <div className={`playing-card ${color}`}>
      <div className="card-corner top-left">
        <span className="corner-rank">{rank}</span>
        <span className="corner-suit">{suit}</span>
      </div>

      <div className="card-center-suit">{suit}</div>

      <div className="card-corner bottom-right">
        <span className="corner-rank">{rank}</span>
        <span className="corner-suit">{suit}</span>
      </div>
    </div>
  );
}

function PlayerSeat({ player, isYou, isCurrentTurn, isDealer }: PlayerSeatProps) {
  return (
    <div
      className={`player-seat ${
        isCurrentTurn ? "current-turn" : ""
      }`}
    >
      <div className="seat-header">
        <div>
          <div className="player-name">
            {player.name}

            {isDealer && (
              <span className="dealer-chip">D</span>
            )}
          </div>

          <div className="player-status">
            {isCurrentTurn
              ? "YOUR TURN"
              : player.folded
              ? "FOLDED"
              : player.allIn
              ? "ALL-IN"
              : "Waiting"}
          </div>
        </div>

        <div className="player-chips">
          🪙 {player.chips}
        </div>
      </div>

      <div className="player-cards">
        {isYou || player.holeCards.length > 0 ? (
          player.holeCards.map((card, index) => (
            <PlayingCard
              key={`${player.id}-${index}`}
              card={card}
            />
          ))
        ) : (
          <>
            <PlayingCard hidden />
            <PlayingCard hidden />
          </>
        )}
      </div>

      <div className="player-bet">
        Street bet: {player.currentBet}
      </div>
    </div>
  );
}

function ComputerGamePage() {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState("");

  const you = game?.players.find(
    (player) => player.id === "player1"
  );

  const opponent = game?.players.find(
    (player) => player.id === "player2"
  );

  const isYourTurn =
    game?.currentPlayerId === "player1";

  const isOpponentTurn =
    game?.currentPlayerId === "player2";

  const currentPlayer =
    game?.players.find(
      (player) =>
        player.id === game?.currentPlayerId
    );

  const highestBet =
    game?.players
      ?.filter((player) => !player.folded)
      .reduce(
        (highest, player) =>
          Math.max(highest, player.currentBet),
        0
      ) ?? 0;

  const amountToCall = you
    ? Math.max(
        0,
        highestBet - you.currentBet
      )
    : 0;

  const bettingRoundHasBet =
    highestBet > (you?.currentBet ?? 0);

  const startGame = async () => {
    setLoading(true);
    setError(null);
    setBetAmount("");

    try {
      const response = await fetch(
        `${API_URL}/api/game/start`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to start game");
      }

      const data = await response.json();

      setGame(data as GameState);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const performAction = async (
    action: PokerAction,
    amount: number | null = null
  ) => {
    setActionLoading(true);
    setError(null);

    try {
      const body: {
        action: PokerAction;
        amount?: number;
      } = {
        action,
      };

      if (amount !== null) {
        body.amount = amount;
      }

      const response = await fetch(
        `${API_URL}/api/game/action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Action failed"
        );
      }

      setGame(data as GameState);
      setBetAmount("");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const submitBetOrRaise = () => {
    const amount = Number(betAmount);

    if (!amount || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }

    if (bettingRoundHasBet) {
      performAction("raise", amount);
    } else {
      performAction("bet", amount);
    }
  };

  useEffect(() => {
    void startGame();
  }, []);

  const minimumBet =
    game?.bigBlind ?? 10;

  const minimumRaise =
    highestBet + (game?.minimumRaise ?? minimumBet);

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Nepalese Poker</h1>
          <p>Texas Hold'em · No Limit</p>
        </div>Play heads-up Texas Hold'em against the table opponent.

        <button
          className="new-game-button"
          onClick={startGame}
          disabled={loading || actionLoading}
        >
          {loading ? "Starting..." : "New Game"}
        </button>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button
            onClick={() => setError(null)}
          >
            ×
          </button>
        </div>
      )}

      {!game ? (
        <main className="welcome-screen">
            <div className="welcome-card">
            <div className="poker-logo">♠</div>
            <h2>Welcome to Nepalese Poker</h2>
            <p>Starting your computer game...</p>
            {loading && <p>Please wait...</p>}
            {error && (
                <button className="start-button" onClick={() => void startGame()}>
                Try again
                </button>
            )}
            </div>
        </main>
      ) : (
        <main className="poker-table-wrapper">
          <div className="poker-table">

            <div className="table-header">
              <div className="phase">
                {game.phase}
              </div>

              <div className="pot-display">
                <span>Pot</span>
                <strong>🪙 {game.pot}</strong>
              </div>
            </div>

            <div className="opponent-area">
              {opponent && (
                <PlayerSeat
                  player={opponent}
                  isYou={false}
                  isCurrentTurn={
                    game.currentPlayerId ===
                    opponent.id
                  }
                  isDealer={
                    game.dealerPlayerId ===
                    opponent.id
                  }
                />
              )}
            </div>

            <div className="community-area">

              <div className="community-label">
                Community Cards
              </div>

              <div className="community-cards">
                {game.communityCards.map(
                  (card, index) => (
                    <PlayingCard
                      key={`community-${index}`}
                      card={card}
                    />
                  )
                )}

                {Array.from({
                  length:
                    5 -
                    game.communityCards.length,
                }).map((_, index) => (
                  <div
                    className="empty-card"
                    key={`empty-${index}`}
                  />
                ))}
              </div>

              <div className="table-message">
                {game.lastAction ||
                  "The hand has started"}
              </div>
            </div>

            <div className="your-area">
              {you && (
                <PlayerSeat
                  player={you}
                  isYou={true}
                  isCurrentTurn={isYourTurn}
                  isDealer={
                    game.dealerPlayerId ===
                    you.id
                  }
                />
              )}
            </div>

            {game.phase === "Complete" ? (
              <div className="showdown-panel">

                <div className="showdown-title">
                  {(game.winnerPlayerIds?.length ?? 0) > 1
                    ? "Split Pot"
                    : "Winner"}
                </div>

                <div className="winner-name">
                  {(game.winnerPlayerIds?.length ?? 0) > 1
                    ? "It's a tie!"
                    : game.winnerPlayerId ===
                      "player1"
                    ? "You win!"
                    : "Opponent wins"}
                </div>

                {game.winningHand && (
                  <div className="winning-hand">
                    {game.winningHand}
                  </div>
                )}

                <button
                  className="start-button"
                  onClick={startGame}
                >
                  Play Again
                </button>
              </div>
            ) : (
              <div className="action-panel">

                <div className="turn-message">
                  {isYourTurn
                    ? "Your turn"
                    : `${currentPlayer?.name || "Opponent"}'s turn`}
                </div>

                {isYourTurn && (
                  <>
                    <div className="action-buttons">

                      <button
                        className="action-button fold"
                        disabled={actionLoading}
                        onClick={() =>
                          performAction("fold")
                        }
                      >
                        Fold
                      </button>

                      {!bettingRoundHasBet ? (
                        <button
                          className="action-button"
                          disabled={actionLoading}
                          onClick={() =>
                            performAction("check")
                          }
                        >
                          Check
                        </button>
                      ) : (
                        <button
                          className="action-button"
                          disabled={
                            actionLoading ||
                            amountToCall >
                              (you?.chips ?? 0)
                          }
                          onClick={() =>
                            performAction("call")
                          }
                        >
                          Call {amountToCall}
                        </button>
                      )}

                    </div>

                    <div className="bet-controls">

                      <div className="bet-input-group">
                        <label>
                          {bettingRoundHasBet
                            ? "Raise to"
                            : "Bet"}
                        </label>

                        <input
                          type="number"
                          min={
                            bettingRoundHasBet
                              ? minimumRaise
                              : minimumBet
                          }
                          max={
                            you?.chips ?? 0
                          }
                          value={betAmount}
                          onChange={(event) =>
                            setBetAmount(
                              event.target.value
                            )
                          }
                          placeholder={
                            bettingRoundHasBet
                              ? String(
                                  minimumRaise
                                )
                              : String(
                                  minimumBet
                                )
                          }
                        />
                      </div>

                      <button
                        className="action-button primary"
                        disabled={
                          actionLoading ||
                          !betAmount
                        }
                        onClick={
                          submitBetOrRaise
                        }
                      >
                        {bettingRoundHasBet
                          ? "Raise"
                          : "Bet"}
                      </button>

                    </div>

                    <div className="bet-hint">
                      {bettingRoundHasBet
                        ? `Minimum raise: ${minimumRaise}`
                        : `Minimum bet: ${minimumBet}`}
                    </div>
                  </>
                )}

                {isOpponentTurn && (
                  <div className="opponent-thinking">
                    <span className="thinking-dot" />
                    Opponent is thinking...
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

export default ComputerGamePage;