import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import InfoIcon from "@mui/icons-material/Info";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../components/SmartDataGrid";
import { getApiErrorMessage as getErrorMessage } from "../services/api";
import {
  fetchAreas,
  fetchContactos,
  fetchMineras,
  fetchSubareas,
  type Area,
  type Contacto,
  type Minera,
  type Subarea,
} from "../services/commercialService";
import { fetchProducts, type Product } from "../services/inventoryService";
import {
  annulSale,
  concretarSale,
  createSale,
  fetchSales,
  fetchSalesSummary,
} from "../services/salesService";
import type {
  CreateSaleLinePayload,
  CreateSalePayload,
  Sale,
  SaleAlert,
  SaleDetail,
  SaleStatus,
  SalesSummary,
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

type SaleFormState = {
  fecha_venta: string;
  fecha_factura: string;
  factura_numero: string;
  orden_compra: string;
  minera: Minera | null;
  area: Area | null;
  subarea: Subarea | null;
  contacto: Contacto | null;
  tipo_documento: "GUIA_DESPACHO" | "HES" | "OTRO";
  numero_guia_hes: string;
  observations: string;
};

type SaleLineFormState = {
  localId: string;
  producto: Product | null;
  cantidad: string;
  valor_unitario: string;
  codigo_sap: string;
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

function getTodayInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 10);
}

function createEmptySaleForm(): SaleFormState {
  return {
    fecha_venta: getTodayInputValue(),
    fecha_factura: "",
    factura_numero: "",
    orden_compra: "",
    minera: null,
    area: null,
    subarea: null,
    contacto: null,
    tipo_documento: "GUIA_DESPACHO",
    numero_guia_hes: "",
    observations: "",
  };
}

function createEmptyLine(): SaleLineFormState {
  return {
    localId: crypto.randomUUID(),
    producto: null,
    cantidad: "1",
    valor_unitario: "0",
    codigo_sap: "",
  };
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

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
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
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [mineras, setMineras] = useState<Minera[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subareas, setSubareas] = useState<Subarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingSale, setSavingSale] = useState(false);
  const [updatingSaleId, setUpdatingSaleId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [saleForm, setSaleForm] = useState<SaleFormState>(createEmptySaleForm);
  const [saleLines, setSaleLines] = useState<SaleLineFormState[]>([
    createEmptyLine(),
  ]);

  const [detailDialog, setDetailDialog] =
    useState<DetailDialogState>(emptyDetailDialog);
  const [annulDialog, setAnnulDialog] =
    useState<AnnulDialogState>(emptyAnnulDialog);

  const loadSales = async (search = searchTerm) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [data, summaryData] = await Promise.all([
        fetchSales({
          search,
          ordering: "-fecha_venta,-created_at",
        }),
        fetchSalesSummary({
          search,
          ordering: "-fecha_venta,-created_at",
        }),
      ]);

      setSales(data);
      setSummary(summaryData);

      setSales(data);
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchSales({
        search: "",
        ordering: "-fecha_venta,-created_at",
      }),
      fetchSalesSummary({
        search: "",
        ordering: "-fecha_venta,-created_at",
      }),
      fetchProducts({
        search: "",
        ordering: "categoria__name,modelo",
      }),
      fetchMineras({ ordering: "name" }),
      fetchAreas({ ordering: "minera__name,name" }),
      fetchSubareas({ ordering: "area__minera__name,area__name,name" }),
      fetchContactos({ ordering: "first_name,last_name" }),
    ])
      .then(
        ([
          salesData,
          summaryData,
          productsData,
          minerasData,
          areasData,
          subareasData,
          contactosData,
        ]) => {
          if (!isMounted) return;

          setSales(salesData);
          setSummary(summaryData);
          setProducts(productsData);
          setMineras(minerasData);
          setAreas(areasData);
          setSubareas(subareasData);
          setContactos(contactosData);
          setErrorMessage("");
        },
      )
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

  const filteredAreas = useMemo(() => {
    if (!saleForm.minera) {
      return [];
    }

    return areas.filter((area) => area.minera === saleForm.minera?.id);
  }, [areas, saleForm.minera]);

  const filteredSubareas = useMemo(() => {
    if (saleForm.area) {
      return subareas.filter((subarea) => subarea.area === saleForm.area?.id);
    }

    if (saleForm.minera) {
      return subareas.filter(
        (subarea) => subarea.minera === saleForm.minera?.id,
      );
    }

    return [];
  }, [saleForm.area, saleForm.minera, subareas]);

  const filteredContactos = useMemo(() => {
    if (saleForm.subarea) {
      return contactos.filter(
        (contacto) => contacto.subarea === saleForm.subarea?.id,
      );
    }

    if (saleForm.area) {
      return contactos.filter(
        (contacto) => contacto.area === saleForm.area?.id,
      );
    }

    if (saleForm.minera) {
      return contactos.filter(
        (contacto) => contacto.minera === saleForm.minera?.id,
      );
    }

    return [];
  }, [contactos, saleForm.area, saleForm.minera, saleForm.subarea]);

  const salePreview = useMemo(() => {
    const neto = saleLines.reduce((sum, line) => {
      const cantidad = parsePositiveInteger(line.cantidad);
      const unitario = parseMoney(line.valor_unitario);

      return sum + cantidad * unitario;
    }, 0);

    const iva = neto * 0.19;
    const total = neto + iva;

    return {
      neto,
      iva,
      total,
    };
  }, [saleLines]);

  const handleOpenCreateSale = () => {
    setSaleForm(createEmptySaleForm());
    setSaleLines([createEmptyLine()]);
    setSaleDialogOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const handleCloseCreateSale = () => {
    if (savingSale) {
      return;
    }

    setSaleDialogOpen(false);
  };

  const updateLine = (
    localId: string,
    updater: (line: SaleLineFormState) => SaleLineFormState,
  ) => {
    setSaleLines((currentLines) =>
      currentLines.map((line) => {
        if (line.localId !== localId) {
          return line;
        }

        return updater(line);
      }),
    );
  };

  const removeLine = (localId: string) => {
    setSaleLines((currentLines) => {
      if (currentLines.length === 1) {
        return currentLines;
      }

      return currentLines.filter((line) => line.localId !== localId);
    });
  };

  const buildSalePayload = (): CreateSalePayload => {
    if (!saleForm.minera) {
      throw new Error("Debe seleccionar una minera.");
    }

    const lineas: CreateSaleLinePayload[] = saleLines.map((line, index) => {
      if (!line.producto) {
        throw new Error(`La línea ${index + 1} debe tener producto.`);
      }

      const cantidad = parsePositiveInteger(line.cantidad);
      const valorUnitario = parseMoney(line.valor_unitario);

      if (cantidad <= 0) {
        throw new Error(
          `La línea ${index + 1} debe tener cantidad mayor a cero.`,
        );
      }

      if (valorUnitario < 0) {
        throw new Error(
          `La línea ${index + 1} no puede tener valor unitario negativo.`,
        );
      }

      return {
        producto: line.producto.id,
        cantidad,
        valor_unitario: String(valorUnitario),
        codigo_sap: line.codigo_sap.trim() || line.producto.codigo_sap || "",
      };
    });

    return {
      fecha_venta: saleForm.fecha_venta || getTodayInputValue(),
      fecha_factura: saleForm.fecha_factura || null,
      factura_numero: saleForm.factura_numero.trim(),
      orden_compra: saleForm.orden_compra.trim(),
      minera: saleForm.minera.id,
      area: saleForm.area?.id ?? null,
      subarea: saleForm.subarea?.id ?? null,
      contacto: saleForm.contacto?.id ?? null,
      tipo_documento: saleForm.tipo_documento,
      numero_guia_hes: saleForm.numero_guia_hes.trim(),
      observations: saleForm.observations.trim(),
      lineas,
    };
  };

  const handleCreateSale = async () => {
    try {
      setSavingSale(true);
      setErrorMessage("");
      setSuccessMessage("");

      const payload = buildSalePayload();
      const createdSale = await createSale(payload);

      setSuccessMessage(
        `Venta #${createdSale.id} ingresada correctamente. Stock y alertas fueron procesados por el backend.`,
      );
      setSaleDialogOpen(false);
      await loadSales("");
      setSearchTerm("");
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSavingSale(false);
    }
  };

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
      headerName: "Fecha de emisión factura",
      width: 210,
      renderCell: (params) => formatDate(String(params.value || "")),
    },
    {
      field: "orden_compra",
      headerName: "Orden de compra",
      minWidth: 160,
      flex: 0.8,
      renderCell: (params) => params.value || "Sin OC",
    },
    {
      field: "minera_name",
      headerName: "Minera",
      minWidth: 190,
      flex: 1,
      renderCell: (params) => params.value || "Sin minera",
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
  const totalSalesCount = summary?.ventas.total ?? sales.length;
  const activeSalesCount =
    summary?.ventas.vigentes ??
    sales.filter((sale) => sale.sale_status !== "ANULADA").length;
  const totalSalesAmount = summary?.montos.total ?? "0";
  const missingDocumentsCount =
    (summary?.documentos.sin_factura ?? 0) +
    (summary?.documentos.sin_guia ?? 0);
  const activeAlertsCount =
    summary?.alertas.activas ??
    sales.reduce(
      (total, sale) =>
        total + sale.alerts.filter((alert) => alert.is_active).length,
      0,
    );

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
            alertas comerciales, detalle de líneas, descuento Kardex y acciones
            controladas.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreateSale}
            disabled={loading}
          >
            Nueva venta
          </Button>

          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void loadSales()}
            disabled={loading}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
          gap: 2,
        }}
      >
        {[
          {
            title: "Ventas registradas",
            value: String(totalSalesCount),
            helper: `${activeSalesCount} vigentes`,
          },
          {
            title: "Monto vigente",
            value: formatCLP(totalSalesAmount),
            helper: "Excluye ventas anuladas",
          },
          {
            title: "Documentos pendientes",
            value: String(missingDocumentsCount),
            helper: "Facturas, guías o HES faltantes",
          },
          {
            title: "Alertas activas",
            value: String(activeAlertsCount),
            helper: `${summary?.alertas.bloqueantes ?? 0} bloqueantes`,
          },
        ].map((card) => (
          <Card
            key={card.title}
            sx={{
              p: 2,
              bgcolor: colors.background.paper,
              border: `1px solid ${colors.border.light}`,
            }}
          >
            <Typography variant="body2" sx={{ color: colors.text.secondary }}>
              {card.title}
            </Typography>

            <Typography
              variant="h5"
              sx={{ color: colors.text.primary, fontWeight: 900 }}
            >
              {card.value}
            </Typography>

            <Typography variant="caption" sx={{ color: colors.text.muted }}>
              {card.helper}
            </Typography>
          </Card>
        ))}
      </Box>

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
        open={saleDialogOpen}
        onClose={handleCloseCreateSale}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>Nueva venta / ingreso</DialogTitle>

        <DialogContent>
          <Stack spacing={2.4} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Al guardar, el backend crea la venta como{" "}
              <strong>INGRESADA</strong>, calcula neto/IVA/total, descuenta
              stock si corresponde y genera alertas comerciales.
            </Alert>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                label="Fecha venta"
                type="date"
                value={saleForm.fecha_venta}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    fecha_venta: event.target.value,
                  }))
                }
                required
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Fecha factura"
                type="date"
                value={saleForm.fecha_factura}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    fecha_factura: event.target.value,
                  }))
                }
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />

              <TextField
                label="Número factura"
                value={saleForm.factura_numero}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    factura_numero: event.target.value,
                  }))
                }
                fullWidth
                placeholder="Opcional"
              />

              <TextField
                label="Orden de compra"
                value={saleForm.orden_compra}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    orden_compra: event.target.value,
                  }))
                }
                fullWidth
                placeholder="Opcional"
              />

              <Autocomplete
                options={mineras}
                value={saleForm.minera}
                onChange={(_, value) =>
                  setSaleForm((current) => ({
                    ...current,
                    minera: value,
                    area: null,
                    subarea: null,
                    contacto: null,
                  }))
                }
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Minera" required />
                )}
              />

              <Autocomplete
                options={filteredAreas}
                value={saleForm.area}
                onChange={(_, value) =>
                  setSaleForm((current) => ({
                    ...current,
                    area: value,
                    subarea: null,
                    contacto: null,
                  }))
                }
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField {...params} label="Área" placeholder="Opcional" />
                )}
              />

              <Autocomplete
                options={filteredSubareas}
                value={saleForm.subarea}
                onChange={(_, value) =>
                  setSaleForm((current) => ({
                    ...current,
                    subarea: value,
                    contacto: null,
                  }))
                }
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Subárea"
                    placeholder="Opcional"
                  />
                )}
              />

              <Autocomplete
                options={filteredContactos}
                value={saleForm.contacto}
                onChange={(_, value) =>
                  setSaleForm((current) => ({
                    ...current,
                    contacto: value,
                  }))
                }
                getOptionLabel={(option) => option.full_name || "Sin nombre"}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Contacto"
                    placeholder="Opcional"
                  />
                )}
              />

              <Autocomplete
                options={[
                  { value: "GUIA_DESPACHO", label: "Guía de despacho" },
                  { value: "HES", label: "HES" },
                  { value: "OTRO", label: "Otro" },
                ]}
                value={{
                  value: saleForm.tipo_documento,
                  label:
                    saleForm.tipo_documento === "HES"
                      ? "HES"
                      : saleForm.tipo_documento === "OTRO"
                        ? "Otro"
                        : "Guía de despacho",
                }}
                onChange={(_, option) =>
                  setSaleForm((current) => ({
                    ...current,
                    tipo_documento:
                      (option?.value as SaleFormState["tipo_documento"]) ||
                      "GUIA_DESPACHO",
                  }))
                }
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(option, value) =>
                  option.value === value.value
                }
                renderInput={(params) => (
                  <TextField {...params} label="Tipo documento logístico" />
                )}
              />

              <TextField
                label="Número guía / HES"
                value={saleForm.numero_guia_hes}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    numero_guia_hes: event.target.value,
                  }))
                }
                fullWidth
                placeholder="Opcional"
              />
            </Box>

            <TextField
              label="Observaciones"
              value={saleForm.observations}
              onChange={(event) =>
                setSaleForm((current) => ({
                  ...current,
                  observations: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={2}
            />

            <Divider />

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              sx={{ alignItems: { xs: "stretch", md: "center" } }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Líneas de venta
                </Typography>

                <Typography
                  variant="body2"
                  sx={{ color: colors.text.secondary }}
                >
                  Cada producto inventariable descontará stock mediante Kardex.
                </Typography>
              </Box>

              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() =>
                  setSaleLines((currentLines) => [
                    ...currentLines,
                    createEmptyLine(),
                  ])
                }
              >
                Agregar línea
              </Button>
            </Stack>

            <Stack spacing={1.5}>
              {saleLines.map((line, index) => (
                <Card
                  key={line.localId}
                  sx={{
                    p: 2,
                    bgcolor: colors.surface.soft,
                    border: `1px solid ${colors.border.light}`,
                  }}
                >
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      sx={{ alignItems: { xs: "stretch", md: "center" } }}
                    >
                      <Typography sx={{ fontWeight: 900, minWidth: 90 }}>
                        Línea {index + 1}
                      </Typography>

                      <Autocomplete
                        options={products}
                        value={line.producto}
                        onChange={(_, value) =>
                          updateLine(line.localId, (current) => ({
                            ...current,
                            producto: value,
                            codigo_sap: value?.codigo_sap || "",
                          }))
                        }
                        getOptionLabel={(option) =>
                          `${option.modelo}${
                            option.codigo_sap
                              ? ` · SAP ${option.codigo_sap}`
                              : ""
                          } · Stock ${option.stock_actual}`
                        }
                        isOptionEqualToValue={(option, value) =>
                          option.id === value.id
                        }
                        sx={{ flex: 1.5 }}
                        renderInput={(params) => (
                          <TextField {...params} label="Producto" required />
                        )}
                      />

                      <TextField
                        label="Cantidad"
                        type="number"
                        value={line.cantidad}
                        onChange={(event) =>
                          updateLine(line.localId, (current) => ({
                            ...current,
                            cantidad: event.target.value,
                          }))
                        }
                        sx={{ width: { xs: "100%", md: 130 } }}
                        required
                      />

                      <TextField
                        label="Valor unitario"
                        type="number"
                        value={line.valor_unitario}
                        onChange={(event) =>
                          updateLine(line.localId, (current) => ({
                            ...current,
                            valor_unitario: event.target.value,
                          }))
                        }
                        sx={{ width: { xs: "100%", md: 170 } }}
                        required
                      />

                      <TextField
                        label="Código SAP"
                        value={line.codigo_sap}
                        onChange={(event) =>
                          updateLine(line.localId, (current) => ({
                            ...current,
                            codigo_sap: event.target.value,
                          }))
                        }
                        sx={{ width: { xs: "100%", md: 160 } }}
                      />

                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        disabled={saleLines.length === 1}
                        onClick={() => removeLine(line.localId)}
                      >
                        Quitar
                      </Button>
                    </Stack>

                    <Typography
                      variant="body2"
                      sx={{ color: colors.text.muted }}
                    >
                      Total línea:{" "}
                      <strong>
                        {formatCLP(
                          parsePositiveInteger(line.cantidad) *
                            parseMoney(line.valor_unitario),
                        )}
                      </strong>
                      {line.producto?.controla_stock
                        ? ` · Stock disponible: ${line.producto.stock_actual}`
                        : " · No controla stock"}
                    </Typography>
                  </Stack>
                </Card>
              ))}
            </Stack>

            <Alert severity="success" variant="outlined">
              Neto: <strong>{formatCLP(salePreview.neto)}</strong> — IVA 19%:{" "}
              <strong>{formatCLP(salePreview.iva)}</strong> — Total:{" "}
              <strong>{formatCLP(salePreview.total)}</strong>
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseCreateSale} disabled={savingSale}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleCreateSale()}
            disabled={savingSale}
          >
            {savingSale ? "Guardando..." : "Ingresar venta"}
          </Button>
        </DialogActions>
      </Dialog>

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
