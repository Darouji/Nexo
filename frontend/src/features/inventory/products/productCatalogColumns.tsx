import Inventory2Icon from "@mui/icons-material/Inventory2";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

import { formatNumber } from "../utils/inventoryFormatters";
import { Button, Chip, Stack, Typography } from "@mui/material";
import { colors } from "../../../theme/colors";
import { getProductOriginLabel } from "./productFormModel";

import type { MouseEvent as ReactMouseEvent } from "react";
import type { GridColDef } from "@mui/x-data-grid";
import type {
  Product,
  ProductOrigin,
  ProductStockStatus,
} from "../../../services/inventoryService";

type ProductCatalogColumnsOptions = {
  onOpenInventoryActionMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    product: Product,
  ) => void;
  onOpenMoreActionMenu: (
    event: ReactMouseEvent<HTMLButtonElement>,
    product: Product,
  ) => void;
};

function getStockStatusColor(status: ProductStockStatus) {
  if (status === "STOCK_CORRECTO") {
    return colors.status.success;
  }

  if (status === "BAJO_MINIMO") {
    return colors.status.warning;
  }

  if (status === "SIN_STOCK") {
    return colors.status.error;
  }

  return colors.status.info;
}

function getStockStatusLabel(status: ProductStockStatus) {
  if (status === "STOCK_CORRECTO") {
    return "Stock correcto";
  }

  if (status === "BAJO_MINIMO") {
    return "Bajo mínimo";
  }

  if (status === "SIN_STOCK") {
    return "Sin stock";
  }

  return "No controla stock";
}

function getProductOriginColor(origin: ProductOrigin) {
  if (origin === "COMPRADO") {
    return colors.status.info;
  }

  if (origin === "FABRICADO") {
    return colors.status.success;
  }

  if (origin === "SERVICIO") {
    return colors.status.warning;
  }

  return colors.text.muted;
}

export function buildProductCatalogColumns({
  onOpenInventoryActionMenu,
  onOpenMoreActionMenu,
}: ProductCatalogColumnsOptions): GridColDef[] {
  return [
    {
      field: "modelo",
      headerName: "Modelo",
      minWidth: 220,
      flex: 1.1,
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 850 }}>
          {params.value || "Sin modelo"}
        </Typography>
      ),
    },
    {
      field: "categoria_name",
      headerName: "Categoría",
      minWidth: 180,
      flex: 0.8,
    },
    {
      field: "origen",
      headerName: "Origen",
      width: 135,
      renderCell: (params) => {
        const origin = String(params.value || "COMPRADO") as ProductOrigin;
        const color = getProductOriginColor(origin);

        return (
          <Chip
            label={getProductOriginLabel(origin)}
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
      field: "codigo_sap",
      headerName: "Código SAP",
      minWidth: 145,
      flex: 0.65,
      renderCell: (params) => params.value || "Sin código",
    },
    {
      field: "stock_actual",
      headerName: "Stock actual",
      width: 135,
      type: "number",
      renderCell: (params) => (
        <Typography sx={{ fontWeight: 900 }}>
          {formatNumber(Number(params.value || 0))}
        </Typography>
      ),
    },
    {
      field: "por_recibir",
      headerName: "Por recibir",
      width: 130,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_critico",
      headerName: "Stock mínimo",
      width: 135,
      type: "number",
      renderCell: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_status",
      headerName: "Estado de stock",
      width: 180,
      renderCell: (params) => {
        const status = String(params.value || "") as ProductStockStatus;
        const color = getStockStatusColor(status);

        return (
          <Chip
            label={getStockStatusLabel(status)}
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
      field: "estado_producto_display",
      headerName: "Estado del producto",
      width: 175,
      renderCell: (params) => (
        <Chip
          label={String(params.value || "Sin estado")}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 800 }}
        />
      ),
    },
    {
      field: "detalle",
      headerName: "Detalle",
      minWidth: 250,
      flex: 1.2,
      renderCell: (params) => params.value || "Sin detalle",
    },
    {
      field: "actions",
      headerName: "Acciones",
      width: 430,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const product = params.row as Product;

        return (
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              startIcon={<Inventory2Icon />}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(event) => onOpenInventoryActionMenu(event, product)}
            >
              Gestionar inventario
            </Button>

            <Button
              size="small"
              variant="outlined"
              startIcon={<MoreHorizIcon />}
              endIcon={<KeyboardArrowDownIcon />}
              onClick={(event) => onOpenMoreActionMenu(event, product)}
            >
              Más acciones
            </Button>
          </Stack>
        );
      },
    },
  ];
}
