const WEIGHT = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

function score(notification) {
  const typeWeight = WEIGHT[notification.Type] || 1;
  const ts = notification.Timestamp
    ? new Date(notification.Timestamp).getTime()
    : 0;
  return typeWeight * 1_000_000_000_000 + ts;
}

export function getTopN(notifications, n = 10) {
  // min-heap approach — keep only top n by score
  const heap = [];

  const heapPush = (item) => {
    heap.push(item);
    heap.sort((a, b) => a.score - b.score); // keep sorted ascending (min at front)
    if (heap.length > n) heap.shift(); // remove smallest
  };

  for (const notif of notifications) {
    const s = score(notif);
    if (heap.length < n) {
      heapPush({ score: s, notif });
    } else if (s > heap[0].score) {
      heap.shift();
      heapPush({ score: s, notif });
    }
  }

  return heap
    .sort((a, b) => b.score - a.score)
    .map((item) => item.notif);
}