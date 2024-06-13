import { Router } from "express";
import reviewController from "../controllers/ReviewController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = Router();

router.post("/", authMiddleware, reviewController.createReview);
router.get("/hasReview", reviewController.hasReview);
router.get("/:seller_id", reviewController.getReviewsBySeller);

export default router;
