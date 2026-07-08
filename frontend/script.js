/* ==========================================================================
   IN-BETWEEN (ACEY DEUCEY) ONLINE MULTIPLAYER CLIENT
   ========================================================================== */

// --- Production Backend Server URL (Change to your Render URL) ---
const SERVER_URL = 'https://in-between-game-gkc7.onrender.com';

// --- Web Audio API Sound Synthesizer ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        
        const initAudio = () => {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        };
        window.addEventListener('click', initAudio, { once: true });
        window.addEventListener('touchstart', initAudio, { once: true });
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.muted;
    }

    initCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playSound(generatorFn) {
        if (this.muted) return;
        this.initCtx();
        try {
            generatorFn(this.ctx);
        } catch (e) {
            console.error("Audio error:", e);
        }
    }

    playShuffle() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            for (let i = 0; i < 8; i++) {
                const clickTime = now + (i * 0.08);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(150 + Math.random() * 80, clickTime);
                osc.frequency.exponentialRampToValueAtTime(10, clickTime + 0.05);

                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, clickTime);

                gain.gain.setValueAtTime(0.04, clickTime);
                gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.04);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.start(clickTime);
                osc.stop(clickTime + 0.05);
            }
        });
    }

    playFlip() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.15);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.16);

            const oscClick = ctx.createOscillator();
            const gainClick = ctx.createGain();
            oscClick.type = 'triangle';
            oscClick.frequency.setValueAtTime(250, now + 0.05);
            gainClick.gain.setValueAtTime(0.02, now + 0.05);
            gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

            oscClick.connect(gainClick);
            gainClick.connect(ctx.destination);

            oscClick.start(now + 0.05);
            oscClick.stop(now + 0.1);
        });
    }

    playSlide() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(250, now + 0.25);
            
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(800, now);
            filter.Q.setValueAtTime(2.0, now);
            
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.26);
        });
    }

    playChip() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
            
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(now);
            osc.stop(now + 0.07);
        });
    }

    playWin() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
            
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + (index * 0.08);
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, noteTime);
                
                gain.gain.setValueAtTime(0.0, noteTime);
                gain.gain.linearRampToValueAtTime(0.06, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(noteTime);
                osc.stop(noteTime + 0.40);
            });
        });
    }

    playLose() {
        this.playSound((ctx) => {
            const now = ctx.currentTime;
            const notes = [311.13, 293.66, 277.18, 220.00]; // Eb4, D4, Db4, A3
            
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const noteTime = now + (index * 0.12);
                
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, noteTime);
                osc.frequency.linearRampToValueAtTime(freq - 30, noteTime + 0.2);
                
                gain.gain.setValueAtTime(0.0, noteTime);
                gain.gain.linearRampToValueAtTime(0.04, noteTime + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start(noteTime);
                osc.stop(noteTime + 0.3);
            });
        });
    }
}

// --- Confetti particle engine ---
class ConfettiManager {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.colors = ['#f1c40f', '#e67e22', '#2ecc71', '#3498db', '#e74c3c', '#9b59b6', '#1abc9c'];
        this.active = false;
        
        window.addEventListener('resize', () => {
            if (this.active) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
        });
    }

    start() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.classList.add('active');
        this.particles = [];
        this.active = true;

        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height - this.canvas.height,
                r: Math.random() * 6 + 4,
                d: Math.random() * this.canvas.height,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                tilt: Math.random() * 10 - 5,
                tiltAngleIncremental: Math.random() * 0.07 + 0.02,
                tiltAngle: 0,
                speedY: Math.random() * 3 + 2,
                speedX: Math.random() * 2 - 1
            });
        }
        this.draw();
    }

    stop() {
        this.active = false;
        this.canvas.classList.remove('active');
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    draw() {
        if (!this.active) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let remaining = false;
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.tiltAngle += p.tiltAngleIncremental;
            p.y += p.speedY;
            p.x += p.speedX;
            p.tilt = Math.sin(p.tiltAngle) * 12;

            if (p.y <= this.canvas.height + 10) {
                remaining = true;
            }

            this.ctx.beginPath();
            this.ctx.lineWidth = p.r;
            this.ctx.strokeStyle = p.color;
            this.ctx.moveTo(p.x + p.tilt + p.r / 2, p.y);
            this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2);
            this.ctx.stroke();
        }

        if (remaining) {
            requestAnimationFrame(() => this.draw());
        } else {
            this.stop();
        }
    }
}

// --- Game Client Manager ---
class Game {
    constructor() {
        // Subsystems
        this.audio = new AudioManager();
        this.confetti = new ConfettiManager('confetti-canvas');
        
        // local state
        this.roomCode = null;
        this.isHost = false;
        this.playersList = [];

        // Detect server environment URL (localhost dev vs production Render link)
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const serverHost = isLocalhost ? 'http://localhost:3000' : SERVER_URL;

        // Initialize Sockets connection
        this.socket = io(serverHost);

        this.initDOMElements();
        this.bindEvents();
        this.bindSocketEvents();
        
        this.loadProfileFromStorage();
        this.logMessage("Local system initialized. Connecting to backend...", "info");
    }

    initDOMElements() {
        // Screens
        this.lobbyScreen = document.getElementById('lobby-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        
        // Lobby view sub-sections
        this.lobbySetupView = document.getElementById('lobby-setup-view');
        this.lobbyRoomView = document.getElementById('lobby-room-view');
        
        // Inputs
        this.playerNameInput = document.getElementById('player-name-input');
        this.colorChoices = document.getElementById('avatar-color-choices');
        this.roomCodeInput = document.getElementById('room-code-input');
        
        // Actions
        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.lobbyAddBotBtn = document.getElementById('lobby-add-bot-btn');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.goToLobbyBtn = document.getElementById('go-to-lobby-btn');
        this.lobbyExitBtn = document.getElementById('lobby-exit-btn');
        
        // Lobbies UI
        this.lobbyRoomCodeLbl = document.getElementById('lobby-room-code-lbl');
        this.lobbyPlayersList = document.getElementById('lobby-players-list');
        this.seatCountLbl = document.getElementById('seat-count');
        this.lobbyStatusMsg = document.getElementById('lobby-status-msg');
        this.hostControls = document.getElementById('host-controls');

        // Game Header
        this.gameRoomCodeLbl = document.getElementById('game-room-code-lbl');
        this.tablePotVal = document.getElementById('table-pot-val');
        this.activeHandHolder = document.getElementById('active-hand-holder');
        this.deckSizeLbl = document.getElementById('deck-size-lbl');
        this.dealerBubble = document.getElementById('dealer-bubble');
        this.roundNumLbl = document.getElementById('round-num-lbl');
        this.mainStatusMsg = document.getElementById('main-status-msg');
        this.rangeVisualizer = document.getElementById('range-visualizer');
        this.rangeMinLbl = document.getElementById('range-min-lbl');
        this.rangeMaxLbl = document.getElementById('range-max-lbl');
        this.discardStack = document.getElementById('discard-card-stack');
        this.seatsGrid = document.getElementById('player-seats-grid');

        // Cards slots
        this.cardA = document.getElementById('table-card-a');
        this.cardB = document.getElementById('table-card-b');
        this.cardC = document.getElementById('table-card-c');

        // Betting Controls panel
        this.bettingPanel = document.getElementById('betting-panel');
        this.bettingPlayerAvatar = document.getElementById('betting-player-avatar');
        this.bettingPlayerName = document.getElementById('betting-player-name');
        this.bettingPlayerBalance = document.getElementById('betting-player-balance');
        this.betSlider = document.getElementById('bet-range-slider');
        this.betInput = document.getElementById('bet-number-input');
        this.betMaxLbl = document.getElementById('bet-max-lbl-display');
        this.confirmBetBtn = document.getElementById('confirm-bet-btn');
        this.passBetBtn = document.getElementById('pass-bet-btn');

        // Sidebar
        this.sidebar = document.getElementById('sidebar');
        this.toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
        this.gameLogList = document.getElementById('game-log-list');
        this.statsList = document.getElementById('stats-players-list');
        this.clearLogBtn = document.getElementById('clear-log-btn');
        this.resetStatsBtnSidebar = document.getElementById('reset-stats-btn-sidebar');

        // Settings / Rules / full screen buttons
        this.settingsModal = document.getElementById('settings-modal');
        this.rulesModal = document.getElementById('rules-modal');
        this.openSettingsBtn = document.getElementById('open-settings-btn');
        this.gameRulesBtn = document.getElementById('game-rules-btn');
        this.muteSoundBtn = document.getElementById('mute-sound-btn');
        this.soundOnIcon = this.muteSoundBtn.querySelector('.sound-icon-on');
        this.soundOffIcon = this.muteSoundBtn.querySelector('.sound-icon-off');
        this.fullscreenBtn = document.getElementById('fullscreen-btn');

        // Settings selectors
        this.themeSelector = document.getElementById('theme-selector');
        this.cardSizeSelector = document.getElementById('card-size-selector');
        this.gameSpeedSelector = document.getElementById('game-speed-selector');
        this.soundToggle = document.getElementById('sound-effects-toggle');
    }

    bindEvents() {
        // 1. Color Button picker triggers
        this.colorChoices.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-btn')) {
                this.colorChoices.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
        });

        // 2. Sockets action emitters (Lobby)
        this.createRoomBtn.addEventListener('click', () => {
            const name = this.playerNameInput.value.trim();
            const color = this.colorChoices.querySelector('.color-btn.active').getAttribute('data-color');
            if (!name) {
                this.toast("Please enter a player name!");
                return;
            }
            this.saveProfileToStorage(name, color);
            this.socket.emit('createRoom', { playerName: name, color: color });
        });

        this.joinRoomBtn.addEventListener('click', () => {
            const name = this.playerNameInput.value.trim();
            const color = this.colorChoices.querySelector('.color-btn.active').getAttribute('data-color');
            const code = this.roomCodeInput.value.toUpperCase().trim();
            if (!name) {
                this.toast("Please enter a player name!");
                return;
            }
            if (!code || code.length !== 4) {
                this.toast("Please enter a valid 4-character Room Code!");
                return;
            }
            this.saveProfileToStorage(name, color);
            this.socket.emit('joinRoom', { roomCode: code, playerName: name, color: color });
        });

        this.lobbyAddBotBtn.addEventListener('click', () => {
            if (this.roomCode) {
                this.socket.emit('addBot', { roomCode: this.roomCode });
            }
        });

        this.startGameBtn.addEventListener('click', () => {
            if (this.roomCode) {
                this.socket.emit('startGame', { roomCode: this.roomCode });
            }
        });

        // 3. Betting slider inputs triggers
        this.betSlider.addEventListener('input', (e) => {
            this.betInput.value = e.target.value;
            this.audio.playChip();
        });
        
        this.betInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value) || 0;
            const maxVal = parseInt(this.betSlider.max);
            if (val < 10) val = 10;
            if (val > maxVal) val = maxVal;
            this.betSlider.value = val;
        });

        // Chip presets
        document.querySelectorAll('.chip-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const valueAttr = target.getAttribute('data-value');
                const me = this.playersList.find(p => p.socketId === this.socket.id);
                if (!me) return;
                
                let targetBet = 10;
                if (valueAttr === "all-in" || target.id === "bet-preset-all-in") {
                    targetBet = me.balance;
                } else {
                    targetBet = parseInt(valueAttr);
                }

                if (targetBet > me.balance) targetBet = me.balance;
                if (targetBet < 10) targetBet = 10;

                this.betSlider.value = targetBet;
                this.betInput.value = targetBet;
                this.audio.playChip();
            });
        });

        // Bet confirm/pass actions
        this.confirmBetBtn.addEventListener('click', () => {
            const betAmount = parseInt(this.betInput.value) || 0;
            if (this.roomCode) {
                this.socket.emit('placeBet', { roomCode: this.roomCode, betAmount });
            }
        });

        this.passBetBtn.addEventListener('click', () => {
            if (this.roomCode) {
                this.socket.emit('passRound', { roomCode: this.roomCode });
            }
        });

        // 4. Modals and Settings binds
        this.openSettingsBtn.addEventListener('click', () => this.openModal(this.settingsModal));
        this.gameRulesBtn.addEventListener('click', () => this.openModal(this.rulesModal));
        
        this.muteSoundBtn.addEventListener('click', () => {
            const isMuted = this.audio.toggleMute();
            this.soundToggle.checked = !isMuted;
            this.updateSoundIcons(isMuted);
            this.toast(`Sound ${isMuted ? 'Muted' : 'Unmuted'}`);
        });

        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-close');
                this.closeModal(document.getElementById(modalId));
            });
        });

        this.themeSelector.addEventListener('change', (e) => {
            document.body.className = '';
            document.body.classList.add(e.target.value);
        });

        this.cardSizeSelector.addEventListener('change', (e) => {
            const size = e.target.value;
            const sizes = ['card-sm', 'card-md', 'card-lg'];
            const elements = [this.cardA, this.cardB, this.cardC];
            elements.forEach(el => {
                sizes.forEach(s => el.classList.remove(s));
                el.classList.add(size);
            });
        });

        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.clearLogBtn.addEventListener('click', () => this.gameLogList.innerHTML = '');
        
        // Exit table
        this.lobbyExitBtn.addEventListener('click', () => {
            if (confirm("Leave this table? You will be disconnected.")) {
                window.location.reload(); // Quick reset
            }
        });

        this.goToLobbyBtn.addEventListener('click', () => {
            window.location.reload();
        });

        // Tabs
        this.sidebar.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.sidebar.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                this.sidebar.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(e.target.getAttribute('data-tab')).classList.add('active');
            });
        });

        this.toggleSidebarBtn.addEventListener('click', () => {
            this.sidebar.classList.toggle('collapsed');
        });
    }

    bindSocketEvents() {
        // Room creation callback
        this.socket.on('roomCreated', ({ roomCode }) => {
            this.roomCode = roomCode;
            this.lobbyRoomCodeLbl.textContent = roomCode;
            this.gameRoomCodeLbl.textContent = roomCode;
            
            // Toggle view to room lobby
            this.lobbySetupView.classList.add('hidden');
            this.lobbyRoomView.classList.remove('hidden');
        });

        // Room state synchronizer
        this.socket.on('roomUpdate', (roomState) => {
            this.roomCode = roomState.roomCode;
            this.playersList = roomState.players;
            
            // 1. Identify client host/seat details
            const me = roomState.players.find(p => p.socketId === this.socket.id);
            this.isHost = me ? me.isHost : false;

            // 2. Render Screen transitions
            if (roomState.gameState === 'LOBBY') {
                this.lobbyScreen.classList.add('active');
                this.gameScreen.classList.remove('active');
                this.gameOverScreen.classList.remove('active');
                this.renderLobbyPlayers(roomState.players);
            } else if (roomState.gameState === 'GAME_OVER') {
                this.lobbyScreen.classList.remove('active');
                this.gameScreen.classList.remove('active');
                this.showGameOverLeaderboard(roomState.players);
            } else {
                this.lobbyScreen.classList.remove('active');
                this.gameScreen.classList.add('active');
                this.gameOverScreen.classList.remove('active');
                
                // Update table elements
                this.syncGameTable(roomState, me);
            }
        });

        // Direct animation broadcasts
        this.socket.on('animateEndpoints', ({ cardA, cardB }) => {
            this.animateCardDeal(this.cardA, cardA);
            setTimeout(() => {
                this.animateCardDeal(this.cardB, cardB);
            }, 500);
        });

        this.socket.on('animateThirdCard', (cardC) => {
            this.animateCardDeal(this.cardC, cardC);
        });

        // Direct audio triggers
        this.socket.on('soundCue', (type) => {
            if (type === 'shuffle') this.audio.playShuffle();
            if (type === 'win') this.audio.playWin();
            if (type === 'lose') this.audio.playLose();
            if (type === 'chip') this.audio.playChip();
            if (type === 'slide') this.audio.playSlide();
        });

        this.socket.on('confettiTrigger', () => {
            this.confetti.start();
        });

        // Toast notifications
        this.socket.on('toastMessage', (msg) => {
            this.toast(msg);
        });

        // Errors & kicks
        this.socket.on('errorMessage', (msg) => {
            this.toast(`⚠️ ${msg}`);
        });

        this.socket.on('kickMessage', (msg) => {
            alert(msg);
            window.location.reload();
        });
    }

    // --- State Sync Handlers ---
    renderLobbyPlayers(players) {
        this.lobbyPlayersList.innerHTML = '';
        this.seatCountLbl.textContent = players.length;

        // Toggle host controls
        if (this.isHost) {
            this.hostControls.classList.remove('hidden');
            this.startGameBtn.classList.remove('hidden');
            this.lobbyStatusMsg.classList.add('hidden');
            
            // Enable start if enough players
            if (players.length >= 2) {
                this.startGameBtn.classList.remove('disabled');
                this.startGameBtn.removeAttribute('disabled');
            } else {
                this.startGameBtn.classList.add('disabled');
                this.startGameBtn.setAttribute('disabled', 'true');
            }
        } else {
            this.hostControls.classList.add('hidden');
            this.startGameBtn.classList.add('hidden');
            this.lobbyStatusMsg.classList.remove('hidden');
            this.lobbyStatusMsg.textContent = "Waiting for Host to start game...";
        }

        players.forEach(p => {
            const row = document.createElement('div');
            row.className = 'lobby-player-row';
            const initials = p.name.substring(0,2).toUpperCase();

            // Kick action only visible to Host
            const deleteHTML = (this.isHost && p.socketId !== this.socket.id) ? `
                <div class="player-actions">
                    <button type="button" class="lobby-delete-btn" title="Kick Player" data-id="${p.id}">
                        <svg class="icon" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    </button>
                </div>
            ` : '';

            row.innerHTML = `
                <div class="player-details">
                    <span class="lobby-avatar" style="background-color: ${p.color};">${initials}</span>
                    <span class="player-name-val">${p.isBot ? '🤖 ' : ''}${p.name} ${p.isHost ? '<span class="gold-text">(Host)</span>' : ''}</span>
                </div>
                ${deleteHTML}
            `;

            if (this.isHost && p.socketId !== this.socket.id) {
                row.querySelector('.lobby-delete-btn').addEventListener('click', (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    this.socket.emit('removePlayer', { roomCode: this.roomCode, playerId: id });
                });
            }

            this.lobbyPlayersList.appendChild(row);
        });
    }

    syncGameTable(roomState, me) {
        this.roundNumLbl.textContent = roomState.roundNumber;
        this.deckSizeLbl.textContent = roomState.deckSize;
        this.dealerBubble.textContent = roomState.dealerBubble;
        
        // Sync pot amount
        if (this.tablePotVal) {
            this.tablePotVal.textContent = roomState.pot;
        }

        // Sync hand holder
        if (this.activeHandHolder) {
            const activePlayer = roomState.players[roomState.activePlayerIndex];
            this.activeHandHolder.textContent = activePlayer ? `${activePlayer.name}'s Deal` : "No Dealt Cards";
        }

        // Render card states visually
        this.syncCardVisuals(roomState);

        // Render seats
        this.renderSeatsGrid(roomState.players, roomState.activePlayerIndex);
        this.updateStatsSidebar(roomState.players);

        // Sync logs
        this.syncLogsList(roomState.logs);

        // Simultaneous betting console display
        this.syncBettingConsole(roomState, me);
    }

    syncCardVisuals(roomState) {
        // Sync Card A
        if (roomState.cardA) {
            this.cardA.classList.remove('empty');
            this.cardA.querySelector('.card-front').innerHTML = `<img src="${roomState.cardA.filename}">`;
            if (roomState.gameState !== 'DEALING') {
                this.cardA.classList.add('flipped');
            }
        } else {
            this.resetCardElement(this.cardA);
        }

        // Sync Card B
        if (roomState.cardB) {
            this.cardB.classList.remove('empty');
            this.cardB.querySelector('.card-front').innerHTML = `<img src="${roomState.cardB.filename}">`;
            if (roomState.gameState !== 'DEALING') {
                this.cardB.classList.add('flipped');
            }
        } else {
            this.resetCardElement(this.cardB);
        }

        // Sync Card C
        if (roomState.cardC) {
            this.cardC.classList.remove('empty');
            this.cardC.querySelector('.card-front').innerHTML = `<img src="${roomState.cardC.filename}">`;
            if (roomState.gameState !== 'DEALING') {
                this.cardC.classList.add('flipped');
            }
        } else {
            this.resetCardElement(this.cardC);
        }

        // Range strip visualizer
        if (roomState.cardA && roomState.cardB && roomState.gameState !== 'DEALING') {
            this.rangeMinLbl.textContent = roomState.cardA.value;
            this.rangeMaxLbl.textContent = roomState.cardB.value;
            const filler = this.rangeVisualizer.querySelector('.range-fill');
            
            const gap = roomState.cardB.rank - roomState.cardA.rank - 1;
            if (gap === -1) {
                filler.textContent = "Pair (Auto-loss)";
                filler.style.background = "linear-gradient(90deg, transparent, var(--color-danger), transparent)";
            } else if (gap === 0) {
                filler.textContent = "Adjacent (No gap)";
                filler.style.background = "linear-gradient(90deg, transparent, var(--color-danger), transparent)";
            } else {
                filler.textContent = "In-Between Range";
                filler.style.background = "linear-gradient(90deg, transparent, var(--color-gold), transparent)";
            }
            this.rangeVisualizer.classList.remove('hidden');
        } else {
            this.rangeVisualizer.classList.add('hidden');
        }

        // Discard stack top card sync
        if (roomState.discardSize > 0) {
            this.discardStack.innerHTML = `<img src="cards/back.png" class="card-discard-top">`;
        } else {
            this.discardStack.innerHTML = `<div class="empty-discard">Discard</div>`;
        }
    }

    renderSeatsGrid(players, activePlayerIndex) {
        this.seatsGrid.innerHTML = '';
        
        players.forEach((p, idx) => {
            const seat = document.createElement('div');
            seat.className = 'player-seat';
            if (p.isEliminated) seat.classList.add('seat-eliminated');
            if (p.recentResult === "WIN") seat.classList.add('seat-win');
            if (p.recentResult === "LOSE") seat.classList.add('seat-lose');
            if (idx === activePlayerIndex) seat.classList.add('active'); // highlight the active player taking their turn

            const initials = p.name.substring(0, 2).toUpperCase();
            let statusClass = "";
            if (p.recentResult === "WIN") statusClass = "success-text";
            if (p.recentResult === "LOSE") statusClass = "danger-text";
            
            // Build mini cards
            let miniCardsHTML = '<div class="seat-mini-cards">';
            if (p.recentResult === "WIN" || p.recentResult === "LOSE" || (p.currentBet === 0 && p.status === 'Folded')) {
                miniCardsHTML += `
                    <div class="mini-card-slot"><img src="cards/back.png"></div>
                    <div class="mini-card-slot" style="border-color: var(--color-gold);"><img src="cards/back.png"></div>
                    <div class="mini-card-slot"><img src="cards/back.png"></div>
                `;
            } else {
                miniCardsHTML += `
                    <div class="mini-card-slot">A</div>
                    <div class="mini-card-slot">C</div>
                    <div class="mini-card-slot">B</div>
                `;
            }
            miniCardsHTML += '</div>';

            // Bet indicator
            let betBadgeHTML = '';
            if (p.currentBet > 0) {
                betBadgeHTML = `<div class="seat-bet-badge active-bet">Bet: ${p.currentBet}</div>`;
            } else if (p.status === 'Passed' || p.status === 'Folded') {
                betBadgeHTML = `<div class="seat-bet-badge">Pass</div>`;
            } else {
                betBadgeHTML = `<div class="seat-bet-badge">${p.status}</div>`;
            }

            seat.innerHTML = `
                <span class="seat-avatar" style="background-color: ${p.color};">${initials}</span>
                <div class="seat-name">${p.isBot ? '🤖 ' : ''}${p.name} ${p.isHost ? '👑' : ''}</div>
                <div class="seat-balance">
                    <span class="seat-chips-icon">🪙</span>
                    <span>${p.balance}</span>
                </div>
                ${betBadgeHTML}
                ${miniCardsHTML}
                <div class="seat-status-lbl ${statusClass}">${p.status}</div>
            `;

            this.seatsGrid.appendChild(seat);
        });
    }

    syncBettingConsole(roomState, me) {
        const activePlayer = roomState.players[roomState.activePlayerIndex];

        if (!me || me.isEliminated || roomState.gameState !== 'BETTING' || !activePlayer || activePlayer.socketId !== this.socket.id) {
            this.bettingPanel.classList.remove('active');
            
            if (roomState.gameState === 'BETTING' && activePlayer) {
                this.mainStatusMsg.textContent = `Waiting for ${activePlayer.name} to bet...`;
            } else if (roomState.gameState === 'DEALING') {
                this.mainStatusMsg.textContent = "Dealer dealing endpoints...";
            } else if (roomState.gameState === 'REVEALING') {
                this.mainStatusMsg.textContent = "Dealing third card...";
            } else if (roomState.gameState === 'EVALUATING') {
                this.mainStatusMsg.textContent = "Evaluating round outcomes...";
            } else if (roomState.gameState === 'ROUND_END') {
                this.mainStatusMsg.textContent = "Advancing to the next turn...";
            }
            return;
        }

        // Show betting panel for active player
        this.mainStatusMsg.textContent = "Your Turn! Place your bet.";
        this.bettingPlayerName.textContent = me.name;
        this.bettingPlayerBalance.textContent = me.balance;
        this.bettingPlayerAvatar.textContent = me.name.substring(0,2).toUpperCase();
        this.bettingPlayerAvatar.style.backgroundColor = me.color;

        // Reset sliders bounds (Capped by Pot limit)
        const maxBet = Math.min(me.balance, roomState.pot);
        this.betSlider.min = 10;
        this.betSlider.max = maxBet;
        this.betSlider.step = 10;

        if (me.balance < 10 || maxBet < 10) {
            this.betSlider.min = maxBet;
            this.betSlider.max = maxBet;
            this.betSlider.value = maxBet;
            this.betInput.value = maxBet;
        } else {
            this.betSlider.value = 10;
            this.betInput.value = 10;
        }

        this.betMaxLbl.textContent = `Max: ${maxBet}`;
        this.betSlider.setAttribute('max', maxBet);

        this.bettingPanel.classList.add('active');
    }

    syncHostControlsBar(gameState) {
        // During ROUND_END show Host next round button
        const oldBar = document.getElementById('host-table-bar');
        if (oldBar) oldBar.remove();

        if (this.isHost && gameState === 'ROUND_END') {
            const bar = document.createElement('div');
            bar.id = 'host-table-bar';
            bar.style.cssText = 'position: absolute; top: 120px; left: 50%; transform: translateX(-50%); z-index: 15; width: 80%; max-width: 400px; padding:15px; border-radius: 8px; text-align:center; background-color: rgba(0,0,0,0.8); border:1.5px solid var(--color-gold);';
            bar.innerHTML = `
                <div style="font-size:0.9rem; font-weight:bold; color:var(--color-gold-light); margin-bottom:10px;">HOST CONTROL PANEL</div>
                <button id="host-next-round-btn" class="btn play-btn btn-full">Deal Next Round</button>
            `;
            
            document.getElementById('card-table').appendChild(bar);
            document.getElementById('host-next-round-btn').addEventListener('click', () => {
                this.socket.emit('nextRound', { roomCode: this.roomCode });
            });
        }
    }

    syncLogsList(logs) {
        this.gameLogList.innerHTML = '';
        logs.forEach(log => {
            const item = document.createElement('div');
            item.className = `log-item ${log.type}`;
            item.innerHTML = `
                <span class="time">${log.time}</span>
                <span class="text">${log.text}</span>
            `;
            this.gameLogList.appendChild(item);
        });
        this.gameLogList.scrollTop = this.gameLogList.scrollHeight;
    }

    updateStatsSidebar(players) {
        this.statsList.innerHTML = '';
        players.forEach(p => {
            const card = document.createElement('div');
            card.className = 'player-stats-card';
            if (p.isEliminated) card.style.opacity = '0.5';

            const initials = p.name.substring(0, 2).toUpperCase();

            // Render stats grid (online matches sync balance)
            card.innerHTML = `
                <div class="stats-card-header">
                    <span class="avatar" style="background-color: ${p.color};">${initials}</span>
                    <span class="name">${p.isBot ? '🤖 ' : ''}${p.name} ${p.isEliminated ? '<span class="danger-text">(Eliminated)</span>' : ''}</span>
                </div>
                <div class="stats-grid">
                    <div class="stat-box" style="grid-column: span 2;">
                        <div class="lbl">Chips Balance</div>
                        <div class="val gold-text" style="font-size:1.15rem;">${p.balance}</div>
                    </div>
                </div>
            `;
            this.statsList.appendChild(card);
        });
    }

    showGameOverLeaderboard(players) {
        const sorted = [...players].sort((x, y) => y.balance - x.balance);
        this.leaderboardBody = document.getElementById('leaderboard-body');
        this.leaderboardBody.innerHTML = '';
        
        sorted.forEach((p, idx) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="rank-val">#${idx+1}</span></td>
                <td>
                    <span class="lobby-avatar" style="background-color: ${p.color}; display: inline-flex; width:20px; height:20px; font-size:0.6rem; vertical-align: middle; margin-right:8px; line-height:20px; color:#000; font-weight:bold; border-radius:50%; justify-content:center; align-items:center;">${p.name.substring(0,2).toUpperCase()}</span>
                    ${p.isBot ? '🤖 ' : ''}${p.name}
                </td>
                <td>${p.balance} chips</td>
                <td>-</td>
                <td class="gold-text">-</td>
            `;
            this.leaderboardBody.appendChild(row);
        });

        this.lobbyScreen.classList.remove('active');
        this.gameScreen.classList.remove('active');
        this.gameOverScreen.classList.add('active');
    }

    // --- Card Dealing animations ---
    animateCardDeal(cardElement, cardObj) {
        this.audio.playSlide();
        cardElement.className = 'game-card card-md card-dealt-anim';
        
        const front = cardElement.querySelector('.card-front');
        front.innerHTML = `<img src="${cardObj.filename}" alt="${cardObj.value}">`;

        setTimeout(() => {
            cardElement.classList.remove('card-dealt-anim');
            cardElement.classList.add('flipped');
            this.audio.playFlip();
        }, 300);
    }

    resetCardElement(cardElement) {
        cardElement.className = 'game-card card-md empty';
        cardElement.querySelector('.card-front').innerHTML = '';
    }

    // --- Profile Local Storage Memory ---
    loadProfileFromStorage() {
        const name = localStorage.getItem('inbetween_saved_name');
        const color = localStorage.getItem('inbetween_saved_color');
        if (name) {
            this.playerNameInput.value = name;
        }
        if (color) {
            this.colorChoices.querySelectorAll('.color-btn').forEach(btn => {
                if (btn.getAttribute('data-color') === color) {
                    this.colorChoices.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        }
    }

    saveProfileToStorage(name, color) {
        localStorage.setItem('inbetween_saved_name', name);
        localStorage.setItem('inbetween_saved_color', color);
    }

    // --- UI Helper Methods ---
    openModal(modal) {
        modal.classList.add('active');
        this.audio.playFlip();
    }

    closeModal(modal) {
        modal.classList.remove('active');
        this.audio.playFlip();
    }

    toast(msg) {
        const container = document.getElementById('notification-toast');
        container.textContent = msg;
        container.classList.add('show');
        setTimeout(() => {
            container.classList.remove('show');
        }, 2200);
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                this.toast("Fullscreen blocked or not supported.");
            });
        } else {
            document.exitFullscreen();
        }
    }

    updateSoundIcons(isMuted) {
        if (isMuted) {
            this.soundOnIcon.classList.add('hidden');
            this.soundOffIcon.classList.remove('hidden');
        } else {
            this.soundOnIcon.classList.remove('hidden');
            this.soundOffIcon.classList.add('hidden');
        }
    }

    logMessage(message, type = "info") {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.innerHTML = `
            <span class="time">${time}</span>
            <span class="text">${message}</span>
        `;
        this.gameLogList.appendChild(item);
        this.gameLogList.scrollTop = this.gameLogList.scrollHeight;
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new Game();
});
