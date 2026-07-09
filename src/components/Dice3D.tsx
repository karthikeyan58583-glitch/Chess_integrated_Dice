/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { Color } from '../types';
import { Dices, Sparkles } from 'lucide-react';

interface Dice3DProps {
  value: number | null;
  color: Color;
  isRolling: boolean;
  onRollComplete: () => void;
  onRollTriggered: () => void;
  disabled: boolean;
  rollNotNeeded?: boolean;
  maxRollValue?: number;
}

export const Dice3D: React.FC<Dice3DProps> = ({
  value,
  color,
  isRolling,
  onRollComplete,
  onRollTriggered,
  disabled,
  rollNotNeeded = false,
  maxRollValue = 6
}) => {
  const [currentRot, setCurrentRot] = useState({ x: 12, y: 14, z: 0 });
  const [localRolling, setLocalRolling] = useState(false);

  // Map dice faces (1-6) to target rotations to bring them facing forward
  const faceRotations: { [key: number]: { x: number; y: number } } = {
    1: { x: 0, y: 0 },       // Front
    2: { x: -90, y: 0 },     // Top
    3: { x: 0, y: -90 },     // Right
    4: { x: 0, y: 90 },      // Left
    5: { x: 90, y: 0 },      // Bottom
    6: { x: 180, y: 0 }      // Back
  };

  useEffect(() => {
    if (isRolling && !localRolling) {
      triggerRoll();
    }
  }, [isRolling]);

  useEffect(() => {
    if (value === null && !isRolling && !localRolling) {
      setCurrentRot({ x: 12, y: 14, z: 0 });
    }
  }, [value, isRolling, localRolling]);

  const triggerRoll = () => {
    setLocalRolling(true);
    // Use value specified from parent state; fallback to random if not populated
    const targetValue = value || Math.floor(Math.random() * maxRollValue) + 1;
    const finalRot = faceRotations[targetValue] || faceRotations[1];

    // Crazily high rot numbers for deep physical spin
    const targetX = (finalRot.x) + 1440;
    const targetY = (finalRot.y) + 1440;
    const targetZ = (Math.random() * 16) - 8; // Small organic tilt to avoid 180 degrees flip distortion

    // Initial wind-up before releasing
    setCurrentRot({ x: targetX, y: targetY, z: targetZ });

    const timer = setTimeout(() => {
      setLocalRolling(false);
      onRollComplete();
    }, 1200);

    return () => clearTimeout(timer);
  };

  const handleManualRoll = () => {
    if (disabled || isRolling || localRolling || rollNotNeeded) return;
    onRollTriggered();
  };

  // Helper to render pips
  const renderPips = (face: number, themeClasses: string) => {
    const dot = <div className={`w-3.5 h-3.5 rounded-full ${themeClasses} shadow-inner transition-colors duration-300`} />;
    const empty = <div className="w-3.5 h-3.5 bg-transparent" />;

    // 3x3 layout mapping for pips
    switch (face) {
      case 1:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {empty} {empty} {empty}
            {empty} {dot} {empty}
            {empty} {empty} {empty}
          </div>
        );
      case 2:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {dot} {empty} {empty}
            {empty} {empty} {empty}
            {empty} {empty} {dot}
          </div>
        );
      case 3:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {dot} {empty} {empty}
            {empty} {dot} {empty}
            {empty} {empty} {dot}
          </div>
        );
      case 4:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {dot} {empty} {dot}
            {empty} {empty} {empty}
            {dot} {empty} {dot}
          </div>
        );
      case 5:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {dot} {empty} {dot}
            {empty} {dot} {empty}
            {dot} {empty} {dot}
          </div>
        );
      case 6:
        return (
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-16 h-16 items-center justify-items-center">
            {dot} {empty} {dot}
            {dot} {empty} {dot}
            {dot} {empty} {dot}
          </div>
        );
      default:
        return null;
    }
  };

  // Define themed styling based on whose turn it is
  const isWhite = color === 'w';
  const surfaceBg = isWhite
    ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-800 text-amber-950"
    : "bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 text-sky-400";

  const pipColor = isWhite ? "bg-amber-950 shadow-amber-900/40" : "bg-sky-400 shadow-sky-500/50 animate-pulse";
  const btnStyle = isWhite
    ? "bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-amber-50 shadow-amber-900/30"
    : "bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-sky-400 shadow-slate-950/50 border border-slate-700";

  return (
    <div className="flex flex-col items-center justify-center p-3.5 md:p-6 bg-slate-900/50 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm w-full max-w-[200px] md:max-w-[280px] shrink-0 self-center">
      {/* 3D Stage Container */}
      <div className="relative w-44 h-44 flex items-center justify-center perspective-600 mb-6 mt-2 overflow-visible">
        {/* Cube Wrapper with Framer Motion */}
        <motion.div
          animate={{
            rotateX: currentRot.x,
            rotateY: currentRot.y,
            rotateZ: currentRot.z
          }}
          transition={{
            type: localRolling ? "tween" : "spring",
            duration: localRolling ? 1.2 : 0.8,
            ease: "easeOut"
          }}
          style={{ transformStyle: 'preserve-3d' }}
          className="w-24 h-24 relative select-none cursor-pointer overflow-visible"
          onClick={handleManualRoll}
        >
          {/* FACE 1: FRONT */}
          <div
            style={{ transform: 'rotateY(0deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(1, pipColor)}
          </div>
          {/* FACE 2: TOP */}
          <div
            style={{ transform: 'rotateX(90deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(2, pipColor)}
          </div>
          {/* FACE 3: RIGHT */}
          <div
            style={{ transform: 'rotateY(90deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(3, pipColor)}
          </div>
          {/* FACE 4: LEFT */}
          <div
            style={{ transform: 'rotateY(-90deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(4, pipColor)}
          </div>
          {/* FACE 5: BOTTOM */}
          <div
            style={{ transform: 'rotateX(-90deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(5, pipColor)}
          </div>
          {/* FACE 6: BACK */}
          <div
            style={{ transform: 'rotateY(180deg) translateZ(48px)', transformStyle: 'preserve-3d' }}
            className={`absolute inset-0 rounded-xl border-4 ${surfaceBg} flex items-center justify-center shadow-lg backface-hidden`}
          >
            {renderPips(6, pipColor)}
          </div>
        </motion.div>

        {/* Ambient shadow underneath */}
        <div className={`absolute bottom-2 w-20 h-3 bg-black/60 rounded-full blur-md transition-all duration-300 ${
          localRolling ? 'scale-75 opacity-40 translate-y-1' : 'scale-100 opacity-80'
        }`} />
      </div>

      {/* Controller Buttons and Display */}
      <div className="flex flex-col items-center gap-3 w-full">
        <button
          onClick={handleManualRoll}
          disabled={disabled || isRolling || localRolling || rollNotNeeded}
          id="roll_dice_btn"
          className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium tracking-wide transition-all duration-200 transform active:scale-95 disabled:scale-100 disabled:opacity-40 disabled:cursor-not-allowed ${btnStyle} w-full text-center justify-center shadow-md`}
        >
          {localRolling ? (
            <span className="flex items-center gap-2">
              <Dices className="w-5 h-5 animate-spin text-inherit" />
              Rolling Matrix...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Dices className="w-5 h-5 text-inherit" />
              Roll {isWhite ? 'White' : 'Black'}
            </span>
          )}
        </button>

        {value !== null && !localRolling && !rollNotNeeded && (
          <div className="flex flex-col items-center mt-1 animate-fade-in text-center">
            <span className="text-slate-400 text-xs font-mono tracking-wider uppercase">ROLL RESULT</span>
            <div className={`flex items-center gap-1 text-2xl font-bold font-mono tracking-tight ${isWhite ? 'text-amber-200' : 'text-sky-300'}`}>
              <Sparkles className="w-5 h-5" />
              {value} {value === 1 ? 'Move Allocated' : 'Moves Allocated'}
            </div>
          </div>
        )}

        {localRolling && (
          <div className="h-10 flex items-center justify-center">
            <span className="text-slate-500 text-xs tracking-widest animate-pulse font-mono font-medium">SHUFFLING SQUARES...</span>
          </div>
        )}
      </div>
    </div>
  );
};
