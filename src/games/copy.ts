import {stages,type Kind} from './model';
import {language} from '../lib/locale';
const english={orbit:[['First Orbit','Glowing edges mark where to jump. Clear each gap.'],['Crossing Lights','Steer around tall pillars. Jump the gaps.'],['Starbound Path','After each pillar, return toward the center. Keep your rhythm to the finish.']],amber:[['A Small Step','Move right and jump just before each gap.'],['Sky Steps','Jump onto raised platforms. Land before your next jump.'],['Amber Garden','Jump over the red spikes. Check the next platform and take your time.']]};
export const stageName=(kind:Kind,index:number)=>language()==='ja'?stages[kind][index].name:english[kind][index][0];
export const stageHint=(kind:Kind,index:number)=>language()==='ja'?stages[kind][index].hint:english[kind][index][1];
