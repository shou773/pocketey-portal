import {STAGES,type State} from './model';
/** Simulation time keeps the non-animated arrival notice consistent through pause/retry. */
export function bossIncoming(s:State) {
 return s.stage===2&&s.status==='playing'&&!s.bossSpawned&&s.time>=28.5&&s.time<30;
}

/** Only the observed deadline with shields and a living boss gets timeout advice. */
export function bossTimedOut(s:State) {
 return s.stage===2&&s.status==='lost'&&s.hp>0&&s.time+1e-9>=STAGES[2].duration&&s.enemies.some(e=>e.kind==='boss'&&e.hp>0);
}
