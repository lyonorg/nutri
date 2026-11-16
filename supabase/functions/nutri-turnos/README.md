Función `nutri-turnos` (Supabase Edge Function, proyecto mision-diaria).
Lee el calendario de Google con el enlace iCal privado guardado en `nutri_secretos` y devuelve
`{ turnos: [{ fecha, turno, inicio, fin, titulo }] }` para los últimos 7 días y los próximos 60.
Un evento cuenta como turno si su título dice "Turno" y "Mañana", "Tarde" o "Noche".
El código desplegado está en el panel de Supabase; requiere sesión (JWT).
