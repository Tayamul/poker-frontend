import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "../App.css";

const API_URL = "http://localhost:8080";
const SESSION_PREFIX = "nepalese-poker-room:";

type RoomPlayer = {
  id: string;
  name: string;
};

type RoomCredentials = {
  roomCode: string;
  playerId: string;
  playerToken: string;
  hostPlayerId: string;
};

type RoomData = {
  code: string;
  hostPlayerId: string;
  started: boolean;
  players: RoomPlayer[];
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.text();

  let data: unknown;
  try {
    data = body ? JSON.parse(body) : {};
  } catch {
    throw new Error(body || `Request failed (${response.status})`);
  }

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return data as T;
}

export default function LobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const routeCode = code ?? "new";
  const isCreating = routeCode.toLowerCase() === "new";
  const isJoining = routeCode.toLowerCase() === "join";
  const isEntryPage = isCreating || isJoining;

  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState(
    !isEntryPage ? routeCode : "",
  );
  const [credentials, setCredentials] =
    useState<RoomCredentials | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const saveCredentials = (value: RoomCredentials) => {
    sessionStorage.setItem(
      `${SESSION_PREFIX}${value.roomCode}`,
      JSON.stringify(value),
    );
    setCredentials(value);
  };

  const enterRoom = useCallback(
    async (roomCode: string, playerId: string) => {
      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(roomCode)}`,
        {
          headers: { "X-Player-Id": playerId },
        },
      );

      const data = await readResponse<RoomData>(response);
      setRoom(data);

      if (data.started) {
        navigate(`/online/${data.code}`, { replace: true });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (isEntryPage) return;

    const normalizedCode = routeCode.trim();
    const saved = sessionStorage.getItem(
      `${SESSION_PREFIX}${normalizedCode}`,
    );

    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as RoomCredentials;
      setCredentials(parsed);
      setError("");
    } catch {
      sessionStorage.removeItem(
        `${SESSION_PREFIX}${normalizedCode}`,
      );
    }
  }, [isEntryPage, routeCode]);

  useEffect(() => {
    if (isEntryPage || !credentials) return;

    let active = true;

    let hasObservedWaitingRoom = false;
    const refreshRoom = async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${encodeURIComponent(credentials.roomCode)}`,
          {
            headers: { "X-Player-Id": credentials.playerId },
          },
        );

        const data = await readResponse<RoomData>(response);

        if (!active) return;

        setRoom(data);
        setError("");

        if (!data.started) {
            hasObservedWaitingRoom = true;
        } else if (hasObservedWaitingRoom) {
            navigate(`/online/${data.code}`, { replace: true });
        }

      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to refresh the room.",
          );
        }
      }
    };

    void refreshRoom();

    const intervalId = window.setInterval(() => {
      void refreshRoom();
    }, 2000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [credentials, isEntryPage, navigate]);

  const submitRoomRequest = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    const targetCode = isCreating
      ? ""
      : joinCode.trim();

    if (!isCreating && !targetCode) {
      setError("Please enter a room code.");
      return;
    }

    setLoading(true);

    try {
      const endpoint = isCreating
        ? `${API_URL}/api/rooms`
        : `${API_URL}/api/rooms/${encodeURIComponent(targetCode)}/join`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });

      const data = await readResponse<{
        code: string;
        playerId: string;
        playerToken: string;
        hostPlayerId: string;
      }>(response);

      const savedCredentials: RoomCredentials = {
        roomCode: data.code,
        playerId: data.playerId,
        playerToken: data.playerToken,
        hostPlayerId: data.hostPlayerId,
      };

      saveCredentials(savedCredentials);
      navigate(`/room/${data.code}`, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create or join the room.",
      );
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!credentials || !room) return;

    setError("");
    setStarting(true);

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${encodeURIComponent(credentials.roomCode)}/start`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: credentials.playerId,
            playerToken: credentials.playerToken,
          }),
        },
      );

      await readResponse<RoomData>(response);
      navigate(`/online/${credentials.roomCode}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start the game.",
      );
    } finally {
      setStarting(false);
    }
  };

  const isHost =
    !!credentials &&
    !!room &&
    room.hostPlayerId === credentials.playerId;

  const canStart =
    isHost &&
    !!room &&
    room.players.length >= 2 &&
    room.players.length <= 4 &&
    !room.started;

  if (!isEntryPage && !credentials) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <div className="poker-logo">♠</div>
          <h2>Join room {routeCode}</h2>
          <p>Enter your name to join this poker room.</p>

          <form onSubmit={submitRoomRequest}>
            <input
              className="name-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your display name"
              maxLength={24}
              required
            />

            <input
              className="name-input"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="Room code"
              required
            />

            {error && <p className="error-message">{error}</p>}

            <div className="home-menu">
              <button
                className="start-button"
                type="submit"
                disabled={loading}
              >
                {loading ? "Joining..." : "Join room"}
              </button>
              <Link to="/">Back to home</Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  if (isEntryPage) {
    return (
      <main className="welcome-screen">
        <div className="welcome-card">
          <div className="poker-logo">♠</div>

          <h2>{isCreating ? "Create a room" : "Join a game"}</h2>
          <p>
            {isCreating
              ? "Create a room and invite friends with its room code."
              : "Enter a room code to join your friends."}
          </p>

          <form onSubmit={submitRoomRequest}>
            <input
              className="name-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your display name"
              maxLength={24}
              required
            />

            {isJoining && (
              <input
                className="name-input"
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="Six-digit room code"
                inputMode="numeric"
                maxLength={6}
                required
              />
            )}

            {error && <p className="error-message">{error}</p>}

            <div className="home-menu">
              <button
                className="start-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : isCreating
                    ? "Create room"
                    : "Join room"}
              </button>

              <Link to="/">Back to home</Link>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="welcome-screen">
      <div className="welcome-card lobby-card">
        <div className="poker-logo">♠</div>
        <h2>Room lobby</h2>
        <p>Share this code with friends so they can join your game.</p>

        <div className="room-code">{credentials?.roomCode ?? routeCode}</div>

        {!room && !error && <p>Loading room...</p>}

        {room && (
          <>
            <div className="lobby-player-list">
              <h3>
                Players ({room.players.length}/4)
              </h3>

              {room.players.map((player) => (
                <div className="lobby-player" key={player.id}>
                  <span>
                    {player.name}
                    {player.id === credentials?.playerId ? " (You)" : ""}
                  </span>
                  <span className="lobby-player-role">
                    {player.id === room.hostPlayerId
                      ? "Host"
                      : "Player"}
                  </span>
                </div>
              ))}
            </div>

            {room.players.length < 2 && (
              <p>Waiting for at least one more player...</p>
            )}

            {room.players.length >= 4 && (
              <p>This room is full.</p>
            )}

            {isHost && room.players.length >= 2 && (
              <button
                className="start-button"
                onClick={() => void startGame()}
                disabled={!canStart || starting}
              >
                {starting ? "Starting..." : "Start game"}
              </button>
            )}

            {!isHost && (
              <p>Waiting for the host to start the game...</p>
            )}
          </>
        )}

        {error && <p className="error-message">{error}</p>}

        <div className="home-menu">
          <button
            className="action-button"
            onClick={() => {
              if (credentials) {
                void enterRoom(
                  credentials.roomCode,
                  credentials.playerId,
                ).catch((err: unknown) => {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Unable to refresh the room.",
                  );
                });
              }
            }}
            disabled={!credentials}
          >
            Refresh room
          </button>
          <Link to="/">Back to home</Link>
        </div>
      </div>
    </main>
  );
}