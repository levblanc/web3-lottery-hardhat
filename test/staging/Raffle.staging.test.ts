import { assert, expect } from 'chai';
import { getNamedAccounts, ethers, network } from 'hardhat';
import { developmentChains } from '../../helper-hardhat-config';
import { Raffle } from '../../typechain-types';
import { BigNumber } from 'ethers';

developmentChains.includes(network.name)
  ? describe.skip
  : describe('Raffle Staging Tests', () => {
      let deployer: string,
        raffle: Raffle,
        raffleEntranceFee: BigNumber,
        winnerStartingBalance: BigNumber;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        raffle = await ethers.getContract('Raffle', deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
      });

      describe('fulfillRandomWords', () => {
        it('Works with live Chainlink Keepers and Chainlink VRF, we get a random winner', async () => {
          const startingTimestamp = await raffle.getLatestTimestamp();
          const accounts = await ethers.getSigners();

          console.log('>>>>>> Setting up listener');
          // Setup listener before entering the raffle
          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('>>>>>> WinnerPicked event fired!');

              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimestamp = await raffle.getLatestTimestamp();

                // check if players array has been reset
                await expect(raffle.getPlayer(0)).to.be.reverted;
                // check winner addrses
                assert.equal(recentWinner.toString(), accounts[0].address);
                // check if raffle state is reset
                assert.equal(raffleState, 0);
                // check if money is sent to winner
                assert(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    // entrance fee for winning player
                    .add(raffleEntranceFee)
                    .toString()
                );
                // check timestamp
                assert(endingTimestamp > startingTimestamp);

                resolve('Success');
              } catch (error) {
                reject(error);
              }
            });

            console.log('>>>>>> Entering Raffle...');
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);

            console.log('>>>>>> Raffle entered. Waiting for winner...');
            winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
