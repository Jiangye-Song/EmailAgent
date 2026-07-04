"use client";

import { useState, useTransition } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Checkbox,
  FormGroup,
  Slider,
  Alert,
} from "@mui/material";
import { savePreferences } from "@/lib/actions/preferences-actions";

const ALERT_EVENT_OPTIONS = [
  { value: "assessment_assigned", label: "Assessment assigned" },
  { value: "interview_invited", label: "Interview invitation" },
  { value: "interview_changed", label: "Interview changed" },
  { value: "offer_received", label: "Offer received" },
  { value: "information_requested", label: "Information requested" },
] as const;

type AlertEvent = (typeof ALERT_EVENT_OPTIONS)[number]["value"];

export function OnboardingForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [roleInput, setRoleInput] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [companyInput, setCompanyInput] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [remotePreference, setRemotePreference] = useState<
    "remote" | "hybrid" | "onsite" | "either"
  >("either");
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([
    "interview_invited",
    "offer_received",
  ]);
  const [discountThreshold, setDiscountThreshold] = useState(30);
  const [freeGifts, setFreeGifts] = useState(true);
  const [instruction, setInstruction] = useState("");

  function addChip(
    value: string,
    list: string[],
    setter: (v: string[]) => void,
    inputSetter: (v: string) => void,
  ) {
    const trimmed = value.trim();
    if (trimmed.length >= 2 && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
    inputSetter("");
  }

  function removeChip(
    value: string,
    list: string[],
    setter: (v: string[]) => void,
  ) {
    setter(list.filter((v) => v !== value));
  }

  function toggleAlertEvent(event: AlertEvent) {
    setAlertEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (roles.length === 0) {
      setError("Please add at least one target role.");
      return;
    }

    startTransition(async () => {
      try {
        await savePreferences({
          targetRoles: roles,
          locations,
          remotePreference,
          targetCompanies: companies,
          immediateAlertEvents: alertEvents,
          minimumDiscountPercent: discountThreshold,
          freeGifts,
          freeformInstruction: instruction,
        });
      } catch (err) {
        // redirect() throws internally — let it propagate
        if (err && typeof err === "object" && "digest" in err) throw err;
        setError(
          err instanceof Error ? err.message : "Failed to save preferences",
        );
      }
    });
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 700 }} gutterBottom>
        Set up your job search
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Tell us what you&apos;re looking for so we can track opportunities from
        your emails.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={3}>
          {/* Target roles */}
          <Box>
            <TextField
              label="Target roles"
              value={roleInput}
              onChange={(e) => setRoleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addChip(roleInput, roles, setRoles, setRoleInput);
                }
              }}
              placeholder="e.g. Software Engineer (press Enter)"
              fullWidth
              helperText="At least one required"
            />
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {roles.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  onDelete={() => removeChip(r, roles, setRoles)}
                />
              ))}
            </Box>
          </Box>

          {/* Locations */}
          <Box>
            <TextField
              label="Preferred locations"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addChip(
                    locationInput,
                    locations,
                    setLocations,
                    setLocationInput,
                  );
                }
              }}
              placeholder="e.g. Sydney, Remote (press Enter)"
              fullWidth
            />
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {locations.map((l) => (
                <Chip
                  key={l}
                  label={l}
                  onDelete={() => removeChip(l, locations, setLocations)}
                />
              ))}
            </Box>
          </Box>

          {/* Remote preference */}
          <FormControl fullWidth>
            <InputLabel>Remote preference</InputLabel>
            <Select
              value={remotePreference}
              label="Remote preference"
              onChange={(e) =>
                setRemotePreference(
                  e.target.value as typeof remotePreference,
                )
              }
            >
              <MenuItem value="remote">Remote only</MenuItem>
              <MenuItem value="hybrid">Hybrid</MenuItem>
              <MenuItem value="onsite">On-site</MenuItem>
              <MenuItem value="either">No preference</MenuItem>
            </Select>
          </FormControl>

          {/* Target companies */}
          <Box>
            <TextField
              label="Companies of interest (optional)"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addChip(
                    companyInput,
                    companies,
                    setCompanies,
                    setCompanyInput,
                  );
                }
              }}
              placeholder="e.g. Canva, Atlassian"
              fullWidth
            />
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
              {companies.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  onDelete={() => removeChip(c, companies, setCompanies)}
                />
              ))}
            </Box>
          </Box>

          {/* Alert events */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Immediate alerts for
            </Typography>
            <FormGroup>
              {ALERT_EVENT_OPTIONS.map((opt) => (
                <FormControlLabel
                  key={opt.value}
                  control={
                    <Checkbox
                      checked={alertEvents.includes(opt.value)}
                      onChange={() => toggleAlertEvent(opt.value)}
                    />
                  }
                  label={opt.label}
                />
              ))}
            </FormGroup>
          </Box>

          {/* Deal preferences */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Minimum discount to surface ({discountThreshold}%)
            </Typography>
            <Slider
              value={discountThreshold}
              onChange={(_, v) => setDiscountThreshold(v as number)}
              min={0}
              max={100}
              step={5}
              marks
              valueLabelDisplay="auto"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={freeGifts}
                  onChange={(e) => setFreeGifts(e.target.checked)}
                />
              }
              label="Alert me about free gifts and membership benefits"
            />
          </Box>

          {/* Free-form instruction */}
          <TextField
            label="Additional instructions (optional)"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            multiline
            rows={3}
            placeholder="e.g. Focus on startups with fewer than 200 employees"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={isPending}
            fullWidth
          >
            {isPending ? "Saving…" : "Start tracking opportunities"}
          </Button>
        </Stack>
      </Box>
    </Container>
  );
}
