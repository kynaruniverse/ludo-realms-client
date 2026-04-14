import { PLAYERS, SAFE_TILES, HOME_ENTRY_TILE, START_POSITIONS, HOME_LANE_LENGTH } from '../engine/rules.js';

export class AIController {
    selectMove(board, player, roll, moves, difficulty) {
        if (moves.length === 1) return moves[0];
        switch (difficulty) {
            case 'easy': return this.randomMove(moves);
            case 'medium': return this.mediumMove(board, player, roll, moves);
            case 'hard': return this.hardMove(board, player, roll, moves);
            default: return moves[0];
        }
    }

    randomMove(moves) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    mediumMove(board, player, roll, moves) {
        // Prioritize: 1) capture opponent, 2) get token out of yard, 3) move token closest to home
        let best = moves[0];
        let bestScore = -1;
        for (let move of moves) {
            let score = 0;
            const token = move.token;
            // Capturing move?
            if (token.position.type === 'path') {
                const targetIdx = move.target.index;
                const opp = board.getTokenAtPathPosition(targetIdx);
                if (opp && opp.player !== player && !SAFE_TILES.has(targetIdx)) {
                    score += 50;
                }
            }
            // Getting out of yard
            if (token.position.type === 'yard') score += 30;
            // Prefer tokens further along path (closer to home)
            if (token.position.type === 'path') {
                const entry = HOME_ENTRY_TILE[player];
                const dist = (entry - token.position.index + 52) % 52;
                score += (52 - dist);
            }
            if (token.position.type === 'home') {
                score += 60 + token.position.index * 5;
            }
            if (score > bestScore) {
                bestScore = score;
                best = move;
            }
        }
        return best;
    }

    hardMove(board, player, roll, moves) {
        // Enhanced: consider safety of landing tile, blocking, etc.
        let best = moves[0];
        let bestScore = -1000;
        for (let move of moves) {
            let score = 0;
            const token = move.token;
            const target = move.target;
            // Capture bonus
            if (target.type === 'path') {
                const opp = board.getTokenAtPathPosition(target.index);
                if (opp && opp.player !== player && !SAFE_TILES.has(target.index)) {
                    score += 80;
                }
                // Avoid landing on unsafe tile if opponent nearby?
                if (!SAFE_TILES.has(target.index)) {
                    // check if any opponent within 6 tiles behind?
                    score -= 5;
                } else {
                    score += 10;
                }
            }
            // Yard exit
            if (token.position.type === 'yard') score += 40;
            // Proximity to home
            if (token.position.type === 'path') {
                const entry = HOME_ENTRY_TILE[player];
                const dist = (entry - token.position.index + 52) % 52;
                score += (52 - dist) * 2;
            }
            if (target.type === 'home') {
                score += 70 + target.index * 10;
            }
            // Prefer moving tokens that are behind
            if (bestScore < score) {
                bestScore = score;
                best = move;
            }
        }
        return best;
    }
}