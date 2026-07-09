/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type Color = 'w' | 'b';

export interface Piece {
  id: string; // Unique ID to keep React keys stable for animations
  type: PieceType;
  color: Color;
  hasMoved: boolean;
}

export type BoardState = (Piece | null)[][];

export interface Position {
  r: number; // Row (0 to 7)
  c: number; // Column (0 to 7)
}

export type MoveType = 'normal' | 'castle-king' | 'castle-queen' | 'en-passant' | 'promotion';

export interface Move {
  from: Position;
  to: Position;
  type: MoveType;
  piece: Piece;
  captured?: Piece;
  promotionType?: PieceType;
  enPassantTargetCell?: Position; // Position of the pawn captured during en passant
}

export interface GameState {
  board: BoardState;
  turn: Color;
  diceRoll: number | null;
  movesRemaining: number;
  movesMadeThisTurn: number;
  lastMove: Move | null; // Necessary for En Passant calculation
  isRolling: boolean;
  gameStatus: 'rolling' | 'playing' | 'checkmate' | 'stalemate' | 'insufficient_material' | 'threefold_repetition' | 'fifty_moves_draw' | 'agreed_draw';
  statusMessage: string;
  history: {
    move: Move;
    notation: string;
    roll: number;
    moveIndex: number; // Index within the turn (e.g. 1st of 4, etc.)
  }[];
  halfmoveClock: number; // For 50-move rule
  fullmoveNumber: number;
  whiteKingMoved: boolean;
  whiteRookKMoved: boolean;
  whiteRookQMoved: boolean;
  blackKingMoved: boolean;
  blackRookKMoved: boolean;
  blackRookQMoved: boolean;
  whiteTurnCount: number; // Turn count of White
  blackTurnCount: number; // Turn count of Black
}
