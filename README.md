# In-Memory Rate Limiter

This project implements an in-memory sliding-window rate limiter that allows a configurable number of requests per client within a given time window. 
Request timestamps are stored in a JavaScript `Map`, with each client key being limited independently. 
The current time is injectable, which makes the limiter deterministic and easy to test with Jest. 
The main tradeoff is that the limiter only works within a single process, so a distributed system would require shared storage such as Redis. 
