import type { Command, Result } from '../domain/model/types';
import { CommandType, Phase } from '../domain/model/types';
import type { World } from '../domain/model/World';
import { build } from './commands/build';
import { callWave } from './commands/callWave';
import { endless } from './commands/endless';
import { receive } from './commands/receive';
import { sell } from './commands/sell';
import { send } from './commands/send';
import { target } from './commands/target';
import { upgrade } from './commands/upgrade';
import { fail } from './result';

/** Seule porte d'entrée des ordres du joueur : chaque ordre accepté est journalisé pour le rejeu. */
export function dispatch(world: World, cmd: Command): Result {
  const r = execute(world, cmd);
  if (r.ok) world.log.push({ tick: world.tick, cmd });
  return r;
}

function execute(world: World, cmd: Command): Result {
  if (world.phase === Phase.Defeat) return fail('La partie est terminée.');
  if (world.phase === Phase.Victory && cmd.c !== CommandType.Endless) return fail('La partie est terminée.');
  switch (cmd.c) {
    case CommandType.Build: return build(world, cmd);
    case CommandType.Upgrade: return upgrade(world, cmd);
    case CommandType.Sell: return sell(world, cmd);
    case CommandType.Target: return target(world, cmd);
    case CommandType.CallWave: return callWave(world);
    case CommandType.Endless: return endless(world);
    case CommandType.Send: return send(world, cmd);
    case CommandType.Receive: return receive(world, cmd);
  }
}
