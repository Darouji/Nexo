/**
 * Controlador de ubicaciones físicas, saldos distribuidos y transferencias.
 *
 * Coordina la experiencia de la pantalla y sus formularios. La integridad del
 * movimiento —origen, destino, cantidad, bloqueo e idempotencia— debe seguir
 * siendo validada transaccionalmente por el backend.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getApiErrorMessage,
  getApiFieldErrors,
} from "../../../services/api";
import { getStoredAccess } from "../../../services/authService";
import { fetchCollaborators } from "../../../services/collaboratorService";
import { createIdempotencyKey } from "../../../services/idempotency";
import {
  archiveInventoryLocation,
  createInventoryLocation,
  createInventoryTransfer,
  fetchInventoryLocations,
  fetchInventoryTransfers,
  fetchProductLocationBalances,
  fetchProductLocationBalancesPage,
  updateInventoryLocation,
  type InventoryLocation,
  type InventoryLocationType,
  type InventoryTransfer,
  type ProductLocationBalance,
} from "../../../services/inventoryService";
import type { Collaborator } from "../../../services/collaboratorService";

export type LocationFormState = {
  open: boolean;
  editing: InventoryLocation | null;
  name: string;
  locationType: InventoryLocationType;
  custodian: string;
  city: string;
  description: string;
};

export type TransferFormState = {
  open: boolean;
  product: string;
  originLocation: string;
  destinationLocation: string;
  quantity: string;
  reason: string;
  evidenceReference: string;
  idempotencyKey: string;
};

export type ArchiveLocationState = {
  location: InventoryLocation | null;
  reason: string;
};

export const emptyLocationForm: LocationFormState = {
  open: false,
  editing: null,
  name: "",
  locationType: "BODEGA",
  custodian: "",
  city: "",
  description: "",
};

export const emptyTransferForm: TransferFormState = {
  open: false,
  product: "",
  originLocation: "",
  destinationLocation: "",
  quantity: "",
  reason: "",
  evidenceReference: "",
  idempotencyKey: "",
};

export const emptyArchiveLocation: ArchiveLocationState = {
  location: null,
  reason: "",
};

type ControllerOptions = {
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
  onInventoryChanged?: () => void | Promise<void>;
  onLocationsChanged?: () => void | Promise<void>;
};

export function useInventoryLocationsController({
  onError,
  onSuccess,
  onInventoryChanged,
  onLocationsChanged,
}: ControllerOptions) {
  const [locations, setLocations] = useState<InventoryLocation[]>([]);
  const [balances, setBalances] = useState<ProductLocationBalance[]>([]);
  const [balanceCount, setBalanceCount] = useState(0);
  const [balancePage, setBalancePage] = useState(0);
  const [balancePageSize, setBalancePageSize] = useState(25);
  const [transferBalances, setTransferBalances] = useState<
    ProductLocationBalance[]
  >([]);
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locationForm, setLocationForm] =
    useState<LocationFormState>(emptyLocationForm);
  const [transferForm, setTransferForm] =
    useState<TransferFormState>(emptyTransferForm);
  const [transferErrorMessage, setTransferErrorMessage] = useState("");
  const [transferFieldErrors, setTransferFieldErrors] = useState<
    Record<string, string>
  >({});
  const [archiveState, setArchiveState] =
    useState<ArchiveLocationState>(emptyArchiveLocation);

  // Estas capacidades solo gobiernan la visibilidad de acciones. Los endpoints
  // vuelven a autorizar cada creación, edición, archivo o transferencia.
  const access = getStoredAccess();
  const canManageLocations = Boolean(
    access?.capabilities?.["inventory.manage_locations"],
  );
  const canTransferStock = Boolean(
    access?.capabilities?.["inventory.transfer_stock"],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [nextLocations, nextBalancesPage, nextTransfers] = await Promise.all([
        fetchInventoryLocations(),
        fetchProductLocationBalancesPage({
          positiveOnly: true,
          page: balancePage + 1,
          pageSize: balancePageSize,
        }),
        fetchInventoryTransfers(),
      ]);
      setLocations(nextLocations);
      setBalances(nextBalancesPage.results);
      setBalanceCount(nextBalancesPage.count);
      setTransfers(nextTransfers);
      onError("");
    } catch (error: unknown) {
      onError(
        getApiErrorMessage(
          error,
          "No se pudieron cargar las ubicaciones de inventario.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [balancePage, balancePageSize, onError]);

  // La carga inicial obtiene en paralelo la estructura física, los saldos positivos
  // y el historial de transferencias para formar una vista operativa coherente.
  useEffect(() => {
    let active = true;

    Promise.all([
      fetchInventoryLocations(),
      fetchProductLocationBalancesPage({
        positiveOnly: true,
        page: 1,
        pageSize: 25,
      }),
      fetchInventoryTransfers(),
    ])
      .then(([nextLocations, nextBalancesPage, nextTransfers]) => {
        if (!active) {
          return;
        }
        setLocations(nextLocations);
        setBalances(nextBalancesPage.results);
        setBalanceCount(nextBalancesPage.count);
        setTransfers(nextTransfers);
        onError("");
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        onError(
          getApiErrorMessage(
            error,
            "No se pudieron cargar las ubicaciones de inventario.",
          ),
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [onError]);

  const activeLocations = useMemo(
    () => locations.filter((location) => location.status === "ACTIVO"),
    [locations],
  );

  const changeBalancePagination = async (
    nextPage: number,
    nextPageSize: number,
  ) => {
    try {
      setLoading(true);
      const pageData = await fetchProductLocationBalancesPage({
        positiveOnly: true,
        page: nextPage + 1,
        pageSize: nextPageSize,
      });
      setBalancePage(nextPage);
      setBalancePageSize(nextPageSize);
      setBalances(pageData.results);
      setBalanceCount(pageData.count);
    } catch (error: unknown) {
      onError(getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  // Solo los saldos positivos del producto pueden actuar como origen de un traslado.
  // Esta preselección orienta al usuario, pero el backend comprueba nuevamente stock.
  const originBalances = useMemo(() => {
    const productId = Number(transferForm.product);
    return transferBalances.filter(
      (balance) => balance.product === productId && balance.quantity > 0,
    );
  }, [transferBalances, transferForm.product]);

  const loadCollaborators = useCallback(async () => {
    if (collaborators.length > 0) {
      return;
    }
    try {
      const data = await fetchCollaborators({ status: "ACTIVO" });
      setCollaborators(data);
    } catch (error: unknown) {
      onError(
        getApiErrorMessage(
          error,
          "No se pudieron cargar los colaboradores disponibles.",
        ),
      );
    }
  }, [collaborators.length, onError]);

  const openCreateLocation = () => {
    setLocationForm({ ...emptyLocationForm, open: true });
    void loadCollaborators();
  };

  const openEditLocation = (location: InventoryLocation) => {
    setLocationForm({
      open: true,
      editing: location,
      name: location.name,
      locationType: location.location_type,
      custodian: location.custodian ? String(location.custodian) : "",
      city: location.city,
      description: location.description,
    });
    void loadCollaborators();
  };

  const closeLocationForm = () => setLocationForm(emptyLocationForm);

  const saveLocation = async () => {
    try {
      setSaving(true);
      onError("");
      const payload = {
        name: locationForm.name,
        location_type: locationForm.locationType,
        // El custodio solo corresponde a domicilios bajo custodia; para otros tipos
        // se envía null para evitar relaciones residuales al cambiar la clasificación.
        custodian:
          locationForm.locationType === "DOMICILIO_CUSTODIA" &&
          locationForm.custodian
            ? Number(locationForm.custodian)
            : null,
        city: locationForm.city,
        description: locationForm.description,
      };
      if (locationForm.editing) {
        await updateInventoryLocation(locationForm.editing.id, payload);
        onSuccess("Ubicación actualizada correctamente.");
      } else {
        await createInventoryLocation(payload);
        onSuccess("Ubicación creada correctamente.");
      }
      closeLocationForm();
      await loadData();
      await onLocationsChanged?.();
    } catch (error: unknown) {
      onError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const requestArchiveLocation = (location: InventoryLocation) => {
    setArchiveState({ location, reason: "" });
  };

  // Archivar conserva el registro y su trazabilidad; no representa una eliminación
  // física ni debe desvincular saldos o movimientos históricos existentes.
  const archiveLocation = async () => {
    if (!archiveState.location) {
      return;
    }
    try {
      setSaving(true);
      onError("");
      await archiveInventoryLocation(
        archiveState.location.id,
        archiveState.reason,
      );
      setArchiveState(emptyArchiveLocation);
      onSuccess("Ubicación archivada correctamente.");
      await loadData();
      await onLocationsChanged?.();
    } catch (error: unknown) {
      onError(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = (
    productId: number,
    originLocationId: number,
  ) => {
    setTransferErrorMessage("");
    setTransferFieldErrors({});
    setTransferForm({
      ...emptyTransferForm,
      open: true,
      product: productId ? String(productId) : "",
      originLocation: "",
      // La clave permanece estable durante este intento para que un reenvío del mismo
      // formulario no genere dos transferencias por doble clic o recuperación de red.
      idempotencyKey: createIdempotencyKey("inventory-transfer"),
    });
    void fetchProductLocationBalances({
      product: productId,
      positiveOnly: true,
    })
      .then((nextBalances) => {
        setTransferBalances(nextBalances);
        setTransferForm((current) => ({
          ...current,
          originLocation: String(originLocationId),
        }));
      })
      .catch((error: unknown) =>
        setTransferErrorMessage(getApiErrorMessage(error)),
      );
  };

  const closeTransfer = () => {
    setTransferForm(emptyTransferForm);
    setTransferBalances([]);
    setTransferErrorMessage("");
    setTransferFieldErrors({});
  };

  const clearTransferFieldError = (field: string) => {
    setTransferFieldErrors((errors) => {
      const nextErrors = { ...errors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  /**
   * Una transferencia redistribuye el saldo entre ubicaciones y no modifica el
   * stock total del producto. El backend debe registrar ambos lados del movimiento
   * dentro de una única operación auditable.
   */
  const saveTransfer = async () => {
    try {
      setSaving(true);
      setTransferErrorMessage("");
      setTransferFieldErrors({});
      await createInventoryTransfer(
        {
          product: Number(transferForm.product),
          origin_location: Number(transferForm.originLocation),
          destination_location: Number(transferForm.destinationLocation),
          quantity: Number(transferForm.quantity),
          reason: transferForm.reason.trim(),
          evidence_reference: transferForm.evidenceReference.trim() || undefined,
        },
        transferForm.idempotencyKey,
      );
      closeTransfer();
      onSuccess("Transferencia registrada sin alterar el stock total.");
      await loadData();
      await onInventoryChanged?.();
    } catch (error: unknown) {
      const fieldErrors = getApiFieldErrors(error);
      setTransferFieldErrors(fieldErrors);
      setTransferErrorMessage(
        Object.keys(fieldErrors).length > 0
          ? ""
          : getApiErrorMessage(error),
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    locations,
    activeLocations,
    balances,
    balanceCount,
    balancePage,
    balancePageSize,
    changeBalancePagination,
    transfers,
    collaborators,
    originBalances,
    loading,
    saving,
    canManageLocations,
    canTransferStock,
    locationForm,
    setLocationForm,
    transferForm,
    setTransferForm,
    transferErrorMessage,
    transferFieldErrors,
    clearTransferFieldError,
    archiveState,
    setArchiveState,
    loadData,
    openCreateLocation,
    openEditLocation,
    closeLocationForm,
    saveLocation,
    requestArchiveLocation,
    archiveLocation,
    openTransfer,
    closeTransfer,
    saveTransfer,
  };
}
