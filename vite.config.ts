import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

const vercelApiPlugin = () => ({
  name: 'vercel-api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api')) {
        try {
          // Parse URL and populate req.query
          const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
          const pathname = urlObj.pathname;
          req.query = Object.fromEntries(urlObj.searchParams.entries());
          
          let filePath = path.resolve(__dirname, `.${pathname}.ts`);
          if (!fs.existsSync(filePath)) {
            // Also attempt index.ts if directory requested
            filePath = path.resolve(__dirname, `.${pathname}/index.ts`);
          }
          
          if (fs.existsSync(filePath)) {
            // Hot-load the TypeScript module containing the API function
            const module = await server.ssrLoadModule(filePath);
            if (module.default) {
              // Parse body for non-GET requests
              if (req.method !== 'GET' && req.method !== 'HEAD') {
                const chunks: any[] = [];
                for await (const chunk of req) {
                  chunks.push(chunk);
                }
                const bodyStr = Buffer.concat(chunks).toString();
                if (bodyStr) {
                  try {
                    req.body = JSON.parse(bodyStr);
                  } catch (e) {
                    req.body = bodyStr;
                  }
                }
              }

              // Mock Express/Vercel-like response helpers
              const originalRes = res;
              res.status = (code: number) => {
                originalRes.statusCode = code;
                return res;
              };
              res.json = (data: any) => {
                if (!originalRes.headersSent) {
                  originalRes.setHeader('Content-Type', 'application/json');
                }
                originalRes.end(JSON.stringify(data));
              };
              res.send = (data: any) => {
                originalRes.end(data);
              };

              await module.default(req, res);
              return;
            }
          }
        } catch (e: any) {
          console.error('[API Proxy Error]', e);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: e.message }));
          return;
        }
      }
      next();
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [react(), tailwindcss(), vercelApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      // You must specify the external resolution manually for server.ssrLoadModule sometimes, but Vite handles most.
    },
  }
})
