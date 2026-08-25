# Notification Service Design

## 1. Architecture Overview

The notification service receives notification requests from internal services and places them onto message queues. Transactional and bulk notifications use separate queues so urgent messages can be processed with low latency while large campaigns can be processed at a slower rate. Notification workers consume messages, check user preferences and deduplication records, and send notifications through the appropriate email, SMS, or push provider. Delivery results are recorded so the system can track sent, delivered, and failed notifications.

```text
                    ┌──────────────────────┐
                    │   Internal Services  │
                    │ Password Reset, etc. │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Notification API   │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Message Broker    │
                    └──────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        ┌─────────────────┐       ┌─────────────────┐
        │  Transactional  │       │      Bulk       │
        │      Queue      │       │      Queue      │
        └────────┬────────┘       └────────┬────────┘
                 │                         │
                 └────────────┬────────────┘
                              ▼
                  ┌──────────────────────┐
                  │ Notification Workers │
                  └──────────┬───────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │  Email   │   │   SMS    │   │   Push   │
        │ Provider │   │ Provider │   │ Provider │
        └──────────┘   └──────────┘   └──────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Delivery Status DB   │
                  │ Preferences / Dedup  │
                  └──────────────────────┘

## 2. Components
Internal Services
These are the services that request notifications, such as an authentication service requesting a password reset notification.
Notification API
This is the entry point for internal services. It validates notification requests, assigns a unique notification ID, checks basic requirements, and places the request onto the appropriate queue.
Message Broker
The message broker temporarily stores notification jobs and allows the system to process them asynchronously. It also helps the system handle large traffic spikes without overwhelming notification providers.
Transactional Queue
This queue is for important notifications such as password resets. It receives higher priority so these notifications can be processed close to real time.
Bulk Queue
This queue is for large-volume notifications such as marketing campaigns. Bulk messages can be processed more slowly so they do not affect transactional notifications.
Notification Workers
Workers consume jobs from the queues and handle the actual notification delivery. They check user preferences, perform deduplication, apply retry rules, and send the notification through the correct provider.
Email, SMS, and Push Providers
These are external providers responsible for delivering notifications through their respective channels. The service should support multiple providers so another provider can be used if one becomes unavailable or unreliable.
Delivery Status Database
This stores notification records and delivery states such as sent, delivered, and failed. It also stores information needed for deduplication and tracking notification attempts.
User Preferences
User preferences determine whether a notification can be sent through a particular channel. They include opt-outs, channel-specific settings, and quiet hours.
3. Deduplication and Idempotency
Each notification request receives a unique notification ID from the calling service.
Before sending a notification, the worker checks the notification ID against the delivery status database. If the notification has already been successfully processed, the worker does not send it again.
If a worker crashes after sending a notification but before recording the result, the same notification may be processed again. To prevent duplicate delivery, the notification provider request should also use an idempotency key based on the notification ID.
This gives the system at-least-once processing while reducing the risk of duplicate notifications.
4. Retries and Provider Failures
Notification workers retry failed deliveries using exponential backoff. This prevents the system from repeatedly sending requests to a provider that may be temporarily unavailable or rate-limited.
Each notification has a maximum retry count. If all attempts fail, the notification is marked as failed and moved to a dead-letter queue for later investigation or replay.
Multiple providers can be configured for each channel. If a provider becomes unavailable, the worker can fail over to another configured provider where possible.
Provider rate limits are handled by controlling the worker concurrency and applying backoff when rate limits are encountered.
5. Transactional vs. Bulk Notifications
Transactional notifications, such as password resets, are placed on the high-priority queue. Dedicated workers process this queue with higher priority to keep latency low.
Bulk notifications, such as marketing campaigns, use a separate queue with controlled processing rates. Bulk workers can scale up when demand increases, but they should not consume resources needed by transactional notifications.
This separation prevents a large marketing campaign from delaying important transactional notifications.
6. Scaling and Traffic Spikes
The system should scale horizontally by running multiple Notification API instances and multiple notification workers behind load balancers. The message broker absorbs traffic spikes, allowing requests to be queued instead of overwhelming the workers or external providers.
The target of 10 million notifications per day averages roughly 116 notifications per second, but the system should be designed for much higher short-term traffic during events such as marketing blasts.
Workers can be scaled independently based on queue depth. Transactional workers should have reserved capacity so that bulk traffic cannot consume all available resources.
External provider rate limits should be respected by controlling worker concurrency and processing rates.
7. Data Stores and Tradeoffs
Notification Database
A relational database such as PostgreSQL can store notification records, user preferences, delivery status, retry attempts, and idempotency keys.
A relational database is suitable because notification status and user preferences require consistent and reliable updates.
Message Broker
A durable message broker such as Kafka or RabbitMQ is used for notification jobs.
The broker provides asynchronous processing, buffering during traffic spikes, and reliable message delivery.
Cache
Redis can be used for frequently accessed data such as user preferences, rate limits, and short-lived deduplication records.
The cache reduces database load and provides fast lookups, but it should not be the only source of truth for important notification records.
Tradeoffs
Using multiple systems increases operational complexity, but each system is used for a specific purpose. The relational database provides durable state, the message broker handles asynchronous workloads, and Redis provides fast access to frequently used temporary data.
For a simpler initial implementation, the system could start with PostgreSQL and a message broker, adding Redis when traffic or latency requirements justify it.
8. User Preferences and Quiet Hours
User preferences are stored in the notification database and define which channels a user has enabled.
For example, a user may allow email notifications but disable SMS notifications.
Before a notification is sent, the worker checks the user's preferences and determines whether the requested channel is allowed.
Quiet hours are also stored as part of the user's preferences. Non-critical notifications are delayed when they fall within a user's quiet hours.
Critical transactional notifications, such as password resets, can bypass quiet hours when required by the application's business rules.
Preferences should be checked close to delivery time so that recently changed settings are respected.
9. Delivery Tracking
Every notification is assigned a unique notification ID and has a delivery status.
Example statuses include:
- queued
- processing
- sent
- delivered
- failed
The delivery status database stores the notification ID, user ID, channel, provider, timestamps, retry count, and current status.
Provider delivery callbacks or webhooks can be used to update the notification from sent to delivered when the provider supports delivery confirmation.
This allows internal services and administrators to determine whether a notification was successfully delivered.
10. Failure Handling and Dead-Letter Queue
If a notification fails, the worker retries it using exponential backoff.
A notification should have a maximum number of retry attempts to prevent an endlessly failing job from consuming worker resources.
After the maximum number of attempts is reached, the notification is moved to a dead-letter queue and marked as failed.
The dead-letter queue allows failed notifications to be inspected, monitored, and replayed after the underlying problem has been resolved.
Provider failures should be monitored so that the system can automatically reduce traffic to unhealthy providers and fail over to another provider when available.
11. Extensibility
The notification service should use a common provider interface so new notification channels can be added without changing the core queue and processing logic.
For example, each channel can implement a common method such as:
send(notification)
The worker determines the channel and selects the appropriate provider implementation.
This makes it possible to add future channels such as WhatsApp or other messaging services without redesigning the entire system.
12. Security and Reliability Considerations
Internal services should authenticate when calling the Notification API so unauthorized systems cannot send notifications.
Sensitive notification data should be protected both in transit and at rest.
The service should avoid storing unnecessary message content when it is not required for delivery tracking.
Monitoring should track queue depth, processing latency, provider failures, retry counts, and dead-letter queue size.
These metrics allow operators to identify failures and scaling problems before they affect users.
13. Summary
The proposed architecture separates notification requests from delivery using a durable message broker. Transactional and bulk notifications use separate queues so high-priority messages can remain near real-time during large traffic spikes. Workers handle preferences, deduplication, retries, provider failover, and delivery tracking. PostgreSQL provides durable notification state, Redis can provide fast access to temporary data, and the message broker provides reliable asynchronous processing. The design can scale horizontally by adding API instances and workers while controlling external provider rate limits.