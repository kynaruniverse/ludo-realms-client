// /render/canvas-renderer.js
export class CanvasRenderer {
  constructor(ctx, width, height) {
    this.ctx = ctx;
    this.W = width;
    this.H = height;
    this.CELL = Math.floor(width / 15);
    this.colors = {
      red: '#e74c3c',
      blue: '#3498db',
      green: '#2ecc71',
      yellow: '#f1c40f',
      path: '#f5f5f5',
      border: '#2c3e50'
    };
    this.particles = [];
  }

  clear() {
    this.ctx.fillStyle = '#0f1c0f';
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  drawBoard() {
    const C = this.CELL;
    
    // Background quadrants (home areas)
    this.ctx.fillStyle = this.colors.red;
    this.ctx.fillRect(C*1, C*1, C*4, C*4);
    this.ctx.fillStyle = this.colors.blue;
    this.ctx.fillRect(C*10, C*1, C*4, C*4);
    this.ctx.fillStyle = this.colors.green;
    this.ctx.fillRect(C*1, C*10, C*4, C*4);
    this.ctx.fillStyle = this.colors.yellow;
    this.ctx.fillRect(C*10, C*10, C*4, C*4);
    
    // Main path cross
    this.ctx.fillStyle = this.colors.path;
    // Horizontal bar
    this.ctx.fillRect(C*0, C*6, C*15, C*3);
    // Vertical bar
    this.ctx.fillRect(C*6, C*0, C*3, C*15);
    
    // Grid lines
    this.ctx.strokeStyle = this.colors.border;
    this.ctx.lineWidth = 3;
    for (let i = 0; i <= 15; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * C, 0);
      this.ctx.lineTo(i * C, this.H);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * C);
      this.ctx.lineTo(this.W, i * C);
      this.ctx.stroke();
    }
    
    // Safe stars (approximate standard positions)
    this.ctx.fillStyle = '#f1c40f';
    const starPositions = [8, 21, 34, 47, 1, 14, 27, 40]; // simplified
    starPositions.forEach(p => {
      const x = ((p % 15) * C) + C/2;
      const y = (Math.floor(p / 15) * C) + C/2 + (p > 30 ? 40 : 0); // rough mapping
      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.beginPath();
      for (let s = 0; s < 5; s++) {
        this.ctx.lineTo(Math.cos((s*2-1)*Math.PI/5)*15, Math.sin((s*2-1)*Math.PI/5)*15);
      }
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    });
    
    // Center home triangle area
    this.ctx.fillStyle = '#34495e';
    this.ctx.fillRect(C*6, C*6, C*3, C*3);
  }

  drawTokens(players) {
    const C = this.CELL;
    players.forEach((player, pIdx) => {
      const col = this.colors[player.color];
      player.tokens.forEach((token, tIdx) => {
        let x, y;
        if (token.progress === -1) {
          // Yard positions (4 corners)
          const baseX = [C*2.2, C*11.8, C*2.2, C*11.8][pIdx];
          const baseY = [C*2.2, C*2.2, C*11.8, C*11.8][pIdx];
          x = baseX + (tIdx % 2) * (C*0.8);
          y = baseY + Math.floor(tIdx / 2) * (C*0.8);
        } else if (token.progress < 52) {
          // Main path (simplified mapping - full precise path would use array of coords)
          const global = (player.startOffset + token.progress) % 52;
          x = ((global % 15) * C) + C/2;
          y = (Math.floor(global / 15) * C) + C/2;
        } else {
          // Home stretch (colored column)
          const homeStep = token.progress - 52;
          const homeColX = [C*7, C*7.5, C*7, C*7.5][pIdx]; // approximate center columns
          const homeColY = [C*6 + homeStep*C, C*6 + homeStep*C, C*9 - homeStep*C, C*9 - homeStep*C][pIdx];
          x = homeColX;
          y = homeColY;
        }
        
        // Token shadow
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowOffsetY = 6;
        
        this.ctx.fillStyle = col;
        this.ctx.beginPath();
        this.ctx.arc(x, y, C * 0.35, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.shadowBlur = 0;
        this.ctx.shadowOffsetY = 0;
        
        // Highlight
        this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        this.ctx.beginPath();
        this.ctx.arc(x - C*0.12, y - C*0.12, C*0.15, 0, Math.PI * 2);
        this.ctx.fill();
      });
    });
  }

  drawDice(value) {
    // Dice is drawn on overlay HTML element
  }

  animateCaptureOrFinish() {
    // Placeholder for particle burst (expandable)
    console.log("🎇 Capture / Finish animation triggered");
  }
}