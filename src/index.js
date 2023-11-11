const express = require("express")
const mongoose = require("mongoose")
const helmet = require('helmet')
const morgan = require('morgan')
const cors = require('cors');
const dotenv = require("dotenv")
const app = express()
const hpp = require('hpp');
const bodyParser = require("body-parser")
const compression = require('compression')
const http = require("http")
const server = http.createServer(app);
const MongoSanitize = require("express-mongo-sanitize")
const session = require("express-session")
const MongoStore = require('connect-mongo');
const cookieParser = require("cookie-parser")
const { Server } = require("socket.io");
const { rooms } = require("utils/rooms");


// app extensions
dotenv.config()
app.enable('trust proxy');

app.use(cors({
    origin: process.env.ORIGIN,
    credentials: true,
    methods: "GET, POST, PUT, DELETE"
}));

app.use(helmet())
app.use(morgan("common"))
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json());
app.use(compression({
    level: 6,
    threshold: 100 * 1000
}))
app.use(hpp())
/* app.use(
    MongoSanitize({
        replaceWith: '_',
    }),
); */
/* app.use(cookieParser())
 */// database config
/* mongoose.set('strictQuery', false)
mongoose.connect(process.env.DataBase_URL, (err) => {
    if (err) console.log(err)
    else console.log("done")
})

 */
// sessions config
/* app.use(session({
    secret: process.env.SESSION_SECRET,
    saveUninitialized: false,
    resave: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 48,
        secure: process.env.NODE_ENV === "production" ? true : false,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    },
    store: MongoStore.create({
        mongoUrl: process.env.DataBase_URL,
        autoRemove: 'interval',
        autoRemoveInterval: 240 // In minutes. Default
    })
})) */

// socket io 
const io = new Server(server, {
    cors: {
        origin: process.env.ORIGIN,
        methods: ["GET", "POST"]
    }
});


const gameState = {
    players: {},
    rooms: rooms
};

io.on('connection', (socket) => {

    socket.emit('gameState', gameState);

    socket.on('join', (data) => {
        gameState.players[socket.id] = {
            id: socket.id,
            name: data.PlayerName, // Fix: Use data.playerName instead of undefined variable playerName
            room: data.room,
            direction: "left",
            x: 0,
            y: 0,
        };

        gameState.rooms[data.room].players += 1
        socket.join(data.room); // Join the specified room
        socket.broadcast.to(data.room).emit('playerJoined', data.PlayerName);
    });

    socket.on('move', (coordinates) => {
        const player = gameState.players[socket.id];
        if (player) {
            player.x = coordinates.x;
            player.y = coordinates.y;
            io.to(player.room).emit('playerCoordinates', {
                playerId: socket.id,
                x: coordinates.x,
                y: coordinates.y,
                direction: coordinates.mouseDirection
            });
        }
    });

    socket.on('attack', (coordinates) => {
        const player = gameState.players[socket.id];
        if (player) {
            player.x = coordinates.x;
            player.y = coordinates.y;
            io.to(player.room).emit('magicBullets', {
                playerId: socket.id,
                x: coordinates.x,
                y: coordinates.y,
                direction: coordinates.mouseDirection
            });
        }
    });

    socket.on('win', (playerId) => {
        const player = gameState.players[playerId];
        if (player) {
            io.to(player.room).emit('winnerPlayer', playerId);
        }
    });

    socket.on('disconnect', () => {
        const player = gameState.players[socket.id];
        if (player) {
            gameState.rooms[player.room].players -= 1
            delete gameState.players[socket.id];
            socket.broadcast.to(player.room).emit('playerLeft', socket.id);
        }
    });
});



// app routes
const SignUpRoutes = require('./Routes/SignUp')
const SignInRoutes = require('./Routes/SignIn');

app.use("/api/SignUp", SignUpRoutes)
app.use("/api/SignIn", SignInRoutes)

server.listen(process.env.PORT, () => console.log("server is running"))

