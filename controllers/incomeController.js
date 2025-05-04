const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");
const Income = require("../models/Income");

// Add Income Source
exports.addIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const { icon, title, amount, date, description } = req.body;

    // Validation: Check for missing fields
    if (!title || !amount || !date) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newIncome = new Income({
      userId,
      icon,
      title,
      amount,
      date: new Date(date),
      description // Add description field
    });

    await newIncome.save();
    res.status(201).json(newIncome);
  } catch (error) {
    console.error("Error adding income:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get All Income Source
exports.getAllIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const incomes = await Income.find({ userId }).sort({ date: -1 });
    res.status(200).json(incomes);
  } catch (error) {
    console.error("Error fetching incomes:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Income Source
exports.deleteIncome = async (req, res) => {
  try {
    await Income.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Income deleted successfully" });
  } catch (error) {
    console.error("Error deleting income:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Download Excel
exports.downloadIncomeExcel = async (req, res) => {
  const userId = req.user.id;
  try {
    // Get income data
    const incomes = await Income.find({ userId }).sort({ date: -1 });

    // Prepare data for Excel
    const data = incomes.map((item) => ({
      Title: item.title,
      Amount: item.amount,
      Date: new Date(item.date).toLocaleDateString(),
      Description: item.description || "" // Add description field to Excel
    }));

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create Excel file
    const filePath = path.join(tempDir, 'income_details.xlsx');
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "Income");
    xlsx.writeFile(wb, filePath);

    // Send the file
    res.download(filePath, 'income_details.xlsx', (err) => {
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
    console.error("Error downloading Excel:", error);
    res.status(500).json({ message: "Server Error" });
  }
};