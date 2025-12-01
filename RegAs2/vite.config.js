import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración crucial para GitHub Pages: usa el nombre del repositorio ('/CIC/')
export default defineConfig({
  plugins: [react()],
  base: '/CIC/', 
})