/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Move, PieceType } from '../types';
import { Dices, History, Trophy, Swords, Flag } from 'lucide-react';

interface MoveLogProps {
  history: {
    move: Move;
    notation: string;
    roll: number;
    moveIndex: number;
  }[];
  onResign: () => void;
  onAgreeDraw: () => void;
  gameStatus: string;
  disabled?: boolean;
}

export const MoveLog: React.FC<MoveLogProps> = ({
  history,
  onResign,
  onAgreeDraw,
  gameStatus,
  disabled = false
}) => {
  const pieceSymbols: { [key in PieceType]: string } = {
    p: '♟',
    r: '♜',
    n: '♞',
    b: '♝',
    q: '♛',
    k: '♚'
  };

  // Group history by full turn pairs (White + Black)
  const turns: {
    turnNumber: number;
    whiteRoll?: number;
    whiteNotationLog?: string[];
    blackRoll?: number;
    blackNotationLog?: string[];
  }[] = [];

  history.forEach((record) => {
    // Determine the main index based on when dice represents a turn
    // We can group history by sequential moves of the same player
    // Instead of raw turn logic, let's list them elegantly chronologically
  });

  // Calculate captured pieces
  const whiteCaptures: string[] = [];
  const blackCaptures: string[] = [];

  history.forEach(({ move }) => {
    if (move.captured) {
      const sym = pieceSymbols[move.captured.type];
      if (move.captured.color === 'b') {
        whiteCaptures.push(sym); // White captured a Black piece
      } else {
        blackCaptures.push(sym); // Black captured a White piece
      }
    }
  });

  // Simple chronological display of turns, or grouped by rolling rounds
  const turnRounds: {
    round: number;
    player: 'w' | 'b';
    roll: number;
    notations: string[];
  }[] = [];

  history.forEach(({ move, notation, roll }) => {
    const isWhite = move.piece.color === 'w';
    const player = isWhite ? 'w' : 'b';

    const lastRound = turnRounds[turnRounds.length - 1];
    // If we have a matching active round (same player & same roll) we append
    if (lastRound && lastRound.player === player && lastRound.roll === roll) {
      lastRound.notations.push(notation);
    } else {
      turnRounds.push({
        round: turnRounds.length + 1,
        player,
        roll,
        notations: [notation]
      });
    }
  });

  // Group turnRounds into paired rows (White & Black side-by-side)
  interface PairedTurn {
    roundIndex: number;
    white?: {
      roll: number;
      notations: string[];
    };
    black?: {
      roll: number;
      notations: string[];
    };
  }

  const pairedTurns: PairedTurn[] = [];
  turnRounds.forEach((round) => {
    if (round.player === 'w') {
      pairedTurns.push({
        roundIndex: pairedTurns.length + 1,
        white: { roll: round.roll, notations: round.notations }
      });
    } else {
      const lastPair = pairedTurns[pairedTurns.length - 1];
      if (lastPair && !lastPair.black) {
        lastPair.black = { roll: round.roll, notations: round.notations };
      } else {
        pairedTurns.push({
          roundIndex: pairedTurns.length + 1,
          black: { roll: round.roll, notations: round.notations }
        });
      }
    }
  });

  const getDiceChar = (val: number) => {
    const chars = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    return chars[val - 1] || '⚁';
  };

  return (
    <div className="flex flex-col h-full bg-transparent p-0 border-none shadow-none">
      {/* Captured Pieces Section - Flat styled list */}
      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[#312e2b] mb-3 select-none">
        {/* Captured by White */}
        <div className="bg-[#1a1917] p-2 rounded-xl border border-[#312e2b]">
          <span className="text-[10px] uppercase tracking-wider text-[#bab9b7] font-sans font-bold block mb-1">White Captures</span>
          <div className="flex flex-wrap gap-1 leading-none text-xl h-6 items-center text-zinc-950">
            {whiteCaptures.length > 0 ? (
              whiteCaptures.map((sym, idx) => (
                <span key={idx} className="drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]">{sym}</span>
              ))
            ) : (
              <span className="text-[10px] text-zinc-500 font-sans">No captures</span>
            )}
          </div>
          <span className="text-[9px] text-[#866f5a] font-sans block mt-0.5">Score: {whiteCaptures.length}</span>
        </div>

        {/* Captured by Black */}
        <div className="bg-[#1a1917] p-2 rounded-xl border border-[#312e2b]">
          <span className="text-[10px] uppercase tracking-wider text-[#bab9b7] font-sans font-bold block mb-1">Black Captures</span>
          <div className="flex flex-wrap gap-1 leading-none text-xl h-6 items-center text-[#fff3db]">
            {blackCaptures.length > 0 ? (
              blackCaptures.map((sym, idx) => (
                <span key={idx} className="drop-shadow-[0_1px_2.5px_rgba(0,0,0,0.85)]">{sym}</span>
              ))
            ) : (
              <span className="text-[10px] text-zinc-500 font-sans">No captures</span>
            )}
          </div>
          <span className="text-[9px] text-[#866f5a] font-sans block mt-0.5">Score: {blackCaptures.length}</span>
        </div>
      </div>

      {/* Move History Log */}
      <div className="flex items-center gap-1.5 mb-2 text-[#efe3cb] font-sans font-extrabold select-none text-xs uppercase tracking-wider">
        <History className="w-3.5 h-3.5 text-[#81b64c]" />
        Turn Ledger
      </div>

      {pairedTurns.length > 0 && (
        <div className="grid grid-cols-[38px_1fr_1fr] gap-2 px-2 py-1 text-[9px] font-sans tracking-widest text-[#989795] uppercase border-b border-[#312e2b] mb-1 select-none font-bold">
          <span className="text-center">Rnd</span>
          <span className="pl-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-white" />White</span>
          <span className="pl-1 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-zinc-950 border border-[#989795]" />Black</span>
        </div>
      )}

      <div className="overflow-y-auto max-h-[220px] md:max-h-[240px] min-h-[145px] pr-1 space-y-1 custom-scrollbar">
        {pairedTurns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-6 text-center bg-[#1a1917]/70 rounded-xl border border-dashed border-[#312e2b]">
            <Swords className="w-6 h-6 text-zinc-600 mb-1.5 animate-pulse" />
            <p className="text-[#9bab95] text-xs font-sans max-w-[220px] leading-relaxed">The board is set. Roll the dice to begin the match!</p>
          </div>
        ) : (
          pairedTurns.map((pair, pIdx) => (
            <div
              key={pIdx}
              className="grid grid-cols-[38px_1fr_1fr] items-center gap-2 py-1 px-1 font-sans text-xs border border-transparent hover:bg-zinc-800/20 rounded-lg transition-colors"
            >
              <span className="text-[11px] font-sans font-bold text-gray-400 text-center select-none">
                {pair.roundIndex}.
              </span>

              {/* White Action Column */}
              {pair.white ? (
                <div className="flex items-center gap-1.5 bg-[#1a1917] border border-[#312e2b] px-2 py-1 rounded-md min-w-0">
                  {pair.roundIndex <= 5 ? (
                    <span className="text-xs font-sans font-bold text-white tracking-wide truncate flex-1" title={pair.white.notations.join(' ')}>
                      {pair.white.notations.join(' ')}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 truncation flex-1 leading-none">
                      <span className="text-xs font-sans font-extrabold text-[#caa469] shrink-0 select-none" title={`Rolled ${pair.white.roll}`}>
                        {getDiceChar(pair.white.roll)} ({pair.white.roll}) ➔
                      </span>
                      <span className="text-xs font-sans font-bold text-white tracking-wide truncate flex-1" title={pair.white.notations.join(' ')}>
                        {pair.white.notations.join(' ')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-7" />
              )}

              {/* Black Action Column */}
              {pair.black ? (
                <div className="flex items-center gap-1.5 bg-[#1a1917] border border-[#312e2b] px-2 py-1 rounded-md min-w-0">
                  {pair.roundIndex <= 5 ? (
                    <span className="text-xs font-sans font-bold text-[#b9b8b6] tracking-wide truncate flex-1" title={pair.black.notations.join(' ')}>
                      {pair.black.notations.join(' ')}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 truncation flex-1 leading-none">
                      <span className="text-xs font-sans font-extrabold text-[#caa469] shrink-0 select-none" title={`Rolled ${pair.black.roll}`}>
                        {getDiceChar(pair.black.roll)} ({pair.black.roll}) ➔
                      </span>
                      <span className="text-xs font-sans font-bold text-[#b9b8b6] tracking-wide truncate flex-1" title={pair.black.notations.join(' ')}>
                        {pair.black.notations.join(' ')}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                pair.white ? (
                  <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 font-sans font-medium select-none">
                    <span className="animate-pulse">Thinking...</span>
                  </div>
                ) : (
                  <div className="h-7" />
                )
              )}
            </div>
          ))
        )}
      </div>

      {/* Control Buttons - Sleek Chess.com gray/charcoal action bar */}
      <div className="mt-3 pt-3 border-t border-[#312e2b] grid grid-cols-2 gap-2">
        <button
          onClick={onAgreeDraw}
          disabled={disabled || (gameStatus !== 'playing' && gameStatus !== 'rolling')}
          id="claim_draw_btn"
          className="px-3 py-2 bg-[#21201e] hover:bg-[#2c2a27] active:scale-95 text-[#bab9b7] hover:text-white border border-[#312e2b] rounded-xl text-xs font-sans font-bold disabled:scale-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Swords className="w-3.5 h-3.5 text-zinc-400" />
          Offer Draw
        </button>
        <button
          onClick={onResign}
          disabled={disabled || (gameStatus !== 'playing' && gameStatus !== 'rolling')}
          id="resign_game_btn"
          className="px-3 py-2 bg-[#dc3545]/15 hover:bg-[#dc3545]/30 text-red-200 hover:text-white active:scale-95 border border-[#dc3545]/30 rounded-xl text-xs font-sans font-bold disabled:scale-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Flag className="w-3.5 h-3.5 text-red-400" />
          Resign
        </button>
      </div>
    </div>
  );
};
