const ADJECTIVES = [
  'Lazy', 'Swift', 'Clever', 'Sleepy', 'Cheerful',
  'Sad', 'Brave', 'Quiet', 'Loud', 'Hungry',
  'Fluffy', 'Ginger', 'Wet', 'Wild', 'Energetic',
  'Important', 'Nervous', 'Kind', 'Smart', 'Full',
  'Shaggy', 'Serious', 'Strange', 'Forgetful', 'Proud',
  'Angry', 'Nimble', 'Timid', 'Gloomy', 'Playful',
];

const ANIMALS = [
  'Raccoon', 'Lemur', 'Capybara', 'Penguin', 'Fox',
  'Bear', 'Hamster', 'Rabbit', 'Duck', 'Panda',
  'Moose', 'Hedgehog', 'Otter', 'Seal', 'Crab',
  'Octopus', 'Giraffe', 'Zebra', 'Koala', 'Kangaroo',
  'Badger', 'Skunk', 'Armadillo', 'Tapir', 'Narwhal',
  'Platypus', 'Opossum', 'Manatee', 'Axolotl', 'Quokka',
];

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}
