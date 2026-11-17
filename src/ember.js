'use strict';
// Ember, den's fox. Each letter is one pixel; '.' is see-through.

const S = require('./sprite');

const INK = { O: '#f0843c', o: '#c4602a', W: '#f6ead8', E: '#1b1410', N: '#2a1a12', K: '#4a2c1c', S: '#7fb8ff' };

const BASE = [
  '..........................',
  '....K...............K.....',
  '....KK.............KK.....',
  '....KWK...........KWK.....',
  '....OWWO.........OWWO.....',
  '...OOOOOOOOOOOOOOOOOOO....',
  '...OOOOWEOOOOOOOWEOOOO....',
  '...WWOOEEOOOOOOOEEOOWW....',
  '....WWWOOOOOOOOOOOWWW.....',
  '.....WWWWWWWWWWWWWWW......',
  '.......WWWWWNWWWWW........',
  '.........WWWWWWW....OOo...',
  '........OOWWWWWOO..OOOWW..',
  '.......OOOOWWWWWOOOOOOWWW.',
  '.......OOOOOWWWOOOOOOWWWW.',
  '.......oOOOOOOOOOOOOOWWW..',
  '........KKK.oOOOo.KKKoW...',
];

const swap = (grid, rows) => grid.map((r, i) => (rows[i] !== undefined ? rows[i] : r));

const FRAMES = {
  idle: BASE,
  // eyes shut
  blink: swap(BASE, { 6: '...OOOOOOOOOOOOOOOOOOO....' }),
  // ^ ^ : pleased
  happy: swap(BASE, { 6: '...OOOOEEOOOOOOOEEOOOO....', 7: '...WWOEOOEOOOOOEOOEOWW....' }),
  // a worried little drop
  oops: swap(BASE, { 3: '....KWK...........KWK..S..', 4: '....OWWO.........OWWO.SSS.', 5: '...OOOOOOOOOOOOOOOOOOOSSS.' }),
  // the tail flicks up
  tail: swap(BASE, {
    10: '.......WWWWWNWWWWW...OO...', 11: '.........WWWWWWW....OOWW..', 12: '........OOWWWWWOO...OWWW..',
    13: '.......OOOOWWWWWOOOOOOWW..', 14: '.......OOOOOWWWOOOOOOOW...', 15: '.......oOOOOOOOOOOOOOO....', 16: '........KKK.oOOOo.KKK.....',
  }),
};

/** Ember for the terminal: lines of text. */
function draw(frame = 'idle', bg = null) {
  return S.draw(FRAMES[frame] || BASE, INK, { bg });
}

/** Ember for the page. */
function web() {
  return { ink: INK, frames: FRAMES };
}

module.exports = { INK, FRAMES, draw, web };
