import type { ReactNode } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { colors } from "../theme/colors";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
  icon?: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  destructive = false,
  icon,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  const tone = destructive
    ? {
        main: colors.status.error,
        soft: colors.status.errorSoft,
        border: colors.status.error,
      }
    : {
        main: colors.status.warning,
        soft: colors.status.warningSoft,
        border: colors.secondary.border,
      };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.4} sx={{ alignItems: "center" }}>
          <Stack
            sx={{
              width: 42,
              height: 42,
              display: "grid",
              placeItems: "center",
              borderRadius: colors.radius.md,
              color: tone.main,
              bgcolor: tone.soft,
              border: `1px solid ${tone.border}`,
              flexShrink: 0,
            }}
          >
            {icon || <WarningAmberIcon />}
          </Stack>

          <Typography
            variant="h6"
            sx={{ color: colors.text.primary, fontWeight: 950 }}
          >
            {title}
          </Typography>
        </Stack>
      </DialogTitle>

      {description ? (
        <DialogContent>
          <Typography sx={{ color: colors.text.secondary, lineHeight: 1.6 }}>
            {description}
          </Typography>
        </DialogContent>
      ) : null}

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          sx={{ color: colors.text.secondary, fontWeight: 850 }}
        >
          {cancelLabel}
        </Button>

        <Button
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          sx={{
            bgcolor: tone.main,
            color: colors.text.inverse,
            fontWeight: 900,
            "&:hover": {
              bgcolor: tone.main,
            },
          }}
        >
          {loading ? "Procesando..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
