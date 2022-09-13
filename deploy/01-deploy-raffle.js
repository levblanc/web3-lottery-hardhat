const { network, ethers } = require('hardhat');
const { developmentChains, networkConfig } = require('../helper-hardhat-config');
const { verify } = require('../utils/verify');

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther('30');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const { chainId } = network.config;
  let vrfCoordinatorV2Address, subscriptionId;

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;

    const txResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResponse.wait(1);
    subscriptionId = txReceipt.events[0].args.subId;

    // Fund the subscription
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2;
    subscriptionId = networkConfig[chainId].subscriptionId;
  }

  const { entranceFee, gasLane, callbackGasLimit, interval } = networkConfig[chainId];

  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ];

  const raffle = await deploy('Raffle', {
    from: deployer,
    args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  });

  log('--------------------------------------------------');

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    await verify(raffle.address, args);
  }

  log('--------------------------------------------------');
};

module.exports.tags = ['all', 'raffle'];
