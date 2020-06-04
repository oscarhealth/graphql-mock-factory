import * as random from '../random';
import validate from 'uuid-validate';

describe('random', () => {
  it('Generates random boolean values', () => {
    let hasTrue = false;
    let hasFalse = false;
    for (let i = 0; i < 10; i++) {
      if (random.getBoolean()) {
        hasTrue = true;
      } else {
        hasFalse = true;
      }
    }
    expect(hasTrue).toBeTruthy();
    expect(hasFalse).toBeTruthy();
  });

  it('Generates random int values', () => {
    let hasMinusThree = false;
    let hasPlusThree = false;
    for (let i = 0; i < 50; i++) {
      const rand = random.getInt(-3, 3);
      expect(rand).toBeGreaterThanOrEqual(-3);
      expect(rand).toBeLessThanOrEqual(3);
      if (rand === -3) {
        hasMinusThree = true;
      }
      if (rand === 3) {
        hasPlusThree = true;
      }
    }
    expect(hasMinusThree).toBeTruthy();
    expect(hasPlusThree).toBeTruthy();
  });

  it('Generates random float values', () => {
    let hasMinusThrees = false;
    let hasPlusThrees = false;
    for (let i = 0; i < 50; i++) {
      const rand = random.getFloat(-4, 4);
      expect(rand).toBeGreaterThanOrEqual(-4);
      expect(rand).toBeLessThanOrEqual(4);
      if (rand <= -3) {
        hasMinusThrees = true;
      }
      if (rand >= 3) {
        hasPlusThrees = true;
      }
    }
    expect(hasMinusThrees).toBeTruthy();
    expect(hasPlusThrees).toBeTruthy();
  });

  it('Generates random UUIDs', () => {
    for (let i = 0; i < 10; i++) {
      const uuid = random.getUUID();
      expect(validate(uuid)).toBeTruthy();
      expect(uuid).not.toEqual(random.getUUID());
    }
  });

  it('Generates random strings', () => {
    for (let i = 0; i < 10; i++) {
      const str = random.getString();
      expect(str.length).toBeGreaterThan(5);
      const words = str.split(' ');
      expect(words.length).toEqual(5);
      const set = new Set(words);
      expect(set.size).toBeGreaterThan(1);
    }
  });
});
