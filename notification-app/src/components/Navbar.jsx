import { AppBar, Toolbar, Typography, Button, Box } from "@mui/material";
import NotificationsIcon from "@mui/icons-material/Notifications";
import StarIcon from "@mui/icons-material/Star";
import { useLocation, useNavigate } from "react-router-dom";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <AppBar position="sticky" elevation={1}>
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography
          variant="h6"
          component="div"
          sx={{ cursor: "pointer", fontWeight: 600 }}
          onClick={() => navigate("/")}
        >
          Campus Notify
        </Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            startIcon={<NotificationsIcon />}
            onClick={() => navigate("/")}
            color="inherit"
            variant={location.pathname === "/" ? "outlined" : "text"}
            sx={{ textTransform: "none" }}
          >
            Notifications
          </Button>

          <Button
            startIcon={<StarIcon />}
            onClick={() => navigate("/priority")}
            color="inherit"
            variant={location.pathname === "/priority" ? "outlined" : "text"}
            sx={{ textTransform: "none" }}
          >
            Priority Inbox
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}