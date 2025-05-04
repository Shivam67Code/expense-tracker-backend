const Income = require("../models/Income");
const Expense = require("../models/Expense");
const { isValidObjectId, Types } = require("mongoose");

// Dashboard Data
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.user.id;
    const userObjectId = new Types.ObjectId(String(userId));

    // Fetch total income & expenses
    const totalIncome = await Income.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    console.log("Total Income Aggregation Result:", totalIncome);


    const totalExpense = await Expense.aggregate([
      { $match: { userId: userObjectId } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);

    // Get income transactions in the last 60 days
    const last60Days = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const last60DaysIncomeTransactions = await Income.find({
      userId,
      date: { $gte: last60Days }
    }).sort({ date: -1 });

    // Get expense transactions in the last 60 days
    const last60DaysExpenseTransactions = await Expense.find({
      userId,
      date: { $gte: last60Days }
    }).sort({ date: -1 });

    // Get total income for last 60 days
    const incomeLast60Days = last60DaysIncomeTransactions.reduce(
      (sum, transaction) => sum + (Number(transaction.amount) || 0),
      0
    );
    console.log("Income Last 60 Days:", incomeLast60Days);

    // For debugging, verify the transaction amounts
    console.log("Transaction amounts:", last60DaysIncomeTransactions.map(t => t.amount));

    // Get total expenses for last 60 days
    const expenseLast60Days = last60DaysExpenseTransactions.reduce(
      (sum, transaction) => sum + transaction.amount,
      0
    );

    // Get total income for last 30 days
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const incomeLast30Days = last60DaysIncomeTransactions
      .filter(item => item.date >= last30Days)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    // Get total expenses for last 30 days
    const expenseLast30Days = last60DaysExpenseTransactions
      .filter(item => item.date >= last30Days)
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    // Fetch last 5 transactions (income + expenses) sorted by date
    const lastIncomeTransactions = await Income.find({ userId })
      .sort({ date: -1 })
      .limit(5)
      .lean();  // Using lean() is more efficient than toObject()

    const lastExpenseTransactions = await Expense.find({ userId })
      .sort({ date: -1 })
      .limit(5)
      .lean();

    // Combine and sort all transactions
    const lastTransactions = [
      ...lastIncomeTransactions.map(txn => ({
        ...txn,
        type: "income"
      })),
      ...lastExpenseTransactions.map(txn => ({
        ...txn,
        type: "expense"
      }))
    ]
      .sort((a, b) => new Date(b.date) - new Date(a.date))  // Sort by date, latest first
      .slice(0, 5);  // Take only the 5 most recent transactions

    // Format income transactions for chart consumption
    const formattedIncomeTransactions = last60DaysIncomeTransactions.map(transaction => ({
      month: new Date(transaction.date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      }),
      amount: transaction.amount,
      title: transaction.title,
      date: transaction.date,
      // Also include the original fields
      _id: transaction._id,
      icon: transaction.icon
    }));

    // Format expense transactions for chart consumption - ADD THIS CODE
    const formattedExpenseTransactions = last60DaysExpenseTransactions.map(transaction => ({
      month: new Date(transaction.date).toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short'
      }),
      amount: transaction.amount,
      category: transaction.category,
      date: transaction.date,
      _id: transaction._id,
      icon: transaction.icon
    }));

    // Get last 30 days expense transactions - ADD THIS CODE
    const last30DaysExpenseTransactions = formattedExpenseTransactions
      .filter(item => new Date(item.date) >= last30Days);

    // Send the complete dashboard data
    res.status(200).json({
      // Account summary
      summary: {
        totalBalance: (totalIncome[0]?.total || 0) - (totalExpense[0]?.total || 0),
        totalIncome: totalIncome[0]?.total || 0,
        totalExpenses: totalExpense[0]?.total || 0
      },

      // Last 30 days data - UPDATE THIS SECTION
      last30Days: {
        income: incomeLast30Days,
        expenses: expenseLast30Days,
        expenseTransactions: last30DaysExpenseTransactions // Add this line
      },

      // Last 60 days data - UPDATE THIS SECTION
      last60Days: {
        income: {
          total: incomeLast60Days,
          transactions: formattedIncomeTransactions
        },
        expenses: {
          total: expenseLast60Days,
          transactions: formattedExpenseTransactions // Use formatted transactions here
        }
      },

      // Add specific section for last30DaysExpenses - ADD THIS SECTION
      last30DaysExpenses: {
        transactions: last30DaysExpenseTransactions
      },

      // Recent activity
      recentTransactions: lastTransactions
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};
