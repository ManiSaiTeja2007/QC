import React from 'react';

interface TransportBarProps {
  currentStep: number;
  totalSteps: number;
  totalOps: number;
  currentOpId: number;
  isPlaying: boolean;
  speedMs: number;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onStepChange: (step: number) => void;
  onSpeedChange: (speed: number) => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  currentStep,
  totalSteps,
  totalOps,
  currentOpId,
  isPlaying,
  speedMs,
  onReset,
  onPrev,
  onNext,
  onTogglePlay,
  onStepChange,
  onSpeedChange,
}) => {
  return (
    <section className="transport-bar">
      <div className="playback-btns">
        <button className="btn btn-icon" title="Reset to Step 0" onClick={onReset}>⏮️</button>
        <button className="btn btn-icon" title="Step Back" onClick={onPrev}>◀</button>
        <button className={`btn btn-icon ${isPlaying ? 'btn-pause' : 'btn-play'}`} onClick={onTogglePlay}>
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="btn btn-icon" title="Step Forward" onClick={onNext}>▶</button>
      </div>

      <div className="scrubber-container">
        <span className="step-label">
          Op {currentOpId} / {totalOps} · Gate {currentStep} / {totalSteps}
        </span>
        <input
          type="range"
          min={0}
          max={totalSteps || 1}
          value={currentStep}
          onChange={(e) => onStepChange(parseInt(e.target.value, 10))}
          className="slider"
        />
      </div>

      <div className="speed-container">
        <label>Speed:</label>
        <input
          type="range"
          min={50}
          max={800}
          step={50}
          value={speedMs}
          onChange={(e) => onSpeedChange(parseInt(e.target.value, 10))}
          className="slider-sm"
        />
        <span>{speedMs}ms</span>
      </div>
    </section>
  );
};
