/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BoardState, Color, Move, Piece, Position, PieceType } from '../types';
import { getValidMoves } from '../chessEngine';
import { ShieldAlert, AlertCircle, Sparkles, Flag } from 'lucide-react';

interface ChessBoardProps {
  board: BoardState;
  turn: Color;
  lastMove: Move | null;
  movesRemaining: number;
  onMoveSelected: (move: Move) => void;
  isKingChecked: boolean;
  disabled: boolean;
  gameStatus?: string;
  winner?: Color | 'draw' | null;
  orientation?: Color;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
  board,
  turn,
  lastMove,
  movesRemaining,
  onMoveSelected,
  isKingChecked,
  disabled,
  gameStatus = 'playing',
  winner = null,
  orientation = 'w'
}) => {
  const [selectedCell, setSelectedCell] = useState<Position | null>(null);
  const [promotionPendingMove, setPromotionPendingMove] = useState<Move[] | null>(null);

  // Generate mapping of piece types to vector symbols
  const pieceSymbols: { [key in PieceType]: string } = {
    p: '♟',
    r: '♜',
    n: '♞',
    b: '♝',
    q: '♛',
    k: '♚'
  };

  const hollowSymbols: { [key in PieceType]: string } = {
    p: '♙',
    r: '♖',
    n: '♘',
    b: '♗',
    q: '♕',
    k: '♔'
  };

  const selectedMoves = selectedCell
    ? getValidMoves(board, selectedCell.r, selectedCell.c, lastMove)
    : [];

  const handleSquareClick = (r: number, c: number) => {
    if (disabled || movesRemaining <= 0) return;
    if (promotionPendingMove) return; // Must resolve promotion first

    const clickedPiece = board[r][c];

    // Check if clicked cell matches one of the valid move targets of the currently selected piece
    const matchedMove = selectedMoves.find(m => m.to.r === r && m.to.c === c);

    if (matchedMove) {
      // Is it a promotion?
      const promotionMoves = selectedMoves.filter(m => m.to.r === r && m.to.c === c && m.type === 'promotion');
      if (promotionMoves.length > 0) {
        // Trigger promotion overlay
        setPromotionPendingMove(promotionMoves);
      } else {
        // Execute normally
        onMoveSelected(matchedMove);
        setSelectedCell(null);
      }
    } else if (clickedPiece && clickedPiece.color === turn) {
      // Select or change selection
      setSelectedCell({ r, c });
    } else {
      // Deselect
      setSelectedCell(null);
    }
  };

  const handlePromotionSelect = (promoType: PieceType) => {
    if (!promotionPendingMove) return;
    const selectedMove = promotionPendingMove.find(m => m.promotionType === promoType);
    if (selectedMove) {
      onMoveSelected(selectedMove);
    }
    setPromotionPendingMove(null);
    setSelectedCell(null);
  };

  // Helper files/ranks
  const fileLabels = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rankLabels = ['8', '7', '6', '5', '4', '3', '2', '1'];

  return (
    <div className="relative flex flex-col items-center justify-center select-none w-full max-w-full mx-auto">
      {/* Board Base Container - Flat Chess.com style, no surrounding heavy bezel */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.6)] border-2 border-[#312e2b]">
        
        {/* The 8x8 grid */}
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full relative shadow-inner">
          {Array(8).fill(null).map((_, r) => {
            const actualR = orientation === 'b' ? 7 - r : r;
            return Array(8).fill(null).map((_, c) => {
              const actualC = orientation === 'b' ? 7 - c : c;
              const piece = board[actualR][actualC];
              const isDark = (actualR + actualC) % 2 === 1;
              const isSelected = selectedCell && selectedCell.r === actualR && selectedCell.c === actualC;
              
              // Validate highlight moves
              const targetMove = selectedMoves.find(m => m.to.r === actualR && m.to.c === actualC);
              const isHighlighted = !!targetMove;
              const isCaptureHighlight = isHighlighted && (piece !== null || targetMove!.type === 'en-passant');

              // Highlight last move sources and targets
              const isLastMoveSrc = lastMove && lastMove.from.r === actualR && lastMove.from.c === actualC;
              const isLastMoveDst = lastMove && lastMove.to.r === actualR && lastMove.to.c === actualC;

              // Highlight check
              const isCheckedKingSquare = piece && piece.type === 'k' && piece.color === turn && isKingChecked;

              // Classic chess engine materials: Cream Maple and Walnut/Mahogany
              let cellBg = isDark ? 'bg-[#916545]' : 'bg-[#eecda3]';
              
              if (isLastMoveSrc || isLastMoveDst) {
                cellBg = isDark ? 'bg-[#cba774]' : 'bg-[#dfc499]';
              }
              if (isSelected) {
                cellBg = 'bg-[#dfb455]';
              }
              if (isCheckedKingSquare) {
                cellBg = 'bg-[#bc3c30]/75 ring-2 ring-[#ef4444] ring-inset';
              }

              // Game Over highlights override
              const isGameOver = gameStatus && ['checkmate', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_moves_draw', 'agreed_draw', 'resigned'].includes(gameStatus);
              const isKing = piece && piece.type === 'k';
              let showResignedFlag = false;

              if (isGameOver && isKing) {
                const isDraw = winner === 'draw' || ['stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_moves_draw', 'agreed_draw'].includes(gameStatus);
                if (isDraw) {
                  cellBg = 'bg-[#7c7876] ring-2 ring-stone-400 ring-inset shadow-[inset_0_0_12px_rgba(0,0,0,0.5)]';
                } else if (winner === 'w' || winner === 'b') {
                  if (piece.color === winner) {
                    cellBg = 'bg-[#4c814c] ring-2 ring-emerald-400 ring-inset shadow-[inset_0_0_12px_rgba(0,0,0,0.5)]';
                  } else {
                    cellBg = 'bg-[#bc3c30] ring-2 ring-rose-500 ring-inset shadow-[inset_0_0_12px_rgba(0,0,0,0.5)]';
                    if (gameStatus === 'resigned') {
                      showResignedFlag = true;
                    }
                  }
                }
              }

              // Piece styling - ivory white with dark shade overlay vs hand-stained charcoal-dark
              const pieceEl = piece ? (
                <div
                  className="text-4xl md:text-5xl select-none flex items-center justify-center w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-200 hover:scale-112 relative"
                  style={{ zIndex: isSelected ? 30 : 10 }}
                >
                  {piece.color === 'w' ? (
                    <div className="relative w-full h-full flex items-center justify-center drop-shadow-[0_3px_5px_rgba(0,0,0,0.85)]">
                      {/* Solid cream backing */}
                      <span className="absolute inset-0 flex items-center justify-center text-[#fff8eb] font-semibold leading-none select-none z-10">
                        {pieceSymbols[piece.type]}
                      </span>
                      {/* Hollow dark lines overlay to give the perfect internal shaded lines */}
                      <span className="absolute inset-0 flex items-center justify-center text-[#18110a] font-normal leading-none select-none z-20">
                        {hollowSymbols[piece.type]}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[#18110a] drop-shadow-[0_2px_2.5px_rgba(255,255,255,0.45)] font-normal leading-none">
                      {pieceSymbols[piece.type]}
                    </span>
                  )}
                </div>
              ) : null;

              return (
                <div
                  key={`${actualR}-${actualC}`}
                  id={`square_${fileLabels[actualC]}${rankLabels[actualR]}`}
                  onClick={() => handleSquareClick(actualR, actualC)}
                  className={`relative flex items-center justify-center transition-colors duration-200 w-full h-full cursor-pointer ${cellBg}`}
                >
                  {/* Pieces */}
                  {pieceEl}

                  {/* Resigned White Flag Icon in top right corner of the piece area */}
                  {showResignedFlag && (
                    <div className="absolute top-1 right-1 bg-white border border-slate-300 rounded p-0.5 shadow-md flex items-center justify-center z-30 animate-bounce">
                      <Flag className="w-3.5 h-3.5 text-[#1a1917] fill-[#1a1917]" />
                    </div>
                  )}

                  {/* Move Target Indicators */}
                  {isHighlighted && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      {isCaptureHighlight ? (
                        <div className="w-10 h-10 rounded-full border-4 border-rose-500/70 bg-rose-500/20 animate-pulse" />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                      )}
                    </div>
                  )}

                  {/* Corner Label Files (A-H only on row 7) */}
                  {r === 7 && (
                    <span className={`absolute bottom-0.5 right-1 text-[9px] font-sans font-bold leading-none select-none z-20 ${
                      isDark ? 'text-[#eecda3]/75' : 'text-[#916545]/85'
                    }`}>
                      {fileLabels[actualC].toUpperCase()}
                    </span>
                  )}

                  {/* Corner Label Ranks (1-8 only on col 0) */}
                  {c === 0 && (
                    <span className={`absolute top-0.5 left-1 text-[9px] font-sans font-bold leading-none select-none z-20 ${
                      isDark ? 'text-[#eecda3]/75' : 'text-[#916545]/85'
                    }`}>
                      {rankLabels[actualR]}
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>

        {/* Promotion Floating Modal Layer */}
        {promotionPendingMove && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 rounded-2xl animate-fade-in">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm text-center shadow-2xl relative">
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Evolution
              </div>
              <h4 className="text-amber-200 font-bold text-lg mb-1 mt-1">Pawn Promotion</h4>
              <p className="text-slate-400 text-xs mb-5">Choose the piece to replace this pawn</p>
              
              <div className="grid grid-cols-4 gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                {(['q', 'r', 'b', 'n'] as PieceType[]).map((type) => {
                  const label = type === 'q' ? 'Queen' : type === 'r' ? 'Rook' : type === 'b' ? 'Bishop' : 'Knight';
                  return (
                    <button
                      key={type}
                      id={`promo_${type}_btn`}
                      onClick={() => handlePromotionSelect(type)}
                      className="group flex flex-col items-center p-2.5 rounded-lg bg-slate-850 hover:bg-amber-500/20 border border-slate-705 border-slate-700/60 hover:border-amber-500 transition-all duration-150 transform hover:-translate-y-1"
                    >
                      <span className={`text-4xl leading-none mb-1 ${
                        turn === 'w' ? 'text-[#f7e4c2]' : 'text-zinc-300'
                      }`}>
                        {pieceSymbols[type]}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-medium group-hover:text-amber-300">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Info Status under the board */}
      <div className="w-full mt-3 flex items-center justify-between text-xs px-2 text-slate-400 font-mono">
        <div className="flex items-center gap-1">
          {isKingChecked && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              KING UNDER ATTACK!
            </span>
          )}
        </div>
        <div className="text-slate-400 select-none">
          {disabled ? (
            <span className="text-slate-500">Wait for turn activation</span>
          ) : (
            <span className="text-emerald-400 font-semibold">Active Board Grid</span>
          )}
        </div>
      </div>
    </div>
  );
};
