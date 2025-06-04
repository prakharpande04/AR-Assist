// This file manages WebRTC signaling messages via Socket.IO
function setupSignaling(io) {
  const rooms = {}; // A simple object to keep track of rooms and participants

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Event: Client wants to join a room
    socket.on('join_room', ({ roomID, userType }) => {
      // roomID: String, userType: 'technician' or 'expert'
      
      let room = rooms[roomID];
      if (!room) {
        room = { technician: null, expert: null, users: new Set() };
        rooms[roomID] = room;
      }

      if (room.users.size >= 2) {
        socket.emit('room_full', roomID);
        console.log(`Room ${roomID} is full for ${socket.id}`);
        return;
      }

      if (userType === 'technician' && room.technician) {
        socket.emit('user_type_taken', 'Technician role already taken in this room.');
        console.log(`Technician role taken in room ${roomID}`);
        return;
      }
      if (userType === 'expert' && room.expert) {
        socket.emit('user_type_taken', 'Expert role already taken in this room.');
        console.log(`Expert role taken in room ${roomID}`);
        return;
      }

      socket.join(roomID);
      room.users.add(socket.id);
      
      if (userType === 'technician') {
        room.technician = socket.id;
      } else {
        room.expert = socket.id;
      }

      console.log(`Socket ${socket.id} joined room ${roomID} as ${userType}`);
      socket.emit('joined_room', { roomID, userType, peerCount: room.users.size });

      // If two people are in the room, notify them to start the call process
      if (room.users.size === 2) {
        console.log(`Two users in room ${roomID}. Notifying to start call.`);
        io.to(room.expert).emit('start_call', { type: 'expert', roomID });
        io.to(room.technician).emit('start_call', { type: 'technician', roomID });
      } else if (room.users.size === 1 && userType === 'technician') {
        // Only technician is in room, wait for expert
        socket.emit('waiting_for_expert', roomID);
      }
    });

    // Event: WebRTC Offer (from Expert to Technician)
    socket.on('offer', (data) => {
      console.log(`Offer received from ${socket.id} for room ${data.roomID}`);
      const room = rooms[data.roomID];
      if (room && room.technician && socket.id === room.expert) {
        io.to(room.technician).emit('offer', data.sdp);
      }
    });

    // Event: WebRTC Answer (from Technician to Expert)
    socket.on('answer', (data) => {
      console.log(`Answer received from ${socket.id} for room ${data.roomID}`);
      const room = rooms[data.roomID];
      if (room && room.expert && socket.id === room.technician) {
        io.to(room.expert).emit('answer', data.sdp);
      }
    });

    // Event: ICE Candidate
    socket.on('ice_candidate', (data) => {
      console.log(`ICE candidate received from ${socket.id} for room ${data.roomID}`);
      const room = rooms[data.roomID];
      if (room) {
        // Send candidate to the other peer in the room
        const otherPeerId = Array.from(room.users).find(id => id !== socket.id);
        if (otherPeerId) {
          io.to(otherPeerId).emit('ice_candidate', data.candidate);
        }
      }
    });

    // Event: Client disconnects
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Remove disconnected socket from all rooms it was in
      for (const roomID in rooms) {
        const room = rooms[roomID];
        if (room.users.has(socket.id)) {
          room.users.delete(socket.id);
          if (room.technician === socket.id) room.technician = null;
          if (room.expert === socket.id) room.expert = null;

          if (room.users.size === 0) {
            delete rooms[roomID]; // Remove empty room
            console.log(`Room ${roomID} is now empty and removed.`);
          } else {
            console.log(`Socket ${socket.id} left room ${roomID}. Remaining users: ${room.users.size}`);
            // Notify remaining peer that the other peer disconnected
            const remainingPeerId = Array.from(room.users)[0];
            if (remainingPeerId) {
              io.to(remainingPeerId).emit('peer_disconnected', 'The other user has disconnected.');
            }
          }
          break;
        }
      }
    });
  });
}

module.exports = setupSignaling;