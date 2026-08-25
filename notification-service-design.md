# Notification Service Design

## 1. Architecture Overview

The notification service receives notification requests from internal services and places them onto message queues. Transactional and bulk notifications use separate queues so urgent messages can be processed with low latency while large campaigns can be processed at a slower rate. Notification workers consume messages, check user preferences and deduplication records, and send notifications through the appropriate email, SMS, or push provider. Delivery results are recorded so the system can track sent, delivered, and failed notifications.

                    ┌──────────────────────┐
                    │   Internal Services   │
                    │ Password Reset, etc.  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Notification API    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     Message Broker   │
                    └──────────┬───────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        ┌─────────────────┐       ┌─────────────────┐
        │ Transactional   │       │      Bulk       │
        │     Queue       │       │      Queue      │
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

### Internal Services

These are the services that request notifications, such as an authentication service requesting a password reset notification.

### Notification API

This is the entry point for internal services. It validates notification requests, assigns a unique notification ID, checks basic requirements, and places the request onto the appropriate queue.

### Message Broker

The message broker temporarily stores notification jobs and allows the system to process them asynchronously. It also helps the system handle large traffic spikes without overwhelming notification providers.

### Transactional Queue

This queue is for important notifications such as password resets. It receives higher priority so these notifications can be processed close to real time.

### Bulk Queue

This queue is for large-volume notifications such as marketing campaigns. Bulk messages can be processed more slowly so they do not affect transactional notifications.

### Notification Workers

Workers consume jobs from the queues and handle the actual notification delivery. They check user preferences, perform deduplication, apply retry rules, and send the notification through the correct provider.

### Email, SMS, and Push Providers

These are external providers responsible for delivering notifications through their respective channels. The service should support multiple providers so another provider can be used if one becomes unavailable or unreliable.

### Delivery Status Database

This stores notification records and delivery states such as `sent`, `delivered`, and `failed`. It also stores information needed for deduplication and tracking notification attempts.

### User Preferences

User preferences determine whether a notification can be sent through a particular channel. They include opt-outs, channel-specific settings, and quiet hours.


## 3. Deduplication and Idempotency

Each notification request receives a unique notification ID from the calling service.

Before sending a notification, the worker checks the notification ID against the delivery status database. If the notification has already been successfully processed, the worker does not send it again.

If a worker crashes after sending a notification but before recording the result, the same notification may be processed again. To prevent duplicate delivery, the notification provider request should also use an idempotency key based on the notification ID.

This gives the system at-least-once processing while reducing the risk of duplicate notifications.

## 4. Retries and Provider Failures

Notification workers retry failed deliveries using exponential backoff. This prevents the system from repeatedly sending requests to a provider that may be temporarily unavailable or rate-limited.

Each notification has a maximum retry count. If all attempts fail, the notification is marked as `failed` and moved to a dead-letter queue for later investigation or replay.

Multiple providers can be configured for each channel. If a provider becomes unavailable, the worker can fail over to another configured provider where possible.

Provider rate limits are handled by controlling the worker concurrency and applying backoff when rate limits are encountered.

## 5. Transactional vs. Bulk Notifications

Transactional notifications, such as password resets, are placed on the high-priority queue. Dedicated workers process this queue with higher priority to keep latency low.

Bulk notifications, such as marketing campaigns, use a separate queue with controlled processing rates. Bulk workers can scale up when demand increases, but they should not consume resources needed by transactional notifications.

This separation prevents a large marketing campaign from delaying important transactional notifications.

## 6. Scaling and Traffic Spikes

The system should scale horizontally by running multiple Notification API instances and multiple notification workers behind load balancers. The message broker absorbs traffic spikes, allowing requests to be queued instead of overwhelming the workers or external providers.

The target of 10 million notifications per day averages roughly 116 notifications per second, but the system should be designed for much higher short-term traffic during events such as marketing blasts.

Workers can be scaled independently based on queue depth. Transactional workers should have reserved capacity so that bulk traffic cannot consume all available resources.

External provider rate limits should be respected by controlling worker concurrency and processing rates.

