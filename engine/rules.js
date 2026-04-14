// Core Ludo rules constants and helpers
export const PLAYERS = {
    RED: 0,
    BLUE: 1,
    GREEN: 2,
    YELLOW: 3
};

export const PLAYER_COLORS = ['#e63946', '#1e88e5', '#2e7d32', '#f9a825'];
export const PLAYER_NAMES = ['Red', 'Blue', 'Green', 'Yellow'];

// Board paths: each player's path from start to home stretch
// We use a single 1D array representing all 52 shared path tiles + home lanes
// The shared path is 52 tiles (0-51). Each player has a start offset.
export const START_POSITIONS = {
    0: 0,   // Red starts at tile 0 (first tile after red yard)
    1: 13,  // Blue
    2: 26,  // Green
    3: 39   // Yellow
};

export const HOME_ENTRY_TILE = {
    0: 50, // Red enters home lane at tile 50 (after 51,52... actually it's a separate lane)
    1: 11,
    2: 24,
    3: 37
};

// The actual home stretch tiles (5 tiles) per player, indexed separately.
export const HOME_LANE_LENGTH = 5;

// Safe tiles (stars) on shared path
export const SAFE_TILES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// Colored safe tiles (starting positions are safe)
export const isSafeTile = (tileIndex) => SAFE_TILES.has(tileIndex);

// Determine if a tile is a star (visual)
export const isStarTile = (tileIndex) => [8, 21, 34, 47].includes(tileIndex);

// Get next tile in shared path (clockwise)
export function getNextSharedTile(current) {
    return (current + 1) % 52;
}

// Check if move is valid given dice roll and token state
export function isValidMove(token, roll, boardTokens) {
    // token: { player, id, position: { type: 'yard'|'home'|'path', index } }
    if (token.position.type === 'yard') {
        return roll === 6;
    }
    if (token.position.type === 'home') {
        // Can only move if exact roll finishes
        return token.position.index + roll === HOME_LANE_LENGTH;
    }
    // On path
    return true; // basic validation, further checks done in engine
}