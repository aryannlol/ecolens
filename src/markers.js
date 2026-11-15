import { AR } from './ar/aruco.js';
import { CONFIG } from './config.js';
const dict = new AR.Dictionary(CONFIG.markers.dictionary);
const sheet = document.getElementById('sheet');
for (const [id, world] of Object.entries(CONFIG.markers.ids)) {
  const fig = document.createElement('figure');
  fig.innerHTML = dict.generateSVG(Number(id)) + `<figcaption>${CONFIG.worlds[world].label} (ID ${id})</figcaption>`;
  sheet.appendChild(fig);
}
