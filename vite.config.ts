import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 子路徑：/panda-finance/（規格第 15.2 節）
export default defineConfig({
  base: "/panda-finance/",
  plugins: [react()],
});
