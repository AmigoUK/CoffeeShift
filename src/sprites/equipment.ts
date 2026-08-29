import type { SpriteData } from './customers';

const machine: SpriteData = {
  w: 32, h: 28,
  rows: [
    '................................',
    '..ssssssssssssssssssssssssssss..',
    '..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
    '..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
    '..SSCssssCssssCssssCssssCssSSS..',
    '..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
    '..SSSSSSSSSSSSSSSSSSSSSSSSSSSS..',
    '..SSSssssSSSSSSSSSSSSSSssssSSS..',
    '..SSSssssSSSSSSSSSSSSSSssssSSS..',
    '..SSSssssSSSSSSSSSSSSSSssssSSS..',
    '..SSSssssSSSSSSSSSSSSSSssssSSS..',
    '..ssssssssssssssssssssssssssss..',
    '................................',
    '.......KKK..........KKK........',
    '.......KKK..........KKK........',
    '.......sss..........sss........',
    '.......sss..........sss........',
    '.......sss..........sss........',
    '................................',
    '..bbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
    '..BBBBBBBBBBBBBBBBBBBBBBBBBBBB..',
    '................................',
    '..KKK..........................',
    '..KKK..........................',
    '..KKK..........................',
  ],
};

const grinder: SpriteData = {
  w: 18, h: 22,
  rows: [
    '..................',
    '.....EEEEEE.......',
    '....EWWWWWWE......',
    '....EWBBWWWWE.....',
    '....EWWBBWWWE.....',
    '....EWWWWWWE......',
    '.....EWBBWE.......',
    '.....EEEEEE.......',
    '.....SSSSSS.......',
    '.....SSSSSS.......',
    '.....SssssS.......',
    '.....SSSSSS.......',
    '.....SSSSSS.......',
    '.....SSSSSS.......',
    '.....SssssS.......',
    '.....SSSSSS.......',
    '...KKKKKKKKKK.....',
    '...KBBBBBBBBK.....',
    '..................',
  ],
};

const wand: SpriteData = {
  w: 14, h: 20,
  rows: [
    '..........ss..',
    '.........ss...',
    '........sss...',
    '........sss...',
    '.......sss....',
    '.......sss....',
    '......sss.....',
    '......sss.....',
    '.....sss......',
    '.....sss......',
    '....sss.......',
    '....sss.......',
    '...TTT........',
    '...TTT........',
    '................',
  ],
};

const jugSmall: SpriteData = {
  w: 12, h: 14,
  rows: [
    '............',
    '...ss.......',
    '...ss.......',
    '..WWWWWW....',
    '..WWWWWWs...',
    '..WWWWWWs...',
    '..WWWWWWs...',
    '..WWWWWW....',
    '..WWWWWW....',
    '..WWWWWW....',
    '...WWWW.....',
    '............',
  ],
};

const jugLarge: SpriteData = {
  w: 14, h: 16,
  rows: [
    '..............',
    '....sss.......',
    '....sss.......',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWWs....',
    '..WWWWWWW.....',
    '...WWWWWW.....',
    '..............',
  ],
};

const counter: SpriteData = {
  w: 48, h: 14,
  rows: [
    '................................................',
    '................................................',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '................................................',
  ],
};

const menuBoard: SpriteData = {
  w: 48, h: 32,
  rows: [
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    'bNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCNNNb',
    'bNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNb',
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ],
};

export const EQUIPMENT_SPRITES: Record<string, SpriteData> = {
  machine, grinder, wand, 'jug-small': jugSmall, 'jug-large': jugLarge, counter, 'menu-board': menuBoard,
};
