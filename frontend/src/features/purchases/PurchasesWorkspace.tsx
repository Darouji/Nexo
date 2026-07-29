import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  cancelPhysicalReceipt,
  createPurchaseOrder,
  createSupplier,
  exportPurchases,
  fetchPhysicalReceiptHistory,
  fetchPurchaseOrders,
  fetchPurchaseReceipts,
  fetchSuppliers,
  receivePhysicalReceipt,
  transitionPurchaseOrder,
  type PurchaseOrder,
  type PurchaseReceipt,
  type PurchaseReceiptHistory,
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
  purchaseTaxRateForCountry,
  validatePurchaseOrderForm,
  type PurchaseOrderForm,
} from "./purchaseModels";
import { buildPurchaseQueryParams, type PurchaseQueryState } from "./purchaseQueryParams";
import { PurchaseOrderDialog } from "./PurchaseOrderDialog";
import {
  OrderDetailDialog,
  PhysicalReceiptHistoryDialog,
  ReceiveCommitmentDialog,
  SupplierDialog,
  TransitionReasonDialog,
  type PurchaseTransition,
} from "./PurchaseOperationsDialogs";
import { PurchaseLogisticsSection } from "./PurchaseLogisticsSection";

type Section = "orders" | "suppliers" | "shipments" | "receipts";
type Row = PurchaseOrder | Supplier | PurchaseReceipt;
const sections: Record<Section, { label: string; gridKey: string }> = {
  orders: { label: "Órdenes", gridKey: "purchases.orders" },
  suppliers: { label: "Proveedores", gridKey: "purchases.suppliers" },
  shipments: { label: "Envíos e importaciones", gridKey: "purchases.shipments" },
  receipts: { label: "Recepción física", gridKey: "inventory.pending-receipts" },
};
const RECEIPT_EXPORTABLE_COLUMNS = new Set([
  "producto__modelo_normalized",
  "producto__categoria__name_normalized",
  "producto__codigo_sap_normalized",
  "destination_location__name_normalized",
  "cantidad_original",
  "cantidad_recibida",
  "cantidad_cancelada",
  "cantidad_pendiente_orden",
  "estado",
  "referencia",
  "motivo",
  "created_by__username",
  "created_at",
]);
const emptyQuery = (): PurchaseQueryState => ({
  search: "",
  statuses: [],
  currencies: [],
  pagination: { page: 0, pageSize: 10 },
  sort: null,
  columnFilters: [],
});

export function PurchasesWorkspace() {
  const navigate = useNavigate();
  const [section, setSection] = useState<Section>(() => window.location.pathname.replace(/\/+$/, "") === "/compras/recepcion" ? "receipts" : "orders");
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
  const [optionsError, setOptionsError] = useState("");
  const [loadingOrderOptions, setLoadingOrderOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const creationKey = useRef(createIdempotencyKey("purchase-order"));
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const emptySupplier: SupplierPayload = { tax_id: "", name: "", trade_name: "", country: "", contact_name: "", email: "", phone: "", active: true };
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierPayload>(emptySupplier);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [shipmentOrder, setShipmentOrder] = useState<PurchaseOrder | null>(null);
  const [transition, setTransition] = useState<PurchaseTransition | null>(null);
  const [transitionReason, setTransitionReason] = useState("");
  const transitionKey = useRef(createIdempotencyKey("purchase-transition"));
  const [selectedCommitment, setSelectedCommitment] = useState<PurchaseReceipt | null>(null);
  const [receiptMode, setReceiptMode] = useState<"RECEIVE" | "CANCEL">("RECEIVE");
  const [receiptQuantity, setReceiptQuantity] = useState("");
  const [receiptReason, setReceiptReason] = useState("");
  const [receiptKey, setReceiptKey] = useState(() => createIdempotencyKey("purchase-receipt"));
  const [historyReceipt, setHistoryReceipt] = useState<PurchaseReceipt | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<PurchaseReceiptHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const load = useCallback(async (target: Section, state: PurchaseQueryState) => {
    if (target === "shipments") {
      request.current?.abort();
      setLoading(false);
      return;
    }
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
    navigate(target === "receipts" ? "/compras/recepcion" : "/compras");
    setSection(target);
    setRows([]);
    setCount(0);
    setSearch("");
    setExpanded(false);
    setQuery(emptyQuery());
    setFilterResetKey((value) => value + 1);
  };

  const registerShipmentForOrder = (order: PurchaseOrder) => {
    setShipmentOrder(order);
    setSelectedOrder(null);
    changeSection("shipments");
  };

  const openOrderDialog = async () => {
    setForm(createEmptyPurchaseOrderForm());
    creationKey.current = createIdempotencyKey("purchase-order");
    setFieldErrors({});
    setDialogError("");
    setOptionsError("");
    setLoadingOrderOptions(true);
    setDialogOpen(true);
    try {
      const [supplierPage, productRows, locationRows] = await Promise.all([
        fetchSuppliers({ page_size: 100 }),
        fetchProducts({ status: "ACTIVO" }),
        fetchInventoryLocations({ status: "ACTIVO" }),
      ]);
      setSuppliers(supplierPage.results.filter((supplier) => supplier.active));
      setProducts(productRows);
      setLocations(locationRows);
    } catch {
      setOptionsError(
        "No se pudieron cargar proveedores, productos o ubicaciones. Cierra el formulario y vuelve a intentarlo.",
      );
    } finally {
      setLoadingOrderOptions(false);
    }
  };

  const saveOrder = async () => {
    setDialogError("");
    const errors = validatePurchaseOrderForm(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const selectedSupplier = suppliers.find((supplier) => supplier.id === Number(form.supplier));
      const taxRate = purchaseTaxRateForCountry(selectedSupplier?.country);
      await createPurchaseOrder(
        toPurchaseOrderPayload(form, taxRate),
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

  const openReceiptOperation = useCallback((commitment: PurchaseReceipt, mode: "RECEIVE" | "CANCEL") => {
    setReceiptKey(createIdempotencyKey(mode === "RECEIVE" ? "physical-receipt" : "physical-receipt-cancel"));
    setReceiptMode(mode);
    setSelectedCommitment(commitment);
    setReceiptQuantity("");
    setReceiptReason("");
    setDialogError("");
  }, []);

  const openReceiptHistory = useCallback(async (receipt: PurchaseReceipt) => {
    setHistoryReceipt(receipt);
    setReceiptHistory([]);
    setHistoryError("");
    setHistoryLoading(true);
    try {
      setReceiptHistory(await fetchPhysicalReceiptHistory(receipt.id));
    } catch (reason: unknown) {
      setHistoryError(getApiErrorMessage(reason, "No se pudo cargar el historial."));
    } finally {
      setHistoryLoading(false);
    }
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
      if (receiptMode === "RECEIVE") {
        await receivePhysicalReceipt(
          selectedCommitment.id, quantity, receiptReason.trim(), receiptKey,
        );
      } else {
        await cancelPhysicalReceipt(
          selectedCommitment.id, quantity, receiptReason.trim(), receiptKey,
        );
      }
      setSelectedCommitment(null);
      setSuccess(
        receiptMode === "RECEIVE"
          ? "Recepción registrada; Inventario y Kardex fueron actualizados."
          : "Unidades pendientes canceladas con trazabilidad.",
      );
      await load("receipts", query);
    } catch (reason: unknown) {
      setDialogError(getApiErrorMessage(reason, receiptMode === "RECEIVE" ? "No se pudo registrar la recepción." : "No se pudo cancelar el pendiente."));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (scope: "view" | "official") => {
    if (section === "shipments") return;
    if (!count) {
      setError("No hay resultados para exportar. Ajusta o elimina los filtros.");
      return;
    }
    try {
      const blob = await exportPurchases(section, {
        ...buildPurchaseQueryParams(query),
        scope,
        columns: scope === "view"
          ? (section === "receipts"
              ? visibleColumns.filter((column) => RECEIPT_EXPORTABLE_COLUMNS.has(column))
              : visibleColumns
            ).join(",")
          : undefined,
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
    section === "shipments"
      ? []
      : section === "orders"
      ? (buildOrderColumns(setSelectedOrder) as ColDef<Row>[])
      : section === "suppliers"
        ? (buildSupplierColumns() as ColDef<Row>[])
        : (buildReceiptColumns({ onReceive: (receipt) => openReceiptOperation(receipt, "RECEIVE"), onCancel: (receipt) => openReceiptOperation(receipt, "CANCEL"), onHistory: (receipt) => void openReceiptHistory(receipt) }) as ColDef<Row>[]);
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
        subtitle="Órdenes, seguimiento logístico y recepción física conectados con Inventario y Kardex."
        eyebrow="Abastecimiento"
        icon={<ReceiptLongIcon />}
        tone={colors.modules.purchases}
      />
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 2 }}>
        <MetricCard
          title={section === "shipments" ? "Control logístico" : "Resultados"}
          value={section === "shipments" ? "En vivo" : String(count)}
          helper={section === "shipments" ? "Plazos, Aduanas e incidencias" : "Según los filtros actuales"}
          icon={<ReceiptLongIcon />}
          tone={colors.modules.purchases}
        />
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
          section !== "shipments" ? (
            <>
              {section === "orders" ? (
                <CapabilityGate capability="purchases.create_order">
                  <Button
                    variant="contained"
                    startIcon={<AddShoppingCartIcon />}
                    onClick={() => void openOrderDialog()}
                  >
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
              ) : null}
            <CapabilityGate capability="purchases.export_view">
              <Button startIcon={<DownloadIcon />} onClick={() => void handleExport("view")}>Exportar resultados filtrados</Button>
            </CapabilityGate>
            <CapabilityGate capability="purchases.export_official">
              <Button variant="outlined" onClick={() => void handleExport("official")}>Exportación oficial</Button>
            </CapabilityGate>
            </>
          ) : undefined
        }
      >
        {section === "shipments" ? (
          <PurchaseLogisticsSection
            initialOrder={shipmentOrder}
            onInitialOrderHandled={() => setShipmentOrder(null)}
          />
        ) : (
          <>
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
          </>
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
        optionsError={optionsError}
        optionsLoading={loadingOrderOptions}
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
        onRegisterShipment={registerShipmentForOrder}
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
      <PhysicalReceiptHistoryDialog
        receipt={historyReceipt}
        operations={receiptHistory}
        loading={historyLoading}
        error={historyError}
        onClose={() => setHistoryReceipt(null)}
      />
      <ReceiveCommitmentDialog
        commitment={selectedCommitment}
        mode={receiptMode}
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
