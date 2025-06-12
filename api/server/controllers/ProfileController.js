// ProfileController.js
// Aggregates user info and usage stats for profile dialog

const {
  User,
  Conversation,
  Message,
  Transaction,
} = require('~/db/models');
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

    // --- Aggregate daily usage (tokens and cost) using correct logic ---
    // Define 'since' for 30 days ago at midnight
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - 30);

    // --- Aggregate daily usage (tokens and cost) using correct logic ---
    const transactionsDaily = await Transaction.find({ user: user._id, createdAt: { $gte: since } });
    const dailyUsageMap = {};
    for (const tx of transactionsDaily) {
      const day = tx.createdAt ? tx.createdAt.toISOString().slice(0, 10) : 'unknown';
      if (!dailyUsageMap[day]) {
        dailyUsageMap[day] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        };
      }
      if (tx.tokenType === 'prompt') {
        dailyUsageMap[day].inputTokens += Math.round(Math.abs(tx.tokenValue || 0));
      } else if (tx.tokenType === 'completion') {
        dailyUsageMap[day].outputTokens += Math.round(Math.abs(tx.tokenValue || 0));
      }
      dailyUsageMap[day].totalTokens += Math.round(Math.abs(tx.tokenValue || 0));
      dailyUsageMap[day].totalCost += Math.abs(tx.tokenValue || 0) / 1000000;
    }
    const dailyUsage = Object.entries(dailyUsageMap).map(([date, data]) => ({ date, ...data }));

    // Usage by model (input, output, total tokens, and cost) using correct logic
    const transactions = await Transaction.find({ user: user._id, createdAt: { $gte: since } });
    const usageByModelMap = {};
    for (const tx of transactions) {
      const model = tx.model || 'unknown';
      if (!usageByModelMap[model]) {
        usageByModelMap[model] = {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          totalCost: 0,
        };
      }
      if (tx.tokenType === 'prompt') {
        usageByModelMap[model].inputTokens += Math.round(Math.abs(tx.tokenValue || 0));
      } else if (tx.tokenType === 'completion') {
        usageByModelMap[model].outputTokens += Math.round(Math.abs(tx.tokenValue || 0));
      }
      usageByModelMap[model].totalTokens += Math.round(Math.abs(tx.tokenValue || 0));
      usageByModelMap[model].totalCost += Math.abs(tx.tokenValue || 0) / 1000000;
    }
    const usageByModel = Object.entries(usageByModelMap).map(([model, data]) => ({ _id: model, ...data }));

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
