# GIOR Move & Style — demo

Sitio promocional + panel de gestión para una tienda de ropa fitness de Criciúma (todo en portugués de Brasil).

- `index.html` — sitio: colección, sacola de reserva (envía por WhatsApp/Direct), cómo comprar, pagos y seguimiento de pedido.
- `admin.html` — panel: dashboard, productos, categorías (con íconos propios), pedidos con estados/prioridad y notificaciones (con simulador de mensajes de WhatsApp/Instagram).

Demo estática: los datos se guardan en el `localStorage` del navegador (no hay servidor ni login).

## Ejecutar

```bash
npx -y http-server@14.1.1 -p 5500 -c-1
```

Abrir http://localhost:5500/index.html (sitio) y http://localhost:5500/admin.html (panel).
