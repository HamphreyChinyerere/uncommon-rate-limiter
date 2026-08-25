import { RateLimiter } from "../src/RateLimiter.mjs";

//testing to see if user is new
describe("RateLimiter", () => {
    test("allows the first request", () => {
        const limiter = new RateLimiter(3, 10000);

        expect(limiter.allow("user-1")).toBe(true);
    })
    test("rejects requests after the limit is reached", () => {
        const limiter = new RateLimiter(3, 10000);

        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);

        expect(limiter.allow("user-1")).toBe(false);

    })
    test("limits each client seperately", () => {
        const limiter = new RateLimiter(3, 10000);

        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(false);

        expect(limiter.allow("user-2")).toBe(true);
        expect(limiter.allow("user-2")).toBe(true);
        expect(limiter.allow("user-2")).toBe(true);
        expect(limiter.allow("user-2")).toBe(false);

    })
    test("allows a request after the window expires", () => {
        let currentTime = 0;
        
        const limiter = new RateLimiter(
            2,
            10000,
            () => currentTime
        );
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(false);

        currentTime = 10001;

        expect(limiter.allow("user-1")).toBe(true)
    })
    test("allows a request at the window boundary", () => {
        let currentTime = 0;
        
        const limiter = new RateLimiter(
            2,
            10000,
            () => currentTime
        );
        expect(limiter.allow("user-1")).toBe(true);
        expect(limiter.allow("user-1")).toBe(true);

        currentTime = 10000;

        expect(limiter.allow("user-1")).toBe(true)
    })
    

    
})