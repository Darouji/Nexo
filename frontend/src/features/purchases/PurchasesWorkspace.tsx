import { useCallback, useEffect, useRef, useState } from "react";
import type { ColDef } from "ag-grid-community";
import { Alert, Box, Button, ButtonGroup, Stack } from "@mui/material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import BusinessIcon from "@mui/icons-material/Business";
import DownloadIcon from "@mui/icons-material/Download";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { PageHeader } from "../../components/PageHeader";
import { SectionCard } from "../../components/SectionCard";
import { MetricCard } from "../../components/MetricCard";
import { CapabilityGate } from "../../components/CapabilityGate";
import { LoadingState, StateFeedback } from "../../components/StateFeedback";
import { SerkanDataGrid, type SerkanGridFilter } from "../../components/SerkanDataGrid";
import { SerkanFilterToolbar } from "../../components/filters/SerkanFilterToolbar";
import { SerkanMultiSelectFilter } from "../../components/filters/SerkanMultiSelectFilter";
import { getApiErrorMessage, getApiFieldErrors } from "../../services/api";
import { downloadBlob } from "../../services/download";
import { createIdempotencyKey } from "../../services/idempotency";
import { fetchInventoryLocations, fetchProducts, type InventoryLocation, type Product } from "../../services/inventoryService";
import {
  createPurchaseOrder,
  createSupplier,
  exportPurchases,
  fetchPurchaseOrders,
  fetchPurchaseReceipts,
  fetchSuppliers,
  receivePurchaseCommitment,
  transitionPurchaseOrder,
  type PurchaseOrder,
  type PurchaseReceipt,
  type Supplier,
  type SupplierPayload,
} from "../../services/purchasesService";
import type { SavedGridViewConfig } from "../../services/gridService";
import { colors } from "../../theme/colors";
import { buildOrderColumns, buildReceiptColumns, buildSupplierColumns } from "./purchaseColumns";
import {
  createEmptyPurchaseOrderForm,
  PURCHASE_STATUSES,
  toPurchaseOrderPayload,
  validatePurchaseOrderForm,
  type PurchaseOrderForm,
} from "./purchaseModels";
import { buildPurchaseQueryParams, type PurchaseQueryState } from "./purchaseQueryParams";
import { PurchaseOrderDialog } from "./PurchaseOrderDialog";
import {
  OrderDetailDialog,
  ReceiveCommitmentDialog,
  SupplierDialog,
  TransitionReasonDialog,
  type PurchaseTransition,
} from "./PurchaseOperationsDialogs";

type Section = "orders" | "suppliers" | "receipts";
type Row = PurchaseOrder | Supplier | PurchaseReceipt;
const sections: Record<Section, { label: string; gridKey: string }> = {
  orders: { label: "Órdenes", gridKey: "purchases.orders" },
  suppliers: { label: "Proveedores", gridKey: "purchases.suppliers" },
  receipts: { label: "Recepciones", gridKey: "purchases.receipts" },
};
const emptyQuery = (): PurchaseQueryState => ({
  search: "",
  statuses: [],
  currencies: [],
  pagination: { page: 0, pageSize: 10 },
  sort: null,
  columnFilters: [],
});

export function PurchasesWorkspace() {
  const [section, setSection] = useState<Section>("orders");
  const [query, setQuery] = useState(emptyQuery);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const request = useRef<AbortController | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PurchaseOrderForm>(createEmptyPurchaseOrderForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const creationKey = useRef(createIdempotencyKey("purchase-order"));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const emptySupplier: SupplierPayload = { tax_id: "", name: "", trade_name: "", country: "", contact_name: "", email: "", phone: "", active: true };
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierPayload>(emptySupplier);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [transition, setTransition] = useState<PurchaseTransition | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const transitionKey = useRef(createIdempotencyKey("purchase-transition"));
  const [selectedCommitment, setSelectedCommitment] = useState<PurchaseReceipt | null>(null);
  const [receiptQuantity, setReceiptQuantity] = useState("");
  const [receiptReason, setReceiptReason] = useState("");
  const [receiptKey, setReceiptKey] = useState(() => createIdempotencyKey("purchase-receipt"));

  const load = useCallback(async (target: Section, state: PurchaseQueryState) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const params = buildPurchaseQueryParams(state);
      const response =
        target === "orders"
          ? await fetchPurchaseOrders(params, controller.signal)
          : target === "suppliers"
            ? await fetchSuppliers(params, controller.signal)
            : await fetchPurchaseReceipts(params, controller.signal);
      if (!controller.signal.aborted) {
        setRows(response.results);
        setCount(response.count);
        setError("");
      }
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        setRows([]);
        setCount(0);
        setError(getApiErrorMessage(reason, "No se pudo cargar Compras."));
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(section, query), 0);
    return () => {
      window.clearTimeout(timer);
      request.current?.abort();
    };
  }, [load, query, section]);

  const updateQuery = (patch: Partial<PurchaseQueryState>) =>
    setQuery((current) => ({
      ...current,
      ...patch,
      pagination: patch.pagination ?? { ...current.pagination, page: 0 },
    }));

  const changeSection = (target: Section) => {
    setSection(target);
    setRows([]);
    setCount(0);
    setSearch("");
    setExpanded(false);
    setQuery(emptyQuery());
    setFilterResetKey((value) => value + 1);
  };

  const openOrderDialog = async () => {
    setForm(createEmptyPurchaseOrderForm());
    creationKey.current = createIdempotencyKey("purchase-order");
    setFieldErrors({});
    setDialogError("");
    setDialogOpen(true);
    try {
      const [supplierPage, productRows, locationRows] = await Promise.all([
        fetchSuppliers({ page_size: 200 }),
        fetchProducts({ status: "ACTIVO" }),
        fetchInventoryLocations({ status: "ACTIVA" }),
      ]);
      setSuppliers(supplierPage.results.filter((supplier) => supplier.active));
      setProducts(productRows);
      setLocations(locationRows);
    } catch (reason: unknown) {
      setDialogError(getApiErrorMessage(reason, "No se pudieron cargar las opciones."));
    }
  };

  const saveOrder = async () => {
    const errors = validatePurchaseOrderForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await createPurchaseOrder(
        toPurchaseOrderPayload(form),
        creationKey.current,
      );
      setDialogOpen(false);
      setSuccess("La orden quedó guardada como borrador.");
      await load("orders", query);
    } catch (reason: unknown) {
      setFieldErrors(getApiFieldErrors(reason));
      setDialogError(getApiErrorMessage(reason, "No se pudo guardar la orden."));
    } finally {
      setSaving(false);
    }
  };

  const saveSupplier = async () => {
    const errors: Record<string, string> = {};
    if (!supplierForm.name.trim()) errors.name = "La razón social es obligatoria.";
    if (!supplierForm.tax_id.trim()) errors.tax_id = "La identificación tributaria es obligatoria.";
    if (!supplierForm.country.trim()) errors.country = "El país es obligatorio.";
    if (supplierForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supplierForm.email)) {
      errors.email = "Ingresa un correo válido.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    setDialogError("");
    try {
      await createSupplier(supplierForm);
      setSupplierOpen(false);
      setSuccess("Proveedor creado correctamente.");
      await load("suppliers", query);
    } catch (reason: unknown) {
      setFieldErrors(getApiFieldErrors(reason));
      setDialogError(getApiErrorMessage(reason, "No se pudo crear el proveedor."));
    } finally {
      setSaving(false);
    }
  };

  const openTransition = (action: PurchaseTransition) => {
    transitionKey.current = createIdempotencyKey(`purchase-${action}`);
    setTransitionReason("");
    setDialogError("");
    setTransition(action);
  };

  const runTransition = async () => {
    if (!selectedOrder || !transition) return;
    if (!transitionReason.trim()) {
      setDialogError("El motivo es obligatorio para mantener la trazabilidad.");
      return;
    }
    setSaving(true);
    setDialogError("");
    try {
      const updated = await transitionPurchaseOrder(
        selectedOrder.id, transition, transitionReason.trim(), transitionKey.current,
      );
      setSelectedOrder(updated);
      setTransition(null);
      setSuccess("Estado de la orden actualizado correctamente.");
      await load("orders", query);
    } catch (reason: unknown) {
      setDialogError(getApiErrorMessage(reason, "No se pudo actualizar la orden."));
    } finally {
      setSaving(false);
    }
  };

  const openReceipt = useCallback((commitment: PurchaseReceipt) => {
    setReceiptKey(createIdempotencyKey("purchase-receipt"));
    setSelectedCommitment(commitment);
    setReceiptQuantity("");
    setReceiptReason("");
    setDialogError("");
  }, []);

  const saveReceipt = async () => {
    if (!selectedCommitment) return;
    const quantity = Number(receiptQuantity);
    if (!receiptReason.trim() || quantity < 1 || quantity > selectedCommitment.pending_units) {
      setDialogError("Indica una cantidad válida y un motivo de recepción.");
      return;
    }
    setSaving(true);
    setDialogError("");
    try {
      await receivePurchaseCommitment(
        selectedCommitment.id, quantity, receiptReason.trim(), receiptKey,
      );
      setSelectedCommitment(null);
      setSuccess("Recepción registrada; Inventario y Kardex fueron actualizados.");
      await load("receipts", query);
    } catch (reason: unknown) {
      setDialogError(getApiErrorMessage(reason, "No se pudo registrar la recepción."));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (scope: "view" | "official") => {
    if (!count) {
      setError("No hay resultados para exportar. Ajusta o elimina los filtros.");
      return;
    }
    try {
      const blob = await exportPurchases(section, {
        ...buildPurchaseQueryParams(query),
        scope,
        columns: scope === "view" ? visibleColumns.join(",") : undefined,
      });
      downloadBlob(blob, `compras-${section}-${scope}.xlsx`);
      setSuccess("Archivo Excel generado correctamente.");
    } catch (reason: unknown) {
      setError(getApiErrorMessage(reason, "No se pudo exportar el archivo."));
    }
  };

  const applyNamedView = (config: SavedGridViewConfig) => {
    const list = (key: string) => {
      const value = config.filters[key];
      return typeof value === "string" ? value.split(",").filter(Boolean) : [];
    };
    const next: PurchaseQueryState = {
      search: typeof config.filters.search === "string" ? config.filters.search : "",
      statuses: list("status"),
      currencies: list("currency"),
      pagination: { page: 0, pageSize: config.page_size },
      sort: config.sort,
      columnFilters: Array.isArray(config.filters.column_filters)
        ? (config.filters.column_filters as SerkanGridFilter[])
        : [],
    };
    setSearch(next.search);
    setExpanded(Boolean(next.statuses.length || next.currencies.length || next.columnFilters.length));
    setQuery(next);
  };

  const columns: ColDef<Row>[] =
    section === "orders"
      ? (buildOrderColumns(setSelectedOrder) as ColDef<Row>[])
      : section === "suppliers"
        ? (buildSupplierColumns() as ColDef<Row>[])
        : (buildReceiptColumns(openReceipt) as ColDef<Row>[]);
  const statusOptions =
    section === "orders"
      ? PURCHASE_STATUSES
      : section === "suppliers"
        ? [
            { value: "ACTIVO", label: "Activo" },
            { value: "INACTIVO", label: "Inactivo" },
          ]
        : [
            { value: "PENDIENTE", label: "Pendiente" },
            { value: "PARCIAL", label: "Parcial" },
            { value: "RECIBIDA", label: "Recibida" },
            { value: "CANCELADA", label: "Cancelada" },
            { value: "CERRADA_PARCIAL", label: "Cerrada parcial" },
          ];

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Compras"
        subtitle="Órdenes, proveedores y recepciones conectadas con Inventario y Kardex."
        eyebrow="Abastecimiento"
        icon={<ReceiptLongIcon />}
        tone={colors.modules.purchases}
        actions={
          section === "orders" ? (
            <CapabilityGate capability="purchases.create_order">
              <Button variant="contained" startIcon={<AddShoppingCartIcon />} onClick={() => void openOrderDialog()}>
                Nueva orden
              </Button>
            </CapabilityGate>
          ) : section === "suppliers" ? (
            <CapabilityGate capability="purchases.manage_suppliers">
              <Button variant="contained" startIcon={<BusinessIcon />} onClick={() => {
                setSupplierForm(emptySupplier);
                setFieldErrors({});
                setDialogError("");
                setSupplierOpen(true);
              }}>
                Nuevo proveedor
              </Button>
            </CapabilityGate>
          ) : null
        }
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
        <MetricCard title="Resultados" value={String(count)} helper="Según los filtros actuales" icon={<ReceiptLongIcon />} tone={colors.modules.purchases} />
        <MetricCard title="Recepción física" value="Controlada" helper="Solo entonces cambia stock y Kardex" icon={<Inventory2Icon />} tone={colors.modules.inventory} />
        <MetricCard title="Monedas" value="CLP / USD" helper="Tipo de cambio congelado" icon={<BusinessIcon />} tone={colors.modules.analytics} />
      </Box>
      <ButtonGroup sx={{ alignSelf: "flex-start" }}>
        {(Object.keys(sections) as Section[]).map((key) => (
          <Button key={key} variant={section === key ? "contained" : "outlined"} onClick={() => changeSection(key)}>
            {sections[key].label}
          </Button>
        ))}
      </ButtonGroup>
      {success ? <Alert severity="success" onClose={() => setSuccess("")}>{success}</Alert> : null}
      {error ? <Alert severity="error" onClose={() => setError("")}>{error}</Alert> : null}
      <SectionCard
        title={sections[section].label}
        subtitle="Filtros remotos, vistas personales, columnas configurables y exportación."
        actions={
          <>
            <CapabilityGate capability="purchases.export_view">
              <Button startIcon={<DownloadIcon />} onClick={() => void handleExport("view")}>Exportar resultados filtrados</Button>
            </CapabilityGate>
            <CapabilityGate capability="purchases.export_official">
              <Button variant="outlined" onClick={() => void handleExport("official")}>Exportación oficial</Button>
            </CapabilityGate>
          </>
        }
      >
        <SerkanFilterToolbar
          searchLabel={`Buscar ${sections[section].label.toLowerCase()}`}
          searchPlaceholder="Número, proveedor, identificación o estado..."
          searchValue={search}
          onSearchValueChange={setSearch}
          onApply={() => updateQuery({ search })}
          onClear={() => {
            setSearch("");
            setQuery(emptyQuery());
            setExpanded(false);
            setFilterResetKey((value) => value + 1);
          }}
          loading={loading}
          expanded={expanded}
          onExpandedChange={setExpanded}
          activeFiltersCount={query.statuses.length + query.currencies.length + query.columnFilters.length}
          panelId={`purchases-${section}-filters`}
        >
          <SerkanMultiSelectFilter label="Estado" options={statusOptions} value={query.statuses} onChange={(statuses) => updateQuery({ statuses })} />
          {section === "orders" ? (
            <SerkanMultiSelectFilter
              label="Moneda"
              options={[{ value: "CLP", label: "CLP" }, { value: "USD", label: "USD" }]}
              value={query.currencies}
              onChange={(currencies) => updateQuery({ currencies })}
            />
          ) : null}
        </SerkanFilterToolbar>
        {loading && rows.length === 0 ? (
          <LoadingState message="Cargando Compras..." />
        ) : error && rows.length === 0 ? (
          <StateFeedback title="No se pudo mostrar esta sección" description={error} severity="error" actionLabel="Reintentar" onAction={() => void load(section, query)} />
        ) : (
          <SerkanDataGrid
            key={section}
            gridKey={sections[section].gridKey}
            serverManaged
            ariaLabel={sections[section].label}
            rows={rows}
            columns={columns}
            loading={loading}
            paginationModel={query.pagination}
            onPaginationModelChange={(pagination) => updateQuery({ pagination })}
            rowCount={count}
            sortModel={query.sort}
            onSortModelChange={(sort) => updateQuery({ sort })}
            onFilterModelChange={(columnFilters) => updateQuery({ columnFilters })}
            filterResetKey={filterResetKey}
            onVisibleColumnsChange={setVisibleColumns}
            namedViewFilters={{ search: query.search, status: query.statuses.join(","), currency: query.currencies.join(",") }}
            onNamedViewApply={applyNamedView}
          />
        )}
      </SectionCard>
      <PurchaseOrderDialog
        open={dialogOpen}
        form={form}
        suppliers={suppliers}
        products={products}
        locations={locations}
        errors={fieldErrors}
        generalError={dialogError}
        loading={saving}
        onChange={setForm}
        onClose={() => setDialogOpen(false)}
        onSave={() => void saveOrder()}
      />
      <SupplierDialog
        open={supplierOpen}
        loading={saving}
        error={dialogError}
        errors={fieldErrors}
        values={supplierForm}
        onChange={setSupplierForm}
        onClose={() => setSupplierOpen(false)}
        onSave={() => void saveSupplier()}
      />
      <OrderDetailDialog
        order={selectedOrder}
        loading={saving}
        onClose={() => setSelectedOrder(null)}
        onTransition={openTransition}
      />
      <TransitionReasonDialog
        open={Boolean(transition)}
        actionLabel="Confirmar cambio de estado"
        reason={transitionReason}
        error={dialogError}
        loading={saving}
        onReasonChange={setTransitionReason}
        onClose={() => setTransition(null)}
        onConfirm={() => void runTransition()}
      />
      <ReceiveCommitmentDialog
        commitment={selectedCommitment}
        quantity={receiptQuantity}
        reason={receiptReason}
        error={dialogError}
        loading={saving}
        onQuantityChange={setReceiptQuantity}
        onReasonChange={setReceiptReason}
        onClose={() => setSelectedCommitment(null)}
        onConfirm={() => void saveReceipt()}
      />
    </Stack>
  );
}
