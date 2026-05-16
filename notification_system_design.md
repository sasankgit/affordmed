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

---

## Stage 2

### Database choice

Going with PostgreSQL here. The data is structured and relational — students, notifications, and who read what — so a relational database fits naturally. PostgreSQL specifically because it supports native enums (which maps directly to our Placement/Result/Event types), partial indexes, table partitioning, and read replicas, all of which we'll need as the data grows.

MongoDB was considered but rejected. The data isn't document-like enough to justify it, and we'd lose native joins and ACID guarantees without gaining much.

### Schema

```sql
create type notification_type as enum ('Placement', 'Result', 'Event');

create table students (
    id          serial primary key,
    name        varchar(255) not null,
    email       varchar(255) not null unique,
    rollNumber  varchar(50) not null unique,
    department  varchar(100),
    createdAt   timestamp not null default now()
);

create table notifications (
    id                  uuid primary key default gen_random_uuid(),
    notificationType    notification_type not null,
    message             text not null,
    createdAt           timestamp not null default now(),
    createdBy           varchar(100) not null default 'system'
);

create table student_notifications (
    id              serial primary key,
    studentId       int not null references students(id) on delete cascade,
    notificationId  uuid not null references notifications(id) on delete cascade,
    isRead          boolean not null default false,
    readAt          timestamp,
    createdAt       timestamp not null default now(),
    unique (studentId, notificationId)
);
```

One thing worth noting: the notification message is stored once in the `notifications` table, not once per student. When HR clicks "Notify All", we create one row in `notifications` and 50,000 rows in `student_notifications`. This keeps the data clean and avoids duplicating the message text thousands of times. The `student_notifications` table is essentially just tracking who has seen what.

### Problems that come up as data grows

**The join table gets huge fast.** Every bulk notification adds 50,000 rows to `student_notifications`. With regular usage, this table will hit hundreds of millions of rows. Queries start slowing down even with indexes.

The fix is range partitioning on `createdAt` (e.g. monthly partitions). PostgreSQL handles this natively and older partitions can be archived or dropped without touching active data.

**Unread queries get slow.** Fetching a student's unread notifications means filtering a massive table on both `studentId` and `isRead`. A regular index on both columns still ends up scanning a lot of read rows.

The fix is a partial index that only covers unread rows:

```sql
create index idx_sn_unread
on student_notifications (studentId, createdAt desc)
where isRead = false;
```

This index stays small because it shrinks as students read their notifications.

**Bulk inserts block the database.** Inserting 50,000 rows one by one is slow and holds locks. This is covered more in Stage 5, but the short answer is to batch these inserts through a queue and do them in chunks of 500-1000 rows at a time.

**Too many reads during peak hours.** During placement season, every student is loading notifications at the same time. A single database instance can't handle this. The fix is adding read replicas and routing all SELECT queries to them, keeping writes on the primary only.

### Queries for the APIs from Stage 1

**Fetch all notifications (paginated)**
```sql
select
    n.id,
    n.notificationType,
    n.message,
    sn.isRead,
    sn.readAt,
    n.createdAt
from student_notifications sn
join notifications n on sn.notificationId = n.id
where sn.studentId = :studentId
order by n.createdAt desc
limit :limit offset (:page - 1) * :limit;
```

**Fetch one notification**
```sql
select
    n.id,
    n.notificationType,
    n.message,
    sn.isRead,
    sn.readAt,
    n.createdAt
from student_notifications sn
join notifications n on sn.notificationId = n.id
where sn.studentId = :studentId
  and n.id = :notificationId;
```

**Unread count**
```sql
select count(*) as unreadCount
from student_notifications
where studentId = :studentId
  and isRead = false;
```

**Mark one as read**
```sql
update student_notifications
set isRead = true, readAt = now()
where studentId = :studentId
  and notificationId = :notificationId;
```

**Mark all as read**
```sql
update student_notifications
set isRead = true, readAt = now()
where studentId = :studentId
  and isRead = false;
```

**Delete a notification**
```sql
delete from student_notifications
where studentId = :studentId
  and notificationId = :notificationId;
```

**Filter by type**
```sql
select
    n.id,
    n.notificationType,
    n.message,
    sn.isRead,
    n.createdAt
from student_notifications sn
join notifications n on sn.notificationId = n.id
where sn.studentId = :studentId
  and n.notificationType = :notificationType
order by n.createdAt desc
limit :limit offset (:page - 1) * :limit;
```

### Indexes

```sql
-- general lookup by student
create index idx_sn_studentid on student_notifications (studentId);

-- only indexes unread rows, stays small over time
create index idx_sn_unread on student_notifications (studentId, createdAt desc)
where isRead = false;

-- for filtering by notification type
create index idx_notifications_type on notifications (notificationType);

-- brin is much lighter than btree for append-only timestamp columns
create index idx_notifications_createdat on notifications using brin (createdAt);
```