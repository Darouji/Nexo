import Inventory2Icon from "@mui/icons-material/Inventory2";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";

import { Button, Chip, Stack, Typography } from "@mui/material";
import { colors } from "../../../theme/colors";
import { formatNumber } from "../utils/inventoryFormatters";
import { getProductOriginLabel } from "./productFormModel";

import type { MouseEvent as ReactMouseEvent } from "react";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
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

const numericCellStyle = {
  textAlign: "right" as const,
  fontVariantNumeric: "tabular-nums",
};

export function buildProductCatalogColumns({
  onOpenInventoryActionMenu,
  onOpenMoreActionMenu,
}: ProductCatalogColumnsOptions): ColDef<Product>[] {
  return [
    {
      field: "modelo",
      colId: "modelo",
      headerName: "Producto / Modelo",
      minWidth: 240,
      flex: 1.15,
      cellRenderer: (params: ICellRendererParams<Product, string>) => (
        <Stack
          sx={{
            height: "100%",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontWeight: 850 }}>
            {String(params.value || "Sin producto / modelo")}
          </Typography>
        </Stack>
      ),
    },
    {
      field: "categoria_name",
      colId: "categoria__name",
      headerName: "Categoría",
      minWidth: 180,
      flex: 0.8,
      valueFormatter: (params) => String(params.value || "Sin categoría"),
    },
    {
      field: "origen",
      colId: "origen",
      headerName: "Origen",
      width: 145,
      cellRenderer: (params: ICellRendererParams<Product, ProductOrigin>) => {
        const origin = String(params.value || "COMPRADO") as ProductOrigin;

        const color = getProductOriginColor(origin);

        return (
          <Stack
            sx={{
              height: "100%",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
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
          </Stack>
        );
      },
    },
    {
      field: "codigo_sap",
      colId: "codigo_sap",
      headerName: "Código SAP",
      minWidth: 150,
      flex: 0.65,
      valueFormatter: (params) => String(params.value || "Sin código"),
    },
    {
      field: "stock_actual",
      colId: "stock_actual",
      headerName: "Stock actual",
      width: 140,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "por_recibir",
      colId: "por_recibir_total",
      headerName: "Por recibir",
      width: 135,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_critico",
      colId: "stock_critico",
      headerName: "Stock mínimo",
      width: 140,
      cellStyle: numericCellStyle,
      valueFormatter: (params) => formatNumber(Number(params.value || 0)),
    },
    {
      field: "stock_status",
      colId: "stock_status",
      headerName: "Estado de stock",
      width: 185,
      sortable: false,
      cellRenderer: (
        params: ICellRendererParams<Product, ProductStockStatus>,
      ) => {
        const status = String(
          params.value || "NO_CONTROLA_STOCK",
        ) as ProductStockStatus;

        const color = getStockStatusColor(status);

        return (
          <Stack
            sx={{
              height: "100%",
              justifyContent: "center",
              alignItems: "flex-start",
            }}
          >
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
          </Stack>
        );
      },
    },
    {
      field: "estado_producto_display",
      colId: "estado_producto_display",
      headerName: "Estado del producto",
      width: 185,
      sortable: false,
      cellRenderer: (params: ICellRendererParams<Product, string>) => (
        <Stack
          sx={{
            height: "100%",
            justifyContent: "center",
            alignItems: "flex-start",
          }}
        >
          <Chip
            label={String(params.value || "Sin estado")}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 800 }}
          />
        </Stack>
      ),
    },
    {
      field: "detalle",
      colId: "detalle",
      headerName: "Detalle / Descripción",
      minWidth: 260,
      flex: 1.2,
      sortable: false,
      valueFormatter: (params) => String(params.value || "Sin detalle"),
    },
    {
      colId: "actions",
      headerName: "Acciones",
      width: 430,
      minWidth: 430,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      cellRenderer: (params: ICellRendererParams<Product, unknown>) => {
        const product = params.data;

        if (!product) {
          return null;
        }

        return (
          <Stack
            direction="row"
            spacing={1}
            sx={{
              height: "100%",
              alignItems: "center",
            }}
          >
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
