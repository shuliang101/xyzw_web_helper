
import { gameLogger } from '@/utils/logger';
import { XyzwWebSocketClient } from '@/utils/xyzwWebSocket';
import { EventEmitter } from 'event-emitter3';

import { AckPlugin } from './ack.ts';
import { ChatPlugin } from './chat.ts';
import { HangupPlugin } from './hangup.ts';
import { LegionPlugin } from './legion.ts';
import { RolePlugin } from './role.ts';
import { StudyPlugin } from './study.ts';
import { TeamPlugin } from './team.ts';
import { TowerPlugin } from './tower.ts';

export const $emit = new EventEmitter();
export const events: Set<string> = new Set<string>();
$emit.on('$any', (cmd: string, data: XyzwSession) => {
  gameLogger.warn(`收到未处理事件: ${cmd} TokenID: ${data.tokenId}`, data);
});

export const onSome = (event: string[], listener: (...args: any[]) => void) => {
  event.map((e) => events.add(e));
  event.forEach(evt => {
    $emit.on(evt, listener);
  })
}

export const emitPlus = (
  event: string | symbol,
  ...args: Array<any>
): boolean => {
  // 先触发具体事件，然后触发$any事件
  const result = $emit.emit(event, ...args);
  if (!events.has(event as string)) {
    $emit.emit("$any", event, ...args);
  }
  return result;
};

export interface XyzwSession {
  id: string;
  tokenId: string;
  cmd: string;
  token: any;
  body: any;
  client: XyzwWebSocketClient | null;
  gameData: any;
}

export interface EVM {
  onSome: (event: string[], listener: (...args: any[]) => void) => void;
  emitPlus: (event: string | symbol, ...args: Array<any>) => boolean;
  $emit: EventEmitter;
}

const evmInst: EVM = {
  onSome,
  emitPlus,
  $emit,
};

AckPlugin(evmInst);

RolePlugin(evmInst);

TeamPlugin(evmInst);

StudyPlugin(evmInst);

TowerPlugin(evmInst);

LegionPlugin(evmInst);

ChatPlugin(evmInst);

HangupPlugin(evmInst);

onSome(['evotowerinforesp', 'evotower_getinfo', 'evotower_getinforesp'], (data: XyzwSession) => {
  gameLogger.verbose(`收到怪异塔信息事件: ${data.tokenId}`, data);
  const { body } = data;
  if (!body) {
    gameLogger.debug('怪异塔信息响应为空');
    return;
  }
  data.gameData.value.weirdTowerInfo = body;
  data.gameData.value.lastUpdated = new Date().toISOString();
});

onSome([
  'team_getteaminfo',
  'team_getteaminforesp',
  'role_gettargetteam',
  'role_gettargetteamresp'
], (data: XyzwSession) => {
  gameLogger.verbose(`收到队伍信息事件: ${data.tokenId}`, data);
  const { body, gameData, cmd } = data;
  if (!body) {
    gameLogger.debug('队伍信息响应为空');
    return;
  }
  // 更新队伍数据
  if (!gameData.value.presetTeam) {
    gameData.value.presetTeam = {}
  }
  gameData.value.presetTeam = { ...gameData.value.presetTeam, ...body }
  data.gameData.value.lastUpdated = new Date().toISOString()
});

onSome([
  'presetteam_setteam',
  'presetteam_setteamresp',
  'presetteam_saveteam',
  'presetteam_saveteamresp',
], (data: XyzwSession) => {
  gameLogger.verbose(`收到队伍信息事件: ${data.tokenId}`, data);
  const { body, gameData, cmd } = data;
  if (!body) {
    gameLogger.debug('队伍信息响应为空');
    return;
  }
  // 更新队伍数据
  if (!gameData.value.presetTeam) {
    gameData.value.presetTeam = {}
  }
  // 设置/保存队伍响应 - 可能只返回确认信息
  if (body.presetTeamInfo) {
    gameData.value.presetTeam.presetTeamInfo = body.presetTeamInfo
  }
  // 合并其他队伍相关数据
  Object.keys(body).forEach(key => {
    if (key.includes('team') || key.includes('Team')) {
      gameData.value.presetTeam[key] = body[key]
    }
  })
});

onSome(['tower_getinfo', 'tower_getinforesp'], (data: XyzwSession) => {
  gameLogger.verbose(`收到查询塔事件: ${data.tokenId}`, data);
  const { body, gameData, client } = data;
  // 保存爬塔结果到gameData中，供组件使用
  if (!gameData.value.towerResult) {
    gameData.value.towerResult = {}
  }
  if (!body) {
    gameLogger.warn('爬塔战斗开始响应为空');
    return;
  }
  gameData.value.towerInfo = body?.tower || body
  gameData.value.lastUpdated = new Date().toISOString()
});
onSome(['fight_starttower', 'fight_starttowerresp'], (data: XyzwSession) => {
  gameLogger.verbose(`收到爬塔战斗开始事件: ${data.tokenId}`, data);
  const { body, gameData, client } = data;
  // 保存爬塔结果到gameData中，供组件使用
  if (!gameData.value.towerResult) {
    gameData.value.towerResult = {}
  }
  if (!body) {
    gameLogger.warn('爬塔战斗开始响应为空');
    return;
  }
  const battleData = body.battleData
  if (!battleData) {
    gameLogger.warn('爬塔战斗数据为空');
    return;
  }

  // 判断爬塔结果
  const towerId = battleData.options?.towerId
  const curHP = battleData.result?.sponsor?.ext?.curHP
  const isSuccess = curHP > 0
  gameData.value.towerResult = {
    success: isSuccess,
    curHP,
    towerId,
    timestamp: Date.now()
  }
  gameData.value.lastUpdated = new Date().toISOString()

  // 检查是否需要自动领取奖励
  if (!isSuccess && towerId == undefined) {
    return;
  }

  const layer = towerId % 10
  const rewardFloor = Math.floor(towerId / 10)

  // 如果是新层数的第一层(layer=0)，检查是否有奖励可领取
  if (layer === 0) {
    setTimeout(() => {
      const roleInfo = gameData.value.roleInfo
      const towerRewards = roleInfo?.role?.tower?.reward

      if (towerRewards && !towerRewards[rewardFloor]) {
        // 保存奖励信息
        gameData.value.towerResult.autoReward = true
        gameData.value.towerResult.rewardFloor = rewardFloor
        client?.send('tower_claimreward', { rewardId: rewardFloor })
      }
    }, 1500)
  }

  // 爬塔后立即更新角色信息和塔信息
  setTimeout(() => {
    try {
      client?.send('role_getroleinfo', {})
    } catch (error) {
      // 忽略更新数据错误
    }
  }, 1000)
});


onSome(['tower_claimreward', 'tower_claimrewardresp'], (data: XyzwSession) => {
  const { body, gameData, client } = data;
  if (!body) {
    gameLogger.warn('爬塔战斗开始响应为空');
    return;
  }
  // 奖励领取成功后更新角色信息
  setTimeout(() => {
    client?.send('role_getroleinfo', {})
  }, 500)
});
