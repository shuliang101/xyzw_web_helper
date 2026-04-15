import cron from 'node-cron'
import {
  getDueMembersByTime,
  getDueSendPlansByTime,
  runClubCarSend,
  runClubCarClaim,
} from './clubCarService.js'

class ClubCarScheduler {
  constructor() {
    this.job = null
    this.running = false
  }

  start() {
    this.reload()
  }

  stop() {
    if (this.job) {
      this.job.stop()
      this.job = null
    }
  }

  reload() {
    this.stop()
    this.job = cron.schedule('* * * * *', () => this.runDueMembers(), {
      timezone: 'Asia/Shanghai',
    })
    console.log('[ClubCarScheduler] registered minute dispatcher: * * * * *')
  }

  async _run(taskName, taskFn) {
    if (this.running) {
      return { skipped: true, reason: `another ${taskName} task is running` }
    }

    this.running = true
    try {
      return await taskFn()
    } finally {
      this.running = false
    }
  }

  async runSendNow() {
    return this._run('send', runClubCarSend)
  }

  async runClaimNow() {
    return this._run('claim', runClubCarClaim)
  }

  async runDueMembers() {
    return this._run('dispatch', async () => {
      const now = new Date()
      const sendDuePlans = getDueSendPlansByTime(now)
      const claimDueMembers = getDueMembersByTime('claim', now)

      const result = {
        now: now.toISOString(),
        sendDue: sendDuePlans.length,
        claimDue: claimDueMembers.length,
        send: null,
        claim: null,
      }

      if (sendDuePlans.length > 0) {
        result.send = await runClubCarSend({
          now,
          planIds: sendDuePlans.map(item => item.id),
          runType: 'send_auto',
        })
      }

      if (claimDueMembers.length > 0) {
        result.claim = await runClubCarClaim({
          now,
          memberRoleIds: claimDueMembers.map(item => item.roleId),
          runType: 'claim_auto',
        })
      }

      return result
    })
  }
}

export const clubCarScheduler = new ClubCarScheduler()
