import Router from "express";
const router = Router();
import goodController from "../controllers/goodController.js";
import authMiddleware from "../middleware/authMiddleware.js";

router.post("/add-good", authMiddleware, goodController.create);
router.get("/:gameId", goodController.getByGameId);
router.get("/offer/:goodId", goodController.getOffer);
router.put("/hide/:goodId", goodController.hideGood);
router.put("/publish/:goodId", goodController.publishGood);
router.get("/user/:userId", goodController.getByUserId);
router.post("/purchase/:goodId", authMiddleware, goodController.purchaseGood);
router.get("/purchase/:goodId", authMiddleware, goodController.getGoodData);

export default router;
