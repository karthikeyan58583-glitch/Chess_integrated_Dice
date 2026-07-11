import { useState, useEffect, useMemo, useRef } from 'react';
import { BoardState, Color, Move, GameState } from './types';
import {
  initializeBoard,
  isKingInCheck,
  executeMove,
  hasLegalMoves,
  isInsufficientMaterial,
  getMoveNotation,
  getBoardHash,
  getValidMoves
} from './chessEngine';
import { Dice3D } from './components/Dice3D';
import { ChessBoard } from './components/ChessBoard';
import { MoveLog } from './components/MoveLog';
import { RulesModal } from './components/RulesModal';
import { GameList } from './components/GameList';
import { GameAnalyzer } from './components/GameAnalyzer';
import { 
  ShieldAlert, 
  Trophy, 
  HelpCircle, 
  RefreshCcw, 
  Swords, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  AlertTriangle,
  ArrowLeft,
  CircleDot
} from 'lucide-react';

const getNextTurnSetup = (opponentColor: Color, whiteTurnCount: number, blackTurnCount: number) => {
  const oppTurnCount = opponentColor === 'w' ? whiteTurnCount : blackTurnCount;
  if (oppTurnCount <= 5) {
    // Phase 1: No rolling. Direct play. 1 move.
    return {
      gameStatus: 'playing' as const,
      diceRoll: null,
      movesRemaining: 1,
      statusMessage: `${opponentColor === 'w' ? 'White' : 'Black'}'s Turn (Phase 1: Automatic 1 move. No roll needed!)`
    };
  } else if (oppTurnCount <= 10) {
    // Phase 2: Rolling required. Max 3.
    return {
      gameStatus: 'rolling' as const,
      diceRoll: null,
      movesRemaining: 0,
      statusMessage: `${opponentColor === 'w' ? 'White' : 'Black'}'s Turn (Phase 2 - Roll 1-3). Roll the dice to allocate moves!`
    };
  } else {
    // Phase 3: Rolling required. Max 6.
    return {
      gameStatus: 'rolling' as const,
      diceRoll: null,
      movesRemaining: 0,
      statusMessage: `${opponentColor === 'w' ? 'White' : 'Black'}'s Turn (Phase 3 - Roll 1-6). Roll the dice to allocate moves!`
    };
  }
};

const INITIAL_GAME_STATE: GameState = {
  board: [],
  turn: 'w',
  diceRoll: null,
  movesRemaining: 1,
  movesMadeThisTurn: 0,
  lastMove: null,
  isRolling: false,
  gameStatus: 'playing',
  statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)",
  history: [],
  halfmoveClock: 0,
  fullmoveNumber: 1,
  whiteKingMoved: false,
  whiteRookKMoved: false,
  whiteRookQMoved: false,
  blackKingMoved: false,
  blackRookKMoved: false,
  blackRookQMoved: false,
  whiteTurnCount: 1,
  blackTurnCount: 1,
};

export default function App() {
  // Local client-side authentication and navigation state
  const [user] = useState(() => {
    let id = sessionStorage.getItem('dice_chess_user_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 11);
      sessionStorage.setItem('dice_chess_user_id', id);
    }
    return {
      uid: id,
      displayName: 'Player ' + id.substring(7).toUpperCase(),
      photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`
    };
  });

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [hostPreferredColor, setHostPreferredColor] = useState<'w' | 'b' | 'random' | null>(null);
  const [rawGameDoc, setRawGameDoc] = useState<any | null>(null);
  const [isAnalyseMode, setIsAnalyseMode] = useState(false);
  const [userStats, setUserStats] = useState(() => {
    try {
      const saved = localStorage.getItem('dice_chess_local_stats');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { wins: 0, losses: 0, draws: 0 };
  });

  const [playerColor, setPlayerColor] = useState<'w' | 'b' | 'spectator' | null>(null);
  const playerColorRef = useRef<'w' | 'b' | 'spectator' | null>(null);
  const [opponentConnected, setOpponentConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const [isP2PConnected, setIsP2PConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);

  // Core local game state
  const [gameState, setGameState] = useState<GameState>(() => {
    return {
      ...INITIAL_GAME_STATE,
      board: initializeBoard()
    };
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [repetitionHashes, setRepetitionHashes] = useState<string[]>([]);
  const [drawProposal, setDrawProposal] = useState<{ proposedBy: Color } | null>(null);

  // Active status variables
  const {
    board,
    turn,
    diceRoll,
    movesRemaining,
    movesMadeThisTurn,
    lastMove,
    isRolling,
    gameStatus,
    statusMessage,
    history,
    whiteKingMoved,
    whiteRookKMoved,
    whiteRookQMoved,
    blackKingMoved,
    blackRookKMoved,
    blackRookQMoved
  } = gameState;

  // Handle initial load with room URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const room = urlParams.get('room');
    const side = urlParams.get('side') as 'w' | 'b' | 'random' | null;
    if (room) {
      setSelectedGameId(room);
      if (side) {
        setHostPreferredColor(side);
      }
    }
  }, []);

  // WebSocket subscription for multiplayer gameplay
  useEffect(() => {
    if (!selectedGameId || selectedGameId === 'cpu' || selectedGameId === 'local') {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    let isDisposed = false;
    let reconnectTimeout: any;

    const setupWebRTC = async (color: 'w' | 'b') => {
      console.log(`Setting up WebRTC for color: ${color}`);
      if (pcRef.current) {
        pcRef.current.close();
      }

      let iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ];

      try {
        const response = await fetch('/api/webrtc-config');
        if (response.ok) {
          const config = await response.json();
          if (config.iceServers) {
            iceServers = config.iceServers;
          }
        }
      } catch (err) {
        console.warn("Failed to fetch WebRTC dynamic config, using local fallbacks:", err);
      }

      if (isDisposed) return;

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      setIsP2PConnected(false);

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'signal',
            signalType: 'candidate',
            candidate: event.candidate,
            roomId: selectedGameId
          }));
        }
      };

      const handleDataChannel = (channel: RTCDataChannel) => {
        dcRef.current = channel;
        channel.onopen = () => {
          setIsP2PConnected(true);
          console.log("WebRTC Peer-to-Peer connected!");
        };
        channel.onclose = () => {
          setIsP2PConnected(false);
          console.log("WebRTC Peer-to-Peer disconnected!");
        };
        channel.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            console.log("P2P Message received:", msg);
            if (msg.type === 'game_state_update') {
              const state = msg.gameState;
              setRawGameDoc(state);
              setGameState({
                board: typeof state.board === 'string' ? JSON.parse(state.board) : state.board,
                turn: state.turn,
                diceRoll: state.diceRoll,
                movesRemaining: state.movesRemaining,
                movesMadeThisTurn: state.movesMadeThisTurn,
                lastMove: state.lastMove,
                isRolling: state.isRolling || false,
                gameStatus: state.status,
                statusMessage: state.statusMessage,
                history: typeof state.history === 'string' ? JSON.parse(state.history) : (state.history || []),
                halfmoveClock: state.halfmoveClock || 0,
                fullmoveNumber: state.fullmoveNumber || 1,
                whiteKingMoved: state.whiteKingMoved || false,
                whiteRookKMoved: state.whiteRookKMoved || false,
                whiteRookQMoved: state.whiteRookQMoved || false,
                blackKingMoved: state.blackKingMoved || false,
                blackRookKMoved: state.blackRookKMoved || false,
                blackRookQMoved: state.blackRookQMoved || false,
                whiteTurnCount: state.whiteTurnCount || 1,
                blackTurnCount: state.blackTurnCount || 1,
              });

              if (state.drawProposedBy) {
                setDrawProposal({ proposedBy: state.drawProposedBy });
              } else {
                setDrawProposal(null);
              }
            } else if (msg.type === 'draw_proposal') {
              setDrawProposal({ proposedBy: msg.proposedBy });
            } else if (msg.type === 'draw_response') {
              if (msg.accepted) {
                setGameState(prev => ({
                  ...prev,
                  gameStatus: 'agreed_draw',
                  statusMessage: 'Match drawn by cooperative agreement!'
                }));
                setRawGameDoc(prev => prev ? { ...prev, status: 'agreed_draw', statusMessage: 'Match drawn by cooperative agreement!', winner: 'draw' } : null);
              } else {
                setDrawProposal(null);
              }
            } else if (msg.type === 'reset') {
              setGameState({
                ...INITIAL_GAME_STATE,
                board: initializeBoard()
              });
              setRawGameDoc(prev => {
                if (!prev) return prev;
                return {
                  ...prev,
                  ...INITIAL_GAME_STATE,
                  board: initializeBoard(),
                  status: 'playing',
                  statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
                };
              });
            }
          } catch (e) {
            console.error("Failed to parse WebRTC P2P message", e);
          }
        };
      };

      if (color === 'b') {
        const dc = pc.createDataChannel('game-sync', { ordered: true });
        handleDataChannel(dc);

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'signal',
              signalType: 'offer',
              offer: offer,
              roomId: selectedGameId
            }));
          }
        } catch (e) {
          console.error("Failed to create offer", e);
        }
      } else {
        pc.ondatachannel = (event) => {
          handleDataChannel(event.channel);
        };
      }
    };

    const connect = () => {
      if (isDisposed) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isDisposed) {
          socket.close();
          return;
        }
        console.log('Connected to WebSocket server');
        setWsConnected(true);
        setConnectionAttempt(0);
        socket.send(JSON.stringify({
          type: 'join',
          roomId: selectedGameId,
          userId: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          preferredColor: hostPreferredColor || 'random'
        }));
      };

      socket.onmessage = async (event) => {
        if (isDisposed) return;
        try {
          const data = JSON.parse(event.data);
          console.log('WS Message received:', data);

          if (data.type === 'joined') {
            setPlayerColor(data.color);
            playerColorRef.current = data.color;
            if (data.color === 'w' || data.color === 'b') {
              setupWebRTC(data.color);
            }
            if (data.gameState) {
              const state = data.gameState;
              setRawGameDoc(state);
              setGameState({
                board: typeof state.board === 'string' ? JSON.parse(state.board) : state.board,
                turn: state.turn,
                diceRoll: state.diceRoll,
                movesRemaining: state.movesRemaining,
                movesMadeThisTurn: state.movesMadeThisTurn,
                lastMove: state.lastMove,
                isRolling: state.isRolling || false,
                gameStatus: state.status,
                statusMessage: state.statusMessage,
                history: typeof state.history === 'string' ? JSON.parse(state.history) : (state.history || []),
                halfmoveClock: state.halfmoveClock || 0,
                fullmoveNumber: state.fullmoveNumber || 1,
                whiteKingMoved: state.whiteKingMoved || false,
                whiteRookKMoved: state.whiteRookKMoved || false,
                whiteRookQMoved: state.whiteRookQMoved || false,
                blackKingMoved: state.blackKingMoved || false,
                blackRookKMoved: state.blackRookKMoved || false,
                blackRookQMoved: state.blackRookQMoved || false,
                whiteTurnCount: state.whiteTurnCount || 1,
                blackTurnCount: state.blackTurnCount || 1,
              });

              if (data.color === 'b') {
                setOpponentConnected(true);
              } else if (data.color === 'spectator') {
                setOpponentConnected(true);
              }
            } else {
              // We are the creator (White)
              const initialState = {
                opponentType: 'online',
                creatorId: user.uid,
                whiteId: user.uid,
                blackId: '',
                whiteName: user.displayName,
                whitePhotoURL: user.photoURL,
                blackName: 'Waiting for opponent...',
                blackPhotoURL: '',
                status: 'waiting',
                statusMessage: 'Share the link above with a friend to start playing!',
                board: initializeBoard(),
                turn: 'w',
                movesRemaining: 1,
                movesMadeThisTurn: 0,
                history: [],
                whiteKingMoved: false,
                whiteRookKMoved: false,
                whiteRookQMoved: false,
                blackKingMoved: false,
                blackRookKMoved: false,
                blackRookQMoved: false,
                whiteTurnCount: 1,
                blackTurnCount: 1,
              };
              setRawGameDoc(initialState);
              setGameState({
                ...INITIAL_GAME_STATE,
                board: initializeBoard(),
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
              });
              socket.send(JSON.stringify({
                type: 'game_state_update',
                roomId: selectedGameId,
                gameState: initialState
              }));
            }
          }

          if (data.type === 'signal') {
            const pc = pcRef.current;
            if (pc) {
              if (data.signalType === 'offer') {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
                  const answer = await pc.createAnswer();
                  await pc.setLocalDescription(answer);
                  if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                      type: 'signal',
                      signalType: 'answer',
                      answer: answer,
                      roomId: selectedGameId
                    }));
                  }
                } catch (e) {
                  console.error("Error setting remote offer / creating answer:", e);
                }
              } else if (data.signalType === 'answer') {
                try {
                  await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                } catch (e) {
                  console.error("Error setting remote answer:", e);
                }
              } else if (data.signalType === 'candidate') {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                  console.warn("Error adding candidate:", e);
                }
              }
            }
          }

          if (data.type === 'opponent_joined') {
            setOpponentConnected(true);
            // IMPORTANT: only (re)build the RTCPeerConnection here if we
            // don't already have one actively handshaking or connected.
            // 'joined' already calls setupWebRTC once for this client, and
            // that offer/answer exchange can complete *before* this
            // 'opponent_joined' message arrives (it's a separate, later
            // WS message). Unconditionally calling setupWebRTC again here
            // used to close and replace the peer connection mid-handshake,
            // which silently killed the data channel the moment it was
            // about to open -- this was the main cause of two players
            // failing to link up / falling back to a laggy state.
            const dc = dcRef.current;
            const dcIsLive = dc && (dc.readyState === 'open' || dc.readyState === 'connecting');
            if (playerColorRef.current === 'w' && !dcIsLive) {
              setupWebRTC('w');
            }
            setRawGameDoc(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                blackName: 'Opponent (Black)',
                status: 'playing',
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
              };
            });
          }

          if (data.type === 'game_state_update') {
            if (dcRef.current && dcRef.current.readyState === 'open') {
              console.log("Ignoring WS game_state_update because WebRTC P2P is active!");
              return;
            }
            const state = data.gameState;
            setRawGameDoc(state);
            setGameState({
              board: typeof state.board === 'string' ? JSON.parse(state.board) : state.board,
              turn: state.turn,
              diceRoll: state.diceRoll,
              movesRemaining: state.movesRemaining,
              movesMadeThisTurn: state.movesMadeThisTurn,
              lastMove: state.lastMove,
              isRolling: state.isRolling || false,
              gameStatus: state.status,
              statusMessage: state.statusMessage,
              history: typeof state.history === 'string' ? JSON.parse(state.history) : (state.history || []),
              halfmoveClock: state.halfmoveClock || 0,
              fullmoveNumber: state.fullmoveNumber || 1,
              whiteKingMoved: state.whiteKingMoved || false,
              whiteRookKMoved: state.whiteRookKMoved || false,
              whiteRookQMoved: state.whiteRookQMoved || false,
              blackKingMoved: state.blackKingMoved || false,
              blackRookKMoved: state.blackRookKMoved || false,
              blackRookQMoved: state.blackRookQMoved || false,
              whiteTurnCount: state.whiteTurnCount || 1,
              blackTurnCount: state.blackTurnCount || 1,
            });

            if (state.drawProposedBy) {
              setDrawProposal({ proposedBy: state.drawProposedBy });
            } else {
              setDrawProposal(null);
            }
          }

          if (data.type === 'draw_proposal') {
            if (dcRef.current && dcRef.current.readyState === 'open') return;
            setDrawProposal({ proposedBy: data.proposedBy });
          }

          if (data.type === 'draw_response') {
            if (dcRef.current && dcRef.current.readyState === 'open') return;
            if (data.accepted) {
              setGameState(prev => ({
                ...prev,
                gameStatus: 'agreed_draw',
                statusMessage: 'Match drawn by cooperative agreement!'
              }));
              setRawGameDoc(prev => prev ? { ...prev, status: 'agreed_draw', statusMessage: 'Match drawn by cooperative agreement!', winner: 'draw' } : null);
            } else {
              setDrawProposal(null);
            }
          }

          if (data.type === 'opponent_disconnected') {
            setOpponentConnected(false);
            setRawGameDoc(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                blackName: playerColor === 'w' ? 'Waiting for opponent...' : prev.blackName,
                whiteName: playerColor === 'b' ? 'Waiting for opponent...' : prev.whiteName,
              };
            });
          }

          if (data.type === 'reset') {
            if (dcRef.current && dcRef.current.readyState === 'open') return;
            setGameState({
              ...INITIAL_GAME_STATE,
              board: initializeBoard()
            });
            setRawGameDoc(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                ...INITIAL_GAME_STATE,
                board: initializeBoard(),
                status: 'playing',
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
              };
            });
          }

        } catch (err) {
          console.error('Error handling WebSocket message:', err);
        }
      };

      socket.onclose = () => {
        if (isDisposed) return;
        setWsConnected(false);
        setIsP2PConnected(false);
        setConnectionAttempt(prev => {
          const nextAttempt = prev + 1;
          // Exponential backoff (1s, 2s, 4s ... capped at 8s) with a touch
          // of jitter so both players don't hammer the server in lockstep.
          const delay = Math.min(1000 * Math.pow(2, prev), 8000) + Math.random() * 300;
          console.log(`WebSocket closed, reconnecting in ~${Math.round(delay)}ms (attempt ${nextAttempt})...`);
          reconnectTimeout = setTimeout(connect, delay);
          return nextAttempt;
        });
      };

      socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        socket.close();
      };
    };

    connect();

    return () => {
      isDisposed = true;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (dcRef.current) {
        dcRef.current.close();
        dcRef.current = null;
      }
      setIsP2PConnected(false);
      setWsConnected(false);
      clearTimeout(reconnectTimeout);
    };
  }, [selectedGameId]);

  // Track state hashes for threefold repetition
  useEffect(() => {
    if (board.length === 0) return;
    const currentHash = getBoardHash(
      board,
      turn,
      whiteKingMoved,
      whiteRookKMoved,
      whiteRookQMoved,
      blackKingMoved,
      blackRookKMoved,
      blackRookQMoved,
      lastMove
    );
    setRepetitionHashes(prev => [...prev, currentHash]);
  }, [board, turn]);

  // Synchronize updates locally and broadcast over WebSocket if online
  const updateGameOnCloud = async (fieldsToUpdate: Partial<any>) => {
    if (!selectedGameId) return;

    setRawGameDoc(prev => {
      const next = prev ? { ...prev, ...fieldsToUpdate } : {
        opponentType: selectedGameId === 'cpu' ? 'cpu' : 'local',
        creatorId: user.uid,
        whiteId: user.uid,
        blackId: selectedGameId === 'cpu' ? 'cpu' : user.uid,
        whiteName: 'White',
        blackName: selectedGameId === 'cpu' ? 'Virtual Chess Engine' : 'Black',
        status: 'playing',
        statusMessage: '',
        board: initializeBoard(),
        turn: 'w',
        movesRemaining: 1,
        movesMadeThisTurn: 0,
        history: [],
        whiteKingMoved: false,
        whiteRookKMoved: false,
        whiteRookQMoved: false,
        blackKingMoved: false,
        blackRookKMoved: false,
        blackRookQMoved: false,
        whiteTurnCount: 1,
        blackTurnCount: 1,
        ...fieldsToUpdate
      };

      const parsedBoard = next.board !== undefined ? (typeof next.board === 'string' ? JSON.parse(next.board) : next.board) : board;
      const parsedHistory = next.history !== undefined ? (typeof next.history === 'string' ? JSON.parse(next.history) : next.history) : history;

      setGameState({
        board: parsedBoard,
        turn: next.turn !== undefined ? next.turn : turn,
        diceRoll: next.diceRoll !== undefined ? next.diceRoll : diceRoll,
        movesRemaining: next.movesRemaining !== undefined ? next.movesRemaining : movesRemaining,
        movesMadeThisTurn: next.movesMadeThisTurn !== undefined ? next.movesMadeThisTurn : movesMadeThisTurn,
        lastMove: next.lastMove !== undefined ? next.lastMove : lastMove,
        isRolling: next.isRolling !== undefined ? next.isRolling : isRolling,
        gameStatus: next.status !== undefined ? next.status : gameStatus,
        statusMessage: next.statusMessage !== undefined ? next.statusMessage : statusMessage,
        history: parsedHistory || [],
        halfmoveClock: next.halfmoveClock !== undefined ? next.halfmoveClock : (parsedHistory?.length || 0),
        fullmoveNumber: next.fullmoveNumber !== undefined ? next.fullmoveNumber : Math.floor((parsedHistory?.length || 0) / 2) + 1,
        whiteKingMoved: next.whiteKingMoved !== undefined ? next.whiteKingMoved : whiteKingMoved,
        whiteRookKMoved: next.whiteRookKMoved !== undefined ? next.whiteRookKMoved : whiteRookKMoved,
        whiteRookQMoved: next.whiteRookQMoved !== undefined ? next.whiteRookQMoved : whiteRookQMoved,
        blackKingMoved: next.blackKingMoved !== undefined ? next.blackKingMoved : blackKingMoved,
        blackRookKMoved: next.blackRookKMoved !== undefined ? next.blackRookKMoved : blackRookKMoved,
        blackRookQMoved: next.blackRookQMoved !== undefined ? next.blackRookQMoved : blackRookQMoved,
        whiteTurnCount: next.whiteTurnCount !== undefined ? next.whiteTurnCount : gameState.whiteTurnCount,
        blackTurnCount: next.blackTurnCount !== undefined ? next.blackTurnCount : gameState.blackTurnCount,
      });

      // Cooperative draw proposal syncing
      if (next.drawProposedBy) {
        setDrawProposal({ proposedBy: next.drawProposedBy });
      } else {
        setDrawProposal(null);
      }

      // Broadcast over WebRTC if connected
      const isP2PActive = dcRef.current && dcRef.current.readyState === 'open';
      if (next.opponentType === 'online' && isP2PActive) {
        try {
          dcRef.current!.send(JSON.stringify({
            type: 'game_state_update',
            gameState: next
          }));
          console.log("Game state synchronized via WebRTC P2P!");
        } catch (e) {
          console.error("Failed to send state via WebRTC P2P, falling back to WS", e);
        }
      }

      // Broadcast over WebSocket if playing an online game as fallback/storage
      if (next.opponentType === 'online' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'game_state_update',
          roomId: selectedGameId,
          gameState: next,
          skipBroadcast: isP2PActive
        }));
      }

      return next;
    });
  };

  const handleRecordStatsInCloud = async (resultStatus: string, finalTurn: Color) => {
    if (!rawGameDoc) return;
    if (rawGameDoc.statsRegistered) return;

    try {
      const isDraw = ['stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_moves_draw', 'agreed_draw'].includes(resultStatus);
      
      // Mark as registered
      setRawGameDoc(prev => prev ? { ...prev, statsRegistered: true } : null);

      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      if (!isDraw) {
        const winnerChar = finalTurn === 'w' ? 'b' : 'w'; // If White's turn when checkmated, Black won
        const wasIWhite = playerColor === 'w' || (rawGameDoc.opponentType !== 'online' && turn === 'w');
        const wasIBlack = playerColor === 'b' || (rawGameDoc.opponentType !== 'online' && turn === 'b');
        
        const didIWin = (wasIWhite && winnerChar === 'w') || (wasIBlack && winnerChar === 'b');
        if (didIWin) {
          outcome = 'win';
        } else {
          outcome = 'loss';
        }
      }

      setUserStats(prev => {
        const next = {
          wins: prev.wins + (outcome === 'win' ? 1 : 0),
          losses: prev.losses + (outcome === 'loss' ? 1 : 0),
          draws: prev.draws + (outcome === 'draw' ? 1 : 0)
        };
        localStorage.setItem('dice_chess_local_stats', JSON.stringify(next));
        return next;
      });
    } catch (err) {
      console.error('Failed to register stats:', err);
    }
  };

  // Sound triggering helper
  const playGameSound = (type: 'move' | 'capture' | 'check' | 'roll' | 'victory' | 'reset' | 'draw') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else if (type === 'check') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(293.66, audioCtx.currentTime); // D4
        osc.frequency.setValueAtTime(311.13, audioCtx.currentTime + 0.1); // Eb4
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'roll') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
      } else if (type === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.3); // G5
        osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.45); // C6
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.82);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.82);
      } else if (type === 'reset') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } else if (type === 'draw') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(349.23, audioCtx.currentTime); // F4
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {
      // Audio context block prevention (noop)
    }
  };

  // Start the dice roll from parent state
  const handleStartRoll = async () => {
    if (gameStatus !== 'rolling' || isRolling) return;

    // Verify turn authorization for online multiplayer checks
    if (rawGameDoc && rawGameDoc.opponentType === 'online') {
      const isMyTurn = (turn === 'w' && rawGameDoc.whiteId === user?.uid) || 
                       (turn === 'b' && rawGameDoc.blackId === user?.uid);
      if (!isMyTurn) return; // Prevent opponent from rolling during your turn!
    }

    const currentTurnCount = turn === 'w' ? gameState.whiteTurnCount : gameState.blackTurnCount;
    let min = 1, max = 6;
    if (currentTurnCount <= 5) {
      min = 1; max = 1;
    } else if (currentTurnCount <= 10) {
      min = 1; max = 3;
    } else {
      min = 1; max = 6;
    }

    const rolledValue = Math.floor(Math.random() * (max - min + 1)) + min;

    await updateGameOnCloud({
      isRolling: true,
      diceRoll: rolledValue,
      statusMessage: `${turn === 'w' ? 'White' : 'Black'} is rolling the matrix cube...`
    });
  };

  // Dice roll complete callback
  const handleRollComplete = async () => {
    // Only the authorized current player (or creator if it's CPU/Local) updates Firestore on roll finish
    if (rawGameDoc) {
      const isMyTurn = (turn === 'w' && rawGameDoc.whiteId === user?.uid) || 
                       (turn === 'b' && rawGameDoc.blackId === user?.uid) ||
                       (rawGameDoc.opponentType !== 'online' && rawGameDoc.creatorId === user?.uid);
      if (!isMyTurn) return;
    }

    playGameSound('roll');

    // Check if player has legal moves immediately at start of turn
    const isPlayerInCheck = isKingInCheck(board, turn);
    const hasMoves = hasLegalMoves(board, turn, lastMove);

    if (!hasMoves) {
      const finalStatus = isPlayerInCheck ? 'checkmate' : 'stalemate';
      const finalMsg = isPlayerInCheck 
        ? `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins the match.`
        : `Stalemate! Draw declared.`;

      await updateGameOnCloud({
        status: finalStatus,
        isRolling: false,
        statusMessage: finalMsg,
        winner: isPlayerInCheck ? (turn === 'w' ? 'b' : 'w') : 'draw'
      });

      playGameSound(isPlayerInCheck ? 'victory' : 'draw');
      await handleRecordStatsInCloud(finalStatus, turn);
      return;
    }

    const allocated = diceRoll || 1;
    await updateGameOnCloud({
      movesRemaining: allocated,
      movesMadeThisTurn: 0,
      isRolling: false,
      status: 'playing',
      statusMessage: `${turn === 'w' ? 'White' : 'Black'} rolled a ${allocated}. Execute ${allocated} ${allocated === 1 ? 'move' : 'moves'}.`
    });
  };

  // Chess move selected execution callback
  const handleMoveSelected = async (move: Move) => {
    // Verify turn authorization for online multiplayer checks
    if (rawGameDoc && rawGameDoc.opponentType === 'online') {
      const isMyTurn = (turn === 'w' && rawGameDoc.whiteId === user?.uid) || 
                       (turn === 'b' && rawGameDoc.blackId === user?.uid);
      if (!isMyTurn) return; // Not your turn to execute moves!
    }

    // 1. Play sound
    if (move.captured) {
      playGameSound('capture');
    } else {
      playGameSound('move');
    }

    // 2. Compute the next board
    const nextBoard = executeMove(board, move);

    // 3. Track piece moves for castling rights
    let wKingM = whiteKingMoved;
    let wRookKM = whiteRookKMoved;
    let wRookQM = whiteRookQMoved;
    let bKingM = blackKingMoved;
    let bRookKM = blackRookKMoved;
    let bRookQM = blackRookQMoved;

    if (move.piece.type === 'k') {
      if (move.piece.color === 'w') wKingM = true;
      if (move.piece.color === 'b') bKingM = true;
    }
    if (move.piece.type === 'r') {
      if (move.piece.color === 'w') {
        if (move.from.c === 7) wRookKM = true;
        if (move.from.c === 0) wRookQM = true;
      }
      if (move.piece.color === 'b') {
        if (move.from.c === 7) bRookKM = true;
        if (move.from.c === 0) bRookQM = true;
      }
    }

    // 4. Check if opponent's King is now in check
    const opponentColor = turn === 'w' ? 'b' : 'w';
    const opponentInCheck = isKingInCheck(nextBoard, opponentColor);

    // 5. Construct log history record
    const nextMoveNumber = movesMadeThisTurn + 1;
    const notation = getMoveNotation(move, opponentInCheck, false); // Notation is finalized below if checkmate

    const newHistoryRecord = {
      move,
      notation,
      roll: diceRoll || 1,
      moveIndex: nextMoveNumber
    };

    const nextHistory = [...history, newHistoryRecord];

    // 6. Enforce Fifty-Move rule clock
    let nextHalfmoveClock = gameState.halfmoveClock + 1;
    if (move.piece.type === 'p' || move.captured) {
      nextHalfmoveClock = 0; // Reset clock on pawn move or capture
    }

    // 7. Check automatic draw conditions:
    // Fifty-Move / 75-Move Rule
    if (nextHalfmoveClock >= 150) { // 75 full turns = 150 halfmoves
      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        status: 'fifty_moves_draw',
        statusMessage: 'Automatic Draw! 75 consecutive moves played without a capture or pawn move.',
        history: nextHistory,
        lastMove: move,
        winner: 'draw'
      });
      playGameSound('draw');
      await handleRecordStatsInCloud('fifty_moves_draw', turn);
      return;
    }

    // Insufficient Material
    if (isInsufficientMaterial(nextBoard)) {
      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        status: 'insufficient_material',
        statusMessage: 'Draw! Insufficient material remaining to deliver checkmate.',
        history: nextHistory,
        lastMove: move,
        winner: 'draw'
      });
      playGameSound('draw');
      await handleRecordStatsInCloud('insufficient_material', turn);
      return;
    }

    // Threefold repetition automatic claim check
    const eventualHash = getBoardHash(
      nextBoard,
      opponentColor,
      wKingM,
      wRookKM,
      wRookQM,
      bKingM,
      bRookKM,
      bRookQM,
      move
    );
    const repCount = repetitionHashes.filter(h => h === eventualHash).length + 1;
    if (repCount >= 3) {
      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        status: 'threefold_repetition',
        statusMessage: 'Draw! The exact same board position has occurred three times.',
        history: nextHistory,
        lastMove: move,
        winner: 'draw'
      });
      playGameSound('draw');
      await handleRecordStatsInCloud('threefold_repetition', turn);
      return;
    }

    // 8. CUSTOM DICE CHECK RULE EVALUATION:
    // "Now with respect to the dice move when the king is checked in any colour rule, ensure the remaining move in the dice number is prohibited unless it moves the king to safety.
    // for exsmple : dice is rolled to 4 in white side and if the king is checked in black side at 2 nd move of white , then the remaining moves in the white side (3rd and 4th ) move is prohibited"
    if (opponentInCheck) {
      playGameSound('check');

      // Check if opponent has any legal moves to make sure it's not a checkmate
      const oppHasMoves = hasLegalMoves(nextBoard, opponentColor, move);
      if (!oppHasMoves) {
        // Opponent is checkmated!
        newHistoryRecord.notation = getMoveNotation(move, true, true); // Update notation to show mate symbol #
        await updateGameOnCloud({
          board: JSON.stringify(nextBoard),
          status: 'checkmate',
          statusMessage: `Checkmate! ${turn === 'w' ? 'White' : 'Black'} delivers victory.`,
          history: nextHistory,
          lastMove: move,
          winner: turn
        });
        playGameSound('victory');
        await handleRecordStatsInCloud('checkmate', turn);
        return;
      }

      // If they have legal moves, the turn is cut short immediately!
      // This is because the opponent is in check, so White's remaining moves are prohibited.
      const nextWhiteTurnCount = turn === 'w' ? gameState.whiteTurnCount + 1 : gameState.whiteTurnCount;
      const nextBlackTurnCount = turn === 'b' ? gameState.blackTurnCount + 1 : gameState.blackTurnCount;
      const nextSetup = getNextTurnSetup(opponentColor, nextWhiteTurnCount, nextBlackTurnCount);

      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        turn: opponentColor,
        whiteTurnCount: nextWhiteTurnCount,
        blackTurnCount: nextBlackTurnCount,
        diceRoll: nextSetup.diceRoll,
        movesRemaining: nextSetup.movesRemaining,
        movesMadeThisTurn: 0,
        lastMove: move,
        status: nextSetup.gameStatus,
        statusMessage: `Check! ${turn === 'w' ? 'White' : 'Black'} checked the opponent. Action terminates, transferring play immediately to ${opponentColor === 'w' ? 'White' : 'Black'} to seek safety! ${nextSetup.statusMessage}`,
        history: nextHistory,
        halfmoveClock: nextHalfmoveClock,
        whiteKingMoved: wKingM,
        whiteRookKMoved: wRookKM,
        whiteRookQMoved: wRookQM,
        blackKingMoved: bKingM,
        blackRookKMoved: bRookKM,
        blackRookQMoved: bRookQM
      });
      return;
    }

    // 9. Standard turn progression if NO check occurred
    const remaining = movesRemaining - 1;

    if (remaining <= 0) {
      // Turn complete! Check if opponent has any legal moves to see if they're stalemated
      const oppHasMoves = hasLegalMoves(nextBoard, opponentColor, move);
      if (!oppHasMoves) {
        // No moves remaining for opponent and not in check, so it's stalemate!
        await updateGameOnCloud({
          board: JSON.stringify(nextBoard),
          status: 'stalemate',
          statusMessage: `Stalemate! ${opponentColor === 'w' ? 'White' : 'Black'} has no legal moves. Draw declared.`,
          history: nextHistory,
          lastMove: move,
          winner: 'draw'
        });
        playGameSound('draw');
        await handleRecordStatsInCloud('stalemate', turn);
        return;
      }

      // Setup next turn counts & params
      const nextWhiteTurnCount = turn === 'w' ? gameState.whiteTurnCount + 1 : gameState.whiteTurnCount;
      const nextBlackTurnCount = turn === 'b' ? gameState.blackTurnCount + 1 : gameState.blackTurnCount;
      const nextSetup = getNextTurnSetup(opponentColor, nextWhiteTurnCount, nextBlackTurnCount);

      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        turn: opponentColor,
        whiteTurnCount: nextWhiteTurnCount,
        blackTurnCount: nextBlackTurnCount,
        diceRoll: nextSetup.diceRoll,
        movesRemaining: nextSetup.movesRemaining,
        movesMadeThisTurn: 0,
        lastMove: move,
        status: nextSetup.gameStatus,
        statusMessage: nextSetup.statusMessage,
        history: nextHistory,
        halfmoveClock: nextHalfmoveClock,
        whiteKingMoved: wKingM,
        whiteRookKMoved: wRookKM,
        whiteRookQMoved: wRookQM,
        blackKingMoved: bKingM,
        blackRookKMoved: bRookKM,
        blackRookQMoved: bRookQM
      });
    } else {
      // Current player continues with remaining moves on their dice roll
      await updateGameOnCloud({
        board: JSON.stringify(nextBoard),
        movesRemaining: remaining,
        movesMadeThisTurn: nextMoveNumber,
        lastMove: move,
        statusMessage: `${turn === 'w' ? 'White' : 'Black'} has ${remaining} ${remaining === 1 ? 'move' : 'moves'} remaining.`,
        history: nextHistory,
        halfmoveClock: nextHalfmoveClock,
        whiteKingMoved: wKingM,
        whiteRookKMoved: wRookKM,
        whiteRookQMoved: wRookQM,
        blackKingMoved: bKingM,
        blackRookKMoved: bRookKM,
        blackRookQMoved: bRookQM
      });
    }
  };

  // Co-operative draw helpers
  const handleProposeDraw = async () => {
    await updateGameOnCloud({
      drawProposedBy: turn,
      statusMessage: `${turn === 'w' ? 'White' : 'Black'} proposed a draw. Awaiting opponent response.`
    });
  };

  const handleAcceptDraw = async () => {
    await updateGameOnCloud({
      status: 'agreed_draw',
      statusMessage: 'Match drawn by cooperative agreement!',
      drawProposedBy: null,
      winner: 'draw'
    });
    playGameSound('draw');
    await handleRecordStatsInCloud('agreed_draw', turn);
  };

  const handleDeclineDraw = async () => {
    await updateGameOnCloud({
      drawProposedBy: null,
      statusMessage: `Draw proposal declined. Keep fighting!`
    });
  };

  // Restart handler
  const handleReset = async () => {
    const freshBoard = initializeBoard();
    await updateGameOnCloud({
      board: JSON.stringify(freshBoard),
      turn: 'w',
      diceRoll: null,
      movesRemaining: 1,
      movesMadeThisTurn: 0,
      lastMove: null,
      isRolling: false,
      status: 'playing',
      statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)",
      history: [],
      halfmoveClock: 0,
      fullmoveNumber: 1,
      whiteKingMoved: false,
      whiteRookKMoved: false,
      whiteRookQMoved: false,
      blackKingMoved: false,
      blackRookKMoved: false,
      blackRookQMoved: false,
      whiteTurnCount: 1,
      blackTurnCount: 1,
      drawProposedBy: null
    });
    setRepetitionHashes([]);
    playGameSound('reset');
  };

  const handleResign = async () => {
    if (gameStatus !== 'playing' && gameStatus !== 'rolling') return;

    let resigningColor: Color = turn;
    if (rawGameDoc && user) {
      if (rawGameDoc.whiteId === user.uid && rawGameDoc.blackId !== user.uid) {
        resigningColor = 'w';
      } else if (rawGameDoc.blackId === user.uid && rawGameDoc.whiteId !== user.uid) {
        resigningColor = 'b';
      }
    }

    const winningColor = resigningColor === 'w' ? 'b' : 'w';
    const resigningName = resigningColor === 'w'
      ? (rawGameDoc?.whiteName || 'White')
      : (rawGameDoc?.blackName || 'Black');
    const winningName = winningColor === 'w'
      ? (rawGameDoc?.whiteName || 'White')
      : (rawGameDoc?.blackName || 'Black');

    await updateGameOnCloud({
      status: 'resigned',
      statusMessage: `${resigningName} resigned. ${winningName} wins the match!`,
      winner: winningColor,
      drawProposedBy: null
    });
    playGameSound('victory');
    await handleRecordStatsInCloud('resigned', resigningColor);
  };

  // Back to study lobby exit trigger
  const handleExitToLobby = () => {
    setSelectedGameId(null);
    setRawGameDoc(null);
    setIsAnalyseMode(false);
    setPlayerColor(null);
    playerColorRef.current = null;
  };

  // CPU Automated player loop calculation hook
  useEffect(() => {
    if (!selectedGameId || !rawGameDoc || rawGameDoc.opponentType !== 'cpu') return;
    if (gameStatus === 'checkmate' || gameStatus === 'stalemate') return;

    // AI is assigned black ('b')
    if (turn === 'b') {
      if (gameStatus === 'rolling' && !isRolling) {
        // 1. Auto-roll CPU dice roll
        const activeTimer = setTimeout(() => {
          handleStartRoll();
        }, 1100);
        return () => clearTimeout(activeTimer);
      }

      if (gameStatus === 'playing' && movesRemaining > 0 && !isRolling) {
        // 2. Automate AI Move calculations
        const activeTimer = setTimeout(async () => {
          const legalMoves: Move[] = [];
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              const piece = board[r][c];
              if (piece && piece.color === 'b') {
                const moves = getValidMoves(board, r, c, lastMove);
                legalMoves.push(...moves);
              }
            }
          }

          if (legalMoves.length === 0) {
            // Stalemate or mate detected, which is evaluated next
            return;
          }

          // Heuristics: prioritizes taking higher value pieces, next takes normal captures, finally picks random moves
          const captures = legalMoves.filter(m => m.captured);
          let targetMove: Move;

          if (captures.length > 0) {
            const weights: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
            captures.sort((a,b) => {
              const valA = a.captured ? weights[a.captured.type] : 0;
              const valB = b.captured ? weights[b.captured.type] : 0;
              return valB - valA;
            });
            targetMove = captures[0];
          } else {
            const randomIndex = Math.floor(Math.random() * legalMoves.length);
            targetMove = legalMoves[randomIndex];
          }

          handleMoveSelected(targetMove);
        }, 1300);

        return () => clearTimeout(activeTimer);
      }
    }
  }, [selectedGameId, rawGameDoc, turn, gameStatus, movesRemaining, isRolling, board]);

  // View state variables mappings
  const isWhiteActive = turn === 'w';
  const totalTurnsPlayed = history?.length || 0;

  // Iframe spectator restrictions helper flag
  const isSpectatingOnly = useMemo(() => {
    if (!rawGameDoc) return false;
    if (isAnalyseMode) return true;
    if (rawGameDoc.opponentType === 'online') {
      const isPart = rawGameDoc.whiteId === user?.uid || rawGameDoc.blackId === user?.uid;
      return !isPart;
    }
    return false;
  }, [rawGameDoc, user, isAnalyseMode]);

  // Game list router page
  if (!selectedGameId) {
    return (
      <div className="min-h-screen bg-[#302e2c] text-white py-8 md:py-12">
        <GameList 
          onJoinGame={(gameId, prefColor) => {
            if (gameId === 'cpu') {
              setSelectedGameId('cpu');
              setRawGameDoc({
                opponentType: 'cpu',
                whiteId: user.uid,
                blackId: 'cpu',
                whiteName: 'You (White)',
                blackName: 'Virtual Chess Engine',
                status: 'playing',
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)",
                board: initializeBoard(),
                turn: 'w',
                movesRemaining: 1,
                movesMadeThisTurn: 0,
                history: [],
                whiteKingMoved: false,
                whiteRookKMoved: false,
                whiteRookQMoved: false,
                blackKingMoved: false,
                blackRookKMoved: false,
                blackRookQMoved: false,
                whiteTurnCount: 1,
                blackTurnCount: 1,
              });
              setGameState({
                ...INITIAL_GAME_STATE,
                board: initializeBoard(),
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
              });
            } else if (gameId === 'local') {
              setSelectedGameId('local');
              setRawGameDoc({
                opponentType: 'local',
                whiteId: user.uid,
                blackId: user.uid,
                whiteName: 'White',
                blackName: 'Black',
                status: 'playing',
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)",
                board: initializeBoard(),
                turn: 'w',
                movesRemaining: 1,
                movesMadeThisTurn: 0,
                history: [],
                whiteKingMoved: false,
                whiteRookKMoved: false,
                whiteRookQMoved: false,
                blackKingMoved: false,
                blackRookKMoved: false,
                blackRookQMoved: false,
                whiteTurnCount: 1,
                blackTurnCount: 1,
              });
              setGameState({
                ...INITIAL_GAME_STATE,
                board: initializeBoard(),
                statusMessage: "White's Turn (Phase 1: Automatic 1 move. No roll needed!)"
              });
            } else {
              // Connect online
              setSelectedGameId(gameId);
              if (prefColor) {
                setHostPreferredColor(prefColor);
              }
            }
          }} 
          userStats={userStats} 
        />
        <footer className="mt-12 py-4 select-none">
          <p className="text-center text-[9px] text-[#989795] font-sans font-extrabold tracking-[0.18em]">
            DICE CHESS
          </p>
        </footer>
      </div>
    );
  }

  // Analyzing Mode View Router
  if (isAnalyseMode && rawGameDoc) {
    return (
      <div className="min-h-screen bg-[#302e2c] text-white py-8 md:py-12">
        <GameAnalyzer 
          game={rawGameDoc} 
          onBackToLobby={handleExitToLobby} 
          playerColor={playerColor}
        />
        <footer className="mt-12 py-4 select-none">
          <p className="text-center text-[9px] text-[#989795] font-sans font-extrabold tracking-[0.18em]">
            DICE CHESS
          </p>
        </footer>
      </div>
    );
  }

  // Standard interactive Game Arena
  return (
    <div className="min-h-screen bg-[#302e2c] text-white flex flex-col antialiased selection:bg-[#81b64c]/40 selection:text-white animate-fade-in">
      
      {/* Header Bar - Sleek Chess.com charcoal & brand green highlights */}
      <header className="border-b border-[#312e2b] bg-[#262421] sticky top-0 z-40 select-none shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitToLobby}
              id="header_back_lobby_btn"
              className="p-2 mr-1 bg-[#1a1917] hover:bg-[#312e2b] active:scale-95 text-[#bab9b7] hover:text-white rounded-lg border border-[#312e2b] shadow-sm flex items-center gap-1.5 text-xs font-sans font-bold cursor-pointer"
              title="Return to lobby"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#81b64c]" />
              <span className="hidden sm:inline">Lobby</span>
            </button>
            <div className="w-8 h-8 rounded-lg bg-[#81b64c] flex items-center justify-center text-white font-extrabold text-lg shadow-md select-none">
              ♟
            </div>
            <div>
              <h1 className="text-xs md:text-sm font-sans font-extrabold tracking-tight text-white leading-tight">Dice Chess</h1>
              <p className="text-[8px] text-[#989795] font-sans font-extrabold tracking-[0.12em] leading-none uppercase">Tactical Arena</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedGameId && selectedGameId !== 'cpu' && selectedGameId !== 'local' && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[#1a1917] border rounded-lg shadow-sm ${!wsConnected ? 'border-rose-500/40' : 'border-[#312e2b]'}`}>
                <span className={`w-2 h-2 rounded-full ${
                  !wsConnected ? 'bg-rose-500 animate-pulse' :
                  isP2PConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]' :
                  opponentConnected ? 'bg-amber-500 animate-pulse' : 'bg-zinc-500'
                }`} />
                <span className="text-[9px] font-sans font-extrabold tracking-wider uppercase text-zinc-300">
                  {!wsConnected ? `Reconnecting${connectionAttempt > 1 ? ` (${connectionAttempt})` : ''}...` :
                   isP2PConnected ? 'P2P Connected' :
                   opponentConnected ? 'Live via Relay' : 'Waiting for Opponent'}
                </span>
              </div>
            )}

            <button
              onClick={() => setIsRulesOpen(true)}
              id="open_rules_btn"
              className="p-2 bg-[#1a1917] hover:bg-[#312e2b] active:scale-95 text-white rounded-lg transition-all duration-150 border border-[#312e2b] flex items-center gap-1.5 text-xs font-bold shadow-sm cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-[#81b64c]" />
              <span className="hidden sm:inline font-sans">Rules</span>
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 bg-[#2d1b10] hover:bg-[#3d2516] active:scale-95 text-[#eecda3] rounded-xl transition-all duration-150 border border-[#54351f] flex items-center justify-center shadow-sm"
              title={soundEnabled ? "Mute Game Sound" : "Unmute Game Sound"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-[#ab8a70]" />
              )}
            </button>

            {!isSpectatingOnly && (
              <button
                onClick={handleReset}
                id="reset_game_btn"
                className="p-2 bg-[#2d1b10] hover:bg-[#3d2516] active:scale-95 text-[#eecda3] rounded-xl transition-all duration-150 border border-[#54351f] flex items-center justify-center shadow-sm"
                title="Reset Match"
              >
                <RefreshCcw className="w-4 h-4 text-[#caa469]" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 py-3 md:py-4 flex flex-col gap-4">
        
        {/* Live Spectator Indicator Overlay */}
        {isSpectatingOnly && (
          <div className="w-full bg-[#1b0b04] border border-amber-900/40 text-amber-200/90 py-2.5 px-4 rounded-xl text-xs font-serif italic text-center flex items-center justify-center gap-2 shadow-inner">
            <CircleDot className="w-4 h-4 text-[#caa469] animate-pulse" />
            <span>Spectator Study View Mode. Real-time updates active. Interactions Disabled.</span>
          </div>
        )}

        {window.location.origin.includes('-dev-') && selectedGameId !== 'cpu' && selectedGameId !== 'local' && (
          <div className="w-full bg-amber-950/80 border border-amber-500/30 text-amber-200 py-3 px-4 rounded-xl text-xs text-center flex flex-col sm:flex-row items-center justify-center gap-2.5 shadow-md">
            <span>⚠️ You are inside the AI Studio Dev view. To connect with a friend, both players must open the public URL in separate tabs.</span>
            <button
              onClick={() => {
                let origin = window.location.origin;
                if (origin.includes('-dev-')) {
                  origin = origin.replace('-dev-', '-pre-');
                }
                const inviteLink = `${origin}${window.location.pathname}?room=${selectedGameId}`;
                window.open(inviteLink, '_blank');
              }}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition text-[11px] cursor-pointer"
            >
              Open Shared Tab ↗
            </button>
          </div>
        )}



        {/* Check Alert Prompt */}
        {drawProposal && (
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex flex-col gap-3 select-none w-full animate-fade-in z-10">
            <h5 className="font-bold text-xs text-amber-200 uppercase tracking-widest font-mono">Opponent Proposes Draw</h5>
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              {drawProposal.proposedBy === 'w' ? 'White' : 'Black'} has proposed ending this match in a cooperative draw. Do you accept?
            </p>
            {!isSpectatingOnly && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleAcceptDraw}
                  id="accept_draw_btn"
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold font-mono text-xs rounded-lg shadow transition-colors active:scale-95 cursor-pointer"
                >
                  Accept Draw
                </button>
                <button
                  onClick={handleDeclineDraw}
                  id="decline_draw_btn"
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs rounded-lg shadow transition-colors active:scale-95 cursor-pointer"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        )}

        {/* Arena Layout: Standard Chess.com Multi-Column Layout */}
        <div className="w-full flex flex-col gap-6 max-w-[1440px] mx-auto">
          
          {/* Row 1: Chessboard on Left, Dice Controller on Right in a Single Row */}
          <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch justify-center md:h-[500px] lg:h-[580px] xl:h-[650px]">
            
            {/* Left Panel: The Chess Board & Player plates connected as a single visual sheet */}
            <div className="col-span-1 md:col-span-8 bg-[#262421] border border-[#312e2b] rounded-2xl shadow-2xl flex flex-col justify-between p-4 pb-3.5 select-none w-full md:h-full">
              
              {/* Top Player (Black) Plate - Flat transparent bar integrated in sheet */}
              <div className="w-full flex items-center justify-between bg-transparent border-none select-none pb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {rawGameDoc?.blackPhotoURL ? (
                      <img 
                        src={rawGameDoc.blackPhotoURL} 
                        alt="Black Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-sm font-sans font-extrabold text-[#efe3cb]">B</span>
                    )}
                    {turn === 'b' && (
                      <div className="absolute inset-0 border-2 border-[#81b64c] rounded-lg animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-sans font-extrabold text-[#efe3cb] truncate leading-none">
                        {rawGameDoc?.blackName || 'Guest Black'}
                      </span>
                      {turn === 'b' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] font-sans text-[#989795] block mt-0.5 leading-none">
                      Black Pieces
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-[#989795] font-sans font-bold block leading-none">Alloc</span>
                    <span className="text-sm font-sans font-extrabold text-[#caa469] mt-0.5 block leading-none text-right">
                      {turn === 'b' ? (diceRoll || (gameState.blackTurnCount <= 5 ? 1 : 'Roll')) : '-'}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-[#312e2b]" />
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-[#989795] font-sans font-bold block leading-none">Rem</span>
                    <span className={`text-sm font-sans font-extrabold mt-0.5 block leading-none text-right ${turn === 'b' ? 'text-emerald-400' : 'text-[#989795]'}`}>
                      {turn === 'b' ? movesRemaining : '0'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chessboard Viewport */}
              <div className="flex-1 min-h-0 flex items-center justify-center relative my-1">
                <div className="w-[82vw] max-w-[340px] sm:max-w-[400px] md:w-auto md:max-w-none md:h-full max-h-[360px] lg:max-h-[420px] xl:max-h-[490px] aspect-square flex items-center justify-center">
                  <ChessBoard
                    board={board}
                    turn={turn}
                    lastMove={lastMove}
                    movesRemaining={movesRemaining}
                    onMoveSelected={handleMoveSelected}
                    isKingChecked={isKingInCheck(board, turn)}
                    disabled={gameStatus !== 'playing' || isSpectatingOnly}
                    gameStatus={gameStatus}
                    winner={rawGameDoc?.winner}
                    orientation={selectedGameId === 'local' ? turn : (playerColor === 'b' ? 'b' : 'w')}
                  />
                </div>
              </div>

              {/* Bottom Player (White) Plate - Flat transparent bar integrated in sheet */}
              <div className="w-full flex items-center justify-between bg-transparent border-none select-none pt-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {rawGameDoc?.whitePhotoURL ? (
                      <img 
                        src={rawGameDoc.whitePhotoURL} 
                        alt="White Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="text-sm font-sans font-semibold text-zinc-900">W</span>
                    )}
                    {turn === 'w' && (
                      <div className="absolute inset-0 border-2 border-[#81b64c] rounded-lg animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-sans font-extrabold text-[#efe3cb] truncate leading-none">
                        {rawGameDoc?.whiteName || 'Guest White'}
                      </span>
                      {turn === 'w' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span className="text-[10px] font-sans text-[#989795] block mt-0.5 leading-none">
                      White Pieces
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-[#989795] font-sans font-bold block leading-none">Alloc</span>
                    <span className="text-sm font-sans font-extrabold text-[#caa469] mt-0.5 block leading-none text-right">
                      {turn === 'w' ? (diceRoll || (gameState.whiteTurnCount <= 5 ? 1 : 'Roll')) : '-'}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-[#312e2b]" />
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-[#989795] font-sans font-bold block leading-none">Rem</span>
                    <span className={`text-sm font-sans font-extrabold mt-0.5 block leading-none text-right ${turn === 'w' ? 'text-emerald-400' : 'text-[#989795]'}`}>
                      {turn === 'w' ? movesRemaining : '0'}
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Panel: Dice Controller or Match Results */}
            <div className="col-span-1 md:col-span-4 bg-[#262421] border border-[#312e2b] rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden select-none w-full p-5 md:h-full">
              
              {['checkmate', 'stalemate', 'insufficient_material', 'threefold_repetition', 'fifty_moves_draw', 'agreed_draw', 'resigned'].includes(gameStatus) ? (
                // Match Completed Results Interface (Chess.com Style Sidebar)
                <div className="w-full h-full flex flex-col justify-between py-1">
                  <div className="w-full text-center pb-3 border-b border-[#312e2b]">
                    <span className="text-[10px] text-amber-400 font-sans font-extrabold tracking-[0.14em] uppercase block">MATCH COMPLETED</span>
                  </div>

                  <div className="flex-grow flex flex-col items-center justify-center py-5 px-1 text-center">
                    <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mb-3.5 shadow-lg animate-bounce">
                      <Trophy className="w-7 h-7" />
                    </div>

                    <h3 className="text-lg font-serif font-bold text-[#efe3cb] tracking-wide uppercase mb-1">
                      Game Over
                    </h3>

                    <div className="p-3 bg-[#13110f] rounded-xl border border-[#312e2b] w-full text-center font-serif text-xs text-[#dfd0bd] italic mb-4 leading-relaxed">
                      {statusMessage}
                    </div>

                    {/* Quick navigation and reset controls right in the sidebar panel */}
                    <div className="w-full flex flex-col gap-2">
                      {!isSpectatingOnly && (
                        <button
                          onClick={handleReset}
                          id="sidebar_reset_btn"
                          className="w-full py-2.5 bg-[#81b64c] hover:bg-[#95c25c] text-white font-sans font-extrabold tracking-wider uppercase text-xs rounded-xl transition-all active:scale-95 shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCcw className="w-3.5 h-3.5" />
                          Rematch / Play Again
                        </button>
                      )}
                      <button
                        onClick={handleExitToLobby}
                        id="sidebar_lobby_btn"
                        className="w-full py-2.5 bg-[#312e2b] hover:bg-[#3d3a37] text-white font-sans font-extrabold tracking-wider uppercase text-xs rounded-xl transition-all active:scale-95 border border-[#403c38] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 text-[#81b64c]" />
                        Back to Lobby
                      </button>
                    </div>
                  </div>

                  <div className="w-full text-center pt-3 border-t border-[#312e2b]">
                    <span className="text-[9px] text-[#989795] font-sans font-extrabold tracking-wider uppercase">
                      Review board state above
                    </span>
                  </div>
                </div>
              ) : (
                // Standard Dice roller
                <div className="w-full h-full flex flex-col justify-between">
                  <div className="w-full text-center pb-3 border-b border-[#312e2b]">
                    <span className="text-[10px] text-zinc-400 font-sans font-extrabold tracking-[0.14em] uppercase block">DICE ACTION PANEL</span>
                  </div>
                  
                  <div className="flex-grow flex items-center justify-center py-6 min-h-0">
                    <Dice3D
                      value={diceRoll}
                      color={turn}
                      isRolling={isRolling}
                      onRollComplete={handleRollComplete}
                      onRollTriggered={handleStartRoll}
                      disabled={gameStatus !== 'rolling' || isSpectatingOnly}
                      rollNotNeeded={turn === 'w' ? gameState.whiteTurnCount <= 5 : gameState.blackTurnCount <= 5}
                      maxRollValue={(turn === 'w' ? gameState.whiteTurnCount : gameState.blackTurnCount) <= 10 ? 3 : 6}
                    />
                  </div>


                </div>
              )}

            </div>

          </div>

          {/* Row 2: Turn Ledger / Move History Log displayed below Chessboard + Dice Roller */}
          <div className="w-full bg-[#262421] border border-[#312e2b] p-5 rounded-2xl shadow-xl">
            <MoveLog
              history={history}
              onResign={handleResign}
              onAgreeDraw={handleProposeDraw}
              gameStatus={gameStatus}
              disabled={isSpectatingOnly}
            />
          </div>

        </div>

      </main>

      {/* Rules Information Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />

      {/* Professional Footer */}
      <footer className="mt-auto border-t border-[#312e2b] bg-[#262421] py-4 select-none">
        <p className="text-center text-[9px] text-[#989795] font-sans font-extrabold tracking-[0.18em]">
          DICE CHESS v1.2
        </p>
      </footer>
    </div>
  );
}
