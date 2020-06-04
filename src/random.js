import seedrandom from 'seedrandom';
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

// seed the random number generator so we get consistent results
const rng = seedrandom('graphql!');

export function getInt(min, max) {
  return (Math.abs(rng.int32()) % (max - min + 1)) + min;
}

export function getBoolean() {
  return rng() > 0.5 ? true : false;
}

export function getFloat(min, max) {
  return rng() * (max - min) + min;
}

export function getUUID() {
  const seeds = [];
  for (let i = 0; i < 16; i++) {
    seeds[i] = Math.abs(rng.int32()) % 256;
  }
  return uuidv4({ random: seeds });
}

export function getString(wordCount = 5) {
  const words = [];
  for (let i = 0; i < wordCount; i++) {
    words[i] = WORDS[Math.abs(rng.int32()) % WORDS.length];
  }
  return words.join(' ');
}
