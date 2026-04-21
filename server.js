const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store top 10 scores
let leaderboard = [];

io.on('connection', (socket) => {
    console.log('A client connected.');

    // Send the current leaderboard to the newly connected client
    socket.emit('update_leaderboard', leaderboard);

    socket.on('submit_score', (data) => {
        const { playerName, score, character } = data;
        
        // Add new score
        leaderboard.push({ id: Date.now(), playerName, score, character });
        
        // Sort descending
        leaderboard.sort((a, b) => b.score - a.score);
        
        // Keep top 10
        leaderboard = leaderboard.slice(0, 10);
        
        // Broadcast new leaderboard to all clients
        io.emit('update_leaderboard', leaderboard);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected.');
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
