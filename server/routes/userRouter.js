import Router from "express";
const router = Router();
import userController from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";

router.post("/registration", userController.registration);
router.post("/login", userController.login);
router.get("/auth", authMiddleware, userController.check);
router.get("/purchases", authMiddleware, userController.getUserPurchases);
router.get("/sells", authMiddleware, userController.getUserSells);
router.get("/:id", userController.getOneUser);
router.post("/add-balance", userController.addBalance);

router.put("/:id", authMiddleware, userController.update);

// админка
router.put("/block/:id", authMiddleware, userController.blockUser);
router.put("/unblock/:id", authMiddleware, userController.unblockUser);
router.put(
    "/grant-tech-support/:id",
    authMiddleware,
    userController.grantTechSupport
);
router.put(
    "/revoke-tech-support/:id",
    authMiddleware,
    userController.revokeTechSupport
);
router.get("/is-blocked/:id", authMiddleware, userController.isUserBlocked);

export default router;
