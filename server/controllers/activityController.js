import { getRecentActivities } from '../services/activityService.js'

export const listUserActivities = (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10
    const activities = getRecentActivities(req.user.id, limit)
    res.json({ activities })
  } catch (error) {
    next(error)
  }
}
