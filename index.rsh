'reach 0.1';
'use strict';

const Common = {
  seeTimeout: Fun([], Null),
  seeTransfer: Fun([], Null),
};

export const main = Reach.App(() => {
  const Alice = Participant('Alice', {
    ...Common,
    getSwap: Fun([], Tuple(Token, UInt, Token, UInt, UInt)),
  });
  const Bob = Participant('Bob', {
    ...Common,
    acceptSwap: Fun([Token, UInt, Token, UInt], Bool),
  });
  init();

  Alice.only(() => {
    const [ tokenA, amtA, tokenB, amtB, time ] = declassify(interact.getSwap());
    assume(tokenA != tokenB); });
  Alice.publish(tokenA, amtA, tokenB, amtB, time);
  commit();
  Alice.pay([ [amtA, tokenA] ]);
  commit();

  Bob.only(() => {
    const bobSwap = declassify(interact.acceptSwap(tokenA, amtA, tokenB, amtB)); });
  Bob.pay([ [amtB, tokenB] ])
    .when(bobSwap)
    .timeout(relativeTime(time), () => {
      Alice.publish();
      transfer(amtA, tokenA).to(Alice);
      each([Alice, Bob], () => interact.seeTimeout());
      commit();
      exit();
    });
  transfer(amtB, tokenB).to(Alice);
  transfer([ [amtA, tokenA] ]).to(Bob);
  each([Alice, Bob], () => interact.seeTransfer());
  commit();

  exit();
}); 