import Router from "express";
const router = Router();
import userRouter from "./userRouter.js";
import gameRouter from "./gameRouter.js";
import goodRouter from "./goodRouter.js";
import reviewRouter from "./reviewRouter.js";

router.use("/user", userRouter);
router.use("/game", gameRouter);
router.use("/good", goodRouter);
router.use("/review", reviewRouter);

export default router;
