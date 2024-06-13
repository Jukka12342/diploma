import Router from "express";
const router = Router();
import gameController from "../controllers/gameController.js";
import checkRole from "../middleware/checkRoleMiddleware.js";

router.get("/count", gameController.getCount);
router.post("/", checkRole(2), gameController.create);
router.get("/", gameController.getAll);
router.get("/search", gameController.search);

export default router;
