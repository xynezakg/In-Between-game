const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Initialize Express app and HTTP server
const app = express();
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const server = http.createServer(app);

// Initialize Socket.io with CORS enabled
const io = new Server(server, {
    cors: {
        origin: '*', // Allow Vercel static frontends to connect
        methods: ['GET', 'POST']
    }
});

// --- Game Constants & Mappings ---
const SUITS = ['C', 'D', 'H', 'S'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14 // Ace is high
};

// --- Card Class ---
class Card {
    constructor(value, suit) {
        this.value = value;
        this.suit = suit;
        this.rank = RANK_MAP[value];
        this.code = `${value}${suit}`;
        this.filename = `cards/${this.code}.png`;
    }
}

// --- Deck Class ---
class Deck {
    constructor() {
        this.cards = [];
        this.discard = [];
        this.init();
    }

    init() {
        this.cards = [];
        this.discard = [];
        for (const suit of SUITS) {
            for (const val of VALUES) {
                this.cards.push(new Card(val, suit));
            }
        }
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw() {
        if (this.cards.length === 0) {
            this.recycleDiscard();
        }
        return this.cards.pop();
    }

    recycleDiscard() {
        if (this.discard.length === 0) return;
        this.cards = [...this.discard];
        this.discard = [];
        this.shuffle();
    }

    discardCard(card) {
        if (card) this.discard.push(card);
    }

    size() {
        return this.cards.length;
    }
}

// --- Server Rooms Dictionary ---
const rooms = {};

// Helper to generate a 4-letter alphanumeric Room Code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]); // Ensure unique
    return code;
}

// Helper to get suit unicode for logging
function getSuitUnicode(suit) {
    switch (suit) {
        case 'C': return '♣';
        case 'D': return '♦';
        case 'H': return '♥';
        case 'S': return '♠';
        default: return '';
    }
}

// Helper to check if all active players are ready with bets/pass
function checkAllBetsLocked(room) {
    const activePlayers = room.players.filter(p => !p.isEliminated);
    return activePlayers.every(p => p.status === 'Ready' || p.status === 'Passed');
}

// Broadcast logs
function addRoomLog(room, message, type = 'info') {
    const log = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: message,
        type: type
    };
    room.logs.push(log);
    if (room.logs.length > 50) room.logs.shift(); // Cap logs
}

// --- Bot Betting Processor ---
function processBotBets(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BETTING') return;

    room.players.forEach(p => {
        if (p.isBot && !p.isEliminated && p.status === 'Betting...') {
            // Random bot thinking latency
            const delay = 800 + Math.random() * 1200;
            setTimeout(() => {
                const refreshedRoom = rooms[roomCode];
                if (!refreshedRoom || refreshedRoom.gameState !== 'BETTING' || p.isEliminated) return;

                const cardAVal = refreshedRoom.cardA.rank;
                const cardBVal = refreshedRoom.cardB.rank;
                const gap = cardBVal - cardAVal - 1;

                if (gap <= 2) {
                    // Pass/Fold on auto-loss ranges
                    p.isPass = true;
                    p.currentBet = 0;
                    p.status = 'Passed';
                    addRoomLog(refreshedRoom, `🤖 ${p.name} decided to Pass.`, 'info');
                } else {
                    // Calculate bet amount based on probability
                    let bet = 10;
                    if (gap >= 8) {
                        const pct = 0.15 + Math.random() * 0.15; // 15% - 30%
                        bet = Math.floor((p.balance * pct) / 10) * 10;
                    } else if (gap >= 5) {
                        const pct = 0.07 + Math.random() * 0.08; // 7% - 15%
                        bet = Math.floor((p.balance * pct) / 10) * 10;
                    } else {
                        bet = Math.random() > 0.5 ? 20 : 10;
                    }

                    // Bounds checks
                    if (bet > p.balance) bet = p.balance;
                    if (bet < 10 && p.balance >= 10) bet = 10;
                    if (p.balance < 10) bet = p.balance;

                    p.currentBet = bet;
                    p.balance -= bet;
                    p.status = 'Ready';
                    addRoomLog(refreshedRoom, `🤖 ${p.name} placed a bet of ${bet} chips.`, 'info');
                }

                // Update room and check if all bets locked
                io.to(roomCode).emit('roomUpdate', getClientRoomState(refreshedRoom));
                
                if (checkAllBetsLocked(refreshedRoom)) {
                    triggerThirdCardDraw(roomCode);
                }
            }, delay);
        }
    });
}

// --- Draw Third Card & Reveal Phase ---
function triggerThirdCardDraw(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BETTING') return;

    room.gameState = 'REVEALING';
    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));

    setTimeout(() => {
        const refreshedRoom = rooms[roomCode];
        if (!refreshedRoom) return;

        // Draw third card
        const cardC = refreshedRoom.deck.draw();
        refreshedRoom.cardC = cardC;

        addRoomLog(refreshedRoom, `Dealer drew Third Card: ${cardC.value} of ${getSuitUnicode(cardC.suit)}`, 'dealer');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(refreshedRoom));
        
        // Broadcast animations to trigger deal sounds
        io.to(roomCode).emit('animateThirdCard', cardC);

        setTimeout(() => {
            evaluateRoundResults(roomCode);
        }, refreshedRoom.actionSpeed * 1.5);

    }, 800);
}

// --- Evaluate Round Outcomes ---
function evaluateRoundResults(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'REVEALING') return;

    room.gameState = 'EVALUATING';

    const cardAVal = room.cardA.rank;
    const cardBVal = room.cardB.rank;
    const cardCVal = room.cardC.rank;
    const cardCName = room.cardC.value;

    const isWinningCard = (cardCVal > cardAVal && cardCVal < cardBVal);
    let winCount = 0;
    let loseCount = 0;

    room.players.forEach(p => {
        if (p.isEliminated || p.isPass || p.status === 'Passed') {
            if (p.status === 'Passed') {
                p.recentResult = 'PASS';
                p.status = 'Folded';
            }
            return;
        }

        if (isWinningCard) {
            // Winner
            const profit = p.currentBet;
            p.balance += (p.currentBet * 2);
            p.recentGain = profit;
            p.recentResult = 'WIN';
            p.status = `Won +${profit}`;
            winCount++;
            addRoomLog(room, `${p.name} WINS! Won ${profit} chips.`, 'win');
        } else {
            // Loser
            const loss = p.currentBet;
            p.recentGain = -loss;
            p.recentResult = 'LOSE';
            p.status = `Lost -${loss}`;
            loseCount++;
            addRoomLog(room, `${p.name} LOSES! Lost ${loss} chips.`, 'lose');
        }
        p.currentBet = 0;
    });

    // Sound cue broadcasts
    if (winCount > 0) {
        io.to(roomCode).emit('soundCue', 'win');
        io.to(roomCode).emit('confettiTrigger');
    } else if (loseCount > 0) {
        io.to(roomCode).emit('soundCue', 'lose');
    }

    // Dealer speech remarks
    if (isWinningCard) {
        room.dealerBubble = `Drew a ${cardCName}! Congratulations to our winners!`;
    } else {
        if (cardCVal === cardAVal || cardCVal === cardBVal) {
            room.dealerBubble = `Hit the post! Drew a ${cardCName}. Unlucky bounds hit!`;
        } else {
            room.dealerBubble = `Drew a ${cardCName}. Out of bounds. House wins those chips!`;
        }
    }

    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));

    // Wait and progress to ROUND_END
    setTimeout(() => {
        const refreshedRoom = rooms[roomCode];
        if (!refreshedRoom) return;

        refreshedRoom.gameState = 'ROUND_END';

        // Check eliminations
        refreshedRoom.players.forEach(p => {
            if (!p.isEliminated && p.balance <= 0) {
                p.isEliminated = true;
                p.status = 'Eliminated';
                p.recentResult = 'ELIMINATED';
                addRoomLog(refreshedRoom, `${p.name} has been ELIMINATED!`, 'lose');
            }
        });

        // Check if all human players are eliminated
        const activeHumans = refreshedRoom.players.filter(p => !p.isBot && !p.isEliminated);
        if (activeHumans.length === 0) {
            refreshedRoom.gameState = 'GAME_OVER';
            addRoomLog(refreshedRoom, `--- SESSION OVER ---`, 'info');
        }

        io.to(roomCode).emit('roomUpdate', getClientRoomState(refreshedRoom));
    }, room.actionSpeed * 3.5);
}

// Clean room state object sent to client browsers
function getClientRoomState(room) {
    return {
        roomCode: room.roomCode,
        gameState: room.gameState,
        roundNumber: room.roundNumber,
        deckSize: room.deck.size(),
        discardSize: room.deck.discard.length,
        cardA: room.cardA,
        cardB: room.cardB,
        cardC: room.cardC,
        dealerBubble: room.dealerBubble,
        players: room.players,
        logs: room.logs
    };
}

// --- Socket.io Event Handling ---
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create a new room
    socket.on('createRoom', ({ playerName, color }) => {
        const roomCode = generateRoomCode();
        
        const hostPlayer = {
            id: 'player_' + Date.now() + '_' + Math.floor(Math.random() * 100),
            name: playerName,
            color: color,
            balance: 1000,
            currentBet: 0,
            isPass: false,
            isEliminated: false,
            isBot: false,
            isHost: true,
            status: 'Waiting',
            recentGain: 0,
            recentResult: '',
            socketId: socket.id
        };

        const room = {
            roomCode: roomCode,
            gameState: 'LOBBY',
            roundNumber: 1,
            deck: new Deck(),
            cardA: null,
            cardB: null,
            cardC: null,
            dealerBubble: `Room ${roomCode} created! Join in, players.`,
            players: [hostPlayer],
            logs: [],
            actionSpeed: 1000
        };
        
        room.deck.shuffle();
        rooms[roomCode] = room;
        
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });
        
        addRoomLog(room, `Table created. Room Code: ${roomCode}`, 'info');
        addRoomLog(room, `${playerName} joined as the Host.`, 'info');

        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        console.log(`Room created: ${roomCode} by ${playerName} (${socket.id})`);
    });

    // Join an existing room
    socket.on('joinRoom', ({ roomCode, playerName, color }) => {
        const cleanCode = roomCode.toUpperCase().trim();
        const room = rooms[cleanCode];

        if (!room) {
            socket.emit('errorMessage', 'Room not found! Verify code.');
            return;
        }

        if (room.gameState !== 'LOBBY') {
            socket.emit('errorMessage', 'Game has already started in this room!');
            return;
        }

        if (room.players.length >= 8) {
            socket.emit('errorMessage', 'Table is full! Maximum of 8 players.');
            return;
        }

        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('errorMessage', 'Player name already taken in this room!');
            return;
        }

        const newPlayer = {
            id: 'player_' + Date.now() + '_' + Math.floor(Math.random() * 100),
            name: playerName,
            color: color,
            balance: 1000,
            currentBet: 0,
            isPass: false,
            isEliminated: false,
            isBot: false,
            isHost: false,
            status: 'Waiting',
            recentGain: 0,
            recentResult: '',
            socketId: socket.id
        };

        room.players.push(newPlayer);
        socket.join(cleanCode);

        addRoomLog(room, `${playerName} joined the table.`, 'info');
        io.to(cleanCode).emit('roomUpdate', getClientRoomState(room));
        io.to(cleanCode).emit('toastMessage', `${playerName} joined the table.`);
        console.log(`Player ${playerName} joined room ${cleanCode}`);
    });

    // Add a Bot Player (Host only)
    socket.on('addBot', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        // Verify if caller is the host
        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        if (room.players.length >= 8) {
            socket.emit('errorMessage', 'Table is full! Maximum of 8 players.');
            return;
        }

        const botNames = ['Bot CardShark', 'Bot BluffMaster', 'Bot LuckyChip', 'Bot CasinoAI', 'Bot AceBot', 'Bot ChipStack', 'Bot DealerRob', 'Bot DealerGPT'];
        let selectedName = '';
        for (const name of botNames) {
            if (!room.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                selectedName = name;
                break;
            }
        }
        if (!selectedName) {
            selectedName = `Bot #${Math.floor(Math.random() * 100)}`;
        }

        const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c', '#34495e'];
        let selectedColor = colors[Math.floor(Math.random() * colors.length)];
        for (const color of colors) {
            if (!room.players.some(p => p.color === color)) {
                selectedColor = color;
                break;
            }
        }

        const botPlayer = {
            id: 'bot_' + Date.now() + '_' + Math.floor(Math.random() * 100),
            name: selectedName,
            color: selectedColor,
            balance: 1000,
            currentBet: 0,
            isPass: false,
            isEliminated: false,
            isBot: true,
            isHost: false,
            status: 'Waiting',
            recentGain: 0,
            recentResult: '',
            socketId: null
        };

        room.players.push(botPlayer);
        addRoomLog(room, `Bot ${selectedName} added to seats.`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('toastMessage', `Bot ${selectedName} added.`);
    });

    // Remove a seat (Host only)
    socket.on('removePlayer', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        const targetIndex = room.players.findIndex(p => p.id === playerId);
        if (targetIndex > -1) {
            const target = room.players[targetIndex];
            
            // Disconnect human socket if applicable
            if (target.socketId) {
                const targetSocket = io.sockets.sockets.get(target.socketId);
                if (targetSocket) {
                    targetSocket.leave(roomCode);
                    targetSocket.emit('kickMessage', 'You have been kicked by the host.');
                }
            }

            room.players.splice(targetIndex, 1);
            addRoomLog(room, `${target.name} removed from the table.`, 'info');
            io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
            io.to(roomCode).emit('toastMessage', `${target.name} kicked.`);
        }
    });

    // Start the Game (Host only)
    socket.on('startGame', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        if (room.players.length < 2) {
            socket.emit('errorMessage', 'Need at least 2 players to start!');
            return;
        }

        room.gameState = 'DEALING';
        room.roundNumber = 1;
        room.deck.init();
        room.deck.shuffle();

        addRoomLog(room, `--- GAME STARTED ---`, 'info');
        addRoomLog(room, `Dealer shuffled standard 52-card deck.`, 'dealer');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'shuffle');

        dealEndpoints(roomCode);
    });

    // Deal endpoints logic
    function dealEndpoints(roomCode) {
        const room = rooms[roomCode];
        if (!room) return;

        room.gameState = 'DEALING';
        room.cardA = null;
        room.cardB = null;
        room.cardC = null;
        room.dealerBubble = "Dealers, shuffle up and deal...";

        // Reset players round flags
        room.players.forEach(p => {
            p.recentGain = 0;
            p.recentResult = '';
            if (!p.isEliminated) {
                p.currentBet = 0;
                p.isPass = false;
                p.status = 'Betting...';
            }
        });

        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));

        // Shuffling trigger check
        if (room.deck.size() < 15) {
            room.deck.recycleDiscard();
            addRoomLog(room, `Dealer reshuffled deck. Discards recycled.`, 'dealer');
            io.to(roomCode).emit('soundCue', 'shuffle');
        }

        setTimeout(() => {
            const card1 = room.deck.draw();
            const card2 = room.deck.draw();

            // Sort
            if (card1.rank <= card2.rank) {
                room.cardA = card1;
                room.cardB = card2;
            } else {
                room.cardA = card2;
                room.cardB = card1;
            }

            // Animate card deals
            io.to(roomCode).emit('animateEndpoints', { cardA: room.cardA, cardB: room.cardB });
            
            setTimeout(() => {
                const low = room.cardA.value;
                const high = room.cardB.value;
                const gap = room.cardB.rank - room.cardA.rank - 1;

                if (room.cardA.rank === room.cardB.rank) {
                    room.dealerBubble = `Pair of ${low}s! Autoloss if you bet. Safe bet is to fold!`;
                    addRoomLog(room, `Dealer dealt pair of ${low}s. High risk: auto-loss.`, 'dealer');
                } else if (gap === 0) {
                    room.dealerBubble = `Adjacent cards! ${low} and ${high}. Pass to protect your chips!`;
                    addRoomLog(room, `Dealer dealt adjacent cards ${low} and ${high}.`, 'dealer');
                } else {
                    room.dealerBubble = `Dealt low ${low} and high ${high}. Place your bets!`;
                    addRoomLog(room, `Dealer dealt range: ${low} to ${high}.`, 'dealer');
                }

                room.gameState = 'BETTING';
                io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
                
                // Trigger bot decisions automatically
                processBotBets(roomCode);

            }, room.actionSpeed * 1.5);

        }, room.actionSpeed * 0.5);
    }

    // Place Bet (Simultaneous)
    socket.on('placeBet', ({ roomCode, betAmount }) => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== 'BETTING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.isEliminated || player.status === 'Ready') return;

        const bet = parseInt(betAmount) || 0;
        if (bet < 10 && player.balance >= 10) {
            socket.emit('errorMessage', 'Minimum bet is 10 chips!');
            return;
        }
        if (bet > player.balance) {
            socket.emit('errorMessage', 'Cannot bet more than balance!');
            return;
        }

        player.currentBet = bet;
        player.balance -= bet;
        player.isPass = false;
        player.status = 'Ready';

        addRoomLog(room, `${player.name} placed bet of ${bet} chips.`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'chip');

        if (checkAllBetsLocked(room)) {
            triggerThirdCardDraw(roomCode);
        }
    });

    // Pass / Fold (Simultaneous)
    socket.on('passRound', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== 'BETTING') return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.isEliminated || player.status === 'Passed') return;

        player.currentBet = 0;
        player.isPass = true;
        player.status = 'Passed';

        addRoomLog(room, `${player.name} passed this round.`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'slide');

        if (checkAllBetsLocked(room)) {
            triggerThirdCardDraw(roomCode);
        }
    });

    // Trigger next round (Host only)
    socket.on('nextRound', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        if (room.gameState !== 'ROUND_END') return;

        // Discard
        room.deck.discardCard(room.cardA);
        room.deck.discardCard(room.cardB);
        room.deck.discardCard(room.cardC);

        room.roundNumber++;
        dealEndpoints(roomCode);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);

        // Clean room lists
        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const pIndex = room.players.findIndex(p => p.socketId === socket.id);
            
            if (pIndex > -1) {
                const leavingPlayer = room.players[pIndex];
                
                // Remove player
                room.players.splice(pIndex, 1);
                addRoomLog(room, `${leavingPlayer.name} disconnected.`, 'info');
                console.log(`Player ${leavingPlayer.name} disconnected from room ${roomCode}`);

                if (room.players.length === 0) {
                    // Delete empty room
                    delete rooms[roomCode];
                    console.log(`Deleted empty room: ${roomCode}`);
                } else {
                    // Reassign host if the host left
                    if (leavingPlayer.isHost) {
                        const nextHuman = room.players.find(p => !p.isBot);
                        if (nextHuman) {
                            nextHuman.isHost = true;
                            addRoomLog(room, `${nextHuman.name} is now the Host.`, 'info');
                        } else {
                            // Only bots left, delete
                            delete rooms[roomCode];
                            console.log(`Deleted room ${roomCode} as only bots remained.`);
                            continue;
                        }
                    }

                    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
                    io.to(roomCode).emit('toastMessage', `${leavingPlayer.name} left the table.`);
                    
                    // If in BETTING state, check if remaining players are ready
                    if (room.gameState === 'BETTING' && checkAllBetsLocked(room)) {
                        triggerThirdCardDraw(roomCode);
                    }
                }
            }
        }
    });
});

// Start listening
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`In-Between socket server listening on port ${PORT}`);
});
