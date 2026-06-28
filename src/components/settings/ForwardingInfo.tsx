"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MailOutlineRoundedIcon from "@mui/icons-material/MailOutlineRounded";

type Props = {
  address: string;
};

export function ForwardingInfo({ address }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyAddress() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          bgcolor: "background.paper",
        }}
      >
        <MailOutlineRoundedIcon fontSize="small" color="action" />
        <Typography
          variant="body2"
          sx={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontWeight: 600,
            flex: 1,
            minWidth: 180,
          }}
        >
          {address}
        </Typography>
        <Button
          variant={copied ? "contained" : "outlined"}
          color={copied ? "success" : "primary"}
          size="small"
          onClick={copyAddress}
          startIcon={copied ? <CheckRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </Paper>

      <Alert severity="info" variant="outlined">
        Add this forwarding address in your email provider. Confirmation emails sent to this address will appear in your inbox.
      </Alert>

      <Stack spacing={1.2}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
          Setup Guide
        </Typography>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontWeight: 600 }}>Gmail</Typography>
              <Chip size="small" color="primary" label="Recommended" />
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <ol>
              <li>Open Gmail Settings and choose See all settings.</li>
              <li>Go to Forwarding and POP/IMAP and click Add a forwarding address.</li>
              <li>Paste this address: <strong>{address}</strong>.</li>
              <li>Confirm the verification email in this app inbox.</li>
              <li>Enable Forward a copy of incoming mail.</li>
            </ol>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography sx={{ fontWeight: 600 }}>Outlook / Hotmail</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ol>
              <li>Open Outlook Settings and choose View all Outlook settings.</li>
              <li>Go to Mail and then Forwarding.</li>
              <li>Enable forwarding and enter <strong>{address}</strong>.</li>
              <li>Save changes.</li>
            </ol>
          </AccordionDetails>
        </Accordion>

        <Accordion disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
            <Typography sx={{ fontWeight: 600 }}>Apple Mail (iCloud)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <ol>
              <li>Go to iCloud Mail settings.</li>
              <li>Create a new rule for every message.</li>
              <li>Set action to Forward to and use <strong>{address}</strong>.</li>
            </ol>
          </AccordionDetails>
        </Accordion>
      </Stack>
    </Stack>
  );
}
