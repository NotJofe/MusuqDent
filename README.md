# 🦷 MusuqDent

Plataforma web para gestionar un consultorio dental en Perú: pacientes, doctores, historial de
atenciones, pagos y agenda de citas.

**No necesita servidor (backend).** Es una aplicación estática (puede publicarse gratis en GitHub
Pages) que guarda toda la información en una **hoja de Google Sheets** del consultorio. Para
ingresar, cada persona inicia sesión con su cuenta de Google, y solo pueden entrar las cuentas que
tienen acceso de edición a esa hoja.

> *Musuq* significa "nuevo" en quechua.

## Módulos

| Módulo | Qué hace |
| --- | --- |
| **Inicio** | Citas del día, próximas citas, ingresos del mes, saldos pendientes y cumpleaños. |
| **Pacientes** | Registro con nombres, apellidos, tipo y n° de documento (DNI de 8 dígitos validado), fecha de nacimiento (opcional), celular, correo, dirección y alergias. Búsqueda y exportación a CSV. |
| **Ficha del paciente** | Historial de atenciones (tratamiento, pieza dental, diagnóstico, doctor, costo), pagos (Efectivo, Yape, Plin, tarjeta, transferencia), estado de cuenta y citas. |
| **Doctores** | Nombre, especialidad, n° COP, contacto y color en la agenda. Se pueden desactivar sin perder su historial. |
| **Agenda** | Calendario tipo Google Calendar (mes / semana / día / lista). Clic en un horario para agendar, arrastrar para reprogramar, filtro por doctor y estados (programada, confirmada, atendida, cancelada, no asistió). |
| **Cita atendida** | Al marcar una cita como *Atendida* aparecen dos acciones: **Crear atención** (rápida, con los datos de la cita, o completándola manualmente) y **Registrar pago**. Cada cita puede tener un **costo del servicio**: es opcional al agendar, pero obligatorio para registrar un pago. Se muestra lo pagado y lo pendiente de la cita. |
| **Compartir cita** | Enviar recordatorio por **WhatsApp** al celular del paciente, enlace **"Agregar a Google Calendar"**, archivo **.ics** (para cualquier calendario del celular) o copiar el mensaje. |
| **Importar** | Carga pacientes, doctores, atenciones o pagos desde **Excel (.xlsx)** o **CSV**. Detecta automáticamente las columnas, permite corregir la relación, muestra vista previa y omite duplicados. |
| **Inicio de sesión** | Con Google (OAuth). Opcionalmente se puede limitar a una lista de correos. |

## Probarlo rápido (modo demo)

```bash
npm install
npm run dev
```

Abre http://localhost:5173 y pulsa **"Entrar en modo demo"**. En este modo los datos de ejemplo se
guardan solo en tu navegador (no se necesita configurar Google).

## Conectar con Google Sheets

### 1. Crear la hoja de datos

1. Crea una hoja nueva en [Google Sheets](https://sheets.new), por ejemplo "MusuqDent - Datos".
2. Copia su **ID**: es la parte de la URL entre `/d/` y `/edit`
   (`https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`).
3. No hace falta crear pestañas: la primera vez que alguien inicia sesión, MusuqDent crea
   automáticamente `Pacientes`, `Doctores`, `Atenciones`, `Pagos` y `Citas` con sus encabezados.

### 2. Client ID de Google

El proyecto ya trae configurado su Client ID (`src/config.js`). Solo necesitas repetir estos
pasos si quieres usar un proyecto de Google Cloud distinto.

<details>
<summary>Crear un Client ID propio</summary>


1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto
   (por ejemplo "MusuqDent").
2. En **APIs y servicios → Biblioteca**, habilita **Google Sheets API**.
3. En **APIs y servicios → Pantalla de consentimiento de OAuth** (Google Auth Platform):
   - Tipo de usuario: **Externo**.
   - Completa el nombre de la app y tu correo.
   - En **Permisos (scopes)** agrega `.../auth/spreadsheets`.
   - En **Usuarios de prueba** agrega los correos de las personas que usarán el sistema
     (mientras la app esté en modo "Prueba", solo ellos podrán ingresar).
4. En **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - **Orígenes de JavaScript autorizados**: agrega las direcciones desde donde se abrirá la app,
     por ejemplo `http://localhost:5173` y `https://TU_USUARIO.github.io`.
   - Copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).

</details>

### 3. Configurar MusuqDent

Tienes dos opciones:

- **Desde la app:** en la pantalla de inicio de sesión pulsa **"Configurar conexión con Google"**
  y pega el Client ID y la URL de la hoja. Se guarda en ese navegador.
- **En el build:** copia `.env.example` a `.env.local` y completa los valores
  (`VITE_GOOGLE_CLIENT_ID`, `VITE_SPREADSHEET_ID`, opcionalmente `VITE_ALLOWED_EMAILS`).

### 4. Dar acceso al personal

Comparte la hoja de Google Sheets como **Editor** con cada persona del consultorio
(recepción, doctores). Quien no tenga acceso a la hoja no podrá ver ni modificar los datos, aunque
abra la aplicación.

## Publicar en GitHub Pages

1. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
2. (Opcional) En **Settings → Secrets and variables → Actions → Variables** crea
   `VITE_GOOGLE_CLIENT_ID` y `VITE_SPREADSHEET_ID` para que la app ya venga configurada.
   También puedes definir `VITE_CLINIC_NAME`, `VITE_CLINIC_ADDRESS` y `VITE_CLINIC_PHONE`.
3. Cada push a `main` ejecuta las pruebas y publica la app en
   `https://TU_USUARIO.github.io/MusuqDent/`.
4. Agrega esa dirección (`https://TU_USUARIO.github.io`) en los orígenes autorizados del Client ID.

## Importar desde Excel

En **Importar** elige qué quieres cargar y selecciona el archivo `.xlsx` o `.csv`. Puedes descargar
una plantilla de ejemplo desde la misma pantalla. Consejos:

- Se reconocen encabezados comunes como *Nombres, Apellidos, DNI, Celular, Fecha de nacimiento,
  Correo*; si tu archivo tiene una sola columna *Paciente* o *Nombre completo*, se separa en nombres
  y apellidos.
- Fechas aceptadas: `14/03/1990`, `1990-03-14` o fechas de Excel.
- Si Excel quitó el cero inicial de un DNI (`7654321`), se corrige a `07654321`.
- Para atenciones y pagos, cada fila debe tener el **DNI del paciente** (que ya debe estar
  registrado). Importa primero a los pacientes.
- Los pacientes con un documento ya registrado se omiten (no se duplican).

## Cómo se guardan los datos

Cada pestaña de la hoja es una tabla y cada fila un registro. La fila 1 contiene los nombres de las
columnas (`id`, `nombres`, `apellidos`, …). Puedes ver y filtrar los datos directamente en Google
Sheets, e incluso agregar columnas propias (MusuqDent las respeta), pero **no modifiques la columna
`id`** ni los nombres de las columnas existentes.

Fechas: `AAAA-MM-DD`. Citas: `AAAA-MM-DDTHH:mm` en hora de Lima.

**Limitaciones conocidas** (propias de no tener backend):

- Si dos personas editan el mismo registro al mismo tiempo, prevalece el último cambio. Usa el botón
  **⟳ Actualizar** para traer los cambios de los demás.
- La sesión de Google dura aproximadamente 1 hora; luego hay que volver a ingresar.
- Pensado para el volumen de un consultorio (miles de registros). Google Sheets admite hasta 10
  millones de celdas por archivo.
- Los datos de salud son sensibles: comparte la hoja solo con el personal autorizado y activa la
  verificación en dos pasos en esas cuentas de Google.

## Desarrollo

```bash
npm run dev      # servidor de desarrollo
npm test         # pruebas unitarias (Vitest)
npm run build    # build de producción en dist/
```

Estructura:

```
src/
  auth/        inicio de sesión con Google (Google Identity Services)
  data/        almacenamiento: SheetsStore (Google Sheets) y LocalStore (modo demo)
  lib/         esquema de tablas, utilidades, importación y compartir citas
  components/  layout, formularios, modal de citas
  pages/       Inicio, Pacientes, Ficha, Doctores, Agenda, Importar, Configuración
```

Tecnologías: React + Vite, FullCalendar, Papa Parse y read-excel-file.

## Próximos pasos sugeridos

- Odontograma en la ficha del paciente.
- Recordatorios automáticos (por ejemplo con Google Apps Script).
- Reportes de ingresos por doctor y por tratamiento.
- Catálogo de tratamientos con precios.
