import "./PlayingCard.css";

type PlayingCardProps = {
  rank: string;
  suit: string;
};

function PlayingCard({ rank, suit }: PlayingCardProps) {
  const isRed = suit === "♥" || suit === "♦";

  return (
    <div className={`playing-card ${isRed ? "red" : ""}`}>
      <span>{rank}</span>

      <span>{suit}</span>
    </div>
  );
}

export default PlayingCard;