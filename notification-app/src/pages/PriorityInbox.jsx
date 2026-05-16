import { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Chip, Slider
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import NotificationCard from "../components/NotificationCard";
import { fetchNotifications } from "../lib/api";
import { getTopN } from "../lib/priority";
import { isRead, markRead } from "../lib/store";

const TYPES = ["", "Placement", "Result", "Event"];

export default function PriorityInbox() {
  const [all, setAll] = useState([]);
  const [type, setType] = useState("");
  const [topN, setTopN] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readState, setReadState] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchNotifications({ page: 1, limit: 50, notification_type: type });
      setAll(data);
      const snapshot = {};
      data.forEach((n) => { snapshot[n.ID] = isRead(n.ID); });
      setReadState(snapshot);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCardClick = (id) => {
    markRead(id);
    setReadState((prev) => ({ ...prev, [id]: true }));
  };

  const topNotifications = getTopN(all, topN);

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", px: 2, py: 4 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
            <StarIcon color="primary" />
            <Typography variant="h4" fontWeight={600}>
              Priority Inbox
            </Typography>
          </Box>
        </Box>

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filter Type</InputLabel>
          <Select
            value={type}
            label="Filter Type"
            onChange={(e) => setType(e.target.value)}
          >
            <MenuItem value="">All Notifications</MenuItem>
            {TYPES.filter(Boolean).map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mb: 4, px: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Showing top {topN} notifications
        </Typography>
        <Slider
          value={topN}
          min={5}
          max={20}
          step={5}
          marks
          valueLabelDisplay="auto"
          onChange={(_, val) => setTopN(val)}
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress />
        </Box>
      ) : topNotifications.length === 0 ? (
        <Typography color="text.secondary" align="center" sx={{ py: 10 }}>
          No high-priority notifications found.
        </Typography>
      ) : (
        topNotifications.map((n, index) => (
          <Box key={n.ID} sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
            <Typography
              variant="h6"
              sx={{
                mt: 2.5,
                minWidth: 40,
                color: index === 0 ? "primary.main" : "text.disabled",
                fontWeight: 700,
                textAlign: "center"
              }}
            >
              #{index + 1}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <NotificationCard
                notification={n}
                read={!!readState[n.ID]}
                onClick={() => handleCardClick(n.ID)}
              />
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}