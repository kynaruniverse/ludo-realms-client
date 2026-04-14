// /ai/ai-player.js
export class AIPlayer {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty;
  }

  chooseMove(game, playerIndex, roll) {
    const movable = game.getMovableTokens(playerIndex, roll);
    if (movable.length === 0) return null;
    
    if (this.difficulty === 'easy') {
      return movable[Math.floor(Math.random() * movable.length)];
    }
    
    let bestScore = -Infinity;
    let bestIdx = movable[0];
    
    for (let tokenIdx of movable) {
      let score = 0;
      const token = game.players[playerIndex].tokens[tokenIdx];
      const oldProg = token.progress;
      const newProg = oldProg === -1 ? 0 : oldProg + roll;
      
      // Finishing priority
      if (newProg >= 56) score += 120;
      
      // Capture bonus
      const simGlobal = game.getGlobalPosition(playerIndex, newProg < 52 ? newProg : null);
      if (simGlobal !== null) {
        for (let i = 0; i < 4; i++) {
          if (i === playerIndex) continue;
          for (let opp of game.players[i].tokens) {
            if (opp.progress >= 0 && !opp.isFinished) {
              if (game.getGlobalPosition(i, opp.progress) === simGlobal && 
                  !game.safeTiles.includes(simGlobal)) {
                score += 60;
              }
            }
          }
        }
      }
      
      // Progress
      score += newProg * 3;
      
      // Safety
      if (game.safeTiles.includes(simGlobal)) score += 25;
      
      // Hard mode extra caution near end
      if (this.difficulty === 'hard' && oldProg > 35) score += 20;
      
      if (score > bestScore) {
        bestScore = score;
        bestIdx = tokenIdx;
      }
    }
    
    return bestIdx;
  }
}