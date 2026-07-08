const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Initialize Express app and HTTP server
const app = express();
app.use(cors());

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// --- Game Constants & Mappings ---
const SUITS = ['C', 'D', 'H', 'S'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_MAP = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14
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

// Helper to generate Room Code
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (rooms[code]);
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

// Add log entry
function addRoomLog(room, message, type = 'info') {
    const log = {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        text: message,
        type: type
    };
    room.logs.push(log);
    if (room.logs.length > 50) room.logs.shift();
}

// Collect Antes from all active players
function collectAntes(room) {
    let anteCount = 0;
    room.players.forEach(p => {
        if (!p.isEliminated) {
            const ante = Math.min(p.balance, 10);
            p.balance -= ante;
            room.pot += ante;
            anteCount++;
        }
    });
    addRoomLog(room, `Antes collected: ${anteCount} players anted 10 chips to the pot. Pot is now ${room.pot} chips.`, 'dealer');
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
        logs: room.logs,
        pot: room.pot,
        activePlayerIndex: room.activePlayerIndex
    };
}

// --- Sequential Turn Advancement ---
function advanceTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    // Discard active cards
    room.deck.discardCard(room.cardA);
    room.deck.discardCard(room.cardB);
    room.deck.discardCard(room.cardC);
    room.cardA = null;
    room.cardB = null;
    room.cardC = null;

    // Process eliminations
    room.players.forEach(p => {
        if (!p.isEliminated && p.balance <= 0) {
            p.isEliminated = true;
            p.status = 'Eliminated';
            p.recentResult = 'ELIMINATED';
            addRoomLog(room, `${p.name} has been ELIMINATED!`, 'lose');
        }
    });

    // Check if pot is empty, refill if so
    if (room.pot <= 0) {
        addRoomLog(room, `Pot is empty! Refilling...`, 'dealer');
        collectAntes(room);
        io.to(roomCode).emit('soundCue', 'chip');
    }

    // Find next active player
    let nextIndex = room.activePlayerIndex + 1;
    let foundNext = false;
    let nextIdxResolved = 0;

    for (let i = 0; i < room.players.length; i++) {
        const checkIdx = (nextIndex + i) % room.players.length;
        if (!room.players[checkIdx].isEliminated) {
            nextIdxResolved = checkIdx;
            foundNext = true;
            break;
        }
    }

    // If we wrapped back to index 0 or wrapped backwards, increment round
    if (foundNext) {
        if (nextIdxResolved <= room.activePlayerIndex) {
            room.roundNumber++;
        }
        room.activePlayerIndex = nextIdxResolved;
    }

    const activeHumans = room.players.filter(p => !p.isBot && !p.isEliminated);
    if (!foundNext || activeHumans.length === 0) {
        room.gameState = 'GAME_OVER';
        addRoomLog(room, `--- SESSION OVER ---`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
    } else {
        dealEndpointsForActivePlayer(roomCode);
    }
}

// Deal endpoints for active player
function dealEndpointsForActivePlayer(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.gameState = 'DEALING';
    const activePlayer = room.players[room.activePlayerIndex];
    room.dealerBubble = `Dealing cards for ${activePlayer.name}...`;

    // Reset player round flags
    room.players.forEach(p => {
        p.recentGain = 0;
        p.recentResult = '';
        if (p.id === activePlayer.id) {
            p.status = 'Thinking...';
            p.isPass = false;
            p.currentBet = 0;
        } else if (!p.isEliminated) {
            p.status = 'Waiting';
        }
    });

    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));

    // Reshuffle checks
    if (room.deck.size() < 10) {
        room.deck.recycleDiscard();
        addRoomLog(room, `Dealer reshuffled deck. Discards recycled.`, 'dealer');
        io.to(roomCode).emit('soundCue', 'shuffle');
    }

    // Deal endpoints
    setTimeout(() => {
        const refreshedRoom = rooms[roomCode];
        if (!refreshedRoom) return;

        const card1 = refreshedRoom.deck.draw();
        const card2 = refreshedRoom.deck.draw();

        if (card1.rank <= card2.rank) {
            refreshedRoom.cardA = card1;
            refreshedRoom.cardB = card2;
        } else {
            refreshedRoom.cardA = card2;
            refreshedRoom.cardB = card1;
        }

        io.to(roomCode).emit('animateEndpoints', { cardA: refreshedRoom.cardA, cardB: refreshedRoom.cardB });

        setTimeout(() => {
            const innerRoom = rooms[roomCode];
            if (!innerRoom) return;

            const player = innerRoom.players[innerRoom.activePlayerIndex];
            const low = innerRoom.cardA.value;
            const high = innerRoom.cardB.value;
            const gap = innerRoom.cardB.rank - innerRoom.cardA.rank - 1;

            // --- Immediate Resolutions (Traditional Rules) ---
            if (innerRoom.cardA.rank === innerRoom.cardB.rank) {
                // Pair: Auto Win 20 chips
                const winAmt = Math.min(innerRoom.pot, 20);
                innerRoom.pot -= winAmt;
                player.balance += winAmt;
                player.recentGain = winAmt;
                player.recentResult = 'WIN';
                player.status = `Pair Auto-Win +${winAmt}`;

                innerRoom.dealerBubble = `A pair of ${low}s! ${player.name} automatically wins ${winAmt} chips from the pot!`;
                addRoomLog(innerRoom, `🎉 ${player.name} dealt pair of ${low}s. Auto-won ${winAmt} chips.`, 'win');
                
                io.to(roomCode).emit('roomUpdate', getClientRoomState(innerRoom));
                io.to(roomCode).emit('soundCue', 'win');

                setTimeout(() => {
                    advanceTurn(roomCode);
                }, 4000);

            } else if (gap === 0) {
                // Adjacent: Auto Lose 10 chips
                const loseAmt = Math.min(player.balance, 10);
                player.balance -= loseAmt;
                innerRoom.pot += loseAmt;
                player.recentGain = -loseAmt;
                player.recentResult = 'LOSE';
                player.status = `Adjacent Loss -${loseAmt}`;

                innerRoom.dealerBubble = `Adjacent cards ${low} and ${high}! ${player.name} automatically loses ${loseAmt} chips to the pot.`;
                addRoomLog(innerRoom, `💥 ${player.name} dealt adjacent ${low} & ${high}. Auto-lost ${loseAmt} chips.`, 'lose');

                io.to(roomCode).emit('roomUpdate', getClientRoomState(innerRoom));
                io.to(roomCode).emit('soundCue', 'lose');

                setTimeout(() => {
                    advanceTurn(roomCode);
                }, 4000);

            } else {
                // Normal spread: betting console active
                innerRoom.gameState = 'BETTING';
                innerRoom.dealerBubble = `${player.name}'s turn. Range is ${low} to ${high}. Max bet: ${Math.min(player.balance, innerRoom.pot)}`;
                
                io.to(roomCode).emit('roomUpdate', getClientRoomState(innerRoom));
                if (player.isBot) {
                    executeBotTurn(roomCode);
                }
            }
        }, room.actionSpeed * 1.5);

    }, room.actionSpeed * 0.5);
}

// Bot sequential turn decision
function executeBotTurn(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BETTING') return;

    const botPlayer = room.players[room.activePlayerIndex];
    if (!botPlayer || !botPlayer.isBot) return;

    const delay = 1200 + Math.random() * 1200;
    setTimeout(() => {
        const refreshedRoom = rooms[roomCode];
        if (!refreshedRoom || refreshedRoom.gameState !== 'BETTING') return;

        const lowRank = refreshedRoom.cardA.rank;
        const highRank = refreshedRoom.cardB.rank;
        const gap = highRank - lowRank - 1;

        const maxBet = Math.min(botPlayer.balance, refreshedRoom.pot);

        if (gap <= 2 || maxBet < 10) {
            // Bot Pass
            botPlayer.isPass = true;
            botPlayer.currentBet = 0;
            botPlayer.status = 'Passed';
            addRoomLog(refreshedRoom, `🤖 ${botPlayer.name} passed their turn.`, 'info');
            
            io.to(roomCode).emit('roomUpdate', getClientRoomState(refreshedRoom));
            io.to(roomCode).emit('soundCue', 'slide');

            setTimeout(() => {
                advanceTurn(roomCode);
            }, 1200);
        } else {
            // Bot Bet
            let bet = 10;
            if (gap >= 8) {
                const pct = 0.2 + Math.random() * 0.2;
                bet = Math.floor((maxBet * pct) / 10) * 10;
            } else if (gap >= 5) {
                const pct = 0.08 + Math.random() * 0.08;
                bet = Math.floor((maxBet * pct) / 10) * 10;
            } else {
                bet = 10;
            }

            if (bet > maxBet) bet = maxBet;
            if (bet < 10 && maxBet >= 10) bet = 10;
            if (maxBet < 10) bet = maxBet;

            botPlayer.currentBet = bet;
            botPlayer.balance -= bet;
            botPlayer.status = 'Ready';

            addRoomLog(refreshedRoom, `🤖 ${botPlayer.name} placed a bet of ${bet} chips.`, 'info');
            io.to(roomCode).emit('roomUpdate', getClientRoomState(refreshedRoom));
            io.to(roomCode).emit('soundCue', 'chip');

            setTimeout(() => {
                drawThirdCardForActivePlayer(roomCode);
            }, 800);
        }

    }, delay);
}

// Draw third card
function drawThirdCardForActivePlayer(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'BETTING') return;

    room.gameState = 'REVEALING';
    const activePlayer = room.players[room.activePlayerIndex];

    const cardC = room.deck.draw();
    room.cardC = cardC;

    addRoomLog(room, `Dealer drew Third Card: ${cardC.value} of ${getSuitUnicode(cardC.suit)}`, 'dealer');
    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
    io.to(roomCode).emit('animateThirdCard', cardC);

    setTimeout(() => {
        resolveBetForActivePlayer(roomCode);
    }, room.actionSpeed * 1.5);
}

// Resolve active player's bet outcome
function resolveBetForActivePlayer(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState !== 'REVEALING') return;

    room.gameState = 'EVALUATING';

    const activePlayer = room.players[room.activePlayerIndex];
    const cardAVal = room.cardA.rank;
    const cardBVal = room.cardB.rank;
    const cardCVal = room.cardC.rank;
    const cardCName = room.cardC.value;

    const isWinningCard = (cardCVal > cardAVal && cardCVal < cardBVal);
    const bet = activePlayer.currentBet;

    if (isWinningCard) {
        // WIN
        const profit = Math.min(room.pot, bet);
        room.pot -= profit;
        activePlayer.balance += (bet + profit); // Refund original bet + profit
        activePlayer.recentGain = profit;
        activePlayer.recentResult = 'WIN';
        activePlayer.status = `Won +${profit}`;

        room.dealerBubble = `Drew a ${cardCName}! ${activePlayer.name} wins ${profit} chips!`;
        addRoomLog(room, `${activePlayer.name} WINS! Won ${profit} chips.`, 'win');

        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'win');
        io.to(roomCode).emit('confettiTrigger');
    } else {
        // LOSE
        room.pot += bet;
        activePlayer.recentGain = -bet;
        activePlayer.recentResult = 'LOSE';
        activePlayer.status = `Lost -${bet}`;

        if (cardCVal === cardAVal || cardCVal === cardBVal) {
            room.dealerBubble = `Hit the post! Drew a ${cardCName}. ${activePlayer.name} loses their bet of ${bet} to the pot!`;
        } else {
            room.dealerBubble = `Drew a ${cardCName}. Out of bounds. ${activePlayer.name} loses their bet of ${bet} to the pot!`;
        }

        addRoomLog(room, `${activePlayer.name} LOSES! Lost ${bet} chips to the pot.`, 'lose');

        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'lose');
    }

    activePlayer.currentBet = 0;

    setTimeout(() => {
        advanceTurn(roomCode);
    }, 4000);
}

// --- Socket Connection Handler ---
io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Create room
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
            pot: 0,
            activePlayerIndex: 0,
            actionSpeed: 1000
        };

        room.deck.shuffle();
        rooms[roomCode] = room;

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode });

        addRoomLog(room, `Table created. Room Code: ${roomCode}`, 'info');
        addRoomLog(room, `${playerName} joined as the Host.`, 'info');

        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
    });

    // Join room
    socket.on('joinRoom', ({ roomCode, playerName, color }) => {
        const cleanCode = roomCode.toUpperCase().trim();
        const room = rooms[cleanCode];

        if (!room) {
            socket.emit('errorMessage', 'Room not found!');
            return;
        }

        if (room.gameState !== 'LOBBY') {
            socket.emit('errorMessage', 'Game has already started!');
            return;
        }

        if (room.players.length >= 8) {
            socket.emit('errorMessage', 'Table is full!');
            return;
        }

        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('errorMessage', 'Player name already taken!');
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
    });

    // Add bot (Host only)
    socket.on('addBot', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        if (room.players.length >= 8) {
            socket.emit('errorMessage', 'Table is full!');
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

    // Remove player (Host only)
    socket.on('removePlayer', ({ roomCode, playerId }) => {
        const room = rooms[roomCode];
        if (!room) return;

        const sender = room.players.find(p => p.socketId === socket.id);
        if (!sender || !sender.isHost) return;

        const targetIndex = room.players.findIndex(p => p.id === playerId);
        if (targetIndex > -1) {
            const target = room.players[targetIndex];
            
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

    // Start game (Host only)
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
        room.activePlayerIndex = 0;
        room.pot = 0;
        room.deck.init();
        room.deck.shuffle();

        addRoomLog(room, `--- GAME STARTED ---`, 'info');
        addRoomLog(room, `Dealer shuffled standard 52-card deck.`, 'dealer');
        io.to(roomCode).emit('soundCue', 'shuffle');

        // Collect initial antes
        collectAntes(room);

        // Deal endpoints for player 0
        dealEndpointsForActivePlayer(roomCode);
    });

    // Place bet (Active player only)
    socket.on('placeBet', ({ roomCode, betAmount }) => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== 'BETTING') return;

        const activePlayer = room.players[room.activePlayerIndex];
        if (!activePlayer || activePlayer.socketId !== socket.id) return;

        const bet = parseInt(betAmount) || 0;
        const maxBet = Math.min(activePlayer.balance, room.pot);

        if (bet < 10 && maxBet >= 10) {
            socket.emit('errorMessage', 'Minimum bet is 10 chips!');
            return;
        }
        if (bet > maxBet) {
            socket.emit('errorMessage', 'Cannot bet more than pot/balance limit!');
            return;
        }

        activePlayer.currentBet = bet;
        activePlayer.balance -= bet;
        activePlayer.isPass = false;
        activePlayer.status = 'Ready';

        addRoomLog(room, `${activePlayer.name} placed a bet of ${bet} chips.`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'chip');

        setTimeout(() => {
            drawThirdCardForActivePlayer(roomCode);
        }, 800);
    });

    // Pass turn (Active player only)
    socket.on('passRound', ({ roomCode }) => {
        const room = rooms[roomCode];
        if (!room || room.gameState !== 'BETTING') return;

        const activePlayer = room.players[room.activePlayerIndex];
        if (!activePlayer || activePlayer.socketId !== socket.id) return;

        activePlayer.currentBet = 0;
        activePlayer.isPass = true;
        activePlayer.status = 'Passed';

        addRoomLog(room, `${activePlayer.name} passed their turn.`, 'info');
        io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
        io.to(roomCode).emit('soundCue', 'slide');

        setTimeout(() => {
            advanceTurn(roomCode);
        }, 800);
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`);

        for (const roomCode in rooms) {
            const room = rooms[roomCode];
            const pIndex = room.players.findIndex(p => p.socketId === socket.id);

            if (pIndex > -1) {
                const leavingPlayer = room.players[pIndex];
                
                room.players.splice(pIndex, 1);
                addRoomLog(room, `${leavingPlayer.name} disconnected.`, 'info');

                if (room.players.length === 0) {
                    delete rooms[roomCode];
                    console.log(`Deleted empty room: ${roomCode}`);
                } else {
                    // Host reassignment
                    if (leavingPlayer.isHost) {
                        const nextHuman = room.players.find(p => !p.isBot);
                        if (nextHuman) {
                            nextHuman.isHost = true;
                            addRoomLog(room, `${nextHuman.name} is now the Host.`, 'info');
                        } else {
                            delete rooms[roomCode];
                            console.log(`Deleted room ${roomCode} as only bots remained.`);
                            continue;
                        }
                    }

                    // Turn correction if active player disconnected
                    if (room.activePlayerIndex >= room.players.length) {
                        room.activePlayerIndex = 0;
                    }

                    io.to(roomCode).emit('roomUpdate', getClientRoomState(room));
                    io.to(roomCode).emit('toastMessage', `${leavingPlayer.name} left the table.`);

                    // If active player left in middle of turn, advance automatically
                    if (room.gameState === 'BETTING' && room.players[room.activePlayerIndex].id === leavingPlayer.id) {
                        advanceTurn(roomCode);
                    }
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`In-Between socket server listening on port ${PORT}`);
});
