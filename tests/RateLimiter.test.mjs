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
})