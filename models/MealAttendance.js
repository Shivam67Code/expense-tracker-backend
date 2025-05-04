const mongoose = require('mongoose');

const MealAttendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  morning: {
    type: Boolean,
    default: false
  },
  evening: {
    type: Boolean,
    default: false
  },
  nonVeg: {
    omelette: {
      type: Boolean,
      default: false
    },
    eggCurry: {
      type: Boolean,
      default: false
    },
    chicken: {
      type: Boolean,
      default: false
    },
    other: {
      type: String,
      default: ""
    }
  }
}, { timestamps: true });

// Compound index to ensure one record per user per day
MealAttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MealAttendance', MealAttendanceSchema);