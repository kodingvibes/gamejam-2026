import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas en el build. Con el valor por defecto ('/') el juego solo carga
  // si se sirve desde la raíz de un dominio; con './' funciona igual en la raíz, en
  // una subcarpeta o abriendo el index.html directamente.
  base: './',
});
