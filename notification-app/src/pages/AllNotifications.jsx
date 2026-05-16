import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl,
  InputLabel, Pagination, Button, CircularProgress,
  Alert, Chip
} from "@mui/material";
import NotificationCard from "../components/NotificationCard";
import { fetchNotifications } from "../lib/api";
import { isRead, markRead, markAllRead } from "../lib/store";

const TYPES = ["", "Placement", "Result", "Event"];
const LIMITS = [5, 10, 20];

export default function AllNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readState, setReadState] = useState({});
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotifications({ page, limit, notification_type: type });
      setNotifications(data);
      setTotalPages(data.length < limit ? page : page + 1);
      const snapshot = {};
      data.forEach((n) => { snapshot[n.ID] = isRead(n.ID); });
      setReadState(snapshot);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, type]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCardClick = (id) => {
    markRead(id);
    setReadState((prev) => ({ ...prev, [id]: true }));
  };

  const handleMarkAllRead = () => {
    const ids = notifications.map((n) => n.ID);
    markAllRead(ids);
    const snapshot = {};
    ids.forEach((id) => { snapshot[id] = true; });
    setReadState((prev) => ({ ...prev, ...snapshot }));
  };

  const unreadCount = notifications.filter((n) => !readState[n.ID]).length;

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={600}>
            Notifications
          </Typography>
          {unreadCount > 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              You have {unreadCount} unread messages
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Filter Type</InputLabel>
            <Select
              value={type}
              label="Filter Type"
              onChange={(e) => { setType(e.target.value); setPage(1); }}
            >
              <MenuItem value="">All Notifications</MenuItem>
              {TYPES.filter(Boolean).map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {unreadCount > 0 && (
            <Button
              size="small"
              variant="outlined"
              onClick={handleMarkAllRead}
              sx={{ textTransform: "none" }}
            >
              Mark all as read
            </Button>
          )}
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : notifications.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
          No notifications found.
        </Typography>
      ) : (
        <>
          {notifications.map((n) => (
            <NotificationCard
              key={n.ID}
              notification={n}
              read={!!readState[n.ID]}
              onClick={() => handleCardClick(n.ID)}
            />
          ))}

          <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, val) => setPage(val)}
              color="primary"
            />
          </Box>
        </>
      )}
    </Box>
  );
}