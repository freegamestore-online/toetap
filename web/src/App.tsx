import { useState, useCallback } from "react";
import {
  GameShell,
  GameTopbar,
  GameAuth,
  GameButton,
  useGameSounds,
} from "@freegamestore/games";
import { Game } from "./components/Game";
import { useHighScore } from "./hooks/useHighScore";

const HIGH_SCORE_KEY = "toetap-best";

export default function App() {
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [gameKey, setGameKey] = useState(0);
  const [phase, setPhase] = useState<"playing" | "over">("playing");
  const { highScore, updateHighScore } = useHighScore(HIGH_SCORE_KEY);
  const sounds = useGameSounds();

  const handleScoreChange = useCallback((s: number) => {
    setScore(s);
  }, []);

  const handleRoundChange = useCallback((r: number) => {
    setRound(r);
  }, []);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setScore(finalScore);
      updateHighScore(finalScore);
      setPhase("over");
    },
    [updateHighScore],
  );

  const restart = useCallback(() => {
    setScore(0);
    setRound(0);
    setPhase("playing");
    setGameKey((k) => k + 1);
    sounds.playMove();
  }, [sounds]);

  const isNewBest = score > 0 && score >= highScore;

  return (
    <GameShell
      topbar={
        <GameTopbar
          title="Toe Tap"
          stats={[
            { label: "Score", value: score, accent: true },
            { label: "Round", value: round + 1 },
            { label: "Best", value: highScore },
          ]}
          rules={
            <div>
              <h3 style={{ marginBottom: "0.5rem", fontWeight: 700 }}>
                Toe Tap
              </h3>
              <p>A rhythm memory puzzle. Watch, remember, repeat!</p>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>
                How to Play
              </h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Watch the tiles light up in sequence</li>
                <li>Then tap the same tiles in the same order</li>
                <li>Each round adds one more tile</li>
                <li>One wrong tap and it is game over</li>
              </ul>
              <h4 style={{ marginTop: "0.75rem", fontWeight: 600 }}>
                Scoring
              </h4>
              <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem" }}>
                <li>Points = sequence length x 100 per round</li>
                <li>Longer sequences = bigger bonus</li>
              </ul>
            </div>
          }
          onRestart={restart}
          actions={<GameAuth />}
        />
      }
    >
      <div className="relative w-full h-full">
        <Game
          key={gameKey}
          gameKey={gameKey}
          onScoreChange={handleScoreChange}
          onRoundChange={handleRoundChange}
          onGameOver={handleGameOver}
        />

        {phase === "over" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-5"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            <p
              className="text-3xl font-bold"
              style={{ fontFamily: "Fraunces, serif", color: "var(--accent)" }}
            >
              Game Over
            </p>

            <div className="flex flex-col items-center gap-1">
              <p
                className="text-5xl font-bold"
                style={{ fontFamily: "Fraunces, serif", color: "#fff" }}
              >
                {score}
              </p>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                You survived {round + 1} round{round !== 0 ? "s" : ""}
              </p>
            </div>

            {isNewBest && (
              <p
                className="text-lg font-bold animate-pulse"
                style={{ color: "var(--success)" }}
              >
                New high score!
              </p>
            )}

            <GameButton variant="primary" size="lg" onClick={restart}>
              Play Again
            </GameButton>
          </div>
        )}
      </div>
    </GameShell>
  );
}
