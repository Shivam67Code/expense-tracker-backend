const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getMealAttendance,
  updateMealAttendance,
  downloadMealAttendanceExcel,
  getMealSummary
} = require('../controllers/mealController');

const router = express.Router();

router.get('/get', protect, getMealAttendance);
router.post('/update', protect, updateMealAttendance);
router.get('/downloadExcel', protect, downloadMealAttendanceExcel);
router.get('/summary', protect, getMealSummary);

module.exports = router;