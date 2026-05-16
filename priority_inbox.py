import heapq
import requests
from datetime import datetime
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("priority_inbox")

API_URL = "http://4.224.186.213/evaluation-service/notifications"

API_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJzYXNhbms0cHJAZ21haWwuY29tIiwiZXhwIjoxNzc4OTI5MzQwLCJpYXQiOjE3Nzg5Mjg0NDAsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiI1MjcxMzk5OS05M2ZmLTQwNzEtOGNjYy1jYmZlZjRiOTFhZTkiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJzYXNhbmsgbmF2dXJpIiwic3ViIjoiZDg4OGMwYzEtNGMyMi00YWM1LWJiNDEtMTE4NTg0ZDc0MTZhIn0sImVtYWlsIjoic2FzYW5rNHByQGdtYWlsLmNvbSIsIm5hbWUiOiJzYXNhbmsgbmF2dXJpIiwicm9sbE5vIjoiMjJtaXM3MjQyIiwiYWNjZXNzQ29kZSI6IlNmRnVXZyIsImNsaWVudElEIjoiZDg4OGMwYzEtNGMyMi00YWM1LWJiNDEtMTE4NTg0ZDc0MTZhIiwiY2xpZW50U2VjcmV0IjoiZ0V4Y0Vxd1pRWVJIUENwaiJ9.3NJnKjFVOZRNNBGL_Qwoar48GsC8W0QWnLgvvb1_l-s"

HEADERS = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

WEIGHT = {
    "Placement": 3,
    "Result":    2,
    "Event":     1
}

def fetch_notifications():
    logger.info("fetching notifications from API")
    try:
        response = requests.get(API_URL, headers=HEADERS, timeout=10)
        response.raise_for_status()
        data = response.json()
        notifications = data.get("notifications", [])
        logger.info(f"fetched {len(notifications)} notifications")
        return notifications
    except requests.exceptions.RequestException as e:
        logger.error(f"failed to fetch notifications: {e}")
        return []

def score(notification):
    type_weight = WEIGHT.get(notification.get("Type", "Event"), 1)
    try:
        ts = datetime.strptime(notification["Timestamp"], "%Y-%m-%d %H:%M:%S")
        unix_ts = ts.timestamp()
    except (KeyError, ValueError):
        unix_ts = 0
    return (type_weight * 1_000_000_000) + unix_ts

def get_top_n(notifications, n=10):
    logger.info(f"computing top {n} notifications from {len(notifications)} total")

    heap = []

    for i, notif in enumerate(notifications):
        s = score(notif)
        if len(heap) < n:
            heapq.heappush(heap, (s, i, notif))
        elif s > heap[0][0]:
            heapq.heapreplace(heap, (s, i, notif))

    top = sorted(heap, key=lambda x: x[0], reverse=True)
    logger.info(f"top {n} computed successfully")
    return [item[2] for item in top]

def display(notifications):
    print("\n" + "=" * 60)
    print(f"  PRIORITY INBOX — TOP {len(notifications)} NOTIFICATIONS")
    print("=" * 60)
    for rank, notif in enumerate(notifications, start=1):
        type_label = notif.get("Type", "Unknown")
        message    = notif.get("Message", "")
        timestamp  = notif.get("Timestamp", "")
        notif_id   = notif.get("ID", "")
        print(f"\n  #{rank}")
        print(f"  type    : {type_label}")
        print(f"  message : {message}")
        print(f"  time    : {timestamp}")
        print(f"  id      : {notif_id}")
    print("\n" + "=" * 60 + "\n")

if __name__ == "__main__":
    logger.info("priority inbox started")
    notifications = fetch_notifications()

    if not notifications:
        logger.warning("no notifications received, exiting")
    else:
        top10 = get_top_n(notifications, n=10)
        display(top10)

    logger.info("priority inbox finished")
