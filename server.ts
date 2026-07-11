import express from "express";
import path from "path";
import http from "http";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";

// Helper: get the machine's local LAN IPv4 address
function getLanIp(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

// Safe __filename and __dirname for both ESM and CJS
let currentFilename = "";
let currentDirname = process.cwd();

try {
  if (typeof __filename !== "undefined") {
    currentFilename = __filename;
  }
} catch (e) {}

try {
  if (typeof __dirname !== "undefined") {
    currentDirname = __dirname;
  }
} catch (e) {}

if (!currentFilename) {
  try {
    currentFilename = fileURLToPath(import.meta.url);
    currentDirname = path.dirname(currentFilename);
  } catch (e) {}
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  // IMPORTANT: Cloud Run (and most hosts) inject a PORT env var and route
  // traffic to it. Hardcoding 3000 here means the platform's proxy can
  // never reach this process once deployed, which surfaces to players as
  // 404s on every request -- including the /ws upgrade used to link two
  // players together. Always prefer process.env.PORT.
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Serve active games or simple health checks
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Return LAN IP and port so the frontend can build cross-device invite links
  app.get("/api/server-info", (req, res) => {
    res.json({ lanIp: getLanIp(), port: PORT });
  });

  // Simple room registry (in-memory) so clients can check if a room exists
  app.get("/api/rooms/:roomId", (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({
      id: room.id,
      hasWhite: !!room.players.white,
      hasBlack: !!room.players.black,
    });
  });

  // Dynamic STUN/TURN server configuration endpoint for WebRTC NAT Traversal
  app.get("/api/webrtc-config", (req, res) => {
    const iceServers: any[] = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" }
    ];

    // Default to the provided ExpressTurn credentials, but allow environment overrides.
    const turnUrls = process.env.TURN_URLS
      ? process.env.TURN_URLS.split(",")
      : ["turn:free.expressturn.com:3478?transport=udp", "turn:free.expressturn.com:3478?transport=tcp"];

    const turnUsername = process.env.TURN_USERNAME || "000000002098976323";
    const turnPassword = process.env.TURN_PASSWORD || process.env.TURN_CREDENTIAL || "GhvhR5vTZpoZG9iQuhF5c3C1+v0=";

    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnPassword
    });

    res.json({ iceServers });
  });

  // Handle WebSockets upgrade
  server.on("upgrade", (request, socket, head) => {
    const pathname = request.url ? new URL(request.url, "http://localhost").pathname : "";
    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Simple in-memory Room-based signaling / syncing
  interface Room {
    id: string;
    players: {
      white?: WebSocket;
      black?: WebSocket;
    };
    playerIds?: {
      white?: string;
      black?: string;
    };
    gameState: any; // Store current board state so joining player gets it immediately
  }

  const rooms = new Map<string, Room>();

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as WebSocket & { isAlive?: boolean };
      if (ws.isAlive === false) {
        // No pong received since the last ping -- connection is dead,
        // terminate it so the room can free up the slot / notify the peer.
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 25000);

  wss.on("close", () => clearInterval(heartbeatInterval));

  wss.on("connection", (ws: WebSocket & { isAlive?: boolean }) => {
    let currentRoomId: string | null = null;
    let playerColor: 'w' | 'b' | 'spectator' | null = null;

    // Heartbeat: many proxies/load balancers (including those in front of
    // Cloud Run) will silently kill a WebSocket that looks idle. A player
    // taking their time on a turn can go minutes without sending anything,
    // so we ping periodically to keep the connection open and to prune
    // sockets that have actually died without a clean close event.
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (message: Buffer | string) => {
      try {
        const data = JSON.parse(typeof message === "string" ? message : message.toString());
        const { type, roomId } = data;

        if (type === "join") {
          currentRoomId = roomId;
          const userId = data.userId;
          let room = rooms.get(roomId);
          if (!room) {
            room = {
              id: roomId,
              players: {},
              playerIds: {},
              gameState: null
            };
            rooms.set(roomId, room);
          }

          if (!room.playerIds) {
            room.playerIds = {};
          }

          // Assign color
          let assignedColor: 'w' | 'b' | 'spectator' = 'spectator';
          if (userId) {
            if (room.playerIds.white === userId) {
              room.players.white = ws;
              assignedColor = 'w';
            } else if (room.playerIds.black === userId) {
              room.players.black = ws;
              assignedColor = 'b';
            } else {
              const isWhiteEmpty = !room.playerIds.white;
              const isBlackEmpty = !room.playerIds.black;

              if (isWhiteEmpty && isBlackEmpty) {
                // First player (host) is joining, use their color preference
                const pref = data.preferredColor || 'random';
                let chosen: 'w' | 'b';
                if (pref === 'w') {
                  chosen = 'w';
                } else if (pref === 'b') {
                  chosen = 'b';
                } else {
                  chosen = Math.random() < 0.5 ? 'w' : 'b';
                }

                if (chosen === 'w') {
                  room.playerIds.white = userId;
                  room.players.white = ws;
                  assignedColor = 'w';
                } else {
                  room.playerIds.black = userId;
                  room.players.black = ws;
                  assignedColor = 'b';
                }
              } else if (isWhiteEmpty) {
                room.playerIds.white = userId;
                room.players.white = ws;
                assignedColor = 'w';
              } else if (isBlackEmpty) {
                room.playerIds.black = userId;
                room.players.black = ws;
                assignedColor = 'b';
              } else {
                assignedColor = 'spectator';
              }
            }
          } else {
            // Fallback to legacy assignment
            if (!room.players.white) {
              room.players.white = ws;
              assignedColor = 'w';
            } else if (!room.players.black) {
              room.players.black = ws;
              assignedColor = 'b';
            } else {
              assignedColor = 'spectator';
            }
          }

          playerColor = assignedColor;

          // Merge player's name & photo if gameState exists
          if (room.gameState) {
            if (assignedColor === 'w') {
              room.gameState.whiteId = userId;
              room.gameState.whiteName = data.displayName || room.gameState.whiteName || 'Player White';
              room.gameState.whitePhotoURL = data.photoURL || room.gameState.whitePhotoURL || '';
            } else if (assignedColor === 'b') {
              room.gameState.blackId = userId;
              room.gameState.blackName = data.displayName || room.gameState.blackName || 'Player Black';
              room.gameState.blackPhotoURL = data.photoURL || room.gameState.blackPhotoURL || '';
              room.gameState.status = 'playing';
            }
          }

          ws.send(JSON.stringify({
            type: "joined",
            color: assignedColor,
            gameState: room.gameState
          }));

          // If a second player joins, notify both that game is ready and broadcast merged gameState
          if (room.players.white && room.players.black) {
            if (room.gameState) {
              room.gameState.status = 'playing';
              if (room.gameState.statusMessage === 'Share the link above with a friend to start playing!') {
                room.gameState.statusMessage = "White's Turn (Phase 1: Automatic 1 move. No roll needed!)";
              }
            }

            room.players.white.send(JSON.stringify({
              type: "opponent_joined"
            }));
            room.players.black.send(JSON.stringify({
              type: "opponent_joined"
            }));

            if (room.gameState) {
              const stateUpdateMsg = JSON.stringify({
                type: "game_state_update",
                gameState: room.gameState
              });
              if (room.players.white.readyState === WebSocket.OPEN) {
                room.players.white.send(stateUpdateMsg);
              }
              if (room.players.black.readyState === WebSocket.OPEN) {
                room.players.black.send(stateUpdateMsg);
              }
            }
          }
        }

        if (type === "game_state_update") {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.gameState = data.gameState;

          if (data.skipBroadcast) {
            return; // Skip broadcasting since the players are synchronized via WebRTC P2P
          }

          // Broadcast to other player
          const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
          if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
              type: "game_state_update",
              gameState: data.gameState
            }));
          }
        }

        if (type === "signal") {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
          if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
              type: "signal",
              signalType: data.signalType,
              offer: data.offer,
              answer: data.answer,
              candidate: data.candidate
            }));
          }
        }

        if (type === "draw_proposal") {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
          if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
              type: "draw_proposal",
              proposedBy: playerColor
            }));
          }
        }

        if (type === "draw_response") {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
          if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
              type: "draw_response",
              accepted: data.accepted
            }));
          }
        }

        if (type === "reset") {
          if (!currentRoomId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          room.gameState = null;

          // Notify the other player
          const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
          if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
            otherPlayer.send(JSON.stringify({
              type: "reset"
            }));
          }
        }

      } catch (err) {
        console.error("WebSocket message parsing error:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          if (playerColor === 'w') {
            room.players.white = undefined;
          } else if (playerColor === 'b') {
            room.players.black = undefined;
          }

          // If both left, remove room
          if (!room.players.white && !room.players.black) {
            rooms.delete(currentRoomId);
          } else {
            // Notify other player of disconnect
            const otherPlayer = playerColor === 'w' ? room.players.black : room.players.white;
            if (otherPlayer && otherPlayer.readyState === WebSocket.OPEN) {
              otherPlayer.send(JSON.stringify({
                type: "opponent_disconnected"
              }));
            }
          }
        }
      }
    });
  });

  // Vite middleware for development vs static serve for production
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isCompiledCjs = currentFilename && path.basename(currentFilename) === "server.cjs";

  // We only serve static files if we are running the compiled production bundle AND index.html exists
  const isProduction = isCompiledCjs && hasDist;

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom",
    });
    app.use(vite.middlewares);

    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.join(process.cwd(), "index.html");
        let html = fs.readFileSync(indexPath, "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
