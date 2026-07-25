import { Router } from "express";

import projectRouter from "./project.routes";
import analysisRouter from "./analysis.routes";
import dashboardRouter from "./dashboard.routes";
import scopeItemRouter from "./scopeItem.routes";
import AuthRouter from "./auth.routes";

const router = Router();

router.use("/projects", projectRouter);

router.use("/analysis", analysisRouter);

router.use("/scope-items", scopeItemRouter);

router.use("/dashboard", dashboardRouter);

router.use("/auth", AuthRouter);

export default router;