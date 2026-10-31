
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../App.css";

const API_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const SESSION_PREFIX = "nepalese-poker-room:";

type Card = {
  rank: string;
  suit: string;
};

type RoomPlayer = {
  id: string;
  name: string;
};

type RoomCredentials = {
  roomCode: string;
  playerId: string;
  playerToken: string;
};

type GamePlayer = RoomPlayer & {
  chips: number;
  currentBet: number;
  toCall?: number;
  folded: boolean;
  allIn: boolean;
  holeCards: Card[];
  holeCardsCount?: number;
};

type LegalActions = {
  playerId?: string;
  actions?: string[];
  toCall?: number;
  minBet?: number;
  maxBet?: number;
  minRaiseTo?: number;
  maxRaiseTo?: number;
};

type RecordedAction = {
  type: "Fold" | "Check" | "Call" | "Bet" | "Raise";
  amount?: number;
};

type ActionHistoryEntry = {
  playerId: string;
  playerName: string;
  phase: string;
  action: RecordedAction;
  potBefore: number;
  communityCards: Card[];
};

type GameState = {
  phase: string;
  pot: number;
  players: GamePlayer[];
  communityCards: Card[];
  dealerPlayerId: string;
  currentPlayerId?: string | null;
  bigBlind?: number;
  minimumRaise?: number;
  lastAction?: string;
  winnerPlayerId?: string | null;
  winnerPlayerIds?: string[];
  winningHand?: string;
  legalActions?: LegalActions;
  actionHistory?: ActionHistoryEntry[];
};

type RoomData = {
  code: string;
  hostPlayerId: string;
  started: boolean;
  players: RoomPlayer[];
  game?: GameState | null;
  revealDeadlineEpochMillis?: number | null;
  revealedPlayerIds?: string[];
  sessionOver?: boolean;
  sessionWinnerPlayerId?: string | null;
  handNumber?: number;
  eliminatedPlayerIds?: string[];
  restartVotes?: string[];
};

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "The request failed.");
  }

  return data as T;
}

function cardSymbol(card: Card): string {
  const symbols: Record<string, string> = {
    Hearts: "♥",
    Diamonds: "♦",
    Clubs: "♣",
    Spades: "♠",
  };

  return symbols[card.suit] || card.suit;
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

function PlayingCard({
  card,
  hidden = false,
}: {
  card?: Card;
  hidden?: boolean;
}) {
  if (hidden || !card) {
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

  const color =
    card.suit === "Hearts" || card.suit === "Diamonds"
      ? "red"
      : "black";

  const suit = cardSymbol(card);
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

function PlayerSeat({
  player,
  isYou,
  isCurrentTurn,
  isDealer,
  isSpectator = false,
}: {
  player: GamePlayer;
  isYou: boolean;
  isCurrentTurn: boolean;
  isDealer: boolean;
  isSpectator?: boolean;
}) {
  const cardCount = Math.max(
    0,
    Math.min(2, player.holeCardsCount ?? 2),
  );

  return (
    <div
      className={`player-seat ${isCurrentTurn ? "current-turn" : ""}`}
    >
      <div className="seat-header">
        <div>
          <div className="player-name">
            {player.name}
            {isYou && <span> (You)</span>}
            {isDealer && <span className="dealer-chip">D</span>}
          </div>

          <div className="player-status">
            {isSpectator
              ? "SPECTATING · ELIMINATED"
              : player.folded
                ? "FOLDED"
                : player.allIn
                  ? "ALL-IN"
                  : isCurrentTurn
                    ? "YOUR TURN"
                    : "Waiting"}
          </div>
        </div>

        <div className="player-chips">🪙 {player.chips}</div>
      </div>

      <div className="player-cards">
        {player.holeCards.length > 0
          ? player.holeCards.map((card, index) => (
              <PlayingCard
                key={`${player.id}-${index}`}
                card={card}
              />
            ))
          : Array.from({ length: cardCount }, (_, index) => (
              <PlayingCard
                key={`${player.id}-hidden-${index}`}
                hidden
              />
            ))}
      </div>

      <div className="player-bet">
        Street bet: {player.currentBet}
      </div>
    </div>
  );
}

// function describeAction(entry: ActionHistoryEntry): string {
//   const { playerName, action } = entry;

//   switch (action.type) {
//     case "Fold":
//       return `${playerName} folded`;

//     case "Check":
//       return `${playerName} checked`;

//     case "Call":
//       return action.amount != null
//         ? `${playerName} called ${action.amount}`
//         : `${playerName} called`;

//     case "Bet":
//       return `${playerName} bet ${action.amount ?? 0}`;

//     case "Raise":
//       return `${playerName} raised to ${action.amount ?? 0}`;
//   }
// }

function formatTableMessage(
  lastAction: string | undefined,
  phase: string,
): string {
  if (!lastAction) {
    switch (phase) {
      case "PreFlop":
        return "New hand started — pre-flop betting begins.";
      case "Flop":
        return "The flop is out! Three community cards are revealed.";
      case "Turn":
        return "The turn is out! The fourth community card is revealed.";
      case "River":
        return "The river is out! The final community card is revealed.";
      case "Showdown":
        return "Showdown — let's see who has the winning hand!";
      case "Complete":
        return "Hand complete.";
      default:
        return "The hand is in progress.";
    }
  }

  const message = lastAction.trim();

  // Keep existing game-engine messages, but make them easier to read.
  if (/^hand complete/i.test(message)) {
    return `🏁 ${message}`;
  }

  if (/^showdown/i.test(message)) {
    return `🃏 ${message}`;
  }

  if (/^.*\b(folded)\b/i.test(message)) {
    return `👋 ${message}`;
  }

  if (/^.*\b(checked)\b/i.test(message)) {
    return `✓ ${message}`;
  }

  if (/^.*\b(called)\b/i.test(message)) {
    return `🪙 ${message}`;
  }

  if (/^.*\b(bet|bets|raised|raises|raise)\b/i.test(message)) {
    return `💰 ${message}`;
  }

  return message;
}

export default function OnlineGamePage() {
  const { code } = useParams();
  const roomCode = code ?? "";

  const [credentials, setCredentials] =
    useState<RoomCredentials | null>(null);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [betAmount, setBetAmount] = useState("");
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(
  null,
);

  const inFlightRef = useRef(false);

  // Recover this browser's private player credentials from the lobby.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(
        `${SESSION_PREFIX}${roomCode}`,
      );

      if (stored) {
        const parsed = JSON.parse(stored) as RoomCredentials;

        if (
          parsed.roomCode === roomCode &&
          parsed.playerId &&
          parsed.playerToken
        ) {
          setCredentials(parsed);
        }
      }
    } catch {
      setError("Could not read your room credentials. Return to the lobby.");
    } finally {
      setCredentialsLoaded(true);
    }
  }, [roomCode]);

  const refreshRoom = useCallback(async () => {
    if (!credentials || inFlightRef.current) return;

    inFlightRef.current = true;

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(roomCode)}`,
        {
          headers: {
            "X-Player-Id": credentials.playerId,
          },
        },
      );

      const data = await readResponse<RoomData>(response);
      setRoom(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the online game.",
      );
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [credentials, roomCode]);

  // Each browser refreshes the shared room state every two seconds.
  useEffect(() => {
    if (!credentials) {
      setLoading(false);
      return;
    }

    let active = true;

    const refresh = async () => {
      if (!active || inFlightRef.current) return;

      await refreshRoom();
    };

    void refresh();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [credentials, refreshRoom]);


  // Countdown feature
  useEffect(() => {
    const deadline = room?.revealDeadlineEpochMillis;

    if (
      !room?.started ||
      room.sessionOver ||
      deadline == null ||
      !Number.isFinite(deadline)
    ) {
      setCountdownSeconds(null);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000),
      );

      setCountdownSeconds(remaining);
    };

    updateCountdown();

    const timerId = window.setInterval(updateCountdown, 250);

    return () => window.clearInterval(timerId);
  }, [
    room?.started,
    room?.sessionOver,
    room?.revealDeadlineEpochMillis,
  ]);


  const game = room?.game ?? null;

  const you = game?.players.find(
    (player) => player.id === credentials?.playerId,
  );

  const roomPlayer = room?.players.find(
    (player) => player.id === credentials?.playerId,
  );

  const isSpectator =
    Boolean(roomPlayer) &&
    Boolean(room?.started) &&
    !you &&
    !room?.sessionOver;

  const currentPlayer = game?.players.find(
    (player) => player.id === game.currentPlayerId,
  );

  const opponents: GamePlayer[] =
    (game?.players.filter(
      (player) => player.id !== credentials?.playerId,
    ) ?? []).concat(
      (room?.players ?? [])
        .filter(
          (player) =>
            player.id !== credentials?.playerId &&
            !game?.players.some((gamePlayer) => gamePlayer.id === player.id),
        )
        .map((player) => ({
          ...player,
          chips: 0,
          currentBet: 0,
          folded: true,
          allIn: false,
          holeCards: [],
          holeCardsCount: 0,
        })),
    );

  const highestBet =
    game?.players.reduce(
      (highest, player) => Math.max(highest, player.currentBet),
      0,
    ) ?? 0;

  const amountToCall = you
    ? Math.max(0, highestBet - you.currentBet)
    : 0;

  const legalActions = game?.legalActions;
  const actionNames = (legalActions?.actions ?? []).map(
    (action) => action.toLowerCase(),
  );

  const hasLegalAction = (action: string) =>
    actionNames.includes(action);

  const isYourTurn =
    Boolean(game && you) &&
    game?.currentPlayerId === credentials?.playerId;

  const isFinished =
    game?.phase === "Showdown" || game?.phase === "Complete";

  const canCheck =
    hasLegalAction("check") ||
    (!actionNames.length && amountToCall === 0);

  const canCall =
    hasLegalAction("call") ||
    (!actionNames.length && amountToCall > 0);

  const canBet =
    hasLegalAction("bet") ||
    (!actionNames.length && highestBet === 0);

  const canRaise =
    hasLegalAction("raise") ||
    (!actionNames.length && highestBet > 0);

  const minimumBet =
    legalActions?.minBet ?? game?.bigBlind ?? 10;

  const minimumRaiseTo =
    legalActions?.minRaiseTo ??
    highestBet + (game?.minimumRaise ?? minimumBet);

  const maximumWager = canRaise
    ? (legalActions?.maxRaiseTo ?? highestBet + (you?.chips ?? 0))
    : (legalActions?.maxBet ?? you?.chips ?? 0);

  const performAction = async (
    action: string,
    amount?: number,
  ) => {
    if (!credentials || actionLoading || inFlightRef.current) return;

    setActionLoading(true);
    setError("");
    inFlightRef.current = true;

    try {
      const body: {
        playerId: string;
        playerToken: string;
        action: string;
        amount?: number;
      } = {
        playerId: credentials.playerId,
        playerToken: credentials.playerToken,
        action,
      };

      if (amount !== undefined) {
        body.amount = amount;
      }

      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(roomCode)}/action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await readResponse<RoomData>(response);
      setRoom(data);
      setBetAmount("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your action failed.",
      );
    } finally {
      inFlightRef.current = false;
      setActionLoading(false);
    }
  };

  const submitBetOrRaise = () => {
    const amount = Number(betAmount);
    const minimum = canRaise ? minimumRaiseTo : minimumBet;

    if (
      !Number.isInteger(amount) ||
      amount <= 0 ||
      amount < minimum ||
      amount > maximumWager
    ) {
      setError(
        `Enter a whole-number amount between ${minimum} and ${maximumWager}.`,
      );
      return;
    }

    void performAction(canRaise ? "raise" : "bet", amount);
  };

  const revealCards = async () => {
    if (!credentials || inFlightRef.current) return;

    setError("");
    inFlightRef.current = true;

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(roomCode)}/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: credentials.playerId,
            playerToken: credentials.playerToken,
          }),
        },
      );

      const data = await readResponse<RoomData>(response);
      setRoom(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not reveal your cards.",
      );
    } finally {
      inFlightRef.current = false;
    }
  };

  const voteToRestart = async () => {
    if (!credentials || inFlightRef.current || actionLoading) return;

    setActionLoading(true);
    setError("");
    inFlightRef.current = true;

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(roomCode)}/restart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            playerId: credentials.playerId,
            playerToken: credentials.playerToken,
          }),
        },
      );

      const data = await readResponse<RoomData>(response);
      setRoom(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not vote to restart the session.",
      );
    } finally {
      inFlightRef.current = false;
      setActionLoading(false);
    }
  };

  if (!credentialsLoaded || loading) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <div className="poker-logo">♠</div>
          <h2>Loading online game</h2>
          <p>Connecting to room {roomCode}…</p>
        </div>
      </main>
    );
  }

  if (!credentials) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <h2>Player session not found</h2>
          <p>
            This browser does not have the credentials for room {roomCode}.
            Return to the lobby and join with your player name.
          </p>
          <Link className="start-button" to={`/room/${roomCode}`}>
            Return to lobby
          </Link>
          {error && <p className="error-message">{error}</p>}
        </div>
      </main>
    );
  }

  if (
    !room ||
    !game ||
    (!you && !isSpectator && !room.sessionOver)
  ) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <h2>Unable to load your game</h2>
          <p>{error || "Your player or game was not found in this room."}</p>
          <button
            className="start-button"
            onClick={() => void refreshRoom()}
          >
            Try again
          </button>
          <p>
            <Link to={`/room/${roomCode}`}>Back to lobby</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div>
          <h1>Nepalese Poker</h1>
          <p>Texas Hold'em · No Limit · Room {room.code}</p>
        </div>
        <Link className="new-game-button" to={`/room/${roomCode}`}>
          Room lobby
        </Link>
      </header>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      <main className="poker-table-wrapper">
        <div className="poker-table">
          <div className="table-header">
            <div className="phase">{game.phase}</div>
            <div className="pot-display">
              <span>Pot</span>
              <strong>🪙 {game.pot}</strong>
            </div>
          </div>

          <div className="opponent-area">
            {opponents.map((player) => {
              const isEliminated =
                room.eliminatedPlayerIds?.includes(player.id) ?? false;

              return (
                <PlayerSeat
                  key={player.id}
                  player={player}
                  isYou={false}
                  isCurrentTurn={
                    !isEliminated && game.currentPlayerId === player.id
                  }
                  isDealer={game.dealerPlayerId === player.id}
                  isSpectator={isEliminated}
                />
              );
            })}
          </div>

          <div className="community-area">
            <div className="community-label">Community Cards</div>

            <div className="community-cards">
              {game.communityCards.map((card, index) => (
                <PlayingCard key={`community-${index}`} card={card} />
              ))}

              {Array.from(
                { length: Math.max(0, 5 - game.communityCards.length) },
                (_, index) => (
                  <div className="empty-card" key={`empty-${index}`} />
                ),
              )}
            </div>

            {countdownSeconds === null && (
              <div className="table-message" aria-live="polite">
                {formatTableMessage(game.lastAction, game.phase)}
              </div>
            )}
            
            {countdownSeconds !== null && (
              <div className="next-hand-countdown" role="timer" aria-live="off">
                <span className="next-hand-countdown-label">
                  GET READY FOR THE NEXT HAND
                </span>

                <strong>
                  {String(Math.floor(countdownSeconds / 60)).padStart(2, "0")}:
                  {String(countdownSeconds % 60).padStart(2, "0")}
                </strong>

                <span className="next-hand-countdown-hint">
                  Reveal your cards and discuss the hand.
                </span>
              </div>
            )}
          </div>

          <div className="your-area">
            {you ? (
              <PlayerSeat
                player={you}
                isYou
                isCurrentTurn={isYourTurn}
                isDealer={game.dealerPlayerId === you.id}
              />
            ) : (
              <div className="player-seat spectator-seat">
                <div className="seat-header">
                  <div>
                    <div className="player-name">
                      {roomPlayer?.name ?? "You"} (Spectator)
                    </div>
                    <div className="player-status">
                      SPECTATING · ELIMINATED
                    </div>
                  </div>
                </div>

                <p className="spectator-message">
                  You've run out of chips. You can watch the remaining hands until the
                  session ends.
                </p>
              </div>
            )}
          </div>

          {room.sessionOver ? (
            <div className="showdown-panel restart-panel">
              <div className="showdown-title">Session Finished</div>

              <div className="winner-name">
                {room.sessionWinnerPlayerId === credentials.playerId
                  ? "You won the session!"
                  : `${
                      room.players.find(
                        (player) => player.id === room.sessionWinnerPlayerId,
                      )?.name ?? "Another player"
                    } won the session.`}
              </div>

              <p>
                {room.restartVotes?.length ?? 0} of {room.players.length} players
                voted to play again.
              </p>

              {room.restartVotes?.includes(credentials.playerId) ? (
                <p>You've voted to play again. Waiting for everyone else…</p>
              ) : (
                <button
                  className="start-button"
                  disabled={actionLoading}
                  onClick={() => void voteToRestart()}
                >
                  {actionLoading ? "Submitting vote…" : "Play Again"}
                </button>
              )}
            </div>
          ) : isFinished ? (
            <div className="showdown-panel">
              <div className="showdown-title">
                {game.phase === "Showdown" ? "Showdown" : "Hand Complete"}
              </div>

              {game.winnerPlayerIds && game.winnerPlayerIds.length > 1 ? (
                <div className="winner-name">
                  Split pot:{" "}
                  {game.winnerPlayerIds
                    .map(
                      (winnerId) =>
                        game.players.find((player) => player.id === winnerId)?.name ??
                        "Unknown player",
                    )
                    .join(" and ")}
                </div>
              ) : (
                <div className="winner-name">
                  {game.winnerPlayerId
                    ? game.players.find(
                        (player) => player.id === game.winnerPlayerId,
                      )?.name ?? "Winner"
                    : "Hand finished"}
                  {game.winnerPlayerId === credentials.playerId
                    ? " — You won!"
                    : ""}
                </div>
              )}

              {game.winningHand && (
                <p className="winning-hand">{game.winningHand}</p>
              )}

              {game.lastAction && (
                <p className="showdown-action">{game.lastAction}</p>
              )}

              {room.revealedPlayerIds?.includes(credentials.playerId) ? (
                <div className="reveal-confirmation" role="status">
                  <strong>
                    <span aria-hidden="true">✓</span> Cards revealed
                  </strong>
                  <span>Your cards are now visible to other players.</span>
                </div>
              ) : (
                <button
                  className="start-button"
                  disabled={actionLoading}
                  onClick={() => void revealCards()}
                >
                  Reveal Cards
                </button>
              )}

              {room.sessionOver && (
                <div className="showdown-panel restart-panel">
                  <div className="showdown-title">Session Finished</div>

                  <div className="winner-name">
                    {room.sessionWinnerPlayerId === credentials.playerId
                      ? "You won the session!"
                      : `${
                          room.players.find(
                            (player) => player.id === room.sessionWinnerPlayerId,
                          )?.name ?? "Another player"
                        } won the session.`}
                  </div>

                  <p>
                    {room.restartVotes?.length ?? 0} of {room.players.length} players
                    voted to play again.
                  </p>

                  {room.restartVotes?.includes(credentials.playerId) ? (
                    <p>You've voted to play again. Waiting for everyone else…</p>
                  ) : (
                    <button
                      className="start-button"
                      disabled={actionLoading}
                      onClick={() => void voteToRestart()}
                    >
                      {actionLoading ? "Submitting vote…" : "Play Again"}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="action-panel">
              <div className="turn-message">
                {isSpectator
                  ? "Spectator mode — watch the hand"
                  : isYourTurn
                    ? "Your turn"
                    : `${currentPlayer?.name ?? "Waiting for a player"}'s turn`}
              </div>

              {isYourTurn && (
                <>
                  <div className="action-buttons">
                    <button
                      className="action-button fold"
                      disabled={actionLoading || !hasLegalAction("fold")}
                      onClick={() => void performAction("fold")}
                    >
                      Fold
                    </button>

                    {canCheck ? (
                      <button
                        className="action-button"
                        disabled={actionLoading}
                        onClick={() => void performAction("check")}
                      >
                        Check
                      </button>
                    ) : (
                      <button
                        className="action-button"
                        disabled={
                          actionLoading ||
                          !canCall ||
                          amountToCall > (you?.chips ?? 0)
                        }
                        onClick={() => void performAction("call")}
                      >
                        Call {amountToCall}
                      </button>
                    )}
                  </div>

                  {(canBet || canRaise) && (
                    <>
                      <div className="bet-controls">
                        <div className="bet-input-group">
                          <label htmlFor="online-bet-amount">
                            {canRaise ? "Raise to" : "Bet"}
                          </label>
                          <input
                            id="online-bet-amount"
                            type="number"
                            min={canRaise ? minimumRaiseTo : minimumBet}
                            max={maximumWager}
                            step={1}
                            value={betAmount}
                            onChange={(event) =>
                              setBetAmount(event.target.value)
                            }
                            placeholder={String(
                              canRaise ? minimumRaiseTo : minimumBet,
                            )}
                          />
                        </div>

                        <button
                          className="action-button primary"
                          disabled={actionLoading || !betAmount}
                          onClick={submitBetOrRaise}
                        >
                          {canRaise ? "Raise" : "Bet"}
                        </button>
                      </div>

                      <div className="bet-hint">
                        Minimum {canRaise ? "raise to" : "bet"}:{" "}
                        {canRaise ? minimumRaiseTo : minimumBet}
                        {" · "}Maximum: {maximumWager}
                      </div>
                    </>
                  )}
                </>
              )}

              {!isYourTurn && (
                <div className="opponent-thinking">
                  <span className="thinking-dot" />
                  {isSpectator
                    ? "You're watching the remaining players."
                    : "Waiting for the other players…"}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
