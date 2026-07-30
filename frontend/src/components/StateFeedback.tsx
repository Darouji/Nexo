/**
 * Estados transversales de carga, vacío, restricción y feedback recuperable.
 *
 * Centralizarlos mantiene mensajes, jerarquía visual y acciones consistentes
 * entre módulos, y evita que una página confunda ausencia de datos con error.
 */
import type { ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { colors } from "../theme/colors";

type FeedbackSeverity = "info" | "warning" | "error" | "success";

type StateFeedbackProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  severity?: FeedbackSeverity;
  actionLabel?: string;
  onAction?: () => void;
  minHeight?: number | string;
};

/** Renderiza un estado comprensible con una acción opcional de recuperación. */
export function StateFeedback({
  title,
  description,
  icon,
  severity = "info",
  actionLabel,
  onAction,
  minHeight = 280,
}: StateFeedbackProps) {
  return (
    <Box
      sx={{
        minHeight,
        display: "grid",
        placeItems: "center",
        width: "100%",
      }}
    >
      <Alert
        severity={severity}
        variant="outlined"
        icon={icon}
        sx={{
          width: "100%",
          maxWidth: 720,
          bgcolor: colors.background.paper,
          borderColor: colors.border.light,
          color: colors.text.primary,
        }}
      >
        <Stack spacing={1.5}>
          <Box>
            <Typography sx={{ fontWeight: 950, color: colors.text.primary }}>
              {title}
            </Typography>

            {description ? (
              <Typography
                variant="body2"
                sx={{ mt: 0.5, color: colors.text.secondary, lineHeight: 1.55 }}
              >
                {description}
              </Typography>
            ) : null}
          </Box>

          {actionLabel && onAction ? (
            <Button
              variant="outlined"
              size="small"
              onClick={onAction}
              sx={{
                alignSelf: "flex-start",
                color: colors.text.primary,
                borderColor: colors.border.medium,
                "&:hover": {
                  bgcolor: colors.action.hover,
                  borderColor: colors.primary.border,
                },
              }}
            >
              {actionLabel}
            </Button>
          ) : null}
        </Stack>
      </Alert>
    </Box>
  );
}

/** Indica que la vista espera una respuesta y aún no puede presentar resultados. */
export function LoadingState({
  message = "Cargando información...",
}: {
  message?: string;
}) {
  return (
    <Box
      sx={{
        minHeight: 280,
        display: "grid",
        placeItems: "center",
        width: "100%",
      }}
    >
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress />
        <Typography sx={{ color: colors.text.secondary, fontWeight: 800 }}>
          {message}
        </Typography>
      </Stack>
    </Box>
  );
}

/**
 * Representa una consulta válida sin registros, normalmente después de aplicar
 * filtros; no debe usarse para ocultar un fallo de carga.
 */
export function EmptyState({
  title = "Sin información disponible",
  description = "No hay registros para mostrar con los filtros actuales.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <StateFeedback
      severity="info"
      title={title}
      description={description}
      minHeight={240}
    />
  );
}

/**
 * Explica una restricción visual de acceso. La mención del backend recuerda que
 * la decisión efectiva de autorización no depende de este componente.
 */
export function PermissionDeniedState({
  moduleLabel = "este módulo",
  onBack,
}: {
  moduleLabel?: string;
  onBack?: () => void;
}) {
  return (
    <StateFeedback
      severity="warning"
      title="No tienes permisos para ver este módulo"
      description={`Tu cuenta no tiene permiso visual para acceder a ${moduleLabel}. Si crees que esto es un error, debe revisarse el rol del usuario desde backend.`}
      actionLabel={onBack ? "Volver al inicio" : undefined}
      onAction={onBack}
      minHeight={360}
    />
  );
}
