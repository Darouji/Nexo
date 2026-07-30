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
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InfoIcon from "@mui/icons-material/Info";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { PageHeader } from "../components/PageHeader";
import { SectionCard } from "../components/SectionCard";
import { MetricCard } from "../components/MetricCard";
import { SerkanDataGrid, type SerkanGridFilter, type SerkanGridSortModel } from "../components/SerkanDataGrid";
import { SerkanFilterToolbar } from "../components/filters/SerkanFilterToolbar";
import { SerkanMultiSelectFilter } from "../components/filters/SerkanMultiSelectFilter";
import { getApiErrorMessage as getErrorMessage, getApiFieldErrors } from "../services/api";
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
import {
  fetchProductLocationBalances, fetchProducts,
  type Product, type ProductLocationBalance,
} from "../services/inventoryService";
import {
  annulSale,
  concretarSale,
  createSale,
  fetchSalesPage,
  fetchSalesSummary,
  updateSaleLines,
  updateSaleMetadata,
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
  ubicacion_salida: string;
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
    ubicacion_salida: "",
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
  const [locationBalances, setLocationBalances] = useState<ProductLocationBalance[]>([]);
  const [mineras, setMineras] = useState<Minera[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subareas, setSubareas] = useState<Subarea[]>([]);
  const [contactos, setContactos] = useState<Contacto[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [saleStatuses, setSaleStatuses] = useState<string[]>([]);
  const [validationSummaries, setValidationSummaries] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });
  const [sortModel, setSortModel] = useState<SerkanGridSortModel>({ field: "fecha_venta", direction: "desc" });
  const [columnFilters, setColumnFilters] = useState<SerkanGridFilter[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingSale, setSavingSale] = useState(false);
  const [updatingSaleId, setUpdatingSaleId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [saleEditReason, setSaleEditReason] = useState("");
  const [saleDialogError, setSaleDialogError] = useState("");
  const [saleFieldErrors, setSaleFieldErrors] = useState<Record<string, string>>({});
  const [saleForm, setSaleForm] = useState<SaleFormState>(createEmptySaleForm);
  const [saleLines, setSaleLines] = useState<SaleLineFormState[]>([
    createEmptyLine(),
  ]);

  const [detailDialog, setDetailDialog] =
    useState<DetailDialogState>(emptyDetailDialog);
  const [annulDialog, setAnnulDialog] =
    useState<AnnulDialogState>(emptyAnnulDialog);
  const [detailPagination, setDetailPagination] = useState({ page: 0, pageSize: 25 });
  const [alertPagination, setAlertPagination] = useState({ page: 0, pageSize: 25 });

  const loadSales = async (options?: { search?: string; statuses?: string[]; validations?: string[]; from?: string; to?: string; page?: number; pageSize?: number; sort?: SerkanGridSortModel; filters?: SerkanGridFilter[] }) => {
    const querySearch = options?.search ?? appliedSearch;
    const queryStatuses = options?.statuses ?? saleStatuses;
    const queryValidations = options?.validations ?? validationSummaries;
    const queryFrom = options?.from ?? dateFrom;
    const queryTo = options?.to ?? dateTo;
    const queryPage = options?.page ?? pagination.page;
    const queryPageSize = options?.pageSize ?? pagination.pageSize;
    const querySort = options?.sort === undefined ? sortModel : options.sort;
    const queryFilters = options?.filters ?? columnFilters;
    const params = {
      search: querySearch, sale_status: queryStatuses,
      validation_summary: queryValidations.join(",") || undefined,
      fecha_desde: queryFrom || undefined, fecha_hasta: queryTo || undefined,
      ordering: querySort ? `${querySort.direction === "desc" ? "-" : ""}${querySort.field}` : "-fecha_venta,-created_at",
      grid_filters: queryFilters.length ? JSON.stringify(queryFilters) : undefined,
      page: queryPage + 1, page_size: queryPageSize,
    };
    try {
      setLoading(true); setErrorMessage("");
      const [pageData, summaryData] = await Promise.all([fetchSalesPage(params), fetchSalesSummary(params)]);
      setSales(pageData.results); setSalesCount(pageData.count); setSummary(summaryData);
    } catch (error: unknown) { setErrorMessage(getErrorMessage(error)); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let isMounted = true;

    Promise.all([
      fetchSalesPage({
        search: "",
        ordering: "-fecha_venta,-created_at",
        page: 1,
        page_size: 25,
      }),
      fetchSalesSummary({
        search: "",
        ordering: "-fecha_venta,-created_at",
      }),
      fetchProducts({
        search: "",
        ordering: "categoria__name,modelo",
      }),
      fetchProductLocationBalances({ positiveOnly: true }),
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
          balancesData,
          minerasData,
          areasData,
          subareasData,
          contactosData,
        ]) => {
          if (!isMounted) return;

          setSales(salesData.results);
          setSalesCount(salesData.count);
          setSummary(summaryData);
          setProducts(productsData);
          setLocationBalances(balancesData);
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
    setEditingSale(null);
    setSaleEditReason("");
    setSaleDialogError("");
    setSaleFieldErrors({});
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
    setEditingSale(null);
    setSaleEditReason("");
    setSaleDialogError("");
  };

  const handleOpenEditSale = (sale: Sale) => {
    setEditingSale(sale);
    setSaleEditReason("");
    setSaleDialogError("");
    setSaleFieldErrors({});
    setSaleForm({
      fecha_venta: sale.fecha_venta || getTodayInputValue(),
      fecha_factura: sale.fecha_factura || "",
      factura_numero: sale.factura_numero || "",
      orden_compra: sale.orden_compra || "",
      minera: mineras.find((item) => item.id === sale.minera) ?? null,
      area: areas.find((item) => item.id === sale.area) ?? null,
      subarea: subareas.find((item) => item.id === sale.subarea) ?? null,
      contacto: contactos.find((item) => item.id === sale.contacto) ?? null,
      tipo_documento:
        sale.tipo_documento === "HES" || sale.tipo_documento === "OTRO"
          ? sale.tipo_documento
          : "GUIA_DESPACHO",
      numero_guia_hes: sale.numero_guia_hes || "",
      observations: sale.observations || "",
    });
    setSaleLines(
      sale.detalles.map((detail) => ({
        localId: crypto.randomUUID(),
        producto:
          products.find((product) => product.id === detail.producto) ?? null,
        cantidad: String(detail.cantidad),
        valor_unitario: String(detail.valor_unitario),
        codigo_sap: detail.codigo_sap || "",
        ubicacion_salida: detail.ubicacion_salida ? String(detail.ubicacion_salida) : "",
      })),
    );
    setSaleDialogOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const saleLinesFingerprint = (lines: CreateSaleLinePayload[]) =>
    JSON.stringify(
      lines.map((line) => ({
        producto: line.producto,
        cantidad: line.cantidad,
        valor_unitario: Number(line.valor_unitario),
        codigo_sap: line.codigo_sap?.trim() || "",
        ubicacion_salida: line.ubicacion_salida ? Number(line.ubicacion_salida) : null,
      })),
    );

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
      if (line.producto.controla_stock && !line.ubicacion_salida) {
        throw new Error(`Seleccione la ubicación de salida de la línea ${index + 1}.`);
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
        ubicacion_salida: line.ubicacion_salida ? Number(line.ubicacion_salida) : null,
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
      setSaleDialogError("");
      setSuccessMessage("");

      const payload = buildSalePayload();
      if (editingSale) {
        const { lineas, ...metadata } = payload;
        const originalLines: CreateSaleLinePayload[] = editingSale.detalles.map(
          (detail) => ({
            producto: detail.producto,
            ubicacion_salida: detail.ubicacion_salida,
            cantidad: detail.cantidad,
            valor_unitario: String(detail.valor_unitario),
            codigo_sap: detail.codigo_sap || "",
          }),
        );
        const linesChanged =
          saleLinesFingerprint(lineas) !== saleLinesFingerprint(originalLines);

        if (linesChanged && !saleEditReason.trim()) {
          throw new Error(
            "Indique el motivo de la corrección de productos, cantidades o valores.",
          );
        }

        await updateSaleMetadata(editingSale.id, metadata);
        if (linesChanged) {
          await updateSaleLines(editingSale.id, { motivo: saleEditReason, lineas });
        }
        setSuccessMessage(`Venta #${editingSale.id} actualizada correctamente.`);
      } else {
        const createdSale = await createSale(payload);
        setSuccessMessage(
          `Venta #${createdSale.id} ingresada correctamente. Stock y alertas fueron procesados por el backend.`,
        );
      }
      setSaleDialogOpen(false);
      setEditingSale(null);
      setSaleEditReason("");
      await loadSales({ search: "", page: 0 });
      setSearchTerm("");
      setAppliedSearch("");
      setPagination((current) => ({ ...current, page: 0 }));
    } catch (error: unknown) {
      setSaleFieldErrors(getApiFieldErrors(error));
      setSaleDialogError(getErrorMessage(error));
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
      await loadSales({ search: appliedSearch });
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
      await loadSales({ search: appliedSearch });
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const columns: ColDef<Sale>[] = [
    { field: "fecha_venta", headerName: "Fecha de emisión", width: 165, valueFormatter: (p) => formatDate(String(p.value || "")) },
    { field: "orden_compra", headerName: "Orden de compra", minWidth: 160, flex: 0.8, valueFormatter: (p) => String(p.value || "Sin OC") },
    { field: "minera_name", headerName: "Minera", minWidth: 190, flex: 1, valueFormatter: (p) => String(p.value || "Sin minera") },
    { field: "factura_numero", headerName: "Factura", minWidth: 130, flex: 0.7, valueFormatter: (p) => String(p.value || "Sin factura") },
    { field: "numero_guia_hes", headerName: "Guía / HES", minWidth: 140, flex: 0.7, valueFormatter: (p) => String(p.value || "Sin guía/HES") },
    { field: "valor_neto", headerName: "Monto neto", width: 150, filter: "agNumberColumnFilter", valueFormatter: (p) => formatCLP(String(p.value || 0)) },
    { field: "iva", headerName: "IVA (19%)", width: 140, filter: "agNumberColumnFilter", valueFormatter: (p) => formatCLP(String(p.value || 0)) },
    { field: "total", headerName: "Total con IVA", width: 165, filter: "agNumberColumnFilter", valueFormatter: (p) => formatCLP(String(p.value || 0)), cellStyle: { fontWeight: 900 } },
    { field: "sale_status", headerName: "Estado", width: 150, filter: "agTextColumnFilter", cellRenderer: (p: ICellRendererParams<Sale>) => {
      const sale = p.data; if (!sale) return null; const color = getSaleStatusColor(sale.sale_status);
      return <Chip label={sale.sale_status_display || sale.sale_status} size="small" sx={{ color, bgcolor: colors.surface.soft, borderColor: color, border: "1px solid", fontWeight: 800 }} />;
    } },
    { field: "validation_summary", headerName: "Validación", width: 145, sortable: false, filter: false, cellRenderer: (p: ICellRendererParams<Sale>) => {
      const value = String(p.value || "OK") as SaleValidationSummary; const color = getValidationColor(value);
      return <Chip label={getValidationLabel(value)} size="small" sx={{ color, bgcolor: colors.surface.soft, borderColor: color, border: "1px solid", fontWeight: 800 }} />;
    } },
    { field: "stock_descontado", headerName: "Stock", width: 125, filter: false, cellRenderer: (p: ICellRendererParams<Sale>) => {
      const discounted = Boolean(p.value);
      return <Chip label={discounted ? "Descontado" : "No"} size="small" sx={{ color: discounted ? colors.status.success : colors.text.muted, bgcolor: colors.surface.soft, borderColor: discounted ? colors.status.success : colors.border.medium, border: "1px solid", fontWeight: 800 }} />;
    } },
    { colId: "actions", headerName: "Acciones", width: 455, minWidth: 455, sortable: false, filter: false, suppressMovable: true, cellRenderer: (p: ICellRendererParams<Sale>) => {
      const sale = p.data; if (!sale) return null; const isUpdating = updatingSaleId === sale.id;
      return <Stack direction="row" spacing={1} sx={{ alignItems: "center", height: "100%", flexWrap: "nowrap", whiteSpace: "nowrap" }}>
        <Button size="small" variant="outlined" startIcon={<InfoIcon />} onClick={() => { setDetailPagination({ page: 0, pageSize: 25 }); setAlertPagination({ page: 0, pageSize: 25 }); setDetailDialog({ open: true, sale }); }}>Detalle</Button>
        <Button size="small" variant="outlined" startIcon={<EditIcon />} disabled={sale.sale_status === "ANULADA" || isUpdating} onClick={() => handleOpenEditSale(sale)}>Editar</Button>
        <Button size="small" variant="outlined" startIcon={<CheckCircleIcon />} disabled={sale.sale_status !== "INGRESADA" || isUpdating} onClick={() => void handleConcretarSale(sale)}>Concretar</Button>
        <Button size="small" variant="outlined" startIcon={<BlockIcon />} disabled={sale.sale_status === "ANULADA" || isUpdating} onClick={() => handleOpenAnnulDialog(sale)}>Anular</Button>
      </Stack>;
    } },
  ];
  const detailColumns: ColDef<SaleDetail>[] = [
    { field: "producto_categoria", headerName: "Categoría", minWidth: 160, flex: 0.8 },
    { field: "producto_modelo", headerName: "Producto", minWidth: 220, flex: 1.2 },
    { field: "codigo_sap", headerName: "Código SAP", minWidth: 130, flex: 0.7, valueFormatter: (params) => String(params.value || "Sin código") },
    { field: "cantidad", headerName: "Cantidad", width: 120, cellStyle: { textAlign: "right" } },
    { field: "valor_unitario", headerName: "Valor unitario neto", width: 180, valueFormatter: (params) => formatCLP(String(params.value || 0)) },
    { field: "valor_total", headerName: "Subtotal neto", width: 160, valueFormatter: (params) => formatCLP(String(params.value || 0)), cellStyle: { fontWeight: 900 } },
    { field: "controla_stock_snapshot", headerName: "Control stock", width: 140, valueFormatter: (params) => params.value ? "Sí" : "No" },
  ];

  const alertColumns: ColDef<SaleAlert>[] = [
    { field: "code_display", headerName: "Alerta", minWidth: 190, flex: 1, valueFormatter: (params) => String(params.value || "Alerta") },
    { field: "message", headerName: "Mensaje", minWidth: 240, flex: 1.2 },
    { field: "severity_display", headerName: "Severidad", width: 140, valueFormatter: (params) => String(params.value || "Sin severidad") },
    { field: "is_active", headerName: "Activa", width: 110, valueFormatter: (params) => params.value ? "Sí" : "No" },
  ];
  const selectedSale = detailDialog.sale;
  const selectedDetails: SaleDetail[] = selectedSale?.detalles ?? [];
  const selectedAlerts: SaleAlert[] =
    selectedSale?.alerts.filter((alert) => alert.is_active) ?? [];
  const visibleDetails = selectedDetails.slice(detailPagination.page * detailPagination.pageSize, (detailPagination.page + 1) * detailPagination.pageSize);
  const visibleAlerts = selectedAlerts.slice(alertPagination.page * alertPagination.pageSize, (alertPagination.page + 1) * alertPagination.pageSize);
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
      <PageHeader title="Ventas / Ingresos" subtitle="Registro comercial, documentos, alertas y descuento de inventario en un único flujo." eyebrow="Gestión comercial" icon={<CheckCircleIcon />} tone={colors.modules.sales} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }, gap: 2 }}>
        <MetricCard title="Ventas registradas" value={String(totalSalesCount)} helper={`${activeSalesCount} vigentes`} icon={<CheckCircleIcon />} tone={colors.modules.sales} />
        <MetricCard title="Monto vigente" value={formatCLP(totalSalesAmount)} helper="Excluye ventas anuladas" icon={<CheckCircleIcon />} tone={colors.modules.analytics} />
        <MetricCard title="Documentos pendientes" value={String(missingDocumentsCount)} helper="Facturas, guías o HES faltantes" icon={<InfoIcon />} tone={colors.modules.documents} />
        <MetricCard title="Alertas activas" value={String(activeAlertsCount)} helper={`${summary?.alertas.bloqueantes ?? 0} bloqueantes`} icon={<BlockIcon />} tone={colors.modules.commercial} />
      </Box>
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

      <SectionCard
        title="Ventas"
        subtitle="Filtros remotos, vistas personales, columnas configurables y acciones comerciales."
        actions={<><Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateSale} disabled={loading}>Nueva venta</Button><Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void loadSales()} disabled={loading}>Actualizar</Button></>}
      >
        <SerkanFilterToolbar
          searchLabel="Buscar ventas" searchPlaceholder="Minera, OC, factura, guía, producto o estado..."
          searchValue={searchTerm} onSearchValueChange={setSearchTerm}
          onApply={() => { setAppliedSearch(searchTerm); setPagination((current) => ({ ...current, page: 0 })); void loadSales({ search: searchTerm, page: 0 }); }}
          onClear={() => {
            setSearchTerm(""); setAppliedSearch(""); setSaleStatuses([]); setValidationSummaries([]); setDateFrom(""); setDateTo(""); setColumnFilters([]);
            setPagination((current) => ({ ...current, page: 0 })); setFilterResetKey((current) => current + 1);
            void loadSales({ search: "", statuses: [], validations: [], from: "", to: "", filters: [], page: 0 });
          }}
          loading={loading} expanded={filtersExpanded} onExpandedChange={setFiltersExpanded}
          activeFiltersCount={saleStatuses.length + validationSummaries.length + Number(Boolean(dateFrom)) + Number(Boolean(dateTo)) + columnFilters.length}
          panelId="sales-advanced-filters"
        >
          <SerkanMultiSelectFilter label="Estado" options={[{ value: "INGRESADA", label: "Ingresada" }, { value: "CONCRETADA", label: "Concretada" }, { value: "ANULADA", label: "Anulada" }]} value={saleStatuses} onChange={setSaleStatuses} />
          <SerkanMultiSelectFilter label="Validación" options={[{ value: "OK", label: "Sin alertas" }, { value: "CON_ALERTAS", label: "Con alertas" }, { value: "BLOQUEANTE", label: "Bloqueante" }]} value={validationSummaries} onChange={setValidationSummaries} />
          <TextField label="Desde" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Hasta" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button variant="contained" onClick={() => { setAppliedSearch(searchTerm); setPagination((current) => ({ ...current, page: 0 })); void loadSales({ search: searchTerm, statuses: saleStatuses, validations: validationSummaries, from: dateFrom, to: dateTo, page: 0 }); }}>Aplicar filtros</Button>
        </SerkanFilterToolbar>
        <SerkanDataGrid
          gridKey="sales.sales" serverManaged ariaLabel="Listado de ventas" rows={sales} columns={columns} loading={loading}
          paginationModel={pagination} onPaginationModelChange={(next) => { setPagination(next); void loadSales({ page: next.page, pageSize: next.pageSize }); }} rowCount={salesCount}
          sortModel={sortModel} onSortModelChange={(next) => { setSortModel(next); setPagination((current) => ({ ...current, page: 0 })); void loadSales({ sort: next, page: 0 }); }}
          onFilterModelChange={(next) => { setColumnFilters(next); setPagination((current) => ({ ...current, page: 0 })); void loadSales({ filters: next, page: 0 }); }} filterResetKey={filterResetKey}
        />
      </SectionCard>

      <Dialog
        open={saleDialogOpen}
        onClose={handleCloseCreateSale}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>{editingSale ? `Editar venta #${editingSale.id}` : "Nueva venta / ingreso"}</DialogTitle>

        <DialogContent>
          <Stack spacing={2.4} sx={{ mt: 1 }}>
            {saleDialogError ? <Alert severity="error" variant="outlined">{saleDialogError}</Alert> : null}
            <Alert severity="info" variant="outlined">
              {editingSale
                ? "Los cambios de productos o cantidades ajustan el Kardex por diferencia y quedan registrados en auditoría."
                : <>Al guardar, el backend crea la venta como <strong>INGRESADA</strong>, calcula neto/IVA/total, descuenta stock si corresponde y genera alertas comerciales.</>}
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
                      sx={{ alignItems: { xs: "stretch", md: "flex-start" } }}
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
                            ubicacion_salida: (() => {
                              const balances = locationBalances.filter((item) => item.product === value?.id && item.quantity > 0);
                              return balances.length === 1 ? String(balances[0].location) : "";
                            })(),
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
                        select
                        label="Ubicación de salida"
                        value={line.ubicacion_salida}
                        disabled={!line.producto?.controla_stock}
                        onChange={(event) => updateLine(line.localId, (current) => ({ ...current, ubicacion_salida: event.target.value }))}
                        error={Boolean(saleFieldErrors[`lineas.${index}.ubicacion_salida`] || saleFieldErrors.ubicacion)}
                        helperText={saleFieldErrors[`lineas.${index}.ubicacion_salida`] || (line.producto?.controla_stock ? "Bodega desde la que se descontará el stock." : "No aplica: el producto no controla stock.")}
                        sx={{ minWidth: 210 }}
                      >
                        {locationBalances.filter((item) => item.product === line.producto?.id && item.quantity > 0).map((item) => (
                          <MenuItem key={item.id} value={String(item.location)}>{item.location_name} · Stock {item.quantity}</MenuItem>
                        ))}
                      </TextField>

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
                        label="Valor unitario neto (CLP)"
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
                      Subtotal neto de línea:{" "}
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
              Moneda: <strong>CLP</strong> — Monto neto: <strong>{formatCLP(salePreview.neto)}</strong> — IVA
              (19%): <strong>{formatCLP(salePreview.iva)}</strong> — Total con
              IVA: <strong>{formatCLP(salePreview.total)}</strong>
            </Alert>
            {editingSale ? (
              <TextField
                label="Motivo de la corrección de líneas"
                value={saleEditReason}
                onChange={(event) => setSaleEditReason(event.target.value)}
                helperText="Obligatorio solamente si cambia productos, cantidades, valores o códigos SAP."
                fullWidth multiline minRows={2}
              />
            ) : null}
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
            {savingSale ? "Guardando..." : editingSale ? "Guardar cambios" : "Ingresar venta"}
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
                Monto neto:{" "}
                <strong>{formatCLP(selectedSale.valor_neto)}</strong> — IVA
                (19%): <strong>{formatCLP(selectedSale.iva)}</strong> — Total
                con IVA: <strong>{formatCLP(selectedSale.total)}</strong>
              </Alert>
            ) : null}

            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Líneas de venta
            </Typography>

            <SerkanDataGrid
              gridKey="sales.details"
              ariaLabel="Líneas de la venta"
              rows={visibleDetails}
              columns={detailColumns}
              paginationModel={detailPagination}
              onPaginationModelChange={setDetailPagination}
              rowCount={selectedDetails.length}
              height={420}
              minHeight={280}
            />

            <Typography variant="h6" sx={{ fontWeight: 900 }}>
              Alertas activas de la venta
            </Typography>

            {selectedAlerts.length === 0 ? (
              <Alert severity="success" variant="outlined">
                Esta venta no tiene alertas activas.
              </Alert>
            ) : (
              <SerkanDataGrid
                gridKey="sales.alerts"
                ariaLabel="Alertas activas de la venta"
                rows={visibleAlerts}
                columns={alertColumns}
                paginationModel={alertPagination}
                onPaginationModelChange={setAlertPagination}
                rowCount={selectedAlerts.length}
                height={360}
                minHeight={260}
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
