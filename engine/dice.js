export class Dice {
    constructor() {
        this.value = 1;
        this.rolling = false;
    }

    roll() {
        return new Promise((resolve) => {
            if (this.rolling) return resolve(this.value);
            this.rolling = true;
            const rollCount = 12;
            let i = 0;
            const interval = setInterval(() => {
                this.value = Math.floor(Math.random() * 6) + 1;
                if (++i >= rollCount) {
                    clearInterval(interval);
                    this.rolling = false;
                    resolve(this.value);
                }
            }, 60);
        });
    }

    getValue() {
        return this.value;
    }
}