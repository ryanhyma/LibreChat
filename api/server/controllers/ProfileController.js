// ProfileController.js
// Aggregates user info and usage stats for profile dialog

const User = require('~/models/User');
const Conversation = require('~/models/schema/convoSchema');
const Message = require('~/models/schema/messageSchema');
const Transaction = require('~/models/Transaction'); // <-- Add this line
const { logger } = require('~/config');

/**
 * Returns aggregated user profile info and usage stats
 * GET /api/user/profile
 */
const getProfileController = async (req, res) => {
  try {
    // Get user info
    const user = req.user.toObject ? req.user.toObject() : { ...req.user };
    delete user.totpSecret;

    // Aggregate usage stats
    const [conversationsCount, messagesCount] = await Promise.all([
      Conversation.countDocuments({ user: user._id }),
      Message.countDocuments({ user: user._id }),
    ]);

    // --- Aggregate token usage and cost over last 30 days ---
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // Daily usage (tokens and cost)
    const dailyUsage = await Transaction.aggregate([
      { $match: { user: user._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            tokenType: "$tokenType",
          },
          totalTokens: { $sum: "$tokenValue" },
          totalCost: { $sum: "$rawAmount" },
        },
      },
      {
        $group: {
          _id: "$_id.day",
          tokens: {
            $sum: {
              $cond: [{ $eq: ["$_id.tokenType", "prompt"] }, "$totalTokens", 0],
            },
          },
          completions: {
            $sum: {
              $cond: [{ $eq: ["$_id.tokenType", "completion"] }, "$totalTokens", 0],
            },
          },
          credits: {
            $sum: {
              $cond: [{ $eq: ["$_id.tokenType", "credits"] }, "$totalTokens", 0],
            },
          },
          totalCost: { $sum: "$totalCost" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Usage by model
    const usageByModel = await Transaction.aggregate([
      { $match: { user: user._id, createdAt: { $gte: since } } },
      {
        $group: {
          _id: "$model",
          tokens: { $sum: "$tokenValue" },
          cost: { $sum: "$rawAmount" },
        },
      },
      { $sort: { tokens: -1 } },
    ]);

    res.status(200).json({
      user: {
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastActivity: user.lastActivity,
        // Add more fields as needed
      },
      usage: {
        conversations: conversationsCount,
        messages: messagesCount,
        daily: dailyUsage,
        byModel: usageByModel,
      },
    });
  } catch (err) {
    logger.error('[getProfileController]', err);
    res.status(500).json({ message: 'Failed to fetch user profile.' });
  }
};

module.exports = {
  getProfileController,
};
