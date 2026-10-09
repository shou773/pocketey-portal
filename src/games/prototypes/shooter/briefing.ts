import type {State} from './model';
/** Simulation time keeps the non-animated arrival notice consistent through pause/retry. */
export function bossIncoming(s:State) {
 return s.stage===2&&s.status==='playing'&&!s.bossSpawned&&s.time>=28.5&&s.time<30;
}
