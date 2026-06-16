import { useEffect, useState } from "react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { annulSale, concretarSale, fetchSales } from "../services/salesService";
import type {
  Sale,
  SaleAlert,
  SaleDetail,
  SaleStatus,
  SaleValidationSummary,
} from "../services/salesService";
import { colors } from "../theme/colors";

type DetailDialogState = {
  open: boolean;
  sale: Sale | null;
};

type AnnulDialogState = {
  open: boolean;
  sale: Sale | null;
  motivo: string;
};

const emptyDetailDialog: DetailDialogState = {
  open: false,
  sale: null,
};

const emptyAnnulDialog: AnnulDialogState = {
  open: false,
  sale: null,
  motivo: "",
};

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: string; [key: string]: unknown }
      | undefined;

    if (data?.detail) {
      return data.detail;
    }

    if (data && typeof data === "object") {
      return Object.entries(data)
        .map(([field, value]) => {
          if (Array.isArray(value)) {
            return `${field}: ${value.join(", ")}`;
          }

          return `${field}: ${String(value)}`;
        })
        .join(" | ");
    }
  }

  return "No se pudo completar la operación.";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL").format(date);
}

function formatCLP(value: string | number) {
  const numericValue = Number(value || 0);

  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(numericValue);
}

function getSaleStatusColor(status: SaleStatus) {
  if (status === "CONCRETADA") {
    return colors.status.success;
  }

  if (status === "ANULADA") {
    return colors.status.error;
  }

  return colors.status.warning;
}

function getValidationColor(summary: SaleValidationSummary) {
  if (summary === "OK") {
    return colors.status.success;
  }

  if (summary === "BLOQUEANTE") {
    return colors.status.error;
  }

  return colors.status.warning;
}

function getValidationLabel(summary: SaleValidationSummary) {
  if (summary === "OK") {
    return "OK";
  }

  if (summary === "BLOQUEANTE") {
    return "Bloqueante";
  }

  if (summary === "CON_ALERTAS") {
    return "Con alertas";
  }

  return String(summary).replaceAll("_", " ");
}

export function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingSaleId, setUpdatingSaleId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [detailDialog, setDetailDialog] =
    useState<DetailDialogState>(emptyDetailDialog);
  const [annulDialog, setAnnulDialog] =
    useState<AnnulDialogState>(emptyAnnulDialog);

  const loadSales = async (search = searchTerm) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await fetchSales({
        search,
        ordering: "-fecha_venta,-created_at",
      });

      setSales(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    fetchSales({
      search: "",
      ordering: "-fecha_venta,-created_at",
    })
      .then((data) => {
        if (!isMounted) return;

        setSales(data);
        setErrorMessage("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;

        setErrorMessage(getErrorMessage(error));
      })
      .finally(() => {
        if (!isMounted) return;

        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConcretarSale = async (sale: Sale) => {
    try {
      setUpdatingSaleId(sale.id);
      setErrorMessage("");
      setSuccessMessage("");

      await concretarSale(sale.id);

      setSuccessMessage(`Venta #${sale.id} concretada correctamente.`);
      await loadSales(searchTerm);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const handleOpenAnnulDialog = (sale: Sale) => {
    setAnnulDialog({
      open: true,
      sale,
      motivo: "",
    });
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleAnnulSale = async () => {
    if (!annulDialog.sale) {
      return;
    }

    try {
      setUpdatingSaleId(annulDialog.sale.id);
      setErrorMessage("");
      setSuccessMessage("");

      await annulSale(annulDialog.sale.id, annulDialog.motivo);

      setSuccessMessage(`Venta #${annulDialog.sale.id} anulada correctamente.`);
      setAnnulDialog(emptyAnnulDialog);
      await loadSales(searchTerm);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const columns: GridColDef[] = [
    {
      field: "fecha_venta",
      headerName: "Fecha venta",
      width: 130,
      renderCell: (params) => formatDate(String(params.value || "")),
    },
    {
      field: "minera_name",
      headerName: "Minera",
      minWidth: 190,
      flex: 1,
      renderCell: (params) => params.value || "Sin minera",
    },
    {
      field: "orden_compra",
      headerName: "Orden compra",
      minWidth: 150,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin OC",
    },
    {
      field: "factura_numero",
      headerName: "Factura",
      minWidth: 130,
      flex: 0.7,
      renderCell: (params) => params.value || "Sin factura",
    },
    {
      field: "numero_guia_hes",
      headerName: "Guía / HES",
      minWidth: 140,
      flex: 0.7,
      renderCell: (params) => params.value || "Sin guía/HES",
    },
    {
      field: "total",
      headerName: "Total",
      width: 140,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatCLP(String(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "sale_status",
      headerName: "Estado",
      width: 150,
      renderCell: (params) => {
        const sale = params.row as Sale;
        const color = getSaleStatusColor(sale.sale_status);

        return (
          <Chip
            label={sale.sale_status_display || sale.sale_status}
            size="small"
            sx={{
              color,
              bgcolor: colors.surface.soft,
              borderColor: color,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    {
      field: "validation_summary",
      headerName: "Validación",
      width: 145,
      renderCell: (params) => {
        const summary = String(params.value || "OK") as SaleValidationSummary;
        const color = getValidationColor(summary);

        return (
          <Chip
            label={getValidationLabel(summary)}
            size="small"
            sx={{
              color,
              bgcolor: colors.surface.soft,
              borderColor: color,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    {
      field: "stock_descontado",
      headerName: "Stock",
      width: 125,
      renderCell: (params) => {
        const discounted = Boolean(params.value);

        return (
          <Chip
            label={discounted ? "Descontado" : "No"}
            size="small"
            sx={{
              color: discounted ? colors.status.success : colors.text.muted,
              bgcolor: colors.surface.soft,
              borderColor: discounted
                ? colors.status.success
                : colors.border.medium,
              border: "1px solid",
              fontWeight: 800,
            }}
          />
        );
      },
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 360,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const sale = params.row as Sale;
        const isUpdating = updatingSaleId === sale.id;
        const canConcretar = sale.sale_status === "INGRESADA";
        const canAnular = sale.sale_status !== "ANULADA";

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<InfoIcon />}
              onClick={() =>
                setDetailDialog({
                  open: true,
                  sale,
                })
              }
            >
              Detalle
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<CheckCircleIcon />}
              disabled={!canConcretar || isUpdating}
              onClick={() => void handleConcretarSale(sale)}
            >
              Concretar
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<BlockIcon />}
              disabled={!canAnular || isUpdating}
              onClick={() => handleOpenAnnulDialog(sale)}
            >
              Anular
            </Button>
          </Stack>
        );
      },
    },
  ];

  const detailColumns: GridColDef[] = [
    {
      field: "producto_categoria",
      headerName: "Categoría",
      minWidth: 160,
      flex: 0.8,
    },
    {
      field: "producto_modelo",
      headerName: "Producto",
      minWidth: 220,
      flex: 1.2,
    },
    {
      field: "codigo_sap",
      headerName: "Código SAP",
      minWidth: 130,
      flex: 0.7,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "cantidad",
      headerName: "Cantidad",
      width: 120,
      type: "number",
    },
    {
      field: "valor_unitario",
      headerName: "Valor unitario",
      width: 150,
      type: "number",
      renderCell: (params) => formatCLP(String(params.value || 0)),
    },
    {
      field: "valor_total",
      headerName: "Total línea",
      width: 150,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatCLP(String(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "controla_stock_snapshot",
      headerName: "Control stock",
      width: 140,
      renderCell: (params) => (params.value ? "Sí" : "No"),
    },
  ];

  const alertColumns: GridColDef[] = [
    {
      field: "code_display",
      headerName: "Alerta",
      minWidth: 190,
      flex: 1,
      renderCell: (params) => params.value || "Alerta",
    },
    {
      field: "message",
      headerName: "Mensaje",
      minWidth: 240,
      flex: 1.2,
    },
    {
      field: "severity_display",
      headerName: "Severidad",
      width: 140,
      renderCell: (params) => params.value || "Sin severidad",
    },
    {
      field: "is_active",
      headerName: "Activa",
      width: 110,
      renderCell: (params) => (params.value ? "Sí" : "No"),
    },
  ];

  const selectedSale = detailDialog.sale;
  const selectedDetails: SaleDetail[] = selectedSale?.detalles ?? [];
  const selectedAlerts: SaleAlert[] =
    selectedSale?.alerts.filter((alert) => alert.is_active) ?? [];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{ color: colors.text.primary, fontWeight: 900 }}
          >
            Ventas / Ingresos
          </Typography>

          <Typography variant="body2" sx={{ color: colors.text.secondary }}>
            Módulo conectado al backend: ventas reales, totales calculados,
            alertas comerciales, detalle de líneas y acciones controladas.
          </Typography>
        </Box>

        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void loadSales()}
          disabled={loading}
        >
          Actualizar
        </Button>
      </Stack>

      <Card
        sx={{
          p: 2,
          bgcolor: colors.background.paper,
          border: `1px solid ${colors.border.light}`,
        }}
      >
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            label="Buscar venta"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void loadSales(searchTerm);
              }
            }}
            fullWidth
            placeholder="Minera, OC, factura, guía, producto o estado"
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
            variant="contained"
            onClick={() => void loadSales(searchTerm)}
            disabled={loading}
            sx={{ minWidth: { xs: "100%", md: 140 } }}
          >
            Buscar
          </Button>

          <Button
            variant="outlined"
            onClick={() => {
              setSearchTerm("");
              void loadSales("");
            }}
            disabled={loading}
            sx={{ minWidth: { xs: "100%", md: 120 } }}
          >
            Limpiar
          </Button>
        </Stack>
      </Card>

      {successMessage ? (
        <Alert severity="success" variant="outlined">
          {successMessage}
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" variant="outlined">
          {errorMessage}
        </Alert>
      ) : null}

      <SmartDataGrid rows={sales} columns={columns} loading={loading} />

      <Dialog
        open={detailDialog.open}
        onClose={() => setDetailDialog(emptyDetailDialog)}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Detalle de venta
          {selectedSale ? ` #${selectedSale.id}` : ""}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            {selectedSale ? (
              <Alert severity="info" variant="outlined">
                Total venta: <strong>{formatCLP(selectedSale.total)}</strong> —
                Neto: <strong>{formatCLP(selectedSale.valor_neto)}</strong> —
                IVA: <strong>{formatCLP(selectedSale.iva)}</strong>
              </Alert>
            ) : null}

            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Líneas de venta
            </Typography>

            <SmartDataGrid
              rows={selectedDetails}
              columns={detailColumns}
              loading={false}
            />

            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Alertas activas de la venta
            </Typography>

            {selectedAlerts.length === 0 ? (
              <Alert severity="success" variant="outlined">
                Esta venta no tiene alertas activas.
              </Alert>
            ) : (
              <SmartDataGrid
                rows={selectedAlerts}
                columns={alertColumns}
                loading={false}
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDetailDialog(emptyDetailDialog)}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={annulDialog.open}
        onClose={() => setAnnulDialog(emptyAnnulDialog)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Anular venta</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="warning" variant="outlined">
              La venta no se elimina. Se anula con motivo obligatorio. Si el
              stock fue descontado, el backend realizará la reversa Kardex.
            </Alert>

            <TextField
              label="Venta"
              value={annulDialog.sale ? `Venta #${annulDialog.sale.id}` : ""}
              fullWidth
              disabled
            />

            <TextField
              label="Motivo de anulación"
              value={annulDialog.motivo}
              onChange={(event) =>
                setAnnulDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setAnnulDialog(emptyAnnulDialog)}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleAnnulSale()}
            disabled={
              !annulDialog.sale ||
              !annulDialog.motivo.trim() ||
              updatingSaleId === annulDialog.sale.id
            }
          >
            {updatingSaleId === annulDialog.sale?.id
              ? "Anulando..."
              : "Anular venta"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
