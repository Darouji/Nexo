import { useState } from "react";
import { Card, CardContent, Grid, Stack, Typography } from "@mui/material";
import { AppLayout } from "../layouts/AppLayout";
import { getStoredUser, logout } from "../services/authService";
import { UsersPage } from "./UsersPage";
import { CollaboratorsPage } from "./CollaboratorsPage";

type DashboardPageProps = {
  onLogout: () => void;
};

const summaryCards = [
  {
    title: "Clientes",
    value: "0",
    description: "Empresas, áreas y contactos registrados",
  },
  {
    title: "Ventas / Ingresos",
    value: "0",
    description: "Facturas y productos vendidos",
  },
  {
    title: "Compras / Egresos",
    value: "0",
    description: "Compras nacionales e internacionales",
  },
  {
    title: "Importaciones Excel",
    value: "0",
    description: "Archivos procesados por la plataforma",
  },
];

function DashboardHome() {
  return (
    <Stack spacing={3}>
      <Card elevation={0}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            Bienvenido a Serkan Platform V2
          </Typography>

          <Typography color="text.secondary">
            Esta es la base inicial del panel interno. Desde aquí se irán
            integrando clientes, ventas, compras, productos, documentos,
            importaciones Excel y reportes.
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {summaryCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card elevation={0}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  {card.title}
                </Typography>

                <Typography variant="h3" component="p">
                  {card.value}
                </Typography>

                <Typography variant="body2" color="text.secondary">
                  {card.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export function DashboardPage({ onLogout }: DashboardPageProps) {
  const [activeSection, setActiveSection] = useState("Dashboard");
  const user = getStoredUser();

  const handleLogout = () => {
    logout();
    onLogout();
  };

  return (
    <AppLayout
      user={user}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
      onLogout={handleLogout}
    >
      {activeSection === "Usuarios" ? (
        <UsersPage currentUser={user} />
      ) : activeSection === "Colaboradores" ? (
        <CollaboratorsPage />
      ) : (
        <DashboardHome />
      )}
    </AppLayout>
  );
}