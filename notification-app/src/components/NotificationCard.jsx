import { Card, CardContent, Typography, Chip, Box } from "@mui/material";
import WorkIcon from "@mui/icons-material/Work";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import EventIcon from "@mui/icons-material/Event";

const typeConfig = {
  Placement: { color: "success", icon: <WorkIcon fontSize="small" /> },
  Result: { color: "primary", icon: <EmojiEventsIcon fontSize="small" /> },
  Event: { color: "warning", icon: <EventIcon fontSize="small" /> },
};

export default function NotificationCard({ notification, read, onClick }) {
  const config = typeConfig[notification.Type] || { color: "default", icon: null };

  return (
    <Card
      onClick={onClick}
      variant="outlined"
      sx={{
        mb: 2,
        cursor: "pointer",
        borderColor: read ? "divider" : `${config.color}.main`,
        backgroundColor: read ? "action.hover" : "background.paper",
        transition: "all 0.2s",
        "&:hover": {
          backgroundColor: "action.selected",
        },
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Chip
            icon={config.icon}
            label={notification.Type}
            size="small"
            color={config.color}
            variant="outlined"
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {!read && (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: "error.main",
                }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {new Date(notification.Timestamp).toLocaleString()}
            </Typography>
          </Box>
        </Box>

        <Typography
          variant="body1"
          sx={{
            color: read ? "text.secondary" : "text.primary",
            fontWeight: read ? 400 : 500,
          }}
        >
          {notification.Message}
        </Typography>
      </CardContent>
    </Card>
  );
}