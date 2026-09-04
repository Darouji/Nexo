import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AddLocationAltIcon from "@mui/icons-material/AddLocationAlt";
import DownloadIcon from "@mui/icons-material/Download";
import {
  Alert,
  Button,
  Stack,
} from "@mui/material";

import { CapabilityGate } from "../../components/CapabilityGate";
import {
  NexoDataGrid,
  type NexoGridFilter,
  type NexoGridPaginationModel,
  type NexoGridSortModel,
} from "../../components/NexoDataGrid";
import { NexoFilterToolbar } from "../../components/filters/NexoFilterToolbar";
import { NexoMultiSelectFilter } from "../../components/filters/NexoMultiSelectFilter";
import { LoadingState, StateFeedback } from "../../components/StateFeedback";
import { getApiErrorMessage, getApiFieldErrors } from "../../services/api";
import { downloadBlob } from "../../services/download";
import { createIdempotencyKey } from "../../services/idempotency";
import {
  fetchPurchaseOrders,
  serializeGridFilters,
  type PurchaseOrder,
} from "../../services/purchasesService";
import {
  createPurchaseShipment,
  exportPurchaseShipments,
  fetchCarrierSuggestions,
  fetchPurchaseShipment,
  fetchPurchaseShipments,
  fetchShipmentSummary,
  registerShipmentCharge,
  registerShipmentEvent,
  resolveCarrier,
  type Carrier,
  type PurchaseShipment,
  type ShipmentListParams,
  type ShipmentSummary,
} from "../../services/purchasesLogisticsService";
import type { SavedGridViewConfig } from "../../services/gridService";
import { buildShipmentColumns } from "./purchaseLogisticsColumns";
import {
  createEmptyShipmentChargeForm,
  createEmptyShipmentEventForm,
  createEmptyShipmentForm,
  SHIPMENT_MODE_OPTIONS,
  SHIPMENT_STATUS_OPTIONS,
  toShipmentChargePayload,
  toShipmentEventPayload,
  toShipmentPayload,
  validateShipmentChargeForm,
  validateShipmentEventForm,
  validateShipmentForm,
  type ShipmentChargeForm,
  type ShipmentEventForm,
  type ShipmentForm,
} from "./purchaseLogisticsModels";
import { PurchaseShipmentDetailDialog } from "./PurchaseShipmentDetailDialog";
import { PurchaseShipmentDialog } from "./PurchaseShipmentDialog";
import {
  PurchaseShipmentChargeDialog,
  PurchaseShipmentEventDialog,
} from "./PurchaseShipmentOperationDialogs";

type LogisticsQuery = {
  search: string;
  statuses: string[];
  modes: string[];
  pagination: NexoGridPaginationModel;
  sort: NexoGridSortModel;
  columnFilters: NexoGridFilter[];
};

const emptyQuery = (): LogisticsQuery => ({
  search: "",
  statuses: [],
  modes: [],
  pagination: { page: 0, pageSize: 10 },
  sort: null,
  columnFilters: [],
});

const emptySummary: ShipmentSummary = {
  orders_in_review: 0,
  open_shipments: 0,
  delayed_shipments: 0,
  customs_attention: 0,
  charges_in_dispute: 0,
};

function buildParams(query: LogisticsQuery): ShipmentListParams {
  return {
    search: query.search || undefined,
    status: query.statuses.length ? query.statuses.join(",") : undefined,
    transport_mode: query.modes.length ? query.modes.join(",") : undefined,
    ordering: query.sort
      ? `${query.sort.direction === "desc" ? "-" : ""}${query.sort.field}`
      : undefined,
    grid_filters: serializeGridFilters(query.columnFilters),
    page: query.pagination.page + 1,
    page_size: query.pagination.pageSize,
  };
}

type PurchaseLogisticsSectionProps = {
  initialOrder?: PurchaseOrder | null;
  onInitialOrderHandled?: () => void;
};

export function PurchaseLogisticsSection({
  initialOrder = null,
  onInitialOrderHandled,
}: PurchaseLogisticsSectionProps) {
  const [query, setQuery] = useState<LogisticsQuery>(emptyQuery);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [rows, setRows] = useState<PurchaseShipment[]>([]);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState(emptySummary);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const request = useRef<AbortController | null>(null);

  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm>(
    createEmptyShipmentForm,
  );
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [carrierOptions, setCarrierOptions] = useState<Carrier[]>([]);
  const [carrierSearch, setCarrierSearch] = useState("");
  const [carrierLoading, setCarrierLoading] = useState(false);
  const shipmentKey = useRef(createIdempotencyKey("purchase-shipment"));

  const [selected, setSelected] = useState<PurchaseShipment | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState<ShipmentEventForm>(
    createEmptyShipmentEventForm,
  );
  const eventKey = useRef(createIdempotencyKey("purchase-shipment-event"));
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState<ShipmentChargeForm>(
    createEmptyShipmentChargeForm,
  );
  const chargeKey = useRef(createIdempotencyKey("purchase-shipment-charge"));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState("");

  const load = useCallback(async (state: LogisticsQuery) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const [page, metrics] = await Promise.all([
        fetchPurchaseShipments(buildParams(state), controller.signal),
        fetchShipmentSummary(controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setRows(page.results);
        setCount(page.count);
        setSummary(metrics);
        setError("");
      }
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        setRows([]);
        setCount(0);
        setError(
          getApiErrorMessage(
            reason,
            "No se pudieron cargar los envíos e importaciones.",
          ),
        );
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), 0);
    return () => {
      window.clearTimeout(timer);
      request.current?.abort();
    };
  }, [load, query]);

  useEffect(() => {
    if (!shipmentOpen || shipmentForm.carrierId || carrierSearch.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarrierLoading(true);
      try {
        setCarrierOptions(
          await fetchCarrierSuggestions(carrierSearch.trim(), controller.signal),
        );
      } catch {
        if (!controller.signal.aborted) setCarrierOptions([]);
      } finally {
        if (!controller.signal.aborted) setCarrierLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [carrierSearch, shipmentForm.carrierId, shipmentOpen]);

  const updateQuery = (patch: Partial<LogisticsQuery>) =>
    setQuery((current) => ({
      ...current,
      ...patch,
      pagination: patch.pagination ?? { ...current.pagination, page: 0 },
    }));

  const openShipment = useCallback(async (preselectedOrder: PurchaseOrder | null = null) => {
    const nextForm = createEmptyShipmentForm();
    if (preselectedOrder) {
      nextForm.order = String(preselectedOrder.id);
    }
    setShipmentForm(nextForm);
    setOrders(preselectedOrder ? [preselectedOrder] : []);
    setCarrierOptions([]);
    setCarrierSearch("");
    setFieldErrors({});
    setDialogError("");
    shipmentKey.current = createIdempotencyKey("purchase-shipment");
    setShipmentOpen(true);
    try {
      const page = await fetchPurchaseOrders({
        status: "APROBADA,EMITIDA,PARCIALMENTE_RECIBIDA",
        page_size: 100,
      });
      setOrders(
        preselectedOrder && !page.results.some((order) => order.id === preselectedOrder.id)
          ? [preselectedOrder, ...page.results]
          : page.results,
      );
    } catch (reason: unknown) {
      setDialogError(
        getApiErrorMessage(
          reason,
          "No se pudieron cargar las órdenes disponibles.",
        ),
      );
    }
  }, []);

  useEffect(() => {
    if (!initialOrder) return;
    const timer = window.setTimeout(() => {
      void openShipment(initialOrder);
      onInitialOrderHandled?.();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialOrder, onInitialOrderHandled, openShipment]);

  const saveShipment = async () => {
    const errors = validateShipmentForm(shipmentForm);
    setFieldErrors(errors);
    setDialogError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const carrierId = shipmentForm.carrierId
        ? Number(shipmentForm.carrierId)
        : (await resolveCarrier(shipmentForm.carrierName.trim())).carrier.id;
      await createPurchaseShipment(
        toShipmentPayload(shipmentForm, carrierId),
        shipmentKey.current,
      );
      setShipmentOpen(false);
      setSuccess("El seguimiento logístico fue registrado correctamente.");
      await load(query);
    } catch (reason: unknown) {
      setFieldErrors(getApiFieldErrors(reason));
      setDialogError(
        getApiErrorMessage(reason, "No se pudo registrar el seguimiento."),
      );
    } finally {
      setSaving(false);
    }
  };

  const refreshSelected = async () => {
    if (!selected) return;
    setSelected(await fetchPurchaseShipment(selected.id));
  };

  const openEvent = () => {
    setEventForm(createEmptyShipmentEventForm());
    setFieldErrors({});
    setDialogError("");
    eventKey.current = createIdempotencyKey("purchase-shipment-event");
    setEventOpen(true);
  };

  const saveEvent = async () => {
    if (!selected) return;
    const errors = validateShipmentEventForm(eventForm);
    setFieldErrors(errors);
    setDialogError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await registerShipmentEvent(
        selected.id,
        toShipmentEventPayload(eventForm),
        eventKey.current,
      );
      setEventOpen(false);
      setSuccess("La novedad quedó registrada en el historial.");
      await Promise.all([refreshSelected(), load(query)]);
    } catch (reason: unknown) {
      setFieldErrors(getApiFieldErrors(reason));
      setDialogError(
        getApiErrorMessage(reason, "No se pudo registrar la novedad."),
      );
    } finally {
      setSaving(false);
    }
  };

  const openCharge = () => {
    setChargeForm(createEmptyShipmentChargeForm());
    setFieldErrors({});
    setDialogError("");
    chargeKey.current = createIdempotencyKey("purchase-shipment-charge");
    setChargeOpen(true);
  };

  const saveCharge = async () => {
    if (!selected) return;
    const errors = validateShipmentChargeForm(chargeForm);
    setFieldErrors(errors);
    setDialogError("");
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await registerShipmentCharge(
        selected.id,
        toShipmentChargePayload(chargeForm),
        chargeKey.current,
      );
      setChargeOpen(false);
      setSuccess("El cobro adicional quedó registrado.");
      await Promise.all([refreshSelected(), load(query)]);
    } catch (reason: unknown) {
      setFieldErrors(getApiFieldErrors(reason));
      setDialogError(
        getApiErrorMessage(reason, "No se pudo registrar el cobro."),
      );
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
      const blob = await exportPurchaseShipments({
        ...buildParams(query),
        scope,
        columns: scope === "view" ? visibleColumns.join(",") : undefined,
      });
      downloadBlob(blob, `compras-envios-${scope}.xlsx`);
      setSuccess("Archivo Excel generado correctamente.");
    } catch (reason: unknown) {
      setError(
        getApiErrorMessage(reason, "No se pudo exportar el archivo."),
      );
    }
  };

  const applyNamedView = (config: SavedGridViewConfig) => {
    const list = (key: string) => {
      const value = config.filters[key];
      return typeof value === "string"
        ? value.split(",").filter(Boolean)
        : [];
    };
    const next: LogisticsQuery = {
      search:
        typeof config.filters.search === "string"
          ? config.filters.search
          : "",
      statuses: list("status"),
      modes: list("transport_mode"),
      pagination: { page: 0, pageSize: config.page_size },
      sort: config.sort,
      columnFilters: Array.isArray(config.filters.column_filters)
        ? (config.filters.column_filters as NexoGridFilter[])
        : [],
    };
    setSearch(next.search);
    setExpanded(
      Boolean(
        next.statuses.length ||
          next.modes.length ||
          next.columnFilters.length,
      ),
    );
    setQuery(next);
  };

  const columns = useMemo(
    () => buildShipmentColumns(setSelected),
    [],
  );

  return (
    <Stack spacing={2}>
      {success ? (
        <Alert severity="success" onClose={() => setSuccess("")}>
          {success}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" onClose={() => setError("")}>
          {error}
        </Alert>
      ) : null}
      <Alert severity={summary.delayed_shipments ? "warning" : "info"}>
        {summary.open_shipments} envío(s) abiertos ·{" "}
        {summary.delayed_shipments} atrasado(s) ·{" "}
        {summary.customs_attention} con atención aduanera ·{" "}
        {summary.charges_in_dispute} cobro(s) en disputa.
      </Alert>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1}
        sx={{ justifyContent: "flex-end" }}
      >
        <CapabilityGate capability="purchases.create_shipment">
          <Button
            variant="contained"
            startIcon={<AddLocationAltIcon />}
            onClick={() => void openShipment()}
          >
            Registrar envío
          </Button>
        </CapabilityGate>
        <CapabilityGate capability="purchases.export_view">
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => void handleExport("view")}
          >
            Exportar resultados filtrados
          </Button>
        </CapabilityGate>
        <CapabilityGate capability="purchases.export_shipments_official">
          <Button
            variant="outlined"
            onClick={() => void handleExport("official")}
          >
            Exportación oficial
          </Button>
        </CapabilityGate>
      </Stack>

      <NexoFilterToolbar
        searchLabel="Buscar envíos e importaciones"
        searchPlaceholder="Orden, proveedor, transportista o seguimiento..."
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
        activeFiltersCount={
          query.statuses.length +
          query.modes.length +
          query.columnFilters.length
        }
        panelId="purchases-shipments-filters"
      >
        <NexoMultiSelectFilter
          label="Estado"
          options={SHIPMENT_STATUS_OPTIONS}
          value={query.statuses}
          onChange={(statuses) => updateQuery({ statuses })}
        />
        <NexoMultiSelectFilter
          label="Medio de transporte"
          options={SHIPMENT_MODE_OPTIONS}
          value={query.modes}
          onChange={(modes) => updateQuery({ modes })}
        />
      </NexoFilterToolbar>

      {loading && rows.length === 0 ? (
        <LoadingState message="Cargando envíos e importaciones..." />
      ) : error && rows.length === 0 ? (
        <StateFeedback
          title="No se pudo mostrar el seguimiento logístico"
          description={error}
          severity="error"
          actionLabel="Reintentar"
          onAction={() => void load(query)}
        />
      ) : (
        <NexoDataGrid
          gridKey="purchases.shipments"
          serverManaged
          ariaLabel="Envíos e importaciones"
          rows={rows}
          columns={columns}
          loading={loading}
          paginationModel={query.pagination}
          onPaginationModelChange={(pagination) =>
            updateQuery({ pagination })
          }
          rowCount={count}
          sortModel={query.sort}
          onSortModelChange={(sort) => updateQuery({ sort })}
          onFilterModelChange={(columnFilters) =>
            updateQuery({ columnFilters })
          }
          filterResetKey={filterResetKey}
          onVisibleColumnsChange={setVisibleColumns}
          namedViewFilters={{
            search: query.search,
            status: query.statuses.join(","),
            transport_mode: query.modes.join(","),
          }}
          onNamedViewApply={applyNamedView}
        />
      )}

      <PurchaseShipmentDialog
        open={shipmentOpen}
        form={shipmentForm}
        orders={orders}
        carrierOptions={carrierOptions}
        errors={fieldErrors}
        generalError={dialogError}
        loading={saving}
        carrierLoading={carrierLoading}
        onChange={(nextForm) => {
          setShipmentForm(nextForm);
          if (nextForm.carrierId) setCarrierLoading(false);
        }}
        onCarrierSearch={(value) => {
          setCarrierSearch(value);
          if (value.trim().length < 2) {
            setCarrierOptions([]);
            setCarrierLoading(false);
          }
        }}
        onClose={() => setShipmentOpen(false)}
        onSave={() => void saveShipment()}
      />
      <PurchaseShipmentDetailDialog
        shipment={selected}
        onClose={() => setSelected(null)}
        onAddEvent={openEvent}
        onAddCharge={openCharge}
      />
      <PurchaseShipmentEventDialog
        open={eventOpen}
        form={eventForm}
        errors={fieldErrors}
        generalError={dialogError}
        loading={saving}
        onChange={setEventForm}
        onClose={() => setEventOpen(false)}
        onSave={() => void saveEvent()}
      />
      <PurchaseShipmentChargeDialog
        open={chargeOpen}
        form={chargeForm}
        errors={fieldErrors}
        generalError={dialogError}
        loading={saving}
        onChange={setChargeForm}
        onClose={() => setChargeOpen(false)}
        onSave={() => void saveCharge()}
      />
    </Stack>
  );
}
