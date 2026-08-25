export class RateLimiter {
    constructor(limit, windowMs, now = () => Date.now()) {
        if (!Number.isInteger(limit) || limit <= 0){
            throw new Error("Limit must be a positive integer");
        }
        if (!Number.isInteger(windowMs) || windowMs <= 0){
            throw new Error("Window must be a positive integer");
        }

        this.limit = limit;
        this.windowMs = windowMs;

        //We use this to control the time in our tests
        this.now = now;

        //Store requests times for each user
        this.requests = new Map();

    }
    allow(key) {
        if (!key) {
            throw new Error("client key is required")
        }
        const currentTime = this.now();
        const windowStart = currentTime - this.windowMs;
        const timestamps = this.requests.get(key) ?? [];

        //This removes requests that are otside the time window
        const recentRequests = timestamps.filter(
            (timestamp) => timestamp > windowStart
        );
        if (recentRequests.length >= this.limit) {
            this.requests.set(key, recentRequests);
            return false;
        }

        //adding new request
        recentRequests.push(currentTime);
        this.requests.set(key, recentRequests);
        return true;
    }
    cleanup() {
        const currentTime = this.now();

        for (const [key, timestamps] of this.requests){
            const recentRequests = timestamps.filter(
                (timestamp) => timestamp > currentTime - this.windowMs 
            )
            if (recentRequests.length === 0){
                this.requests.delete(key);
            } else {
                this.requests.set(key, recentRequests)
            }
        }
    }
}