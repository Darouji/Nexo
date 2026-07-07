import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import EditIcon from "@mui/icons-material/Edit";
import type { GridColDef } from "@mui/x-data-grid";
import { SmartDataGrid } from "../../../components/SmartDataGrid";
import { getApiErrorMessage as getErrorMessage } from "../../../services/api";
import {
  createCategory,
  deleteCategorySafely,
  mergeCategories,
  renameCategory,
  updateCategory,
} from "../../../services/inventoryService";
import type { Category } from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

type CategoryManagerDialogProps = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCategoriesChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
  onClearFeedback: () => void;
};

type FeedbackState = {
  severity: "success" | "error";
  message: string;
} | null;

type CreateCategoryFormState = {
  name: string;
  description: string;
};

type DescriptionDialogState = {
  open: boolean;
  category: Category | null;
  description: string;
};

type RenameDialogState = {
  open: boolean;
  category: Category | null;
  name: string;
  motivo: string;
};

type MergeDialogState = {
  open: boolean;
  sourceCategory: Category | null;
  destinationCategory: Category | null;
  motivo: string;
};

type DeleteDialogState = {
  open: boolean;
  category: Category | null;
  motivo: string;
};

const emptyCreateCategoryForm: CreateCategoryFormState = {
  name: "",
  description: "",
};

const emptyDescriptionDialog: DescriptionDialogState = {
  open: false,
  category: null,
  description: "",
};

const emptyRenameDialog: RenameDialogState = {
  open: false,
  category: null,
  name: "",
  motivo: "",
};

const emptyMergeDialog: MergeDialogState = {
  open: false,
  sourceCategory: null,
  destinationCategory: null,
  motivo: "",
};

const emptyDeleteDialog: DeleteDialogState = {
  open: false,
  category: null,
  motivo: "",
};

function getCategoryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVO: "Activo",
    INACTIVO: "Inactivo",
    ARCHIVADO: "Archivado",
  };

  return labels[status] || "Sin estado";
}

function getAvailabilityLabel(category: Category) {
  if (category.is_merged) {
    return category.merged_into_name
      ? `Fusionada en ${category.merged_into_name}`
      : "Fusionada";
  }

  if (category.is_available_for_products) {
    return "Disponible";
  }

  return "No disponible";
}

function getAvailabilityColor(category: Category) {
  if (category.is_merged) {
    return colors.status.warning;
  }

  if (category.is_available_for_products) {
    return colors.status.success;
  }

  return colors.text.muted;
}

function canDeleteCategory(category: Category) {
  return (
    category.is_available_for_products &&
    !category.has_historical_usage &&
    !category.is_merged
  );
}

export function CategoryManagerDialog({
  open,
  categories,
  onClose,
  onCategoriesChanged,
  onError,
  onClearFeedback,
}: CategoryManagerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCategoryFormState>(
    emptyCreateCategoryForm,
  );

  const [descriptionDialog, setDescriptionDialog] =
    useState<DescriptionDialogState>(emptyDescriptionDialog);

  const [renameDialog, setRenameDialog] =
    useState<RenameDialogState>(emptyRenameDialog);

  const [mergeDialog, setMergeDialog] =
    useState<MergeDialogState>(emptyMergeDialog);

  const [deleteDialog, setDeleteDialog] =
    useState<DeleteDialogState>(emptyDeleteDialog);

  const availableCategories = useMemo(
    () => categories.filter((category) => category.is_available_for_products),
    [categories],
  );

  const mergeDestinations = useMemo(
    () =>
      availableCategories.filter(
        (category) => category.id !== mergeDialog.sourceCategory?.id,
      ),
    [availableCategories, mergeDialog.sourceCategory],
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
    onClearFeedback();
  }, [onClearFeedback]);

  const showValidationError = (message: string) => {
    setFeedback({
      severity: "error",
      message,
    });

    onError(message);
  };

  const showRequestError = (error: unknown) => {
    const message = getErrorMessage(error);

    setFeedback({
      severity: "error",
      message,
    });

    onError(message);
  };

  const completeAction = async (message: string) => {
    await onCategoriesChanged(message);

    setFeedback({
      severity: "success",
      message,
    });
  };

  const handleCloseManager = () => {
    if (saving) {
      return;
    }

    setFeedback(null);
    onClose();
  };

  const openCreateDialog = () => {
    clearFeedback();
    setCreateForm(emptyCreateCategoryForm);
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    if (saving) {
      return;
    }

    setCreateDialogOpen(false);
    setCreateForm(emptyCreateCategoryForm);
  };

  const openDescriptionDialog = useCallback(
    (category: Category) => {
      clearFeedback();

      setDescriptionDialog({
        open: true,
        category,
        description: category.description || "",
      });
    },
    [clearFeedback],
  );

  const closeDescriptionDialog = () => {
    if (saving) {
      return;
    }

    setDescriptionDialog(emptyDescriptionDialog);
  };

  const openRenameDialog = useCallback(
    (category: Category) => {
      clearFeedback();

      setRenameDialog({
        open: true,
        category,
        name: category.name,
        motivo: "",
      });
    },
    [clearFeedback],
  );

  const closeRenameDialog = () => {
    if (saving) {
      return;
    }

    setRenameDialog(emptyRenameDialog);
  };

  const openMergeDialog = useCallback(
    (sourceCategory: Category) => {
      clearFeedback();

      setMergeDialog({
        open: true,
        sourceCategory,
        destinationCategory: null,
        motivo: "",
      });
    },
    [clearFeedback],
  );

  const closeMergeDialog = () => {
    if (saving) {
      return;
    }

    setMergeDialog(emptyMergeDialog);
  };

  const openDeleteDialog = useCallback(
    (category: Category) => {
      clearFeedback();

      setDeleteDialog({
        open: true,
        category,
        motivo: "",
      });
    },
    [clearFeedback],
  );

  const closeDeleteDialog = () => {
    if (saving) {
      return;
    }

    setDeleteDialog(emptyDeleteDialog);
  };

  const handleCreateCategory = async () => {
    const name = createForm.name.trim();

    if (!name) {
      showValidationError("El nombre de la categoría es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      await createCategory({
        name,
        description: createForm.description.trim(),
      });

      await completeAction(`Categoría "${name}" creada correctamente.`);

      setCreateDialogOpen(false);
      setCreateForm(emptyCreateCategoryForm);
    } catch (error: unknown) {
      showRequestError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDescription = async () => {
    const category = descriptionDialog.category;

    if (!category) {
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      await updateCategory(category.id, {
        description: descriptionDialog.description.trim(),
      });

      await completeAction(
        `Descripción de la categoría "${category.name}" actualizada correctamente.`,
      );

      setDescriptionDialog(emptyDescriptionDialog);
    } catch (error: unknown) {
      showRequestError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleRenameCategory = async () => {
    const category = renameDialog.category;
    const name = renameDialog.name.trim();
    const motivo = renameDialog.motivo.trim();

    if (!category) {
      return;
    }

    if (!name) {
      showValidationError("El nuevo nombre de la categoría es obligatorio.");
      return;
    }

    if (!motivo) {
      showValidationError("El motivo del renombrado es obligatorio.");
      return;
    }

    if (name === category.name) {
      showValidationError(
        "El nuevo nombre debe ser diferente del nombre actual.",
      );
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      await renameCategory(category.id, {
        name,
        motivo,
      });

      await completeAction(
        `Categoría "${category.name}" renombrada a "${name}" correctamente.`,
      );

      setRenameDialog(emptyRenameDialog);
    } catch (error: unknown) {
      showRequestError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleMergeCategories = async () => {
    const sourceCategory = mergeDialog.sourceCategory;
    const destinationCategory = mergeDialog.destinationCategory;
    const motivo = mergeDialog.motivo.trim();

    if (!sourceCategory || !destinationCategory) {
      showValidationError(
        "Debe seleccionar una categoría de destino para la fusión.",
      );
      return;
    }

    if (!motivo) {
      showValidationError("El motivo de la fusión es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      const result = await mergeCategories(sourceCategory.id, {
        categoria_destino: destinationCategory.id,
        motivo,
      });

      const message = result.idempotente
        ? `La categoría "${sourceCategory.name}" ya estaba fusionada en "${result.categoria_destino.name}".`
        : `Categoría "${sourceCategory.name}" fusionada en "${result.categoria_destino.name}". Productos reasignados: ${result.productos_reasignados}.`;

      await completeAction(message);

      setMergeDialog(emptyMergeDialog);
    } catch (error: unknown) {
      showRequestError(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    const category = deleteDialog.category;
    const motivo = deleteDialog.motivo.trim();

    if (!category) {
      return;
    }

    if (!motivo) {
      showValidationError("El motivo de eliminación es obligatorio.");
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      await deleteCategorySafely(category.id, {
        motivo,
      });

      await completeAction(
        `Categoría "${category.name}" eliminada correctamente.`,
      );

      setDeleteDialog(emptyDeleteDialog);
    } catch (error: unknown) {
      showRequestError(error);
    } finally {
      setSaving(false);
    }
  };

  const categoryColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: "name",
        headerName: "Categoría",
        minWidth: 220,
        flex: 0.9,
        renderCell: (params) => (
          <Typography sx={{ fontWeight: 850 }}>
            {String(params.value || "Sin nombre")}
          </Typography>
        ),
      },
      {
        field: "description",
        headerName: "Descripción",
        minWidth: 280,
        flex: 1.25,
        renderCell: (params) =>
          params.value ? String(params.value) : "Sin descripción",
      },
      {
        field: "status",
        headerName: "Estado",
        width: 140,
        renderCell: (params) => (
          <Chip
            label={getCategoryStatusLabel(String(params.value || ""))}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 800 }}
          />
        ),
      },
      {
        field: "availability",
        headerName: "Uso en productos",
        width: 210,
        sortable: false,
        valueGetter: (_value, row) => getAvailabilityLabel(row as Category),
        renderCell: (params) => {
          const category = params.row as Category;
          const color = getAvailabilityColor(category);

          return (
            <Chip
              label={getAvailabilityLabel(category)}
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
        field: "has_historical_usage",
        headerName: "Historial",
        width: 145,
        renderCell: (params) => (
          <Chip
            label={params.value ? "Con historial" : "Sin historial"}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 800 }}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Acciones",
        width: 500,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const category = params.row as Category;

          const canMerge =
            category.is_available_for_products &&
            availableCategories.some(
              (candidate) => candidate.id !== category.id,
            );

          return (
            <Stack direction="row" spacing={0.75}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditIcon />}
                disabled={saving}
                onClick={() => openDescriptionDialog(category)}
              >
                Descripción
              </Button>

              <Button
                size="small"
                variant="outlined"
                startIcon={<DriveFileRenameOutlineIcon />}
                disabled={saving || !category.is_available_for_products}
                onClick={() => openRenameDialog(category)}
              >
                Renombrar
              </Button>

              <Button
                size="small"
                variant="outlined"
                startIcon={<CallMergeIcon />}
                disabled={saving || !canMerge}
                onClick={() => openMergeDialog(category)}
              >
                Fusionar
              </Button>

              <Button
                size="small"
                variant="outlined"
                startIcon={<DeleteOutlineIcon />}
                disabled={saving || !canDeleteCategory(category)}
                onClick={() => openDeleteDialog(category)}
                sx={{
                  color: colors.status.error,
                  borderColor: colors.status.error,
                  "&:hover": {
                    bgcolor: colors.status.errorSoft,
                    borderColor: colors.status.error,
                  },
                }}
              >
                Eliminar
              </Button>
            </Stack>
          );
        },
      },
    ],
    [availableCategories, saving],
  );

  return (
    <>
      <Dialog open={open} onClose={handleCloseManager} fullWidth maxWidth="xl">
        <DialogTitle sx={{ pb: 1.5 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{
              alignItems: { xs: "stretch", sm: "center" },
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 900 }}>
                Gestión de categorías
              </Typography>

              <Typography variant="body2" sx={{ color: colors.text.secondary }}>
                Datos maestros reutilizables para clasificar productos sin
                perder trazabilidad.
              </Typography>
            </Box>

            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              disabled={saving}
            >
              Nueva categoría
            </Button>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              El nombre, la fusión y la eliminación son operaciones controladas.
              Los productos, Kardex y auditorías históricas no se eliminan ni se
              reescriben.
            </Alert>

            {feedback ? (
              <Alert severity={feedback.severity} variant="outlined">
                {feedback.message}
              </Alert>
            ) : null}

            <SmartDataGrid
              rows={categories}
              columns={categoryColumns}
              height={500}
              minHeight={320}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCloseManager} disabled={saving}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={createDialogOpen}
        onClose={closeCreateDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nueva categoría</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Crea una categoría solo cuando no exista otra equivalente. El
              sistema bloqueará duplicados por mayúsculas, espacios, tildes o
              signos.
            </Alert>

            <TextField
              label="Nombre de la categoría"
              value={createForm.name}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              fullWidth
              required
              autoFocus
            />

            <TextField
              label="Descripción"
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={3}
              placeholder="Opcional"
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeCreateDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleCreateCategory()}
            disabled={saving || !createForm.name.trim()}
          >
            {saving ? "Guardando..." : "Crear categoría"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={descriptionDialog.open}
        onClose={closeDescriptionDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar descripción</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              El nombre no se modifica desde esta acción. Para cambiarlo,
              utiliza Renombrar e indica el motivo.
            </Alert>

            <TextField
              label="Categoría"
              value={descriptionDialog.category?.name || ""}
              fullWidth
              disabled
            />

            <TextField
              label="Descripción"
              value={descriptionDialog.description}
              onChange={(event) =>
                setDescriptionDialog((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={4}
              placeholder="Opcional"
              autoFocus
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDescriptionDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleUpdateDescription()}
            disabled={saving || !descriptionDialog.category}
          >
            {saving ? "Guardando..." : "Guardar descripción"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={renameDialog.open}
        onClose={closeRenameDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Renombrar categoría</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="warning" variant="outlined">
              El renombrado queda registrado en auditoría. La categoría mantiene
              su identidad e historial.
            </Alert>

            <TextField
              label="Nombre actual"
              value={renameDialog.category?.name || ""}
              fullWidth
              disabled
            />

            <TextField
              label="Nuevo nombre"
              value={renameDialog.name}
              onChange={(event) =>
                setRenameDialog((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              fullWidth
              required
              autoFocus
            />

            <TextField
              label="Motivo del renombrado"
              value={renameDialog.motivo}
              onChange={(event) =>
                setRenameDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={3}
              helperText="Este motivo quedará asociado a la auditoría."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeRenameDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleRenameCategory()}
            disabled={
              saving ||
              !renameDialog.category ||
              !renameDialog.name.trim() ||
              !renameDialog.motivo.trim()
            }
          >
            {saving ? "Procesando..." : "Renombrar categoría"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={mergeDialog.open}
        onClose={closeMergeDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Fusionar categorías</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="warning" variant="outlined">
              Los productos de la categoría origen se reasignarán a la categoría
              destino. La categoría origen quedará archivada y su historial se
              conservará.
            </Alert>

            <TextField
              label="Categoría origen"
              value={mergeDialog.sourceCategory?.name || ""}
              fullWidth
              disabled
            />

            <Autocomplete<Category>
              options={mergeDestinations}
              value={mergeDialog.destinationCategory}
              onChange={(_event, category) =>
                setMergeDialog((current) => ({
                  ...current,
                  destinationCategory: category,
                }))
              }
              getOptionLabel={(category) => category.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              noOptionsText="No hay categorías disponibles como destino."
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Categoría destino"
                  required
                  helperText="Debe ser distinta de la categoría origen y estar disponible."
                />
              )}
            />

            <TextField
              label="Motivo de la fusión"
              value={mergeDialog.motivo}
              onChange={(event) =>
                setMergeDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={3}
              helperText="Este motivo quedará asociado a la auditoría de la fusión."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeMergeDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleMergeCategories()}
            disabled={
              saving ||
              !mergeDialog.sourceCategory ||
              !mergeDialog.destinationCategory ||
              !mergeDialog.motivo.trim()
            }
          >
            {saving ? "Procesando..." : "Fusionar categorías"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialog.open}
        onClose={closeDeleteDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Eliminar categoría</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="error" variant="outlined">
              La eliminación física solo está disponible para categorías activas
              sin historial, sin productos asociados y sin relación con
              fusiones.
            </Alert>

            <TextField
              label="Categoría"
              value={deleteDialog.category?.name || ""}
              fullWidth
              disabled
            />

            <TextField
              label="Motivo de eliminación"
              value={deleteDialog.motivo}
              onChange={(event) =>
                setDeleteDialog((current) => ({
                  ...current,
                  motivo: event.target.value,
                }))
              }
              fullWidth
              required
              multiline
              minRows={3}
              helperText="Este motivo quedará registrado antes de eliminar."
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            color="error"
            onClick={() => void handleDeleteCategory()}
            disabled={
              saving || !deleteDialog.category || !deleteDialog.motivo.trim()
            }
          >
            {saving ? "Eliminando..." : "Eliminar categoría"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
