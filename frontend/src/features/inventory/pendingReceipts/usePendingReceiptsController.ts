import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  SerkanGridFilter,
  SerkanGridPaginationModel,
  SerkanGridSortModel,
} from "../../../components/SerkanDataGrid";
import { getApiErrorMessage } from "../../../services/api";
import { downloadBlob } from "../../../services/download";
import type { SavedGridViewConfig } from "../../../services/gridService";
import {
  exportPendingReceipts,
  fetchPendingReceiptHistory,
  fetchPendingReceiptsPage,
  type PendingReceipt,
  type PendingReceiptOperation,
  type PendingReceiptStatus,
} from "../../../services/inventoryService";
import {
  defaultPendingReceiptPaginationModel,
  type PendingReceiptFilterOverrides,
} from "../state/inventoryPageState";
import { buildPendingReceiptPageParams } from "../utils/inventoryQueryParams";

type PendingReceiptsControllerOptions = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  enabled?: boolean;
};

export function usePendingReceiptsController({
  onError,
  onSuccess,
  enabled = true,
}: PendingReceiptsControllerOptions) {
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [paginationModel, setPaginationModel] =
    useState<SerkanGridPaginationModel>(defaultPendingReceiptPaginationModel);
  const [sortModel, setSortModel] = useState<SerkanGridSortModel>({
    field: "created_at",
    direction: "desc",
  });
  const [ordering, setOrdering] = useState("-created_at");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<PendingReceiptStatus[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [columnFilters, setColumnFilters] = useState<SerkanGridFilter[]>([]);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [exporting, setExporting] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPendingReceipt, setHistoryPendingReceipt] =
    useState<PendingReceipt | null>(null);
  const [historyOperations, setHistoryOperations] = useState<
    PendingReceiptOperation[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const requestSequenceRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const buildParams = useCallback(
    (filters: PendingReceiptFilterOverrides = {}) =>
      buildPendingReceiptPageParams(filters, {
        searchTerm,
        statusFilter,
        dateFrom,
        dateTo,
        ordering,
        paginationModel,
        columnFilters,
      }),
    [
      columnFilters,
      dateFrom,
      dateTo,
      ordering,
      paginationModel,
      searchTerm,
      statusFilter,
    ],
  );

  const loadPendingReceipts = useCallback(
    async (filters: PendingReceiptFilterOverrides = {}) => {
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const requestSequence = ++requestSequenceRef.current;

      try {
        setLoading(true);
        onError("");
        const data = await fetchPendingReceiptsPage(
          buildParams(filters),
          abortController.signal,
        );

        if (requestSequence !== requestSequenceRef.current) {
          return;
        }

        setPendingReceipts(data.results);
        setRowCount(data.count);
      } catch (error: unknown) {
        if (!axios.isCancel(error)) {
          onError(getApiErrorMessage(error));
        }
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      }
    },
    [buildParams, onError],
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const requestSequence = ++requestSequenceRef.current;

    void fetchPendingReceiptsPage(
      {
        ordering: "-created_at",
        page: 1,
        page_size: defaultPendingReceiptPaginationModel.pageSize,
      },
      abortController.signal,
    )
      .then((data) => {
        if (requestSequence === requestSequenceRef.current) {
          setPendingReceipts(data.results);
          setRowCount(data.count);
          onError("");
        }
      })
      .catch((error: unknown) => {
        if (!axios.isCancel(error)) {
          onError(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (requestSequence === requestSequenceRef.current) {
          setLoading(false);
        }
      });

    return () => abortController.abort();
  }, [enabled, onError]);

  const loadFirstPage = useCallback(
    (filters: PendingReceiptFilterOverrides = {}) => {
      const nextPaginationModel = { ...paginationModel, page: 0 };
      setPaginationModel(nextPaginationModel);
      void loadPendingReceipts({
        ...filters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadPendingReceipts, paginationModel],
  );

  const changePagination = useCallback(
    (nextPaginationModel: SerkanGridPaginationModel) => {
      setPaginationModel(nextPaginationModel);
      void loadPendingReceipts({
        page: nextPaginationModel.page,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadPendingReceipts],
  );

  const changeSort = useCallback(
    (nextSortModel: SerkanGridSortModel) => {
      const nextOrdering = nextSortModel
        ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
        : "-created_at";
      const nextPaginationModel = { ...paginationModel, page: 0 };

      setSortModel(nextSortModel);
      setOrdering(nextOrdering);
      setPaginationModel(nextPaginationModel);
      void loadPendingReceipts({
        ordering: nextOrdering,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadPendingReceipts, paginationModel],
  );

  const changeColumnFilters = useCallback(
    (nextFilters: SerkanGridFilter[]) => {
      const nextPaginationModel = { ...paginationModel, page: 0 };
      setColumnFilters(nextFilters);
      setPaginationModel(nextPaginationModel);
      void loadPendingReceipts({
        columnFilters: nextFilters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadPendingReceipts, paginationModel],
  );

  const clearFilters = useCallback(() => {
    setSearchTerm("");
    setStatusFilter([]);
    setDateFrom("");
    setDateTo("");
    setColumnFilters([]);
    setFilterResetKey((current) => current + 1);
    loadFirstPage({
      search: "",
      status: [],
      dateFrom: "",
      dateTo: "",
      columnFilters: [],
    });
  }, [loadFirstPage]);

  const applyNamedView = useCallback(
    (config: SavedGridViewConfig) => {
      const readFilter = (key: string) => {
        const value = config.filters[key];
        return typeof value === "string" ? value : "";
      };
      const savedColumnFilters = config.filters.column_filters;
      const nextColumnFilters = Array.isArray(savedColumnFilters)
        ? (savedColumnFilters as SerkanGridFilter[])
        : [];
      const nextSearch = readFilter("search");
      const savedStatus = config.filters.status;
      const nextStatus = (
        typeof savedStatus === "string" && savedStatus
          ? savedStatus.split(",")
          : []
      ) as PendingReceiptStatus[];
      const nextDateFrom = readFilter("date_from");
      const nextDateTo = readFilter("date_to");
      const nextSortModel = config.sort;
      const nextOrdering = nextSortModel
        ? `${nextSortModel.direction === "desc" ? "-" : ""}${nextSortModel.field}`
        : "-created_at";
      const nextPaginationModel = { page: 0, pageSize: config.page_size };

      setSearchTerm(nextSearch);
      setStatusFilter(nextStatus);
      setDateFrom(nextDateFrom);
      setDateTo(nextDateTo);
      setColumnFilters(nextColumnFilters);
      setSortModel(nextSortModel);
      setOrdering(nextOrdering);
      setPaginationModel(nextPaginationModel);

      void loadPendingReceipts({
        search: nextSearch,
        status: nextStatus,
        dateFrom: nextDateFrom,
        dateTo: nextDateTo,
        ordering: nextOrdering,
        columnFilters: nextColumnFilters,
        page: 0,
        pageSize: nextPaginationModel.pageSize,
      });
    },
    [loadPendingReceipts],
  );

  const exportGrid = useCallback(
    async (mode: "view" | "official") => {
      try {
        setExporting(true);
        onError("");
        const { blob, filename } = await exportPendingReceipts({
          ...buildParams({}),
          mode,
          file_format: "xlsx",
          columns: mode === "view" ? visibleColumns : undefined,
        });
        downloadBlob(blob, filename);
        onSuccess(
          mode === "official"
            ? "Exportación oficial de pendientes generada correctamente."
            : "La vista de pendientes se exportó correctamente.",
        );
      } catch (error: unknown) {
        onError(
          getApiErrorMessage(
            error,
            "No se pudo exportar los pendientes por recibir.",
          ),
        );
      } finally {
        setExporting(false);
      }
    },
    [buildParams, onError, onSuccess, visibleColumns],
  );

  const openHistory = useCallback(async (pendingReceipt: PendingReceipt) => {
    setHistoryOpen(true);
    setHistoryPendingReceipt(pendingReceipt);
    setHistoryOperations([]);
    setHistoryError("");
    setHistoryLoading(true);

    try {
      setHistoryOperations(
        await fetchPendingReceiptHistory(pendingReceipt.id),
      );
    } catch (error: unknown) {
      setHistoryError(
        getApiErrorMessage(
          error,
          "No se pudo cargar el historial de este pendiente.",
        ),
      );
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const closeHistory = useCallback(() => {
    setHistoryOpen(false);
    setHistoryPendingReceipt(null);
    setHistoryOperations([]);
    setHistoryError("");
  }, []);

  return {
    pendingReceipts,
    rowCount,
    paginationModel,
    sortModel,
    ordering,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    columnFilters,
    filterResetKey,
    visibleColumns,
    setVisibleColumns,
    loading,
    exporting,
    historyOpen,
    historyPendingReceipt,
    historyOperations,
    historyLoading,
    historyError,
    loadPendingReceipts,
    loadFirstPage,
    changePagination,
    changeSort,
    changeColumnFilters,
    clearFilters,
    applyNamedView,
    exportGrid,
    openHistory,
    closeHistory,
  };
}
