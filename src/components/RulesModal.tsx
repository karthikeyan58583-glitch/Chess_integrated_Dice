/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, HelpCircle, Swords, ShieldAlert, Sparkles, AlertTriangle } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#070402]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-gradient-to-b from-[#21140c] to-[#170e08] border-2 border-[#caa469]/40 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-[0_25px_60px_-10px_rgba(0,0,0,0.9)] relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#3b2313]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#caa469]/10 border border-[#caa469]/20 flex items-center justify-center text-[#caa469]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[#efe3cb] font-serif font-bold text-lg select-none leading-none">Chess Integrated Dice</h3>
              <span className="text-[9px] text-[#bda78d] font-sans font-bold tracking-wider">OFFICIAL RULES & VARIANT MANDATES</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2d1b10] hover:bg-[#3d2516] border border-[#52331c] text-[#eecda3] flex items-center justify-center transition-all duration-150 transform active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-[#dfd0bd] text-sm select-text custom-scrollbar">
          
          {/* Variant Core Mechanics */}
          <div className="space-y-2.5">
            <h4 className="text-[#caa469] font-serif font-bold flex items-center gap-2 text-base select-none">
              <Sparkles className="w-4 h-4 text-[#caa469]" />
              1. Evolutionary Match Phases
            </h4>
            <div className="bg-[#0f0704]/90 p-4 rounded-xl border border-[#301c0f] space-y-3 font-sans text-xs text-[#baa287]">
              <p className="font-serif italic text-xs text-[#cfbfa8]">• White always plays first.</p>
              <div className="border-l-3 border-[#c2b291] pl-3.5 my-2">
                <span className="text-[#e2d3b2] font-semibold font-serif block">PHASE 1 (First 5 Turns of Each)</span>
                <p className="mt-1 font-sans text-xs text-[#b09d89] leading-normal">
                  No dice rolling is needed! Each player is allocated exactly <span className="text-[#e2d3b2] font-semibold">1 move</span> per turn at a time.
                </p>
              </div>
              <div className="border-l-3 border-[#dca76a] pl-3.5 my-2">
                <span className="text-[#caa469] font-semibold font-serif block">PHASE 2 (Next 5 Turns of Each)</span>
                <p className="mt-1 font-sans text-xs text-[#b09d89] leading-normal">
                  Dice rolling begins! The 3D matrix dice rolls and allocates a number falling between <span className="text-[#dfb455] font-semibold">1 to 3</span> moves per turn.
                </p>
              </div>
              <div className="border-l-3 border-[#ca5f4a] pl-3.5 my-2">
                <span className="text-[#de806d] font-semibold font-serif block">PHASE 3 (Turn 11 onwards)</span>
                <p className="mt-1 font-sans text-xs text-[#b09d89] leading-normal">
                  The dice expands to its full potential, rolling and allocating up to <span className="text-[#f89582] font-semibold">6 moves</span> per turn (range 1–6).
                </p>
              </div>
              <p className="font-serif italic text-[11px] text-[#aa8b6d] leading-relaxed pt-2 border-t border-[#341d0e]">
                • A player's turn only ends when all scheduled moves are executed, or when cut short by special check conditions.
              </p>
            </div>
          </div>

          {/* CRITICAL CUSTOM RULE */}
          <div className="space-y-2.5">
            <h4 className="text-rose-450 text-[#caa469] font-serif font-bold flex items-center gap-2 text-base select-none">
              <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
              2. Special Dice Check Rule
            </h4>
            <div className="bg-[#bc3c30]/10 p-4.5 rounded-xl border border-[#bc3c30]/40 space-y-3">
              <p className="leading-relaxed text-sm text-[#eecda3] font-serif">
                To respect the sanctity of a Check, if <span className="font-bold text-[#faf0dc] underline decoration-[#ca5f4a]">any king is checked</span>, remaining moves assigned on the dice are prohibited unless they move the king to safety.
              </p>
              <div className="bg-[#0c0502] p-3.5 rounded-lg border border-[#3b2313] space-y-2">
                <span className="text-[10px] uppercase font-sans font-bold tracking-wider text-[#caa469] flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#caa469]" />
                  Example Turn Sequence
                </span>
                <p className="text-xs font-serif text-[#caa469]/80 leading-relaxed italic">
                  White rolls a <strong className="text-amber-400 not-italic">4</strong>. White makes their 1st move (no checks). On White's 2nd move, White <strong className="text-rose-400 not-italic">puts Black's King in check</strong>.
                </p>
                <p className="text-xs font-serif text-[#caa469]/80 leading-relaxed italic">
                  Because Black's King is now in check, White's remaining 3rd and 4th moves are <strong className="text-rose-400 font-bold not-italic">PROHIBITED</strong>. White's turn terminates immediately, transferring action to Black to seek safety.
                </p>
              </div>
            </div>
          </div>

          {/* Special Chess Moves */}
          <div className="space-y-3">
            <h4 className="text-[#caa469] font-serif font-bold flex items-center gap-2 text-base select-none">
              <Swords className="w-4 h-4 text-[#caa469]" />
              3. Fully Implemented Special Chess Rules
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-[#0d0603] border border-[#321c0e] p-3.5 rounded-xl">
                <span className="font-serif font-bold text-xs text-[#eecda3] block mb-1">Castling (Short/Long)</span>
                <p className="text-[11px] text-[#b29d84] leading-relaxed font-sans">
                  King moves 2 squares towards Rook; Rook leaps over King. Valid only if neither piece has moved, the path is empty, the King is not in check, and the squares crossed are not attacked.
                </p>
              </div>

              <div className="bg-[#0d0603] border border-[#321c0e] p-3.5 rounded-xl">
                <span className="font-serif font-bold text-xs text-[#eecda3] block mb-1">En Passant</span>
                <p className="text-[11px] text-[#b29d84] leading-relaxed font-sans">
                  If an opponent skips a square with a double pawnoff start, your adjacent pawn can capture it diagonally behind, as long as it was the opponent's immediately preceding move.
                </p>
              </div>

              <div className="bg-[#0d0603] border border-[#321c0e] p-3.5 rounded-xl">
                <span className="font-serif font-bold text-xs text-[#eecda3] block mb-1">Pawn Promotion</span>
                <p className="text-[11px] text-[#b29d84] leading-relaxed font-sans">
                  When a pawn reaches the opposite outer edge (8th rank), you can swap it instantly for a Queen, Rook, Bishop, or Knight using the interactive selection overlay.
                </p>
              </div>
            </div>
          </div>

          {/* Draw and Match Out */}
          <div className="space-y-3 border-t border-[#3b2313] pt-4.5">
            <h4 className="text-[#eee3cb] font-serif font-bold text-sm select-none">4. Game Termination Conditions</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#baa287]">
              <div className="space-y-1.5">
                <p><span className="text-[#caa469] font-serif font-semibold">• Checkmate:</span> When a King is in check and cannot escape. The Attacker wins.</p>
                <p><span className="text-[#caa469] font-serif font-semibold">• Stalemate:</span> Player has no legal moves, but is not in check. Ends in a draw.</p>
              </div>
              <div className="space-y-1.5">
                <p><span className="text-[#caa469] font-serif font-semibold">• Insufficient Material:</span> Draw automatically occurs if pieces remaining cannot deliver checkmate (e.g. King vs King).</p>
                <p><span className="text-[#caa469] font-serif font-semibold">• Agreement:</span> Propose a cooperative Draw at any stage.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#3b2313] bg-[#0c0502]/60 flex justify-end">
          <button
            onClick={onClose}
            id="close_rules_btn"
            className="px-5 py-2.5 bg-gradient-to-r from-[#caa469] to-[#dfb455] text-[#1c0f05] font-serif font-bold tracking-wider uppercase text-xs rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all duration-150"
          >
            Acknowledge Directives
          </button>
        </div>

      </div>
    </div>
  );
};
