const { assert, expect } = require('chai');
const { getNamedAccounts, deployments, ethers, network } = require('hardhat');
const {
  developmentChains,
  networkConfig,
} = require('../../helper-hardhat-config');

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('Raffle Unit Tests', () => {
      let deployer, raffle, vrfCoordinatorV2Mock, raffleEntranceFee, interval;
      const { chainId } = network.config;

      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;
        await deployments.fixture(['all']);

        raffle = await ethers.getContract('Raffle', deployer);
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();

        vrfCoordinatorV2Mock = await ethers.getContract(
          'VRFCoordinatorV2Mock',
          deployer
        );
      });

      describe('constractor', () => {
        it('Initialize the raffle correctly', async () => {
          // Ideally we make our tests have just 1 assert per 'it'
          const raffleState = await raffle.getRaffleState();

          assert.equal(raffleState.toString(), '0');
          assert.equal(interval.toString(), networkConfig[chainId].interval);
        });
      });

      describe('enterRaffle', () => {
        it("Reverts when you don't pay enough", async () => {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
            raffle,
            'Raffle__NotEnoughETHEntered'
          );
        });

        it('Records players when they enter', async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });

          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer);
        });

        it('Emits event on enter', async () => {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, 'RaffleEnter');
        });

        it("Doesn't allow entrance when raffle is calculating", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.send('evm_mine', []); // mine one block

          // pretend to be a chainlink keeper
          await raffle.performUpkeep([]);

          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWithCustomError(raffle, 'Raffle__NotOpen');
        });
      });

      describe('checkUpkeep', () => {
        it("Returns false if people haven't sent any ETH", async () => {
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.send('evm_mine', []); // mine one block

          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it("Returns false if raffle isn't open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.send('evm_mine', []); // mine one block
          await raffle.performUpkeep([]);

          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]);

          assert.equal(raffleState.toString(), '1');
          assert.equal(upkeepNeeded, false);
        });

        it("Returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() - 1,
          ]);
          await network.provider.request({ method: 'evm_mine', params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep('0x');
          assert(!upkeepNeeded);
        });

        it('Returns true if enough time has passed, has players, eth, and is open', async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: 'evm_mine', params: [] });
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep('0x');
          assert(upkeepNeeded);
        });
      });

      describe('performUpkeep', () => {
        it('Can only run if `upkeepNeeded` is true', async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: 'evm_mine', params: [] });

          const tx = await raffle.performUpkeep([]);
          assert(tx);
        });

        it('Reverts when `upkeepNeeded` is false', async () => {
          await expect(raffle.performUpkeep([])).to.be.revertedWithCustomError(
            raffle,
            'Raffle__UpkeepNotNeeded'
          );
        });

        it('Updates raffle state, emit an event, and calls VRF coordinator', async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: 'evm_mine', params: [] });

          const txResponse = await raffle.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          const { requestId } = txReceipt.events[1].args;
          const raffleState = await raffle.getRaffleState();

          assert(requestId.toNumber() > 0);
          assert(raffleState.toString() === '1');
        });
      });

      describe('fulfillRandomWords', () => {
        beforeEach(async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send('evm_increaseTime', [
            interval.toNumber() + 1,
          ]);
          await network.provider.request({ method: 'evm_mine', params: [] });
        });

        it('Can only be called after `performUpkeep`', async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith('nonexistent request');

          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith('nonexistent request');
        });

        it('Picks a winner, reset lottery, and sends the money', async () => {
          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();

          for (let i = 0; i < startingAccountIndex + additionalEntrants; i++) {
            const accountConnectedRaffle = raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({
              value: raffleEntranceFee,
            });
          }

          const startingTimestamp = await raffle.getLatestTimestamp();

          await new Promise(async (resolve, reject) => {
            raffle.once('WinnerPicked', async () => {
              console.log('>>>>>> Found WinnerPicked event');

              try {
                const recentWinner = await raffle.getRecentWinner();
                console.log('>>>>>> Winner is', recentWinner);
                console.log('>>>>>> accounts[0]', accounts[0].address);
                console.log('>>>>>> accounts[1]', accounts[1].address);
                console.log('>>>>>> accounts[2]', accounts[2].address);
                console.log('>>>>>> accounts[3]', accounts[3].address);

                const raffleState = await raffle.getRaffleState();
                const endingTimestamp = await raffle.getLatestTimestamp();
                const numOfPlayers = await raffle.getNumOfPlayers();

                assert.equal(numOfPlayers.toString(), '0');
                assert.equal(raffleState.toString(), '0');
                assert(endingTimestamp > startingTimestamp);

                const winnerEndingBalance = await accounts[0].getBalance();

                assert(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance
                    // entrance fee for other players
                    .add(raffleEntranceFee.mul(additionalEntrants))
                    // entrance fee for winning player
                    .add(raffleEntranceFee)
                    .toString()
                );
              } catch (error) {
                reject(error);
              }

              resolve();
            });

            const tx = await raffle.performUpkeep([]);
            const txReceipt = await tx.wait(1);

            const winnerStartingBalance = await accounts[0].getBalance();

            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.events[1].args.requestId,
              raffle.address
            );
          });
        });
      });
    });
