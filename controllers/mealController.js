const MealAttendance = require('../models/MealAttendance');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

// Get meal attendance for a month
exports.getMealAttendance = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  try {
    // Default to current month if not provided
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Create start and end date for the month (using UTC dates to avoid timezone issues)
    const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

    const meals = await MealAttendance.find({
      userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    res.status(200).json(meals);
  } catch (error) {
    console.error('Error fetching meal attendance:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Update or create meal attendance
exports.updateMealAttendance = async (req, res) => {
  const userId = req.user.id;
  try {
    const { date, morning, evening, nonVeg } = req.body;  // Add nonVeg here

    // Validate request body
    if (!date) {
      return res.status(400).json({ message: 'Date is required' });
    }

    // Fixed: Parse the date correctly preserving the day
    // Create a date at noon to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const mealDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // Try to find existing record for this date
    // Find with year, month, day matching instead of direct date comparison
    const startOfDay = new Date(Date.UTC(year, month - 1, day));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));

    const mealRecord = await MealAttendance.findOne({
      userId,
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    });

    if (mealRecord) {
      // Update existing record
      mealRecord.morning = morning !== undefined ? morning : mealRecord.morning;
      mealRecord.evening = evening !== undefined ? evening : mealRecord.evening;

      // Add handling for nonVeg options
      if (nonVeg !== undefined) {
        mealRecord.nonVeg = nonVeg;
      }

      await mealRecord.save();
      return res.status(200).json(mealRecord);
    } else {
      // Create new record
      const newMeal = new MealAttendance({
        userId,
        date: mealDate,
        morning: morning || false,
        evening: evening || false,
        nonVeg: nonVeg || {}  // Add nonVeg to new record
      });
      await newMeal.save();
      return res.status(201).json(newMeal);
    }
  } catch (error) {
    console.error('Error updating meal attendance:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Download meal attendance as Excel
exports.downloadMealAttendanceExcel = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  try {
    // Default to current month if not provided
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Create start and end date for the month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);

    // Get data for the month
    const meals = await MealAttendance.find({
      userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    }).sort({ date: 1 });

    // Prepare data for Excel
    const data = meals.map(meal => ({
      Date: new Date(meal.date).toLocaleDateString(),
      'Morning Meal': meal.morning ? 'Yes' : 'No',
      'Evening Meal': meal.evening ? 'Yes' : 'No'
    }));

    // Add summary row
    const morningCount = meals.filter(meal => meal.morning).length;
    const eveningCount = meals.filter(meal => meal.evening).length;
    const totalPossible = endDate.getDate() * 2; // Days in month * 2 meals per day

    data.push({});  // Empty row
    data.push({
      Date: 'Summary',
      'Morning Meal': `${morningCount} meals`,
      'Evening Meal': `${eveningCount} meals`
    });
    data.push({
      Date: 'Total',
      'Morning Meal': `${morningCount + eveningCount} out of ${totalPossible} possible meals (${Math.round((morningCount + eveningCount) / totalPossible * 100)}%)`
    });

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create Excel file
    const monthName = startDate.toLocaleString('default', { month: 'long' });
    const filePath = path.join(tempDir, `meal_attendance_${monthName}_${targetYear}.xlsx`);
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 },  // Date column
      { wch: 15 },  // Morning Meal column
      { wch: 15 }   // Evening Meal column
    ];

    xlsx.utils.book_append_sheet(wb, ws, "Meal Attendance");
    xlsx.writeFile(wb, filePath);

    // Send the file
    res.download(filePath, `meal_attendance_${monthName}_${targetYear}.xlsx`, (err) => {
      if (err) {
        console.error("Download error:", err);
      }

      // Clean up after download
      setTimeout(() => {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.error("Error removing temp file:", err);
        }
      }, 1000);
    });
  } catch (error) {
    console.error('Error downloading meal attendance Excel:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};

// Get summary statistics for meal attendance
exports.getMealSummary = async (req, res) => {
  const userId = req.user.id;
  const { month, year } = req.query;

  try {
    // Default to current month if not provided
    const currentDate = new Date();
    const targetMonth = month ? parseInt(month) - 1 : currentDate.getMonth();
    const targetYear = year ? parseInt(year) : currentDate.getFullYear();

    // Create start and end date for the month
    const startDate = new Date(targetYear, targetMonth, 1);
    const endDate = new Date(targetYear, targetMonth + 1, 0);
    const daysInMonth = endDate.getDate();

    // Get data for the month
    const meals = await MealAttendance.find({
      userId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    });

    // Calculate statistics
    const morningCount = meals.filter(meal => meal.morning).length;
    const eveningCount = meals.filter(meal => meal.evening).length;
    const totalMeals = morningCount + eveningCount;
    const totalPossible = daysInMonth * 2; // 2 meals per day
    const percentage = (totalMeals / totalPossible) * 100;

    // Calculate veg meal costs
    const vegCost = (morningCount + eveningCount) * 60; // Rs 60 per veg meal

    // Calculate non-veg costs
    let nonVegCost = 0;
    for (const meal of meals) {
      if (meal.nonVeg) {
        if (meal.nonVeg.omelette) nonVegCost += 30;
        if (meal.nonVeg.eggCurry) nonVegCost += 30;
        if (meal.nonVeg.chicken) nonVegCost += 70;
        // Note: We're not handling "other" items cost calculation here
      }
    }

    // Include the costs in the response
    res.status(200).json({
      morningCount,
      eveningCount,
      totalMeals,
      totalPossible,
      percentage: Math.round(percentage),
      month: targetMonth + 1,
      year: targetYear,
      daysInMonth,
      vegCost,
      nonVegCost,
      totalCost: vegCost + nonVegCost
    });
  } catch (error) {
    console.error('Error fetching meal summary:', error);
    res.status(500).json({ message: 'Server Error' });
  }
};