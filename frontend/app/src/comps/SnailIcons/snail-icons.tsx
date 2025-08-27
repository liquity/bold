import Image from "next/image";

type Rank = 1 | 2 | 3 | 4 | 5 | number;

export const getSnailIcon = ({ type }: { type: Rank }) => {
  switch (type) {
    case 1:
      return <Image src='/cute-snails/red.png' alt='3rd Place' width={24} height={24} />;
    case 2:
      return <Image src='/cute-snails/battle.png' alt='1st Place' width={24} height={24} />;
    case 3:
      return <Image src='/cute-snails/brown.png' alt='2nd Place' width={24} height={24} />;
    case 4:
      return <Image src='/cute-snails/blue.png' alt='4th Place' width={24} height={24} />;
    case 5:
      return <Image src='/cute-snails/tiger.png' alt='5th Place' width={24} height={24} />;
    default:
      return null;
  }
};