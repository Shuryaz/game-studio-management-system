import swagger from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { projectRoutes } from "./modules/projects/project.routes";

const app = new Elysia()
  .use(cors({
    // Restrict to the known frontend origin — never use wildcard when credentials: true
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    // Required for the browser to send/receive httpOnly cookies cross-origin
    credentials: true,
  }))
  .use(swagger())
  .use(authRoutes)
  .use(projectRoutes)
  .get("/", () => "GSMS API Running")
  .listen(3001);

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`);
