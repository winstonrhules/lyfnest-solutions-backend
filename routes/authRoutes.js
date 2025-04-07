const express = require("express");
const {registerUser, 
    loginUser, 
    getallUsers,  
    getaUser, 
    deleteaUser,
     updateUser, 
 
     handleRefreshToken,
     logout,
     updatePassword,
     //forgotPassword,
    // resetPasswordToken,
  
     loginAdmin,
   
    } = require("../controllers/userController");
const { authMiddleware, isAdmin } = require("../middlewares/authMiddleware");


const router = express.Router();

router.post("/register", registerUser)
router.post("/login", loginUser)
router.post("/login-admin", loginAdmin)
//router.post("/forgot-password", forgotPassword)
router.get("/handle-refresh", handleRefreshToken)
router.get("/logout", logout)
router.get("/all-users",  getallUsers)

router.get("/:id", authMiddleware, isAdmin, getaUser)
router.delete("/:id", authMiddleware, isAdmin, deleteaUser)

router.put("/edit-user", authMiddleware, isAdmin,  updateUser)


router.put("/password", authMiddleware, updatePassword)
//router.put("/reset-password/:token", resetPasswordToken)


module.exports = router;