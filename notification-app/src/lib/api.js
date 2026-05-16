const BASE_URL = "http://4.224.186.213/evaluation-service/notifications";

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiJzYXNhbms0cHJAZ21haWwuY29tIiwiZXhwIjoxNzc4OTMxMDkzLCJpYXQiOjE3Nzg5MzAxOTMsImlzcyI6IkFmZm9yZCBNZWRpY2FsIFRlY2hub2xvZ2llcyBQcml2YXRlIExpbWl0ZWQiLCJqdGkiOiI2OGZjODVjNi01MjI1LTRjOWMtYjYzOS02Y2NmYTk0ZGQ2MDgiLCJsb2NhbGUiOiJlbi1JTiIsIm5hbWUiOiJzYXNhbmsgbmF2dXJpIiwic3ViIjoiZDg4OGMwYzEtNGMyMi00YWM1LWJiNDEtMTE4NTg0ZDc0MTZhIn0sImVtYWlsIjoic2FzYW5rNHByQGdtYWlsLmNvbSIsIm5hbWUiOiJzYXNhbmsgbmF2dXJpIiwicm9sbE5vIjoiMjJtaXM3MjQyIiwiYWNjZXNzQ29kZSI6IlNmRnVXZyIsImNsaWVudElEIjoiZDg4OGMwYzEtNGMyMi00YWM1LWJiNDEtMTE4NTg0ZDc0MTZhIiwiY2xpZW50U2VjcmV0IjoiZ0V4Y0Vxd1pRWVJIUENwaiJ9.ZvKGm9hGhv45EgDiyHurPLotqAGJgiJtIRuwwU9s0f0";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

export async function fetchNotifications({ page = 1, limit = 10, notification_type = "" } = {}) {
  const params = new URLSearchParams();
  params.append("page", page);
  params.append("limit", limit);
  if (notification_type) params.append("notification_type", notification_type);

  const res = await fetch(`${BASE_URL}?${params.toString()}`, { headers });
  if (!res.ok) throw new Error(`failed to fetch notifications: ${res.status}`);
  const data = await res.json();
  return data.notifications || [];
}