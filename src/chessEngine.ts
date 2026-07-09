/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BoardState, Color, Piece, PieceType, Position, Move, MoveType } from './types';

export function initializeBoard(): BoardState {
  const board: BoardState = Array(8).fill(null).map(() => Array(8).fill(null));

  const backRow = (color: Color): PieceType[] => ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

  // Set up back rows
  const blackBack = backRow('b');
  const whiteBack = backRow('w');

  for (let c = 0; c < 8; c++) {
    board[0][c] = { id: `b-${blackBack[c]}-${c}`, type: blackBack[c], color: 'b', hasMoved: false };
    board[1][c] = { id: `b-p-${c}`, type: 'p', color: 'b', hasMoved: false };

    board[6][c] = { id: `w-p-${c}`, type: 'p', color: 'w', hasMoved: false };
    board[7][c] = { id: `w-${whiteBack[c]}-${c}`, type: whiteBack[c], color: 'w', hasMoved: false };
  }

  return board;
}

export function cloneBoard(board: BoardState): BoardState {
  return board.map(row => row.map(piece => piece ? { ...piece } : null));
}

export function findKing(board: BoardState, color: Color): Position | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        return { r, c };
      }
    }
  }
  return null;
}

export function isAttacked(board: BoardState, r: number, c: number, attackerColor: Color): boolean {
  // Knight attacks
  const nMoves = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  for (const [dr, dc] of nMoves) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr][nc];
      if (p && p.type === 'n' && p.color === attackerColor) return true;
    }
  }

  // Orthogonal attacks (Rook, Queen)
  const rookDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dr, dc] of rookDirs) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === attackerColor && (p.type === 'r' || p.type === 'q')) {
          return true;
        }
        break; // Blocked
      }
      nr += dr;
      nc += dc;
    }
  }

  // Diagonal attacks (Bishop, Queen)
  const bishopDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  for (const [dr, dc] of bishopDirs) {
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr][nc];
      if (p) {
        if (p.color === attackerColor && (p.type === 'b' || p.type === 'q')) {
          return true;
        }
        break; // Blocked
      }
      nr += dr;
      nc += dc;
    }
  }

  // King attacks
  const kingDirs = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];
  for (const [dr, dc] of kingDirs) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr][nc];
      if (p && p.type === 'k' && p.color === attackerColor) return true;
    }
  }

  // Pawn attacks
  // If attacker is White, pawns attack from below (higher row index to lower)
  // If attacker is Black, pawns attack from above (lower row index to higher)
  const pRowOffset = attackerColor === 'w' ? 1 : -1;
  for (const dc of [-1, 1]) {
    const nr = r + pRowOffset, nc = c + dc;
    if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const p = board[nr][nc];
      if (p && p.type === 'p' && p.color === attackerColor) return true;
    }
  }

  return false;
}

export function isKingInCheck(board: BoardState, color: Color): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  const enemyColor = color === 'w' ? 'b' : 'w';
  return isAttacked(board, kingPos.r, kingPos.c, enemyColor);
}

export function getPseudoLegalMoves(board: BoardState, r: number, c: number, lastMove: Move | null): Move[] {
  const moves: Move[] = [];
  const piece = board[r][c];
  if (!piece) return [];

  const color = piece.color;
  const enemyColor = color === 'w' ? 'b' : 'w';

  switch (piece.type) {
    case 'p': {
      // Directions
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;

      // Single step forward
      const f1r = r + dir;
      if (f1r >= 0 && f1r < 8 && !board[f1r][c]) {
        // Is it promotion?
        if (f1r === promoRow) {
          const promoTypes: PieceType[] = ['q', 'r', 'b', 'n'];
          for (const pt of promoTypes) {
            moves.push({
              from: { r, c },
              to: { r: f1r, c },
              type: 'promotion',
              piece,
              promotionType: pt
            });
          }
        } else {
          moves.push({
            from: { r, c },
            to: { r: f1r, c },
            type: 'normal',
            piece
          });
        }

        // Double step forward (only if first is free and at starting row)
        const f2r = r + 2 * dir;
        if (r === startRow && !board[f2r][c]) {
          moves.push({
            from: { r, c },
            to: { r: f2r, c },
            type: 'normal',
            piece
          });
        }
      }

      // Diagonals for capture
      const capCols = [c - 1, c + 1];
      for (const cc of capCols) {
        if (cc >= 0 && cc < 8) {
          const tarPiece = board[f1r] ? board[f1r][cc] : null;
          if (tarPiece && tarPiece.color === enemyColor) {
            if (f1r === promoRow) {
              const promoTypes: PieceType[] = ['q', 'r', 'b', 'n'];
              for (const pt of promoTypes) {
                moves.push({
                  from: { r, c },
                  to: { r: f1r, c: cc },
                  type: 'promotion',
                  piece,
                  captured: tarPiece,
                  promotionType: pt
                });
              }
            } else {
              moves.push({
                from: { r, c },
                to: { r: f1r, c: cc },
                type: 'normal',
                piece,
                captured: tarPiece
              });
            }
          }

          // En Passant
          // White on row 3, Black pawn double stepped on previous turn to row 3
          // Black on row 4, White pawn double stepped on previous turn to row 4
          const epRow = color === 'w' ? 3 : 4;
          if (r === epRow && lastMove && lastMove.piece.type === 'p' && lastMove.piece.color === enemyColor) {
            if (Math.abs(lastMove.from.r - lastMove.to.r) === 2 && lastMove.to.c === cc) {
              moves.push({
                from: { r, c },
                to: { r: f1r, c: cc },
                type: 'en-passant',
                piece,
                captured: lastMove.piece,
                enPassantTargetCell: { r, c: cc }
              });
            }
          }
        }
      }
      break;
    }

    case 'n': {
      const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of offsets) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const tarPiece = board[nr][nc];
          if (!tarPiece || tarPiece.color === enemyColor) {
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              type: 'normal',
              piece,
              captured: tarPiece || undefined
            });
          }
        }
      }
      break;
    }

    case 'b':
    case 'r':
    case 'q': {
      const dirs: number[][] = [];
      if (piece.type === 'r' || piece.type === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }
      if (piece.type === 'b' || piece.type === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }

      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const tarPiece = board[nr][nc];
          if (!tarPiece) {
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              type: 'normal',
              piece
            });
          } else {
            if (tarPiece.color === enemyColor) {
              moves.push({
                from: { r, c },
                to: { r: nr, c: nc },
                type: 'normal',
                piece,
                captured: tarPiece
              });
            }
            break; // Blocked
          }
          nr += dr;
          nc += dc;
        }
      }
      break;
    }

    case 'k': {
      // Normal single steps
      const kingDirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
      ];
      for (const [dr, dc] of kingDirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const tarPiece = board[nr][nc];
          if (!tarPiece || tarPiece.color === enemyColor) {
            moves.push({
              from: { r, c },
              to: { r: nr, c: nc },
              type: 'normal',
              piece,
              captured: tarPiece || undefined
            });
          }
        }
      }

      // Castling
      // Cannot castle if King has moved or King is currently in Check
      const isCurrentlyChecked = isKingInCheck(board, color);
      if (!piece.hasMoved && !isCurrentlyChecked) {
        // King side (castle short)
        // Pieces between King and Rook must be empty
        // Rook must exist, belong to same side, and not have moved
        // Squares crossed by King (f1, g1 for White; f8, g8 for Black) must not be attacked
        const rookColK = 7;
        const rookK = board[r][rookColK];
        if (rookK && rookK.type === 'r' && rookK.color === color && !rookK.hasMoved) {
          const emptyK1 = board[r][5] === null;
          const emptyK2 = board[r][6] === null;
          if (emptyK1 && emptyK2) {
            const path1Attacked = isAttacked(board, r, 5, enemyColor);
            const path2Attacked = isAttacked(board, r, 6, enemyColor);
            if (!path1Attacked && !path2Attacked) {
              moves.push({
                from: { r, c },
                to: { r, c: 6 },
                type: 'castle-king',
                piece
              });
            }
          }
        }

        // Queen side (castle long)
        // Pieces between empty (b1/c1/d1 for White; b8/c8/d8 for Black)
        // Squares c1, d1 (for White) or c8, d8 (for Black) must not be attacked
        const rookColQ = 0;
        const rookQ = board[r][rookColQ];
        if (rookQ && rookQ.type === 'r' && rookQ.color === color && !rookQ.hasMoved) {
          const emptyQ1 = board[r][1] === null;
          const emptyQ2 = board[r][2] === null;
          const emptyQ3 = board[r][3] === null;
          if (emptyQ1 && emptyQ2 && emptyQ3) {
            const pathQ1Attacked = isAttacked(board, r, 3, enemyColor); // d-file
            const pathQ2Attacked = isAttacked(board, r, 2, enemyColor); // c-file
            // b-file can be attacked (it doesn't violate rules, King only crosses d-file and lands on c-file)
            if (!pathQ1Attacked && !pathQ2Attacked) {
              moves.push({
                from: { r, c },
                to: { r, c: 2 },
                type: 'castle-queen',
                piece
              });
            }
          }
        }
      }
      break;
    }
  }

  return moves;
}

export function getValidMoves(board: BoardState, r: number, c: number, lastMove: Move | null): Move[] {
  const p = board[r][c];
  if (!p) return [];

  const pseudo = getPseudoLegalMoves(board, r, c, lastMove);
  const legal: Move[] = [];

  for (const m of pseudo) {
    // Simulate move
    const tempBoard = cloneBoard(board);
    simulateMoveInPlace(tempBoard, m);

    // If king of current moving player's color is NOT in check, it is a valid legal move
    if (!isKingInCheck(tempBoard, p.color)) {
      legal.push(m);
    }
  }

  return legal;
}

function simulateMoveInPlace(board: BoardState, move: Move) {
  const { from, to, type, promotionType } = move;
  const piece = board[from.r][from.c];
  if (!piece) return;

  // Move the piece
  board[from.r][from.c] = null;

  if (type === 'normal') {
    board[to.r][to.c] = piece;
  } else if (type === 'promotion' && promotionType) {
    board[to.r][to.c] = {
      id: piece.id,
      type: promotionType,
      color: piece.color,
      hasMoved: true
    };
  } else if (type === 'en-passant') {
    board[to.r][to.c] = piece;
    // Remove the target pawn
    if (move.enPassantTargetCell) {
      board[move.enPassantTargetCell.r][move.enPassantTargetCell.c] = null;
    }
  } else if (type === 'castle-king') {
    board[to.r][to.c] = piece;
    // Move the Rook from h to f
    const rCol = 7;
    const rook = board[from.r][rCol];
    if (rook) {
      board[from.r][rCol] = null;
      board[from.r][5] = { ...rook, hasMoved: true };
    }
  } else if (type === 'castle-queen') {
    board[to.r][to.c] = piece;
    // Move the Rook from a to d
    const rCol = 0;
    const rook = board[from.r][rCol];
    if (rook) {
      board[from.r][rCol] = null;
      board[from.r][3] = { ...rook, hasMoved: true };
    }
  }
}

export function executeMove(
  board: BoardState,
  move: Move
): BoardState {
  const nextBoard = cloneBoard(board);
  const { from, to, type, promotionType } = move;
  const piece = nextBoard[from.r][from.c];
  if (!piece) return board;

  nextBoard[from.r][from.c] = null;

  const movedPiece = { ...piece, hasMoved: true };

  if (type === 'normal') {
    nextBoard[to.r][to.c] = movedPiece;
  } else if (type === 'promotion' && promotionType) {
    nextBoard[to.r][to.c] = {
      id: piece.id,
      type: promotionType,
      color: piece.color,
      hasMoved: true
    };
  } else if (type === 'en-passant') {
    nextBoard[to.r][to.c] = movedPiece;
    if (move.enPassantTargetCell) {
      nextBoard[move.enPassantTargetCell.r][move.enPassantTargetCell.c] = null;
    }
  } else if (type === 'castle-king') {
    nextBoard[to.r][to.c] = movedPiece;
    const rCol = 7;
    const rook = nextBoard[from.r][rCol];
    if (rook) {
      nextBoard[from.r][rCol] = null;
      nextBoard[from.r][5] = { ...rook, hasMoved: true };
    }
  } else if (type === 'castle-queen') {
    nextBoard[to.r][to.c] = movedPiece;
    const rCol = 0;
    const rook = nextBoard[from.r][rCol];
    if (rook) {
      nextBoard[from.r][rCol] = null;
      nextBoard[from.r][3] = { ...rook, hasMoved: true };
    }
  }

  return nextBoard;
}

export function hasLegalMoves(board: BoardState, color: Color, lastMove: Move | null): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.color === color) {
        const moves = getValidMoves(board, r, c, lastMove);
        if (moves.length > 0) return true;
      }
    }
  }
  return false;
}

/**
 * Check if the material on board makes checkmate impossible
 */
export function isInsufficientMaterial(board: BoardState): boolean {
  // Count pieces
  const pieces: { [key: string]: number } = { w: 0, b: 0, total: 0 };
  const pieceList: { type: PieceType, color: Color }[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        pieces[p.color]++;
        pieces.total++;
        if (p.type !== 'k') {
          pieceList.push({ type: p.type, color: p.color });
        }
      }
    }
  }

  // King vs King
  if (pieces.total === 2) return true;

  // King & Bishop vs King or King & Knight vs King
  if (pieces.total === 3) {
    const p = pieceList[0];
    if (p.type === 'b' || p.type === 'n') return true;
  }

  // King & Bishop vs King & Bishop (same square colour - simple check is skipped for simplicity but we support it if needed)
  return false;
}

/**
 * Standard algebraic notation converter
 */
export function getMoveNotation(move: Move, isCheck: boolean, isMate: boolean): string {
  if (move.type === 'castle-king') return 'O-O';
  if (move.type === 'castle-queen') return 'O-O-O';

  let notation = '';
  const pieceSymbol = move.piece.type.toUpperCase();

  if (move.piece.type !== 'p') {
    notation += pieceSymbol;
  } else if (move.captured || move.type === 'en-passant') {
    // Pawn capturing shows starting file e.g., exd5
    const fileSymbols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    notation += fileSymbols[move.from.c];
  }

  if (move.captured || move.type === 'en-passant') {
    notation += 'x';
  }

  const fileSymbols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const rankSymbol = (8 - move.to.r).toString();
  notation += fileSymbols[move.to.c] + rankSymbol;

  if (move.type === 'promotion' && move.promotionType) {
    notation += '=' + move.promotionType.toUpperCase();
  }

  if (isMate) {
    notation += '#';
  } else if (isCheck) {
    notation += '+';
  }

  return notation;
}

/**
 * Generates simple representation of the board state to implement threefold repetition
 */
export function getBoardHash(
  board: BoardState,
  turn: Color,
  whiteKingMoved: boolean,
  whiteRookKMoved: boolean,
  whiteRookQMoved: boolean,
  blackKingMoved: boolean,
  blackRookKMoved: boolean,
  blackRookQMoved: boolean,
  lastMove: Move | null
): string {
  let hash = '';
  // 1. Board setup
  for (let r = 0; r < 8; r++) {
    let emptyCount = 0;
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p) {
        if (emptyCount > 0) {
          hash += emptyCount;
          emptyCount = 0;
        }
        const char = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
        hash += char;
      } else {
        emptyCount++;
      }
    }
    if (emptyCount > 0) hash += emptyCount;
    if (r < 7) hash += '/';
  }

  // 2. Active color
  hash += ` ${turn}`;

  // 3. Castle rights
  let castleStr = '';
  if (!whiteKingMoved) {
    if (!whiteRookKMoved) castleStr += 'K';
    if (!whiteRookQMoved) castleStr += 'Q';
  }
  if (!blackKingMoved) {
    if (!blackRookKMoved) castleStr += 'k';
    if (!blackRookQMoved) castleStr += 'q';
  }
  hash += ' ' + (castleStr || '-');

  // 4. En Passant target square
  if (lastMove && lastMove.piece.type === 'p' && Math.abs(lastMove.from.r - lastMove.to.r) === 2) {
    const fileSymbols = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const col = lastMove.to.c;
    const epRow = lastMove.piece.color === 'w' ? 5 : 2; // Behind the advanced pawn
    const epRankStr = (8 - epRow).toString();
    hash += ` ${fileSymbols[col]}${epRankStr}`;
  } else {
    hash += ' -';
  }

  return hash;
}
