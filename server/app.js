require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const db = require('./database');
const gameController = require('./controllers/gameController');
const socketController = require('./controllers/socketController');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/games', gameController);

// Socket.IO Connection Handler
socketController(io);

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/lobby/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/lobby.html'));
});

app.get('/race-selection/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/race-selection.html'));
});

app.get('/game/:gameId', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/game.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
    // Test database connection
    db.getConnection()
        .then(connection => {
            console.log('Database connected successfully');
            connection.release();
        })
        .catch(err => {
            console.error('Database connection failed:', err);
        });
});

module.exports = server;