export class RateLimiter {
    private timestamps: number[] = [];
    private readonly limit: number;
    private readonly interval: number;
  
    constructor(limit: number, interval: number) {
      this.limit = limit;
      this.interval = interval;
    }
  
    private async waitForSlot(): Promise<void> {
      const now = Date.now();
      const windowStart = now - this.interval;
  
      // Remove timestamps outside the current window
      this.timestamps = this.timestamps.filter(timestamp => timestamp > windowStart);
  
      if (this.timestamps.length < this.limit) {
        this.timestamps.push(now);
        return;
      }
  
      // Calculate wait time
      const oldestTimestamp = this.timestamps[0];
      const waitTime = oldestTimestamp + this.interval - now;
  
      // Wait for the calculated time
      await new Promise(resolve => setTimeout(resolve, waitTime));
  
      // After waiting, remove the oldest timestamp and add the current one
      this.timestamps.shift();
      this.timestamps.push(Date.now());
    }
  
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      await this.waitForSlot();
      return fn();
    }
  }