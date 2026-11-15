// js-aruco2 is a script-style library (it assigns to `this`), which bundlers can't import as a module.
// We load its two source files as raw text and run them in a tiny sandbox, then re-export AR.
import cvSrc from 'js-aruco2/src/cv.js?raw';
import arSrc from 'js-aruco2/src/aruco.js?raw';

const host = {};
new Function('require', cvSrc).call(host, () => ({ CV: host.CV }));
new Function('require', arSrc).call(host, () => ({ CV: host.CV }));
export const AR = host.AR;
export const CV = host.CV;
