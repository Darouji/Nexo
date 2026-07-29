import {
  useCallback,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
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
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CallMergeIcon from "@mui/icons-material/CallMerge";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { SerkanDataGrid, type SerkanGridPaginationModel } from "../../../components/SerkanDataGrid";
import { getApiErrorMessage as getErrorMessage } from "../../../services/api";
import {
  createCategory,
  deleteCategorySafely,
  fetchProductsPage,
  mergeCategories,
  renameCategory,
  updateCategory,
} from "../../../services/inventoryService";
import type { Category, Product } from "../../../services/inventoryService";
import { colors } from "../../../theme/colors";

type CategoryManagerDialogProps = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onCategoriesChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
  onClearFeedback: () => void;
  onOpenProductInCatalog?: (product: Product, category: Category) => void;
};

type FeedbackState = {
  severity: "success" | "error";
  message: string;
} | null;

type CreateCategoryFormState = {
  name: string;
  description: string;
};

type EditCategoryDialogState = {
  open: boolean;
  category: Category | null;
  name: string;
  description: string;
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

type CategoryActionMenuState = {
  anchorEl: HTMLElement | null;
  category: Category | null;
};

type CategoryProductsDialogState = {
  open: boolean;
  category: Category | null;
  products: Product[];
  rowCount: number;
  paginationModel: SerkanGridPaginationModel;
  loading: boolean;
};

const emptyCreateCategoryForm: CreateCategoryFormState = {
  name: "",
  description: "",
};

const emptyEditCategoryDialog: EditCategoryDialogState = {
  open: false,
  category: null,
  name: "",
  description: "",
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

const emptyCategoryActionMenu: CategoryActionMenuState = {
  anchorEl: null,
  category: null,
};

const defaultCategoryProductsPaginationModel: SerkanGridPaginationModel = {
  page: 0,
  pageSize: 10,
};

const emptyCategoryProductsDialog: CategoryProductsDialogState = {
  open: false,
  category: null,
  products: [],
  rowCount: 0,
  paginationModel: defaultCategoryProductsPaginationModel,
  loading: false,
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
  onOpenProductInCatalog,
}: CategoryManagerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [categoryPagination, setCategoryPagination] = useState({ page: 0, pageSize: 25 });
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCategoryFormState>(
    emptyCreateCategoryForm,
  );

  const [editCategoryDialog, setEditCategoryDialog] =
    useState<EditCategoryDialogState>(emptyEditCategoryDialog);

  const [mergeDialog, setMergeDialog] =
    useState<MergeDialogState>(emptyMergeDialog);

  const [deleteDialog, setDeleteDialog] =
    useState<DeleteDialogState>(emptyDeleteDialog);

  const [categoryActionMenu, setCategoryActionMenu] =
    useState<CategoryActionMenuState>(emptyCategoryActionMenu);

  const [categoryProductsDialog, setCategoryProductsDialog] =
    useState<CategoryProductsDialogState>(emptyCategoryProductsDialog);

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

  const selectedCategory = categoryActionMenu.category;

  const selectedCategoryCanMerge = Boolean(
    selectedCategory &&
    selectedCategory.is_available_for_products &&
    availableCategories.some(
      (candidate) => candidate.id !== selectedCategory.id,
    ),
  );

  const selectedCategoryCanDelete = Boolean(
    selectedCategory && canDeleteCategory(selectedCategory),
  );

  const openCategoryActionMenu = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>, category: Category) => {
      setCategoryActionMenu({
        anchorEl: event.currentTarget,
        category,
      });
    },
    [],
  );

  const closeCategoryActionMenu = useCallback(() => {
    setCategoryActionMenu(emptyCategoryActionMenu);
  }, []);

  const closeCategoryProductsDialog = useCallback(() => {
    setCategoryProductsDialog(emptyCategoryProductsDialog);
  }, []);

  const showRequestError = useCallback(
    (error: unknown) => {
      const message = getErrorMessage(error);

      setFeedback({
        severity: "error",
        message,
      });

      onError(message);
    },
    [onError],
  );

  const loadCategoryProducts = useCallback(
    async (
      category: Category,
      paginationModel: SerkanGridPaginationModel = defaultCategoryProductsPaginationModel,
    ) => {
      setCategoryProductsDialog((current) => ({
        ...current,
        open: true,
        category,
        loading: true,
        paginationModel,
        products: current.category?.id === category.id ? current.products : [],
        rowCount: current.category?.id === category.id ? current.rowCount : 0,
      }));

      try {
        const data = await fetchProductsPage({
          categoria: category.id,
          status: "ACTIVO",
          ordering: "modelo",
          page: paginationModel.page + 1,
          page_size: paginationModel.pageSize,
        });

        setCategoryProductsDialog({
          open: true,
          category,
          products: data.results,
          rowCount: data.count,
          paginationModel,
          loading: false,
        });
      } catch (error: unknown) {
        setCategoryProductsDialog((current) => ({
          ...current,
          loading: false,
        }));

        showRequestError(error);
      }
    },
    [showRequestError],
  );

  const handleCategoryProductsPaginationModelChange = useCallback(
    (nextPaginationModel: SerkanGridPaginationModel) => {
      const category = categoryProductsDialog.category;

      if (!category) {
        return;
      }

      void loadCategoryProducts(category, nextPaginationModel);
    },
    [categoryProductsDialog.category, loadCategoryProducts],
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

  const openEditCategoryDialog = useCallback(
    (category: Category) => {
      clearFeedback();

      setEditCategoryDialog({
        open: true,
        category,
        name: category.name,
        description: category.description || "",
        motivo: "",
      });
    },
    [clearFeedback],
  );

  const closeEditCategoryDialog = () => {
    if (saving) {
      return;
    }

    setEditCategoryDialog(emptyEditCategoryDialog);
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

  const handleSaveCategoryEdit = async () => {
    const category = editCategoryDialog.category;

    if (!category) {
      return;
    }

    const name = editCategoryDialog.name.trim();
    const description = editCategoryDialog.description.trim();
    const motivo = editCategoryDialog.motivo.trim();

    const nameChanged = name !== category.name;
    const descriptionChanged =
      description !== (category.description || "").trim();

    if (!name) {
      showValidationError("El nombre de la categoría es obligatorio.");
      return;
    }

    if (!nameChanged && !descriptionChanged) {
      closeEditCategoryDialog();
      return;
    }

    if (nameChanged && !motivo) {
      showValidationError(
        "El motivo es obligatorio cuando cambia el nombre de una categoría.",
      );
      return;
    }

    try {
      setSaving(true);
      clearFeedback();

      if (nameChanged) {
        await renameCategory(category.id, {
          name,
          motivo,
          ...(descriptionChanged ? { description } : {}),
        });
      } else {
        await updateCategory(category.id, {
          description,
        });
      }

      const message = nameChanged
        ? descriptionChanged
          ? `Categoría "${category.name}" renombrada a "${name}" y descripción actualizada correctamente.`
          : `Categoría "${category.name}" renombrada a "${name}" correctamente.`
        : `Descripción de la categoría "${category.name}" actualizada correctamente.`;

      await completeAction(message);

      setEditCategoryDialog(emptyEditCategoryDialog);
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

  const categoryProductColumns = useMemo<ColDef<Product>[]>(
    () => [
      { field: "modelo", headerName: "Modelo", minWidth: 220, flex: 1, cellStyle: () => ({ fontWeight: 850 }) },
      { field: "codigo_sap", headerName: "Código SAP", minWidth: 145, flex: 0.6, valueFormatter: (params) => String(params.value || "Sin código") },
      { field: "stock_actual", headerName: "Stock", width: 110, cellStyle: () => ({ textAlign: "right" }) },
      { field: "por_recibir", headerName: "Por recibir", width: 125, cellStyle: () => ({ textAlign: "right" }) },
      { field: "estado_producto_display", headerName: "Estado", width: 155, cellRenderer: (params: ICellRendererParams<Product>) => <Chip label={String(params.value || "Sin estado")} size="small" variant="outlined" sx={{ fontWeight: 800 }} /> },
      { colId: "actions", headerName: "Acciones", width: 170, sortable: false, filter: false, cellRenderer: (params: ICellRendererParams<Product>) => {
        const product = params.data; const category = categoryProductsDialog.category;
        if (!product) return null;
        return <Button size="small" variant="outlined" startIcon={<OpenInNewIcon />} disabled={!category || !onOpenProductInCatalog} onClick={() => {
          if (!category || !onOpenProductInCatalog) return;
          closeCategoryProductsDialog(); onOpenProductInCatalog(product, category);
        }} sx={{ color: colors.text.primary, borderColor: colors.border.medium }}>Ver en catálogo</Button>;
      } },
    ],
    [categoryProductsDialog.category, closeCategoryProductsDialog, onOpenProductInCatalog],
  );

  const categoryColumns = useMemo<ColDef<Category>[]>(
    () => [
      { field: "name", headerName: "Categoría", minWidth: 220, flex: 0.9, cellStyle: () => ({ fontWeight: 850 }) },
      { field: "description", headerName: "Descripción", minWidth: 280, flex: 1.25, valueFormatter: (params) => String(params.value || "Sin descripción") },
      { field: "productos_count", headerName: "Productos", width: 125, cellRenderer: (params: ICellRendererParams<Category>) => <Chip label={String(params.value ?? 0)} size="small" sx={{ color: colors.primary.main, bgcolor: colors.primary.soft, borderColor: colors.primary.border, border: "1px solid", fontWeight: 900 }} /> },
      { field: "status", headerName: "Estado", width: 140, cellRenderer: (params: ICellRendererParams<Category>) => <Chip label={getCategoryStatusLabel(String(params.value || ""))} size="small" variant="outlined" sx={{ fontWeight: 800 }} /> },
      { colId: "availability", headerName: "Uso en productos", width: 210, sortable: false, valueGetter: (params) => params.data ? getAvailabilityLabel(params.data) : "", cellRenderer: (params: ICellRendererParams<Category>) => {
        const category = params.data; if (!category) return null; const color = getAvailabilityColor(category);
        return <Chip label={getAvailabilityLabel(category)} size="small" sx={{ color, bgcolor: colors.surface.soft, borderColor: color, border: "1px solid", fontWeight: 800 }} />;
      } },
      { field: "has_historical_usage", headerName: "Historial", width: 145, cellRenderer: (params: ICellRendererParams<Category>) => <Chip label={params.value ? "Con historial" : "Sin historial"} size="small" variant="outlined" sx={{ fontWeight: 800 }} /> },
      { colId: "actions", headerName: "Acciones", width: 165, sortable: false, filter: false, cellRenderer: (params: ICellRendererParams<Category>) => {
        const category = params.data; if (!category) return null;
        return <Button size="small" variant="outlined" endIcon={<KeyboardArrowDownIcon />} disabled={saving} onClick={(event) => openCategoryActionMenu(event, category)} sx={{ color: colors.text.primary, borderColor: colors.border.medium }}>Acciones</Button>;
      } },
    ],
    [saving, openCategoryActionMenu],
  );

  const visibleCategories = categories.slice(
    categoryPagination.page * categoryPagination.pageSize,
    (categoryPagination.page + 1) * categoryPagination.pageSize,
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

            <SerkanDataGrid
              gridKey="inventory.categories"
              ariaLabel="Gestión de categorías"
              rows={visibleCategories}
              columns={categoryColumns}
              paginationModel={categoryPagination}
              onPaginationModelChange={setCategoryPagination}
              rowCount={categories.length}
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

      <Menu
        anchorEl={categoryActionMenu.anchorEl}
        open={Boolean(categoryActionMenu.anchorEl)}
        onClose={closeCategoryActionMenu}
      >
        {selectedCategory ? (
          <>
            <MenuItem
              disabled={saving}
              onClick={() => {
                closeCategoryActionMenu();
                openEditCategoryDialog(selectedCategory);
              }}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Editar categoría</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={saving}
              onClick={() => {
                closeCategoryActionMenu();
                void loadCategoryProducts(selectedCategory);
              }}
            >
              <ListItemIcon>
                <Inventory2Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary="Ver productos"
                secondary={`${selectedCategory.productos_count ?? 0} producto(s) actual(es)`}
              />
            </MenuItem>

            <MenuItem
              disabled={saving || !selectedCategoryCanMerge}
              onClick={() => {
                closeCategoryActionMenu();
                openMergeDialog(selectedCategory);
              }}
            >
              <ListItemIcon>
                <CallMergeIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Fusionar categoría</ListItemText>
            </MenuItem>

            <MenuItem
              disabled={saving || !selectedCategoryCanDelete}
              onClick={() => {
                closeCategoryActionMenu();
                openDeleteDialog(selectedCategory);
              }}
              sx={{
                color: colors.status.error,
              }}
            >
              <ListItemIcon>
                <DeleteIcon
                  fontSize="small"
                  sx={{ color: colors.status.error }}
                />
              </ListItemIcon>
              <ListItemText>Eliminar categoría</ListItemText>
            </MenuItem>
          </>
        ) : null}
      </Menu>

      <Dialog
        open={categoryProductsDialog.open}
        onClose={closeCategoryProductsDialog}
        fullWidth
        maxWidth="lg"
      >
        <DialogTitle>
          Productos de la categoría
          {categoryProductsDialog.category
            ? `: ${categoryProductsDialog.category.name}`
            : ""}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Esta vista muestra los productos actuales asociados a la categoría
              seleccionada. Puedes usar “Ver en catálogo” para ubicar el
              producto en el inventario principal.
            </Alert>

            <SerkanDataGrid
              gridKey="inventory.category-products"
              serverManaged
              ariaLabel="Productos asociados a la categoría"
              rows={categoryProductsDialog.products}
              columns={categoryProductColumns}
              loading={categoryProductsDialog.loading}
              paginationModel={categoryProductsDialog.paginationModel}
              onPaginationModelChange={handleCategoryProductsPaginationModelChange}
              rowCount={categoryProductsDialog.rowCount}
              height={420}
              minHeight={300}
            />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeCategoryProductsDialog}>Cerrar</Button>
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
        open={editCategoryDialog.open}
        onClose={closeEditCategoryDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Editar categoría</DialogTitle>

        <DialogContent>
          <Stack spacing={2.2} sx={{ mt: 1 }}>
            <Alert severity="info" variant="outlined">
              Puedes actualizar la descripción libremente. Si cambias el nombre,
              se registrará como una acción auditada y deberás indicar el
              motivo.
            </Alert>

            <TextField
              label="Nombre de la categoría"
              value={editCategoryDialog.name}
              onChange={(event) =>
                setEditCategoryDialog((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              fullWidth
              required
              autoFocus
              disabled={!editCategoryDialog.category?.is_available_for_products}
              helperText={
                editCategoryDialog.category?.is_available_for_products
                  ? "Cambiar el nombre requiere un motivo."
                  : "Las categorías históricas o fusionadas no pueden renombrarse."
              }
            />

            <TextField
              label="Descripción"
              value={editCategoryDialog.description}
              onChange={(event) =>
                setEditCategoryDialog((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              fullWidth
              multiline
              minRows={4}
              placeholder="Opcional"
            />

            {editCategoryDialog.category &&
            editCategoryDialog.name.trim() !==
              editCategoryDialog.category.name ? (
              <TextField
                label="Motivo del cambio de nombre"
                value={editCategoryDialog.motivo}
                onChange={(event) =>
                  setEditCategoryDialog((current) => ({
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
            ) : null}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={closeEditCategoryDialog} disabled={saving}>
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={() => void handleSaveCategoryEdit()}
            disabled={
              saving ||
              !editCategoryDialog.category ||
              !editCategoryDialog.name.trim() ||
              (editCategoryDialog.name.trim() ===
                editCategoryDialog.category.name &&
                editCategoryDialog.description.trim() ===
                  (editCategoryDialog.category.description || "").trim()) ||
              (editCategoryDialog.name.trim() !==
                editCategoryDialog.category.name &&
                !editCategoryDialog.motivo.trim())
            }
          >
            {saving ? "Guardando..." : "Guardar cambios"}
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
