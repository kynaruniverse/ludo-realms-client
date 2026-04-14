import { PLAYER_NAMES, PLAYER_COLORS } from '../engine/rules.js';

export class UI {
    constructor(gameState, renderer, rollCallback, moveCallback) {
        this.state = gameState;
        this.renderer = renderer;
        this.rollCallback = rollCallback;
        this.moveCallback = moveCallback;
        this.canvas = renderer.canvas;
        this.attachEvents();
        this.updateUI();
        gameState.subscribe(() => this.updateUI());
    }

    attachEvents() {
        document.getElementById('rollBtn').addEventListener('click', () => {
            if (this.state.gameOver) return;
            if (this.state.turn === 0 && !this.state.aiEnabled) {
                this.rollCallback();
            } else if (this.state.turn !== 0 && !this.state.aiEnabled) {
                // human controls other players? For now only Red human.
            }
        });
        document.getElementById('newGameBtn').addEventListener('click', () => {
            this.state.reset();
            this.renderer.renderBoard(this.state.board, this.state.turn, this.state.rollValue);
        });
        document.getElementById('aiToggleBtn').addEventListener('click', (e) => {
            this.state.toggleAI();
            e.target.textContent = this.state.aiEnabled ? 'AI: ON' : 'AI: OFF';
        });
        document.getElementById('difficultySelect').addEventListener('change', (e) => {
            this.state.setAIDifficulty(e.target.value);
        });

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    }

    handleCanvasClick(e) {
        if (this.state.gameOver) return;
        if (this.state.turn !== 0 || this.state.aiEnabled) return; // only human red
        if (this.state.rollValue === null) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * scaleX;
        const canvasY = (e.clientY - rect.top) * scaleY;

        // Find token at position (simplified hit test)
        const tokens = this.state.board.getTokensForPlayer(0);
        const cs = this.renderer.cellSize;
        for (let token of tokens) {
            const pos = this.getTokenScreenPos(token);
            const dx = canvasX - pos.x, dy = canvasY - pos.y;
            if (Math.sqrt(dx*dx+dy*dy) < this.renderer.tokenRadius + 5) {
                // Check if valid move
                const moves = this.state.board.getValidMoves(0, this.state.rollValue);
                const move = moves.find(m => m.token.id === token.id);
                if (move) {
                    this.moveCallback(token);
                }
                break;
            }
        }
    }

    getTokenScreenPos(token) {
        // duplicate logic for hit test, but we can reuse renderer's mapping
        const coords = this.renderer.getPathTileCoordinates();
        const cs = this.renderer.cellSize;
        if (token.position.type === 'yard') return this.renderer.getYardPosition(token.player, token.id);
        if (token.position.type === 'path') {
            const tile = coords[token.position.index];
            return { x: tile.x + cs/2, y: tile.y + cs/2 };
        }
        if (token.position.type === 'home') {
            return this.renderer.getHomeLanePosition(token.player, token.position.index);
        }
    }

    updateUI() {
        const turnEl = document.querySelector('.player-turn');
        const statusEl = document.querySelector('.game-status');
        const player = this.state.turn;
        turnEl.innerHTML = `<span style="color:${PLAYER_COLORS[player]}">⬤</span> ${PLAYER_NAMES[player]}'s turn`;
        if (this.state.gameOver) {
            statusEl.textContent = `🏆 ${PLAYER_NAMES[this.state.board.winner]} wins!`;
        } else {
            statusEl.textContent = this.state.rollValue ? `Rolled ${this.state.rollValue}` : 'Roll dice';
        }
        this.renderer.renderBoard(this.state.board, this.state.turn, this.state.rollValue);
    }
}