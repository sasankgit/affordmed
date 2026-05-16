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


---

## Stage 3

### is the query accurate?

Not really. The query is:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt ASC;
```

The problem is that `isRead` and `studentId` aren't columns on the `notifications` table — they're on `student_notifications`. The notifications table just holds the message and type. So this query would either throw an error or return wrong results entirely. It's querying the wrong table.

The correct version should join both tables:

```sql
select
    n.id,
    n.notificationType,
    n.message,
    n.createdAt
from student_notifications sn
join notifications n on sn.notificationId = n.id
where sn.studentId = 1042
  and sn.isRead = false
order by n.createdAt asc;
```

### why is it slow?

Even if it was hitting the right table, with 5 million rows and no index on `studentId` or `isRead`, postgres has no choice but to do a full sequential scan — it reads every single row and checks each one against the WHERE clause. At this scale that's genuinely expensive.

`SELECT *` makes it worse. It pulls every column even if only two or three are actually needed on the frontend. More data moved per query, multiplied across thousands of requests a day.

### what to change

Fix the join as shown above, drop `SELECT *` in favour of specific columns, and add a partial index that only covers unread rows:

```sql
create index idx_sn_unread
on student_notifications (studentId, createdAt asc)
where isRead = false;
```

The partial index is the key part. Because it only indexes rows where `isRead = false`, it gets smaller as students read their notifications rather than growing indefinitely. With this in place postgres goes from scanning 5 million rows to jumping straight to the relevant student's unread rows. Cost drops from O(n) to roughly O(log n) for the lookup.

### indexing every column — is that good advice?

No. Indexes speed up reads but every index has to be updated on every write too. Our `student_notifications` table gets hit hard with writes — 50,000 inserts per bulk notification, plus updates every time someone reads something. Adding unnecessary indexes to every column means each of those operations becomes slower because postgres has to maintain all those index structures at the same time.

You also end up with more disk usage, more memory pressure, and longer autovacuum cycles. The right approach is to only index columns that show up in WHERE clauses and JOINs in your most common queries, and use partial indexes where possible to keep things lean.

### all students who got a placement notification in the last 7 days

```sql
select distinct
    s.id,
    s.name,
    s.email,
    s.rollNumber
from students s
join student_notifications sn on s.id = sn.studentId
join notifications n on sn.notificationId = n.id
where n.notificationType = 'Placement'
  and n.createdAt >= now() - interval '7 days';
```

`distinct` is there because a student could have received multiple placement notifications in that window and we only want them listed once.


---

## Stage 4

### the problem

Every page load hits the database directly to fetch notifications. With 50,000 students doing this throughout the day — and especially during placement season when everyone's refreshing constantly — the database gets overwhelmed pretty quickly. The fix isn't one single thing, it's a few layers working together.

### caching with redis

The most impactful change is putting Redis in front of the database. The first time a student loads their notifications, we fetch from the DB and store the result in Redis with a key like `notifications:studentId:1042`. Every subsequent page load reads from Redis instead of hitting the database at all.

When a new notification comes in for that student, we invalidate their cache key so the next fetch goes back to the DB and refreshes it.

The tradeoff is that students could briefly see slightly stale data in the window between a new notification arriving and the cache being invalidated. This is usually fine for a notification system where a second or two of delay doesn't matter. The bigger risk is cache invalidation bugs — if you forget to invalidate on any write path, students see outdated data until TTL expires.

A reasonable TTL is around 60 seconds as a safety net even if invalidation is handled correctly.

### pagination

Already built into Stage 1 but worth calling out here. Fetching 20 notifications at a time instead of all of them cuts the data transferred per request significantly. It also means the DB query is cheaper because of the LIMIT clause. The partial index from Stage 3 helps here too since it makes those paginated unread queries fast.

The tradeoff is minimal — just slightly more complexity on the frontend to handle page numbers.

### push over polling

The deeper fix is what we already designed in Stage 1 — WebSockets. If the server pushes new notifications to the client the moment they're created, the client doesn't need to poll on every page load at all. The unread count badge updates in real time without a single extra DB read.

This removes an entire category of unnecessary reads. A student sitting on the notifications page doesn't keep firing GET requests — they just wait and receive.

The tradeoff is that WebSocket connections are stateful and consume memory on the server for every connected client. At 50,000 concurrent students this needs horizontal scaling with a shared pub/sub layer like Redis so all WebSocket server instances can broadcast to any connected student.

### read replicas

Route all SELECT queries to read replicas and keep writes on the primary. This is straightforward with most PostgreSQL setups and multiplies your read capacity by however many replicas you add.

The tradeoff is replication lag — replicas might be a few milliseconds behind the primary. For a notification system this is almost always acceptable. The only edge case is if a student marks something as read and immediately refreshes, they might briefly see it as unread if that read hits a lagging replica. This can be handled by routing a user's own write-then-read to the primary for a short window.

### http caching headers

For the notifications API, return `Cache-Control` and `ETag` headers. The browser stores the response and on the next request sends an `If-None-Match` header with the ETag. If nothing changed, the server returns a 304 with no body and the browser uses its cached version. No DB query needed at all for unchanged data.

```
Cache-Control: private, max-age=30
ETag: "abc123hashofresponse"
```

The tradeoff is this only works for GET requests and requires computing and comparing ETags on the server side. It's also only useful for clients that respect HTTP caching, which browsers do but some mobile implementations might not.

### what to actually do

In practice, the combination that makes the most sense is redis caching + pagination + read replicas. WebSocket push is already there from Stage 1 and handles the real-time side. HTTP caching is a nice bonus on top. No single strategy is enough on its own — the DB relief comes from layering these together.