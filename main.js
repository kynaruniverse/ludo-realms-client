import { GameState } from './engine/gameState.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';

const canvas = document.getElementById('gameCanvas');
const diceCanvas = document.getElementById('diceCanvas');

const gameState = new GameState();
const renderer = new Renderer(canvas, diceCanvas);
const ui = new UI(gameState, renderer,
    () => gameState.rollDice(),
    (token) => gameState.performMove(token)
);

// Initial render
renderer.renderBoard(gameState.board, gameState.turn, null);
ui.updateUI();

// Auto-start AI if enabled
if (gameState.aiEnabled && gameState.turn !== 0) {
    setTimeout(() => gameState.rollDice(), 500);
}