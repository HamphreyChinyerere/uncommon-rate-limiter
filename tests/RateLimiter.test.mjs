import { RateLimiter } from "../src/RateLimiter.mjs";

//testing to see if user is new
describe("RateLimiter", () => {
    test("allows the first request", () => {
        const limiter = new RateLimiter(3, 10000);

        expect(limiter.allow("user-1")).toBe(true);
    })
})