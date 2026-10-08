export type MixGame='orbit'|'amber'|'pulse'|'tilt';
export const MASTER_GAIN=.85;
export const MUSIC_TRIM:Record<MixGame,number>={orbit:1,amber:1.1,pulse:1,tilt:1.5};
export const EFFECTS_GAIN=.9;
// Conservative decoded/oversampled peaks: scores < .5, selected effects < .3.
// Reserve the maximum score at all volume settings, including during ramps.
export const MUSIC_PEAK_BOUND=.5, EFFECTS_PEAK_BOUND=.3, MIX_BUDGET=1.03;
export function effectsLevel(game:MixGame,volume:number,muted:boolean,weights:number){
 if(muted)return 0;
 const reserved=MIX_BUDGET-MUSIC_PEAK_BOUND*MUSIC_TRIM[game];
 return Math.min(volume*EFFECTS_GAIN,reserved/(EFFECTS_PEAK_BOUND*Math.max(1,weights)));
}
export function musicLevel(game:MixGame,volume:number,muted:boolean,duck=false){return muted?0:volume*MUSIC_TRIM[game]*(duck?.5:1);}
