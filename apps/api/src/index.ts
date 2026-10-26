import swagger from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { authRoutes } from "./modules/auth/auth.routes";
import { projectRoutes } from "./modules/projects/project.routes";
import { userRoutes } from "./modules/users/user.routes";
import { sprintRoutes } from "./modules/sprints/sprint.routes";
import { taskRoutes } from "./modules/tasks/tasks.routes";
import { assetRoutes } from "./modules/assets/asset.routes";
import { bugRoutes }   from "./modules/bugs/bug.routes";
import { teamRoutes }  from "./modules/team/team.routes";

const app = new Elysia()
  .use(cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    credentials: true,
  }))
  .use(swagger())
  .use(authRoutes)
  .use(projectRoutes)
  .use(userRoutes)
  .use(sprintRoutes)
  .use(taskRoutes)
  .use(assetRoutes)
  .use(bugRoutes)
  .use(teamRoutes)
  .get("/", () => "GSMS API Running")
  .listen(3001);

console.log(`API running at ${app.server?.hostname}:${app.server?.port}`);
