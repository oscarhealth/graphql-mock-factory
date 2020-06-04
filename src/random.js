import { v4 as uuidv4 } from 'uuid';

// borrowed from lorem-ipsum package
export const WORDS = [
  'ad',
  'adipisicing',
  'aliqua',
  'aliquip',
  'amet',
  'anim',
  'aute',
  'cillum',
  'commodo',
  'consectetur',
  'consequat',
  'culpa',
  'cupidatat',
  'deserunt',
  'do',
  'dolor',
  'dolore',
  'duis',
  'ea',
  'eiusmod',
  'elit',
  'enim',
  'esse',
  'est',
  'et',
  'eu',
  'ex',
  'excepteur',
  'exercitation',
  'fugiat',
  'id',
  'in',
  'incididunt',
  'ipsum',
  'irure',
  'labore',
  'laboris',
  'laborum',
  'Lorem',
  'magna',
  'minim',
  'mollit',
  'nisi',
  'non',
  'nostrud',
  'nulla',
  'occaecat',
  'officia',
  'pariatur',
  'proident',
  'qui',
  'quis',
  'reprehenderit',
  'sint',
  'sit',
  'sunt',
  'tempor',
  'ullamco',
  'ut',
  'velit',
  'veniam',
  'voluptate'
];

export function getInt(min, max) {
  return Math.floor(getFloat(min, max + 1));
}

export function getBoolean() {
  return Math.random() > 0.5 ? true : false;
}

export function getFloat(min, max) {
  return Math.random() * (max - min) + min;
}

export function getUUID() {
  const seeds = [];
  for (let i = 0; i < 16; i++) {
    seeds[i] = getInt(0, 255);
  }
  return uuidv4({ random: seeds });
}

export function getString(wordCount = 5) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words[i] = WORDS[getInt(0, WORDS.length - 1)];
  }
  return words.join(' ');
}
