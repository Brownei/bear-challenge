import { loadStdlib } from '@reach-sh/stdlib';
import * as backend from './build/index.main.mjs';

// helper function to check if the transaction will pass or fail
const shouldFail = async (fp) => {
  let pass = undefined;
  try {
    await fp();
    pass = true;
  } catch (e) {
    pass = false;
  }
  console.log(`\tshouldFail = ${pass}`);
  if (pass !== false) {
    throw Error(`shouldFail`);
  }
};

// This set the stdlib
const stdlib = loadStdlib();

// This set the stdlib connector for conflux network
const time = stdlib.connector === 'CFX' ? 70 : 20;

// This set the intial test account fro the creator and launches the two tokens
const startingBalance = stdlib.parseCurrency(100);
const accCreator = await stdlib.newTestAccount(startingBalance);
const naira = await stdlib.launchToken(accCreator, "Naira", "NGN");
const cedis = await stdlib.launchToken(accCreator, "Cedis", "GHC");

// This set the testaccounts for the participants Alice and Bob and also 
//check that they optin to the two tokens/asssets
const accAlice = await stdlib.newTestAccount(startingBalance);
const accBob = await stdlib.newTestAccount(startingBalance);
if ( stdlib.connector === 'ETH' || stdlib.connector === 'CFX' ) {
  const myGasLimit = 7000000;
  accAlice.setGasLimit(myGasLimit);
  accBob.setGasLimit(myGasLimit);
} else if ( stdlib.connector == 'ALGO' ) {
  console.log(`Demonstrating need to opt-in on ALGO`);
  await shouldFail(async () => await naira.mint(accAlice, startingBalance));
  console.log(`Opt-ing in on ALGO`);
  await accAlice.tokenAccept(naira.id);
  await accAlice.tokenAccept(cedis.id);
  await accBob.tokenAccept(naira.id);
  await accBob.tokenAccept(cedis.id);
}
// This mints the token
await naira.mint(accAlice, startingBalance.mul(5));
await cedis.mint(accBob, startingBalance.mul(5));

// Opting out and opting in calls for Alice
if ( stdlib.connector == 'ALGO' ) {
  console.log(`Demonstrating opt-out on ALGO`);
  console.log(`\tAlice opts out`);
  await naira.optOut(accAlice);
  console.log(`\tAlice can't receive mint`);
  await shouldFail(async () => await naira.mint(accAlice, startingBalance));
  console.log(`\tAlice re-opts-in`);
  await accAlice.tokenAccept(naira.id);
  console.log(`\tAlice can receive mint`);
  await naira.mint(accAlice, startingBalance);
}

// function to format the currency
const fmt = (x) => stdlib.formatCurrency(x, 4);

// This handles the swap
const doSwap = async (tokenA, amtA, tokenB, amtB, trusted) => {
  console.log(`\nPerforming swap of ${fmt(amtA)} ${tokenA.sym} for ${fmt(amtB)} ${tokenB.sym}`);

  // Helper function to get token balance of the participant
  const getBalance = async (tokenX, who) => {
    const amt = await stdlib.balanceOf(who, tokenX.id);
    return `${fmt(amt)} ${tokenX.sym}`; };

    // Get token balance of the participants
  const getBalances = async (who) =>
    `${await getBalance(tokenA, who)} & ${await getBalance(tokenB, who)}`;

  // Get the intial balance of the participants
  const beforeAlice = await getBalances(accAlice);
  const beforeBob = await getBalances(accBob);
  console.log(`Alice has ${beforeAlice}`);
  console.log(`Bob has ${beforeBob}`);

  // Check if the parties are trusted then execute the transaction,  
  // Alice deploys the contract and Bob attaches to the contract
  if ( trusted ) {
    console.log(`Alice transfers to Bob honestly`);
    await stdlib.transfer(accAlice, accBob, amtA, tokenA.id);
    console.log(`Bob transfers to Alice honestly`);
    await stdlib.transfer(accBob, accAlice, amtB, tokenB.id);
  } else {
    console.log(`Alice will deploy the Reach DApp.`);
    const ctcAlice = accAlice.contract(backend);
    console.log(`Bob attaches to the Reach DApp.`);
    const ctcBob = accBob.contract(backend, ctcAlice.getInfo());

    // Helper function to check who saw timeout and who saw transfer
    let success = undefined;
    const Common = (who) => ({
      seeTimeout: () => {
        success = false;
        console.log(`${who} saw a timeout`); },
      seeTransfer: () => {
        success = true;
        console.log(`${who} saw the transfer happened`); },
    });

    // Interactions with Alice and Bob backend 
    await Promise.all([
      backend.Alice(ctcAlice, {
        ...Common(`Alice`),
        getSwap: () => {
          console.log(`Alice proposes swap`);
          return [ tokenA.id, amtA, tokenB.id, amtB, time ]; },
      }),
      backend.Bob(ctcBob, {
        ...Common(`Bob`),
        acceptSwap: (...tokens) => {
          console.log(`Bob accepts swap of`, tokens);
          return true; },
      }),
    ]);

    return success;
  }

  // Alice and Bob balance after the transaction
  const afterAlice = await getBalances(accAlice);
  const afterBob = await getBalances(accBob);
  console.log(`Alice went from ${beforeAlice} to ${afterAlice}`);
  console.log(`Bob went from ${beforeBob} to ${afterBob}`);
};

// Initial amount set for the swap for 1 tokenA transferred 2
// tokenB is transferred in return. i.e 1:2 swap

const amtA = stdlib.parseCurrency(1);
const amtB = stdlib.parseCurrency(2);

if ( await doSwap(naira, amtA, cedis, amtB, false)
     && await doSwap(cedis, amtB, naira, amtA, false) ) {
  await doSwap(naira, amtA, cedis, amtB, true);
} 
