import { useState, useCallback, useRef, useEffect } from "react";
import { useGameSounds } from "@freegamestore/games";
import type { Phase } from "../types";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const GRID_SIZE = 4; // 4x4 grid = 16 tiles
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;
const SHOW_TILE_MS = 600; // time each tile lights up during the show phase
const SHOW_GAP_MS = 200; // gap between tile flashes
const FEEDBACK_MS = 500; // how long correct/wrong feedback shows
const COUNTDOWN_MS = 800; // brief pause before the sequence shows
const START_LENGTH = 2; // starting sequence length

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Pick `count` unique random tile indices from 0..TOTAL_TILES-1 */
function pickSequence(count: number): number[] {
  const seq: number[] = [];
  while (seq.length < count) {
    const n = Math.floor(Math.random() * TOTAL_TILES);
    if (!seq.includes(n)) seq.push(n);
  }
  return seq;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

interface GameProps {
  onScoreChange: (score: number) => void;
  onRoundChange: (round: number) => void;
  onGameOver: (finalScore: number) => void;
  gameKey: number; // increment to restart
}

export function Game({ onScoreChange, onRoundChange, onGameOver, gameKey }: GameProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [sequence, setSequence] = useState<number[]>([]);
  const [showIndex, setShowIndex] = useState(-1); // which tile in the sequence is currently lit
  const [inputIndex, setInputIndex] = useState(0); // how many tiles the player has tapped
  const [correctTiles, setCorrectTiles] = useState<Set<number>>(new Set());
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [countdown, setCountdown] = useState<string | null>(null);

  const sounds = useGameSounds();
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Clear all pending timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const addTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
    return id;
  }, []);

  // Start a new round
  const startRound = useCallback(
    (roundNum: number, currentScore: number) => {
      clearAllTimeouts();
      const seqLength = START_LENGTH + roundNum;
      const seq = pickSequence(Math.min(seqLength, TOTAL_TILES));
      setSequence(seq);
      setInputIndex(0);
      setCorrectTiles(new Set());
      setWrongTile(null);
      setRound(roundNum);
      onRoundChange(roundNum);
      setScore(currentScore);

      // Brief countdown
      setPhase("idle");
      setCountdown("Watch!");
      soundsRef.current.playTick();

      addTimeout(() => {
        setCountdown(null);
        setPhase("showing");

        // Light up tiles one by one
        seq.forEach((_, i) => {
          addTimeout(() => {
            setShowIndex(i);
            soundsRef.current.playMove();
          }, i * (SHOW_TILE_MS + SHOW_GAP_MS));

          addTimeout(() => {
            setShowIndex(-1);
          }, i * (SHOW_TILE_MS + SHOW_GAP_MS) + SHOW_TILE_MS);
        });

        // After all tiles have been shown, switch to input phase
        const totalShowTime =
          seq.length * (SHOW_TILE_MS + SHOW_GAP_MS) + 200;
        addTimeout(() => {
          setShowIndex(-1);
          setPhase("input");
        }, totalShowTime);
      }, COUNTDOWN_MS);
    },
    [clearAllTimeouts, addTimeout, onRoundChange],
  );

  // Start game on mount or gameKey change
  useEffect(() => {
    setPhase("idle");
    setScore(0);
    setRound(0);
    onScoreChange(0);
    onRoundChange(0);
    startRound(0, 0);
    return clearAllTimeouts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameKey]);

  // Handle tile tap
  const handleTap = useCallback(
    (tileIndex: number) => {
      if (phase !== "input") return;

      const expectedTile = sequence[inputIndex];
      if (expectedTile === undefined) return;

      if (tileIndex === expectedTile) {
        // Correct!
        soundsRef.current.playScore();
        const newCorrect = new Set(correctTiles);
        newCorrect.add(tileIndex);
        setCorrectTiles(newCorrect);
        const nextInput = inputIndex + 1;
        setInputIndex(nextInput);

        if (nextInput >= sequence.length) {
          // Round complete!
          setPhase("feedback");
          const roundBonus = sequence.length * 100;
          const newScore = score + roundBonus;
          setScore(newScore);
          onScoreChange(newScore);

          soundsRef.current.playLevelUp();

          addTimeout(() => {
            const nextRound = round + 1;
            startRound(nextRound, newScore);
          }, 1200);
        }
      } else {
        // Wrong!
        soundsRef.current.playError();
        setWrongTile(tileIndex);
        setPhase("feedback");

        // Show the correct remaining sequence
        addTimeout(() => {
          soundsRef.current.playGameOver();
          setPhase("over");
          onGameOver(score);
        }, FEEDBACK_MS);
      }
    },
    [
      phase,
      sequence,
      inputIndex,
      correctTiles,
      score,
      round,
      addTimeout,
      startRound,
      onScoreChange,
      onGameOver,
    ],
  );

  // Determine tile appearance
  const getTileState = (index: number) => {
    const isInSequence = sequence.includes(index);
    const isShowingNow =
      phase === "showing" && showIndex >= 0 && sequence[showIndex] === index;
    const isCorrect = correctTiles.has(index);
    const isWrong = wrongTile === index;
    const isGameOverReveal = phase === "over" && isInSequence;

    return { isShowingNow, isCorrect, isWrong, isGameOverReveal, isInSequence };
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-4 relative">
      {/* Countdown overlay */}
      {countdown && (
        <div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ background: "rgba(0,0,0,0.3)" }}
        >
          <span
            className="text-4xl font-bold animate-pulse"
            style={{ fontFamily: "Fraunces, serif", color: "var(--accent)" }}
          >
            {countdown}
          </span>
        </div>
      )}

      {/* Phase indicator */}
      <div
        className="text-sm font-semibold tracking-wide uppercase"
        style={{ color: "var(--muted)" }}
      >
        {phase === "showing" && "Memorize the pattern..."}
        {phase === "input" && `Tap tile ${inputIndex + 1} of ${sequence.length}`}
        {phase === "feedback" && wrongTile === null && "Round complete!"}
        {phase === "feedback" && wrongTile !== null && "Wrong tile!"}
        {phase === "over" && "Game over!"}
      </div>

      {/* Grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          width: "min(90vw, 90vmin, 400px)",
          aspectRatio: "1",
          touchAction: "manipulation",
        }}
      >
        {Array.from({ length: TOTAL_TILES }, (_, i) => {
          const { isShowingNow, isCorrect, isWrong, isGameOverReveal } =
            getTileState(i);

          // Determine tile visuals
          let bg = "var(--panel)";
          let border = "2px solid var(--line)";
          let shadow = "none";
          let transform = "scale(1)";

          if (isShowingNow) {
            bg = "var(--accent)";
            border = "2px solid var(--accent)";
            shadow = "0 0 20px var(--accent-glow), inset 0 0 10px rgba(255,255,255,0.2)";
            transform = "scale(1.05)";
          } else if (isCorrect) {
            bg = "var(--success)";
            border = "2px solid var(--success)";
            shadow = "0 0 12px rgba(22, 163, 74, 0.4)";
            transform = "scale(0.95)";
          } else if (isWrong) {
            bg = "var(--error)";
            border = "2px solid var(--error)";
            shadow = "0 0 16px rgba(220, 38, 38, 0.5)";
            transform = "scale(1.05)";
          } else if (isGameOverReveal) {
            bg = "var(--accent)";
            border = "2px solid var(--accent)";
            shadow = "0 0 8px var(--accent-glow)";
            transform = "scale(1)";
          }

          const canTap = phase === "input";

          return (
            <button
              key={i}
              onClick={() => handleTap(i)}
              disabled={!canTap}
              className="rounded-xl aspect-square"
              style={{
                background: bg,
                border,
                boxShadow: shadow,
                transform,
                transition:
                  "background 200ms ease, border-color 200ms ease, box-shadow 200ms ease, transform 200ms ease",
                cursor: canTap ? "pointer" : "default",
                outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
              aria-label={`Tile ${i + 1}`}
            />
          );
        })}
      </div>

      {/* Round progress dots */}
      {phase === "input" && (
        <div className="flex gap-2 mt-2">
          {sequence.map((_, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 10,
                height: 10,
                background:
                  i < inputIndex
                    ? "var(--success)"
                    : i === inputIndex
                      ? "var(--accent)"
                      : "var(--line-strong)",
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
