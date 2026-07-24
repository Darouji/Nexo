import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Button,
  Collapse,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import type { ReactNode } from "react";

import { colors } from "../../theme/colors";

type SerkanFilterToolbarProps = {
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchValueChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  loading?: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  activeFiltersCount: number;
  children: ReactNode;
  panelId: string;
};

export function SerkanFilterToolbar({
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchValueChange,
  onApply,
  onClear,
  loading = false,
  expanded,
  onExpandedChange,
  activeFiltersCount,
  children,
  panelId,
}: SerkanFilterToolbarProps) {
  return (
    <Stack spacing={1.5} sx={{ mb: 2 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ alignItems: { md: "center" } }}
      >
        <TextField
          size="small"
          label={searchLabel}
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onApply();
            }
          }}
          placeholder={searchPlaceholder}
          sx={{
            width: { xs: "100%", md: 440 },
            maxWidth: "100%",
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: colors.text.muted }} />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button
          size="small"
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={onApply}
          disabled={loading}
        >
          Buscar
        </Button>

        <Button
          size="small"
          variant={expanded || activeFiltersCount > 0 ? "contained" : "outlined"}
          startIcon={<TuneIcon />}
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
          aria-controls={panelId}
          sx={
            expanded || activeFiltersCount > 0
              ? undefined
              : {
                  color: colors.text.primary,
                  borderColor: colors.border.medium,
                }
          }
        >
          {activeFiltersCount > 0
            ? `Filtros (${activeFiltersCount})`
            : "Filtros"}
        </Button>

        <Button
          size="small"
          variant="text"
          onClick={onClear}
          disabled={loading}
          sx={{ color: colors.text.secondary }}
        >
          Limpiar
        </Button>
      </Stack>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          id={panelId}
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, minmax(0, 1fr))",
              xl: "repeat(4, minmax(0, 1fr))",
            },
            gap: 1.25,
            p: 1.5,
            border: `1px solid ${colors.border.light}`,
            borderRadius: colors.radius.md,
            bgcolor: colors.surface.soft,
          }}
        >
          {children}
        </Box>
      </Collapse>
    </Stack>
  );
}
