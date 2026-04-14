// /engine/ludo-logic.js
export class LudoGame {
  constructor() {
    this.PATH_LENGTH = 52;
    this.HOME_STRETCH = 5; // positions 52 to 56 in home column
    this.FINISH = 57;
    
    this.players = [
      { id: 0, color: 'red',    startOffset: 0,  tokens: this.createTokens() },
      { id: 1, color: 'blue',   startOffset: 13, tokens: this.createTokens() },
      { id: 2, color: 'green',  startOffset: 26, tokens: this.createTokens() },
      { id: 3, color: 'yellow', startOffset: 39, tokens: this.createTokens() }
    ];
    
    this.currentPlayerIndex = 3; // Human starts as Yellow
    this.diceValue = 0;
    this.rollsThisTurn = 0;
    this.extraTurn = false;
    this.gameOver = false;
    this.winner = null;
    
    // Standard safe tiles (stars) on main path
    this.safeTiles = [0, 8, 13, 21, 26, 34, 39, 47];
  }

  createTokens() {
    return Array.from({ length: 4 }, () => ({
      progress: -1,     // -1 = yard, 0-51 = main path, 52-56 = home stretch, 57 = finished
      isFinished: false
    }));
  }

  // Global position on the 52-square main track (null if in yard or home/finished)
  getGlobalPosition(playerId, progress) {
    if (progress < 0 || progress >= 52) return null;
    return (this.players[playerId].startOffset + progress) % this.PATH_LENGTH;
  }

  rollDice() {
    this.diceValue = Math.floor(Math.random() * 6) + 1;
    this.rollsThisTurn++;
    
    this.extraTurn = (this.diceValue === 6);
    
    // Triple 6 penalty: lose turn, no move (standard rule)
    if (this.rollsThisTurn >= 3 && this.diceValue === 6) {
      this.extraTurn = false;
      // Do not move any token
      this.diceValue = 0; // indicate penalty
    }
    
    return this.diceValue;
  }

  getMovableTokens(playerIndex, roll) {
    if (roll === 0) return [];
    const player = this.players[playerIndex];
    const movable = [];
    
    for (let i = 0; i < 4; i++) {
      const token = player.tokens[i];
      if (token.isFinished) continue;
      
      if (token.progress === -1) {
        if (roll === 6) movable.push(i);
      } else {
        const newProgress = token.progress + roll;
        if (newProgress > 56) continue; // overshoot not allowed
        if (newProgress >= 52 && newProgress <= 56) {
          movable.push(i); // home stretch
        } else if (newProgress < 52) {
          movable.push(i);
        } else if (newProgress === 56) {
          movable.push(i); // exact to finish position
        }
      }
    }
    return movable;
  }

  moveToken(playerIndex, tokenIndex, roll) {
    if (roll === 0) return false;
    
    const player = this.players[playerIndex];
    const token = player.tokens[tokenIndex];
    
    if (token.isFinished) return false;
    
    if (token.progress === -1) {
      if (roll !== 6) return false;
      token.progress = 0;
      this.checkCapture(playerIndex, tokenIndex);
      return true;
    }
    
    const newProgress = token.progress + roll;
    
    if (newProgress > 56) return false; // must be exact
    
    token.progress = newProgress;
    
    if (token.progress >= 56) {
      token.progress = 57;
      token.isFinished = true;
    }
    
    this.checkCapture(playerIndex, tokenIndex);
    return true;
  }

  checkCapture(playerIndex, tokenIndex) {
    const moverProgress = this.players[playerIndex].tokens[tokenIndex].progress;
    if (moverProgress < 0 || moverProgress >= 52) return; // yard or home = safe
    
    const moverGlobal = this.getGlobalPosition(playerIndex, moverProgress);
    if (moverGlobal === null || this.safeTiles.includes(moverGlobal)) return;
    
    for (let i = 0; i < 4; i++) {
      if (i === playerIndex) continue;
      const opponent = this.players[i];
      for (let j = 0; j < 4; j++) {
        const oppToken = opponent.tokens[j];
        if (oppToken.progress < 0 || oppToken.isFinished) continue;
        
        const oppGlobal = this.getGlobalPosition(i, oppToken.progress);
        if (oppGlobal === moverGlobal) {
          oppToken.progress = -1; // captured back to yard
        }
      }
    }
  }

  isGameOver() {
    for (let player of this.players) {
      if (player.tokens.every(t => t.isFinished)) {
        this.gameOver = true;
        this.winner = player.color;
        return true;
      }
    }
    return false;
  }

  nextTurn() {
    if (!this.extraTurn) {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
    }
    this.rollsThisTurn = 0;
    this.extraTurn = false;
    this.diceValue = 0;
  }
}