import { io } from 'socket.io-client';
import { TICK_MS } from '../../shared/constants.js';

const KEY = 'treasure-hunt-session';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

// Wraps the socket. Remembers the token so a refresh or a locked phone rejoins as the same player.
export function connect({ onStatus, onState, onCorrect, onFound }) {
  const socket = io();
  let session = load();
  let joined = false;

  const emitJoin = (name) => new Promise((resolve) => {
    socket.emit('player:join', { token: session?.token, name }, (res) => {
      if (!res.error) {
        session = { token: res.token, name: res.name };
        localStorage.setItem(KEY, JSON.stringify(session));
        joined = true;
      }
      resolve(res);
    });
  });

  socket.on('connect', () => {
    onStatus();
    socket.io.engine.once('upgrade', onStatus);
    if (joined) emitJoin(session.name); // reconnect after a drop
  });
  socket.on('disconnect', onStatus);
  socket.on('world:state', onState);
  socket.on('player:correct', onCorrect);
  socket.on('treasure:found', ({ playerId, treasureId }) => onFound?.(playerId, treasureId));

  let last = '';
  return {
    socket,
    savedName: () => session?.name,
    join: emitJoin,
    startSending(getPose) {
      setInterval(() => {
        const pose = getPose();
        const key = `${pose.x.toFixed(2)},${pose.y.toFixed(2)},${pose.z.toFixed(2)},${pose.ry.toFixed(2)}`;
        if (key === last || !socket.connected) return;
        last = key;
        socket.volatile.emit('player:move', pose);
      }, TICK_MS);
    },
  };
}
