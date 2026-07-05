import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import ChecklistRoundedIcon from "@mui/icons-material/ChecklistRounded";
import { InboxLayout } from "@/components/inbox/InboxLayout";

export default async function TodoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <InboxLayout
      activePanel="todo"
      panelContent={
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 2,
          }}
        >
          <ChecklistRoundedIcon sx={{ fontSize: 64, color: "text.disabled" }} />
          <Typography variant="h5" color="text.secondary" sx={{ fontWeight: 700 }}>
            To Do List
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Coming soon
          </Typography>
        </Box>
      }
    />
  );
}
