// Board representation: tokens positions, turn management
import { PLAYERS, START_POSITIONS, HOME_ENTRY_TILE, HOME_LANE_LENGTH, SAFE_TILES } from './rules.js';

export class Board {
    constructor() {
        this.reset();
    }

    reset() {
        // Tokens: 4 per player, each with position object
        this.tokens = [];
        for (let p = 0; p < 4; p++) {
            for (let i = 0; i < 4; i++) {
                this.tokens.push({
                    player: p,
                    id: i,
                    position: { type: 'yard', index: 0 } // yard doesn't need index
                });
            }
        }
        // Track home counts
        this.finishedTokens = [0, 0, 0, 0];
        this.currentPlayer = PLAYERS.RED;
        this.winner = null;
    }

    getTokensForPlayer(player) {
        return this.tokens.filter(t => t.player === player);
    }

    getTokenAtPathPosition(tileIndex) {
        // Returns token if any on that path tile (shared path)
        return this.tokens.find(t => t.position.type === 'path' && t.position.index === tileIndex);
    }

    getTokenAtHomePosition(player, homeIndex) {
        return this.tokens.find(t => t.player === player && t.position.type === 'home' && t.position.index === homeIndex);
    }

    moveToken(token, steps, roll) {
        const player = token.player;
        if (token.position.type === 'yard') {
            if (roll !== 6) return false;
            // Move to start tile
            token.position = { type: 'path', index: START_POSITIONS[player] };
            return true;
        }
        if (token.position.type === 'path') {
            let current = token.position.index;
            // Check if entering home lane
            const entry = HOME_ENTRY_TILE[player];
            const start = START_POSITIONS[player];
            // Calculate distance to entry
            // Path is circular. We need clockwise distance from current to entry.
            let distToEntry = (entry - current + 52) % 52;
            if (distToEntry === 0) distToEntry = 52; // if exactly at entry

            if (steps > distToEntry) {
                // Moves into home lane
                const homeSteps = steps - distToEntry - 1; // first step into home lane (index 0)
                if (homeSteps >= HOME_LANE_LENGTH) return false; // overshoot
                // Check if home spot occupied by own token? Ludo allows stacking but we'll disallow same player blocking? Actually stacking is allowed in some rules.
                // For simplicity, no stacking on home lane; if occupied, cannot move.
                if (this.getTokenAtHomePosition(player, homeSteps)) return false;
                token.position = { type: 'home', index: homeSteps };
                return true;
            } else {
                // Move along path
                let newIndex = (current + steps) % 52;
                // Check if landing on own start tile? Usually allowed.
                token.position = { type: 'path', index: newIndex };
                return true;
            }
        }
        if (token.position.type === 'home') {
            const newIdx = token.position.index + steps;
            if (newIdx > HOME_LANE_LENGTH - 1) return false;
            if (this.getTokenAtHomePosition(player, newIdx)) return false;
            token.position = { type: 'home', index: newIdx };
            if (newIdx === HOME_LANE_LENGTH - 1) {
                this.finishedTokens[player]++;
                if (this.finishedTokens[player] === 4) this.winner = player;
            }
            return true;
        }
        return false;
    }

    // Capture: if landing on a tile occupied by opponent token, send it to yard
    applyCapture(landingToken, tileIndex) {
        if (landingToken.position.type !== 'path') return;
        const opponentToken = this.getTokenAtPathPosition(tileIndex);
        if (opponentToken && opponentToken.player !== landingToken.player) {
            // Safe tiles prevent capture
            if (SAFE_TILES.has(tileIndex)) return;
            opponentToken.position = { type: 'yard' };
        }
    }

    getValidMoves(player, roll) {
        const tokens = this.getTokensForPlayer(player);
        const moves = [];
        for (let token of tokens) {
            if (token.position.type === 'yard' && roll !== 6) continue;
            if (token.position.type === 'home' && token.position.index + roll >= HOME_LANE_LENGTH) continue;
            // Additional checks for path block? We'll just test movement possibility
            const testToken = JSON.parse(JSON.stringify(token)); // clone
            const success = this.moveToken(testToken, roll, roll);
            if (success) {
                moves.push({ token, target: testToken.position });
            }
        }
        return moves;
    }
}