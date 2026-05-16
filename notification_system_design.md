# Campus Notification System

This system handles real-time alerts for students about placements, exam results, and campus events.

### Core Features
- Get a list of all notifications (with paging).
- Filter by type (Placement, Result, Event) or read status.
- Mark specific messages or all of them as read.
- Check the unread message count.
- Delete notifications.

### API Details
Base URL: `https://api.campusnotify.in/v1`
Header needed for all requests: `X-Student-ID: <student_id>`

- **Get all notifications**: `GET /notifications`
  Optional query params: `page`, `limit`, `notification_type`, `is_read`.
- **Get one notification**: `GET /notifications/:id`
- **Mark as read**: `PATCH /notifications/:id/read`
- **Mark all as read**: `PATCH /notifications/read-all`
- **Count unread**: `GET /notifications/unread-count`
- **Delete one**: `DELETE /notifications/:id`

### Example Response
When you fetch notifications, you'll get back something like this:
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "Placement",
        "message": "Google is hiring!",
        "isRead": false,
        "createdAt": "2026-04-22T17:51:30Z"
      }
    ]
  }
}

### Real-Time Alerts
We use WebSockets so students see notifications the moment they are sent. If a student's browser can't handle WebSockets, it automatically switches to Server-Sent Events (SSE).

**WebSocket URL:**
`wss://api.campusnotify.in/v1/ws/notifications?studentId=1042`

The server sends a "ping" every 30 seconds to keep the connection alive. The client should reply with a "pong".

### SSE Fallback
If WebSockets aren't available, use this:
`GET /notifications/stream`
Headers: `Accept: text/event-stream`

### How it works
1. An admin or HR creates a notification.
2. The system saves it and sends it to a message broker (Redis or Kafka).
3. The WebSocket server picks up the message and pushes it directly to the connected student.
4. If the student isn't online, they'll see it next time they fetch their notifications via the API.
