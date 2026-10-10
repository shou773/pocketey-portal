import {stages,type Kind} from './model';
import {language} from '../lib/locale';
const english={orbit:[['First Orbit','Steer around pillars and jump at the glowing edges. Watch the next obstacle.'],['Crossing Lights','Dodge successive left and right pillars. Prepare the next jump after landing.'],['Starbound Path','Switch sides and clear longer gaps. Look ahead and jump close to the edge.']],amber:[['A Small Step','Jump over spikes and gaps, then land before the next move. Stop to plan if needed.'],['Sky Steps','Clear changing heights and spikes in sequence. Choose your takeoff and landing.'],['Amber Garden','Jump over edge spikes and the gap together. Adjust your takeoff for uphill and downhill landings.'],['Landing Beats','You can stop on short platforms to line up. Land, then choose your next jump.']]};
export const stageName=(kind:Kind,index:number)=>language()==='ja'?stages[kind][index].name:english[kind][index][0];
export const stageHint=(kind:Kind,index:number)=>language()==='ja'?stages[kind][index].hint:english[kind][index][1];

