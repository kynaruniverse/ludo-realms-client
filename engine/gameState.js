import { Board } from './board.js';
import { Dice } from './dice.js';
import { PLAYERS, PLAYER_NAMES } from './rules.js';
import { AIController } from '../ai/ai.js';

export class GameState {
    constructor() {
        this.board = new Board();
        this.dice = new Dice();
        this.ai = new AIController();
        this.turn = PLAYERS.RED;
        this.extraTurn = false;
        this.rollValue = null;
        this.selectedToken = null;
        this.aiEnabled = true;
        this.difficulty = 'medium';
        this.waitingForAI = false;
        this.gameOver = false;
        this.listeners = [];
    }

    reset() {
        this.board.reset();
        this.turn = PLAYERS.RED;
        this.extraTurn = false;
        this.rollValue = null;
        this.selectedToken = null;
        this.gameOver = false;
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }

    async rollDice() {
        if (this.gameOver) return;
        if (this.rollValue !== null && !this.extraTurn) return; // already rolled
        const val = await this.dice.roll();
        this.rollValue = val;
        this.extraTurn = (val === 6);
        this.notify();

        // Check if any valid moves exist
        const moves = this.board.getValidMoves(this.turn, val);
        if (moves.length === 0) {
            // No moves, end turn after delay
            setTimeout(() => this.endTurn(), 800);
        } else if (this.aiEnabled && this.isAITurn()) {
            this.waitingForAI = true;
            setTimeout(() => this.executeAIMove(), 600);
        }
    }

    executeAIMove() {
        if (!this.isAITurn() || this.gameOver) return;
        const moves = this.board.getValidMoves(this.turn, this.rollValue);
        if (moves.length === 0) {
            this.endTurn();
            return;
        }
        const aiMove = this.ai.selectMove(this.board, this.turn, this.rollValue, moves, this.difficulty);
        this.performMove(aiMove.token);
        this.waitingForAI = false;
    }

    performMove(token) {
        if (this.gameOver) return false;
        const success = this.board.moveToken(token, this.rollValue, this.rollValue);
        if (!success) return false;
        // Apply capture
        if (token.position.type === 'path') {
            this.board.applyCapture(token, token.position.index);
        }
        // Check win
        if (this.board.winner !== null) {
            this.gameOver = true;
            this.notify();
            return true;
        }
        // If extra turn (rolled 6) and still has moves? Actually after moving, if rolled 6, player gets another turn.
        if (this.extraTurn) {
            this.rollValue = null; // allow new roll
            this.notify();
            // If AI turn, automatically roll after delay
            if (this.aiEnabled && this.isAITurn()) {
                setTimeout(() => this.rollDice(), 500);
            }
        } else {
            this.endTurn();
        }
        this.notify();
        return true;
    }

    endTurn() {
        this.turn = (this.turn + 1) % 4;
        this.rollValue = null;
        this.extraTurn = false;
        this.selectedToken = null;
        this.notify();
        // If new turn is AI, auto-roll after brief delay
        if (this.aiEnabled && this.isAITurn() && !this.gameOver) {
            setTimeout(() => this.rollDice(), 500);
        }
    }

    isAITurn() {
        return this.turn !== PLAYERS.RED; // Human is Red, others AI
    }

    setAIDifficulty(level) {
        this.difficulty = level;
    }

    toggleAI() {
        this.aiEnabled = !this.aiEnabled;
        if (this.aiEnabled && this.isAITurn() && this.rollValue === null && !this.gameOver) {
            setTimeout(() => this.rollDice(), 300);
        }
    }
}