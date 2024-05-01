const express = require('express');

// const { createServer } = require("http");
const { Server } = require("socket.io");

const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const path = require('path');

const app = express();

const options = {
    key: fs.readFileSync('server.key'), // Path to your private key file
    cert: fs.readFileSync('server.cert') // Path to your certificate file
};

const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer, {
    cors: {
        origin: "*"
    }
});


app.use((req, res, next) => {
    if (req.url === '/' || req.url === '/index.html') {
        console.log('Someone accessed index.html');
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));


// Keep track of box information for each client
const clients = {};


function printConnectedClients() {
    console.log("Connected Clients:");
    Object.keys(clients).forEach(clientId => {
        const { position } = clients[clientId];
        console.log(`Client ID: ${clientId}, Position: (${position.x}, ${position.y}, ${position.z})`);
    });
}


// Socket.IO event handling
io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // Add a new box for the client
    clients[socket.id] = {
        id: socket.id,
        position: { x: 70, y: 40, z: 70 },
        color: Math.random() * 0xFFFFFF,
        quaternion: { x: 0, y: 0, z: 0, w: 1 }
    };

    // Handle 'create-player' event
    socket.on('create-player', () => {
        // Emit 'player-created' event with data
        socket.emit('player-created', clients[socket.id]);
        console.log("New player information sent");
        printConnectedClients();
        io.emit('update-players', clients);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Remove the client's box information
        delete clients[socket.id];
        printConnectedClients();
        io.emit('update-players', clients);
      });


    socket.on('update-box', (playerData) =>{
        clients[socket.id] = playerData;
        //console.log("Player position updated: " + socket.id);
        io.emit('update-players', clients);
    });

});



httpsServer.listen(3000);
console.log("Server is now listening on port 3000");
