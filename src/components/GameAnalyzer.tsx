import { useState, useEffect, useMemo } from 'react';
import { BoardState, Color, Move } from '../types';
import { ChessBoard } from './ChessBoard';
import { initializeBoard, executeMove } from '../chessEngine';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  BookOpen, 
  ArrowLeft,
  Trophy,
  Activity,
  User,
  Hash
} from 'lucide-react';

interface GameAnalyzerProps {
  game: any;
  onBackToLobby: () => void;
  playerColor?: 'w' | 'b' | 'spectator' | null;
}

export function GameAnalyzer({ game, onBackToLobby, playerColor }: GameAnalyzerProps) {
  // Extract state properties
  const history = useMemo(() => {
    if (!game.history) return [];
    if (typeof game.history === 'string') {
      try {
        return JSON.parse(game.history);
      } catch {
        return [];
      }
    }
    return game.history;
  }, [game.history]);

  // Pre-calculate all board states for fast navigation
  const boardStates = useMemo(() => {
    const list: BoardState[] = [initializeBoard()];
    let current = list[0];
    for (const record of history) {
      if (record.move) {
        current = executeMove(current, record.move);
        list.push(current);
      }
    }
    return list;
  }, [history]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-set currentIndex to the end when match is loaded
  useEffect(() => {
    setCurrentIndex(boardStates.length - 1);
  }, [boardStates]);

  const currentBoard = boardStates[currentIndex] || initializeBoard();
  const currentRecord = currentIndex > 0 ? history[currentIndex - 1] : null;

  // Navigation handlers
  const handleStart = () => setCurrentIndex(0);
  const handlePrev = () => setCurrentIndex(prev => Math.max(0, prev - 1));
  const handleNext = () => setCurrentIndex(prev => Math.min(boardStates.length - 1, prev + 1));
  const handleEnd = () => setCurrentIndex(boardStates.length - 1);

  // Group history into rounds (White then Black pairs) for ledger view
  const rounds = useMemo(() => {
    const rxs: any[] = [];
    for (let i = 0; i < history.length; i++) {
      const record = history[i];
      const stepIndex = i + 1; // 1-indexed step matching state index
      const rollLabel = record.roll !== undefined ? `Rolled: ${record.roll}` : '';

      // Determine who played this step
      const isWhite = i % 2 === 0; // standard alternate
      const roundIndex = Math.floor(i / 2) + 1;

      let rObj = rxs.find(r => r.roundIndex === roundIndex);
      if (!rObj) {
        rObj = { roundIndex, white: null, black: null };
        rxs.push(rObj);
      }

      const moveDetails = {
        notation: record.notation || 'Move',
        roll: record.roll,
        stepIndex,
        rollLabel
      };

      if (isWhite) {
        rObj.white = moveDetails;
      } else {
        rObj.black = moveDetails;
      }
    }
    return rxs;
  }, [history]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 select-none animate-fade-in px-2">
      
      {/* Upper Control Bar */}
      <div className="flex items-center justify-between border-b border-[#3b2313] pb-4">
        <button
          onClick={onBackToLobby}
          id="analyzer_back_btn"
          className="px-4 py-2 bg-[#2d1b10] hover:bg-[#3d2516] border border-[#54351f] text-[#eecda3] rounded-xl transition-all duration-150 flex items-center gap-1.5 text-xs font-serif shadow-sm active:scale-95"
        >
          <ArrowLeft className="w-4 h-4 text-[#caa469]" />
          <span>Exit Analyzer</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] text-[#caa469] font-sans font-bold tracking-[0.15em] uppercase block">Analysis Dashboard</span>
          <h2 className="text-base font-serif font-bold text-[#faf0dc] uppercase">Historical Study</h2>
        </div>

        <div className="flex items-center gap-2 bg-[#0d0603] border border-[#3b2313] px-3.5 py-1.5 rounded-xl text-xs font-serif italic text-[#b89a74]">
          <BookOpen className="w-4 h-4 text-[#caa469] not-italic shrink-0" />
          <span>Progress Logged</span>
        </div>
      </div>

      {/* Main split grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left component: Static disabled Chessboard */}
        <div className="lg:col-span-7 space-y-4 flex flex-col items-center">
          
          {/* Active step details overhead */}
          <div className="w-full max-w-[460px] bg-[#120804]/90 border border-[#321c0e] p-3 rounded-2xl flex items-center justify-between text-xs font-serif text-[#caa469]">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#ab8a6b]" />
              <span>Step <strong className="text-[#faf0dc] font-sans font-bold">{currentIndex}</strong> of {boardStates.length - 1}</span>
            </div>
            {currentRecord ? (
              <span className="text-[#faf0dc] font-sans font-bold bg-[#caa469]/10 border border-[#caa469]/20 px-2.5 py-0.5 rounded-lg">
                Move: {currentRecord.notation} {currentRecord.roll ? `(Die: ${currentRecord.roll})` : ''}
              </span>
            ) : (
              <span className="text-[#866f5a] italic">Starting position</span>
            )}
          </div>

          <ChessBoard
            board={currentBoard}
            turn={currentRecord ? (currentIndex % 2 === 0 ? 'w' : 'b') : 'w'}
            lastMove={currentRecord ? currentRecord.move : null}
            movesRemaining={0}
            onMoveSelected={() => {}}
            isKingChecked={false}
            disabled={true}
            orientation={playerColor === 'b' ? 'b' : 'w'}
          />

          {/* Stepper slider navigators */}
          <div className="w-full max-w-[460px] bg-gradient-to-r from-[#21140c] via-[#1a0f07] to-[#251710] border border-[#482d1c] p-4 rounded-2xl shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between gap-1.5">
              <button
                onClick={handleStart}
                disabled={currentIndex === 0}
                className="p-2.5 bg-[#2d1b10] hover:bg-[#3d2516] disabled:opacity-30 disabled:pointer-events-none text-[#eecda3] border border-[#52331b] rounded-xl transition-all"
                title="Rewind to start"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-2.5 bg-[#2d1b10] hover:bg-[#3d2516] disabled:opacity-30 disabled:pointer-events-none text-[#eecda3] border border-[#52331b] rounded-xl transition-all flex items-center gap-1 font-serif text-xs px-4"
                title="Step backward"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              
              <span className="text-xs font-sans text-[#dfd0bd] font-bold px-1 select-none">
                {currentIndex} / {boardStates.length - 1}
              </span>

              <button
                onClick={handleNext}
                disabled={currentIndex === boardStates.length - 1}
                className="p-2.5 bg-[#2d1b10] hover:bg-[#3d2516] disabled:opacity-30 disabled:pointer-events-none text-[#eecda3] border border-[#52331b] rounded-xl transition-all flex items-center gap-1 font-serif text-xs px-4"
                title="Step forward"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleEnd}
                disabled={currentIndex === boardStates.length - 1}
                className="p-2.5 bg-[#2d1b10] hover:bg-[#3d2516] disabled:opacity-30 disabled:pointer-events-none text-[#eecda3] border border-[#52331b] rounded-xl transition-all"
                title="Skip to live state"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            {/* Live horizontal click timeline bar */}
            <div className="relative w-full h-1.5 bg-[#0f0704]/80 rounded-full overflow-hidden border border-[#3b2313] mt-1.5">
              <div 
                className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-[#caa469] to-[#dfb455] rounded-full transition-all"
                style={{ width: `${(boardStates.length > 1) ? (currentIndex / (boardStates.length - 1)) * 100 : 0}%` }}
              />
              <input 
                type="range" 
                min="0" 
                max={boardStates.length - 1} 
                value={currentIndex}
                onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Right component: The ledger chronicle */}
        <div className="lg:col-span-5 bg-gradient-to-b from-[#21140c] to-[#1a0f08] border border-[#482d1c] p-5 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.65)] flex flex-col h-[520px]">
          
          {/* Match metadata card */}
          <div className="bg-[#0f0704]/90 border border-[#321c0e] p-3.5 rounded-xl mb-4 text-xs font-serif text-[#aa8e73] space-y-1.5 shadow-inner">
            <span className="text-[9px] text-[#caa469] font-sans font-bold tracking-[0.15em] block uppercase">Match Dossier</span>
            <div className="text-[#efe3cb] font-bold text-xs truncate flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#caa469] shrink-0" />
              <span>{game.whiteName} vs {game.blackName}</span>
            </div>
            <p className="italic text-[#dfd0bd] text-[11px] leading-relaxed">
              Match Status: {game.statusMessage}
            </p>
          </div>

          <div className="text-xs font-sans font-bold text-[#b89a74] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-[#caa469]" />
            <span>Turn Chronicle</span>
          </div>

          {/* Subheader titles */}
          <div className="grid grid-cols-[38px_1fr_1fr] gap-2 px-2 py-1.5 text-[10px] font-sans font-bold tracking-wider text-[#9d8368] uppercase border-b border-[#3b2313] mb-2 select-none">
            <span className="text-center">Rnd</span>
            <span className="pl-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#fceec9] shadow-[0_0_4px_#fceec9]" />White</span>
            <span className="pl-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#18110a] border border-[#aa8e73]" />Black</span>
          </div>

          {/* Scrolling Ledger */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {rounds.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center text-[#aa8e73] italic">
                <span>The first turn has not yet nested.</span>
              </div>
            ) : (
              rounds.map((round, rIndex) => (
                <div key={rIndex} className="grid grid-cols-[38px_1fr_1fr] items-center gap-2 py-0.5">
                  <span className="text-[11px] font-serif font-bold text-[#b5987a] text-center select-none">
                    {round.roundIndex}.
                  </span>

                  {/* White Step box */}
                  {round.white && (
                    <button
                      onClick={() => setCurrentIndex(round.white.stepIndex)}
                      className={`text-left px-2 py-1.5 rounded-lg border text-xs font-serif transition-all truncate flex flex-col gap-0.5 ${
                        currentIndex === round.white.stepIndex
                          ? 'bg-[#caa469] text-[#1c0f05] border-[#caa469] font-bold shadow-sm'
                          : 'bg-[#170e06] text-[#faf0dc] border-[#442a17] hover:border-[#caa469]/50'
                      }`}
                    >
                      <span>{round.white.notation}</span>
                      {round.white.roll && (
                        <span className={`text-[8px] font-sans uppercase font-bold tracking-wider ${
                          currentIndex === round.white.stepIndex ? 'text-[#1c0f05]/70' : 'text-[#ab8a6b]'
                        }`}>
                          {round.white.rollLabel}
                        </span>
                      )}
                    </button>
                  )}

                  {/* Black Step box */}
                  {round.black ? (
                    <button
                      onClick={() => setCurrentIndex(round.black.stepIndex)}
                      className={`text-left px-2 py-1.5 rounded-lg border text-xs font-serif transition-all truncate flex flex-col gap-0.5 ${
                        currentIndex === round.black.stepIndex
                          ? 'bg-[#caa469] text-[#1c0f05] border-[#caa469] font-bold shadow-sm'
                          : 'bg-[#170e06] text-[#cfbfa3] border-[#442a17] hover:border-[#caa469]/50'
                      }`}
                    >
                      <span>{round.black.notation}</span>
                      {round.black.roll && (
                        <span className={`text-[8px] font-sans uppercase font-bold tracking-wider ${
                          currentIndex === round.black.stepIndex ? 'text-[#1c0f05]/70' : 'text-[#ab8a6b]'
                        }`}>
                          {round.black.rollLabel}
                        </span>
                      )}
                    </button>
                  ) : (
                    round.white && <div className="h-[28px]" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
